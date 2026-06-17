import * as XLSX from '@e965/xlsx';
import type {
  BankAccount,
  CashFlowDailyEntry,
  CashFlowDataset,
  CashFlowImportIssue,
  CashFlowImportResult,
  CashFlowMovement,
  CashFlowTransactionType,
} from '../types/cashFlow';
import { normalizeTextKey, normalizeWhitespace, parseCurrencyToCents, parseExcelDate } from '../utils/normalizeExcelData';

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
type SheetRow = unknown[];

export function validateCashFlowExcelFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls'].includes(extension)) {
    return 'Envie um arquivo .xlsx ou .xls.';
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'O arquivo excede o limite de 8 MB.';
  }

  return null;
}

export async function analyzeCashFlowExcelFile(file: File): Promise<CashFlowImportResult> {
  const validationError = validateCashFlowExcelFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return analyzeCashFlowWorkbook(workbook, file.name);
}

export function analyzeCashFlowWorkbook(workbook: XLSX.WorkBook, fileName = 'planilha.xlsx'): CashFlowImportResult {
  const sheetNames = workbook.SheetNames;
  const issues: CashFlowImportIssue[] = [];
  const flowSheetName = findSheetName(sheetNames, 'FLUXO DE CAIXA');
  const debitSheetName = findSheetName(sheetNames, 'DEBITO');
  const creditSheetName = findSheetName(sheetNames, 'CREDITO');

  if (!flowSheetName) {
    throw new Error('A aba FLUXO DE CAIXA nao foi encontrada.');
  }

  const flowRows = getSheetRows(workbook, flowSheetName);
  const flow = parseFlowSheet(flowRows, flowSheetName, issues);
  const debitMovements = debitSheetName ? parseMovementSheet(getSheetRows(workbook, debitSheetName), debitSheetName, 'DEBITO', issues) : [];
  const creditMovements = creditSheetName ? parseMovementSheet(getSheetRows(workbook, creditSheetName), creditSheetName, 'CREDITO', issues) : [];
  const ignoredSheetNames = sheetNames.filter(
    (sheetName) => ![flowSheetName, debitSheetName, creditSheetName].filter(Boolean).includes(sheetName),
  );

  ignoredSheetNames.forEach((sheetName) => {
    issues.push({
      type: 'ignored_sheet',
      severity: 'warning',
      sheetName,
      message: `A aba ${sheetName} nao foi importada automaticamente para evitar duplicidade.`,
    });
  });

  const movements = [...debitMovements, ...creditMovements].sort((a, b) => a.date.localeCompare(b.date));
  const lastDailyEntry = flow.dailyEntries[flow.dailyEntries.length - 1];
  const finalForecastCents = lastDailyEntry?.projectedBalanceCents ?? flow.initialBalanceCents;
  const dataset: CashFlowDataset = {
    monthLabel: buildMonthLabel(flow.dailyEntries[0]?.date ?? new Date().toISOString().slice(0, 10)),
    startDate: flow.dailyEntries[0]?.date ?? new Date().toISOString().slice(0, 10),
    endDate: lastDailyEntry?.date ?? flow.dailyEntries[0]?.date ?? new Date().toISOString().slice(0, 10),
    initialForecastClosingCents: finalForecastCents,
    sourceFileName: fileName,
    importedAt: new Date().toISOString(),
    bankAccounts: flow.bankAccounts,
    dailyEntries: flow.dailyEntries,
    movements,
    changes: [],
    snapshots: [
      {
        id: 'snapshot-imported-baseline',
        snapshotDate: flow.dailyEntries[0]?.date ?? new Date().toISOString().slice(0, 10),
        closingForecastCents: finalForecastCents,
      },
    ],
    issues,
  };

  return {
    dataset,
    summary: {
      fileName,
      sheetNames,
      bankAccountCount: flow.bankAccounts.length,
      dailyEntryCount: flow.dailyEntries.length,
      debitMovementCount: debitMovements.length,
      creditMovementCount: creditMovements.length,
      ignoredSheetNames,
      issues,
    },
  };
}

