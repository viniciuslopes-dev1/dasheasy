import * as XLSX from '@e965/xlsx';
import type { ExcelAnalysis, FinancialBlock, FinancialRecord, ImportIssue } from '../types/financial';
import {
  createDedupeKey,
  formatRawCell,
  normalizeTextKey,
  normalizeWhitespace,
  parseCurrencyToCents,
  parseExcelDate,
} from '../utils/normalizeExcelData';

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

type SheetRow = unknown[];

function isInternalHeader(row: SheetRow): boolean {
  return (
    normalizeTextKey(row[0]).includes('DOCUMENTO') &&
    normalizeTextKey(row[1]).includes('RAZAO SOCIAL') &&
    normalizeTextKey(row[2]).includes('DATA VENCIMENTO') &&
    normalizeTextKey(row[3]).includes('VALOR TOTAL') &&
    normalizeTextKey(row[4]).includes('NOME GRUPO')
  );
}

function isTotalRow(row: SheetRow): boolean {
  return normalizeTextKey(row[0]) === 'TOTAL';
}

function hasAnyValue(row: SheetRow): boolean {
  return row.some((cell) => normalizeWhitespace(cell) !== '');
}

function rowValue(row: SheetRow, index: number): string {
  return normalizeWhitespace(row[index]);
}

function buildRecord(
  detailRow: SheetRow,
  sourceRow: number,
  summaryRow: SheetRow,
): { record: FinancialRecord | null; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const amountCents = parseCurrencyToCents(detailRow[3]);
  const dueDate = parseExcelDate(detailRow[2]);

  if (amountCents === null) {
    issues.push({
      type: 'invalid_amount',
      row: sourceRow,
      severity: 'error',
      message: `Valor financeiro inválido na linha ${sourceRow}.`,
      context: { value: detailRow[3] },
    });
  }

  if (normalizeWhitespace(detailRow[2]) && dueDate === null) {
    issues.push({
      type: 'invalid_date',
      row: sourceRow,
      severity: 'warning',
      message: `Data inválida na linha ${sourceRow}.`,
      context: { value: detailRow[2] },
    });
  }

  const required = [detailRow[0], detailRow[1], detailRow[3], detailRow[4]];
  if (required.some((value) => normalizeWhitespace(value) === '')) {
    issues.push({
      type: 'incomplete_detail_row',
      row: sourceRow,
      severity: 'error',
      message: `Linha ${sourceRow} possui campos obrigatórios vazios.`,
    });
  }

  if (amountCents === null || issues.some((issue) => issue.severity === 'error')) {
    return { record: null, issues };
  }

  const recordWithoutDedupe = {
    sourceRow,
    groupName: rowValue(summaryRow, 0),
    groupKey: normalizeTextKey(summaryRow[0]),
    departmentName: rowValue(summaryRow, 1),
    departmentKey: normalizeTextKey(summaryRow[1]),
    classificationName: rowValue(summaryRow, 2),
    classificationKey: normalizeTextKey(summaryRow[2]),
    financialType: rowValue(summaryRow, 3),
    financialTypeKey: normalizeTextKey(summaryRow[3]),
    documentNumber: rowValue(detailRow, 0),
    personName: rowValue(detailRow, 1),
    personKey: normalizeTextKey(detailRow[1]),
    dueDate,
    amountCents,
    detailGroupName: rowValue(detailRow, 4),
    detailGroupKey: normalizeTextKey(detailRow[4]),
    rawData: {
      documentNumber: formatRawCell(detailRow[0]),
      personName: formatRawCell(detailRow[1]),
      dueDate: formatRawCell(detailRow[2]),
      amount: formatRawCell(detailRow[3]),
      detailGroupName: formatRawCell(detailRow[4]),
    },
  };

  return {
    record: {
      ...recordWithoutDedupe,
      dedupeKey: createDedupeKey(recordWithoutDedupe),
    },
    issues,
  };
}

export function analyzeWorkbookRows(rows: SheetRow[], sheetName: string): ExcelAnalysis {
  const issues: ImportIssue[] = [];
  const blocks: FinancialBlock[] = [];
  const records: FinancialRecord[] = [];
  const headerIndexes = rows
    .map((row, index) => (isInternalHeader(row) ? index : -1))
    .filter((index) => index >= 0);

  if (headerIndexes.length === 0) {
    return {
      sheetName,
      blockCount: 0,
      recordCount: 0,
      totalAmountCents: 0,
      declaredTotalAmountCents: 0,
      blocks: [],
      records: [],
      previewRows: [],
      issues: [
        {
          type: 'missing_internal_headers',
          severity: 'error',
          message: 'Nenhum cabeçalho interno de lançamentos foi encontrado na aba.',
        },
      ],
    };
  }

  headerIndexes.forEach((headerIndex, blockPosition) => {
    const summaryIndex = headerIndex - 2;
    const labelIndex = headerIndex - 1;
    const summaryRow = rows[summaryIndex] ?? [];
    const groupLabel = rowValue(rows[labelIndex] ?? [], 0);
    const nextHeaderIndex = headerIndexes[blockPosition + 1] ?? rows.length;
    const totalIndex = rows.findIndex((row, index) => index > headerIndex && index < nextHeaderIndex && isTotalRow(row));
    const detailEndIndex = totalIndex >= 0 ? totalIndex : nextHeaderIndex - 2;
    const blockRecords: FinancialRecord[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < detailEndIndex; rowIndex += 1) {
      const detailRow = rows[rowIndex] ?? [];
      if (!hasAnyValue(detailRow)) {
        continue;
      }

      const { record, issues: recordIssues } = buildRecord(detailRow, rowIndex + 1, summaryRow);
      issues.push(...recordIssues);
      if (record) {
        blockRecords.push(record);
        records.push(record);

        const groupKey = normalizeTextKey(record.groupName);
        const detailGroupKey = normalizeTextKey(record.detailGroupName);
        const labelKey = normalizeTextKey(groupLabel).replace(/^GRUPO\s+/, '');
        const matchesGroup =
          groupKey.includes(detailGroupKey) ||
          detailGroupKey.includes(groupKey) ||
          labelKey.includes(detailGroupKey) ||
          detailGroupKey.includes(labelKey);

        if (detailGroupKey && !matchesGroup) {
          issues.push({
            type: 'group_detail_mismatch',
            row: rowIndex + 1,
            blockIndex: blockPosition + 1,
            severity: 'info',
            message: 'Nome Grupo do detalhe difere da natureza do bloco.',
            context: {
              groupName: record.groupName,
              detailGroupName: record.detailGroupName,
            },
          });
        }
      }
    }

    const declaredTotalCents = parseCurrencyToCents(summaryRow[4]);
    const totalRowCents = totalIndex >= 0 ? parseCurrencyToCents(rows[totalIndex]?.[3]) : null;
    const detailTotalCents = blockRecords.reduce((sum, record) => sum + record.amountCents, 0);
    if (declaredTotalCents !== null && Math.abs(declaredTotalCents - detailTotalCents) > 1) {
      issues.push({
        type: 'block_total_mismatch',
        blockIndex: blockPosition + 1,
        row: totalIndex >= 0 ? totalIndex + 1 : summaryIndex + 1,
        severity: 'warning',
        message: 'Total declarado do bloco não bate com a soma dos lançamentos.',
        context: { declaredTotalCents, detailTotalCents },
      });
    }
    if (totalRowCents !== null && Math.abs(totalRowCents - detailTotalCents) > 1) {
      issues.push({
        type: 'block_total_mismatch',
        blockIndex: blockPosition + 1,
        row: totalIndex + 1,
        severity: 'warning',
        message: 'Linha TOTAL do bloco não bate com a soma dos lançamentos.',
        context: { declaredTotalCents: totalRowCents, detailTotalCents },
      });
    }

    blocks.push({
      index: blockPosition + 1,
      summaryRow: summaryIndex + 1,
      labelRow: labelIndex + 1,
      headerRow: headerIndex + 1,
      groupName: rowValue(summaryRow, 0),
      departmentName: rowValue(summaryRow, 1),
      classificationName: rowValue(summaryRow, 2),
      financialType: rowValue(summaryRow, 3),
      declaredTotalCents,
      detailTotalCents,
      recordCount: blockRecords.length,
      groupLabel,
    });
  });

  const duplicateCounter = new Map<string, number>();
  records.forEach((record) => {
    duplicateCounter.set(record.dedupeKey, (duplicateCounter.get(record.dedupeKey) ?? 0) + 1);
  });
  duplicateCounter.forEach((count, dedupeKey) => {
    if (count > 1) {
      issues.push({
        type: 'duplicate_record',
        severity: 'warning',
        message: 'Registro duplicado detectado dentro da aba.',
        context: { dedupeKey, duplicateCount: count },
      });
    }
  });

  return {
    sheetName,
    blockCount: blocks.length,
    recordCount: records.length,
    totalAmountCents: records.reduce((sum, record) => sum + record.amountCents, 0),
    declaredTotalAmountCents: blocks.reduce((sum, block) => sum + (block.declaredTotalCents ?? 0), 0),
    blocks,
    records,
    issues,
    previewRows: records.slice(0, 10),
  };
}

export function validateExcelFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls'].includes(extension)) {
    return 'Envie um arquivo .xlsx ou .xls.';
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'O arquivo excede o limite de 8 MB.';
  }

  return null;
}

export async function analyzeExcelFile(file: File): Promise<ExcelAnalysis[]> {
  const validationError = validateExcelFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    return analyzeWorkbookRows(rows, sheetName);
  });
}