function findSheetName(sheetNames: string[], target: string): string | undefined {
  const targetKey = normalizeTextKey(target);
  return sheetNames.find((sheetName) => normalizeTextKey(sheetName) === targetKey);
}

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function parseFlowSheet(rows: SheetRow[], sheetName: string, issues: CashFlowImportIssue[]) {
  const saldoInicialIndex = rows.findIndex((row) => normalizeTextKey(row[0]) === 'SALDO INICIAL');
  const dataHeaderIndex = rows.findIndex((row) => normalizeTextKey(row[0]) === 'DATA');

  if (saldoInicialIndex < 0 || dataHeaderIndex < 0) {
    throw new Error('A aba FLUXO DE CAIXA nao possui SALDO INICIAL ou cabecalho DATA.');
  }

  const bankRows = rows.slice(2, saldoInicialIndex);
  const bankAccounts = bankRows
    .map((row, index) => parseBankAccount(row, index + 3))
    .filter((account): account is BankAccount => Boolean(account));

  const dailyEntries = rows
    .slice(dataHeaderIndex + 1)
    .map((row, index) => parseDailyEntry(row, dataHeaderIndex + index + 2, sheetName, issues))
    .filter((entry): entry is CashFlowDailyEntry => Boolean(entry));

  if (bankAccounts.length === 0) {
    issues.push({
      type: 'missing_bank_accounts',
      severity: 'warning',
      sheetName,
      message: 'Nenhuma conta bancaria foi identificada na parte superior do fluxo.',
    });
  }

  if (dailyEntries.length === 0) {
    throw new Error('Nenhum dia de fluxo foi encontrado na aba FLUXO DE CAIXA.');
  }

  return {
    bankAccounts,
    dailyEntries,
    initialBalanceCents: parseCurrencyToCents(rows[saldoInicialIndex]?.[5]) ?? 0,
  };
}

function parseBankAccount(row: SheetRow, sourceRow: number): BankAccount | null {
  const code = normalizeWhitespace(row[0]);
  const description = normalizeWhitespace(row[1]);
  if (!code && !description) {
    return null;
  }

  const debitCents = parseCurrencyToCents(row[2]);
  const creditCents = parseCurrencyToCents(row[4]);
  const balanceCents = creditCents ?? debitCents ?? 0;
  const includeInCash = !normalizeTextKey(description).includes('GARANTIDA');

  return {
    id: `account-${sourceRow}-${normalizeTextKey(code || description).toLowerCase().replace(/\s+/g, '-')}`,
    code,
    bank: description.split('-')[0]?.trim() || description,
    description,
    balanceCents,
    includeInCash,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

function parseDailyEntry(
  row: SheetRow,
  sourceRow: number,
  sheetName: string,
  issues: CashFlowImportIssue[],
): CashFlowDailyEntry | null {
  const firstCellKey = normalizeTextKey(row[0]);
  if (firstCellKey.includes('TOTAL') || firstCellKey.includes('SALDO')) {
    return null;
  }

  const date = parseExcelDate(row[0]);
  if (!date) {
    if (row.some((cell) => normalizeWhitespace(cell))) {
      issues.push({
        type: 'invalid_flow_date',
        severity: 'warning',
        sheetName,
        row: sourceRow,
        message: `Linha ${sourceRow} ignorada no fluxo: data invalida.`,
      });
    }
    return null;
  }

  return {
    date,
    debitCents: parseCurrencyToCents(row[2]) ?? 0,
    creditCents: parseCurrencyToCents(row[4]) ?? 0,
    projectedBalanceCents: parseCurrencyToCents(row[5]) ?? undefined,
  };
}

function parseMovementSheet(
  rows: SheetRow[],
  sheetName: string,
  type: CashFlowTransactionType,
  issues: CashFlowImportIssue[],
): CashFlowMovement[] {
  return rows.slice(1).flatMap((row, index) => {
    const sourceRow = index + 2;
    const documentNumber = normalizeWhitespace(row[0]);
    const date = parseExcelDate(row[1]);
    const counterparty = normalizeWhitespace(row[2]);
    const valueCents = parseCurrencyToCents(row[3]);
    const isSubtotal = !documentNumber && !date && !counterparty && valueCents !== null;

    if (isSubtotal || (!documentNumber && !counterparty && valueCents === null)) {
      return [];
    }

    if (!documentNumber || !date || !counterparty || valueCents === null) {
      issues.push({
        type: 'invalid_movement_row',
        severity: 'warning',
        sheetName,
        row: sourceRow,
        message: `Linha ${sourceRow} da aba ${sheetName} ignorada por campos incompletos.`,
      });
      return [];
    }

    return [
      {
        id: `${type.toLowerCase()}-${sourceRow}-${normalizeTextKey(documentNumber).toLowerCase().replace(/\s+/g, '-')}`,
        date,
        documentNumber,
        counterparty,
        type,
        category: type === 'DEBITO' ? 'A pagar' : 'A receber',
        valueCents,
        status: 'PREVISTO',
        origin: 'IMPORTACAO_INICIAL',
      },
    ];
  });
}

function buildMonthLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(parsed);
  return `${capitalize(month)} de ${parsed.getUTCFullYear()}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
