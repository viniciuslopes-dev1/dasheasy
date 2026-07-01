import * as XLSX from '@e965/xlsx';
import type {
  CashFlowReportBankAccount,
  CashFlowReportDataset,
  CashFlowReportImportResult,
  CashFlowReportIssue,
  CashFlowReportMovement,
  CashFlowReportTransactionType,
  CashFlowReportVariation,
} from '../types/cashFlowReport';
import { getMovementSignedImpact } from './cashFlowReportService';
import { normalizeTextKey, normalizeWhitespace, parseCurrencyToCents, parseExcelDate } from '../utils/normalizeExcelData';

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const REQUIRED_COLUMNS = {
  documentNumber: ['N DOCUMENTO', 'NO DOCUMENTO', 'NUMERO DOCUMENTO', 'DOCUMENTO'],
  transactionType: ['DEBITO CREDITO', 'DEBITO OU CREDITO', 'TIPO'],
  accountName: ['RAZAO SOCIAL', 'CONTA', 'NOME DA CONTA', 'CLIENTE FORNECEDOR'],
  isSettled: ['BAIXADO'],
  isForecast: ['PREVISAO'],
  dueDate: ['DATA VENCIMENTO', 'VENCIMENTO', 'DATA'],
  valueCents: ['VALOR TOTAL', 'VALOR'],
} as const;

const DETAIL_COLUMNS = {
  documentNumber: REQUIRED_COLUMNS.documentNumber,
  dueDate: REQUIRED_COLUMNS.dueDate,
  accountName: REQUIRED_COLUMNS.accountName,
  valueCents: REQUIRED_COLUMNS.valueCents,
} as const;

type SheetRow = unknown[];
type ColumnKey = keyof typeof REQUIRED_COLUMNS;
type ColumnMap = Record<ColumnKey, number>;
type DetailColumnKey = keyof typeof DETAIL_COLUMNS;
type DetailColumnMap = Record<DetailColumnKey, number>;

export function validateCashFlowReportExcelFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['xlsx', 'xls'].includes(extension)) {
    return 'Envie um arquivo .xlsx ou .xls.';
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'O arquivo excede o limite de 8 MB.';
  }

  return null;
}

export async function analyzeCashFlowReportExcelFile(
  file: File,
  previousDataset?: CashFlowReportDataset | null,
): Promise<CashFlowReportImportResult> {
  const validationError = validateCashFlowReportExcelFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return analyzeCashFlowReportWorkbook(workbook, file.name, previousDataset);
}

export function analyzeCashFlowReportWorkbook(
  workbook: XLSX.WorkBook,
  fileName = 'fluxo-de-caixa.xlsx',
  previousDataset?: CashFlowReportDataset | null,
): CashFlowReportImportResult {
  if (workbook.SheetNames.length === 0) {
    throw new Error('A planilha não possui abas para importar.');
  }

  const issues: CashFlowReportIssue[] = [];
  const standardSheet = findStandardSheet(workbook);
  const sheetName = standardSheet?.sheetName ?? findFirstMovementSheetName(workbook) ?? workbook.SheetNames[0];
  const movements = standardSheet
    ? standardSheet.rows
        .slice(standardSheet.headerIndex + 1)
        .flatMap((row, index) =>
          parseMovement(row, standardSheet.headerIndex + index + 2, standardSheet.sheetName, standardSheet.columnMap, issues),
        )
    : parseSeparatedMovementSheets(workbook, issues);

  if (movements.length === 0) {
    throw new Error('Nenhum lançamento valido foi encontrado na planilha de fluxo de caixa.');
  }

  const importedBankAccounts = parseBankAccounts(workbook);
  const bankAccounts =
    importedBankAccounts.length > 0
      ? mergeImportedBankAccounts(importedBankAccounts, previousDataset?.bankAccounts ?? [])
      : previousDataset?.bankAccounts ?? [];
  const initialBalanceCents = bankAccounts.length > 0 ? calculateBankInitialBalance(bankAccounts) : 0;
  const accumulatedMovements = previousDataset ? mergeMovements(previousDataset.movements, movements) : movements;
  const startDate = accumulatedMovements.reduce(
    (min, movement) => (movement.dueDate < min ? movement.dueDate : min),
    accumulatedMovements[0].dueDate,
  );
  const endDate = accumulatedMovements.reduce(
    (max, movement) => (movement.dueDate > max ? movement.dueDate : max),
    accumulatedMovements[0].dueDate,
  );
  const anticipatedMovements = accumulatedMovements.filter((movement) => movement.isAnticipated);
  const cashFlowMovements = accumulatedMovements.filter((movement) => !movement.excludedFromCashFlow);
  const dailyRows = buildDailyRows(startDate, endDate, cashFlowMovements, anticipatedMovements, initialBalanceCents);
  const newVariations = previousDataset ? buildVariations(previousDataset.movements, movements) : [];
  const variations = [...(previousDataset?.variations ?? []), ...newVariations];
  const duplicateDocumentCount = countDuplicateDocuments(movements);

  if (duplicateDocumentCount > 0) {
    issues.push({
      type: 'duplicate_document_numbers',
      severity: 'info',
      sheetName,
      message: `${duplicateDocumentCount} documentos aparecem mais de uma vez. A comparação usa documento, razão social e tipo para evitar falsos duplicados.`,
    });
  }

  if (anticipatedMovements.length > 0) {
    issues.push({
      type: 'anticipated_credits',
      severity: 'info',
      sheetName,
      message: `${anticipatedMovements.length} créditos baixados foram classificados como Antecipados e não entram no fluxo de caixa.`,
    });
  }

  const dataset: CashFlowReportDataset = {
    sourceFileName: fileName,
    importedAt: new Date().toISOString(),
    sheetName,
    monthLabel: buildPeriodLabel(startDate, endDate),
    startDate,
    endDate,
    initialBalanceCents,
    initialBalanceSource: bankAccounts.length > 0 ? 'spreadsheet' : 'not_informed',
    bankAccounts,
    movements: accumulatedMovements,
    cashFlowMovements,
    anticipatedMovements,
    dailyRows,
    variations,
    issues,
  };

  return {
    dataset,
    summary: {
      fileName,
      sheetNames: workbook.SheetNames,
      sheetName,
      movementCount: accumulatedMovements.length,
      cashFlowMovementCount: cashFlowMovements.length,
      debitMovementCount: accumulatedMovements.filter((movement) => movement.transactionType === 'DEBITO').length,
      creditMovementCount: accumulatedMovements.filter((movement) => movement.transactionType === 'CREDITO').length,
      anticipatedCount: anticipatedMovements.length,
      bankAccountCount: bankAccounts.length,
      dailyRowCount: dailyRows.length,
      variationCount: variations.length,
      duplicateDocumentCount,
      issues,
    },
  };
}

function findStandardSheet(workbook: XLSX.WorkBook) {
  for (const sheetName of workbook.SheetNames) {
    const rows = getSheetRows(workbook, sheetName);
    const headerIndex = rows.findIndex((row) => findColumnMap(row) !== null);
    if (headerIndex >= 0) {
      const columnMap = findColumnMap(rows[headerIndex]);
      if (columnMap) {
        return { sheetName, rows, headerIndex, columnMap };
      }
    }
  }

  return null;
}

function findFirstMovementSheetName(workbook: XLSX.WorkBook): string | null {
  return workbook.SheetNames.find((sheetName) => isDebitSheet(sheetName) || isCreditSheet(sheetName)) ?? null;
}

function mergeMovements(
  previousMovements: CashFlowReportMovement[],
  importedMovements: CashFlowReportMovement[],
): CashFlowReportMovement[] {
  const importedByKey = groupComparableMovements(importedMovements);
  const usedImportedIds = new Set<string>();
  const merged = previousMovements.map((previousMovement) => {
    const replacement = importedByKey
      .get(createComparableKey(previousMovement))
      ?.find((candidate) => !usedImportedIds.has(candidate.id));

    if (!replacement) {
      return previousMovement;
    }

    usedImportedIds.add(replacement.id);
    return {
      ...replacement,
      id: previousMovement.id,
      rawData: {
        ...replacement.rawData,
        previousDueDate: previousMovement.dueDate,
        previousValueCents: previousMovement.valueCents,
        lastMergedFromImport: replacement.rawData,
      },
    };
  });

  importedMovements.forEach((movement) => {
    if (!usedImportedIds.has(movement.id)) {
      merged.push(movement);
    }
  });

  return merged.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.documentNumber.localeCompare(b.documentNumber));
}

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

function findColumnMap(row: SheetRow): ColumnMap | null {
  const normalizedHeaders = row.map((cell) => normalizeTextKey(cell));
  const entries = Object.entries(REQUIRED_COLUMNS).map(([key, candidates]) => {
    const index = normalizedHeaders.findIndex((header) => candidates.includes(header as never));
    return [key, index] as const;
  });

  if (entries.some(([, index]) => index < 0)) {
    return null;
  }

  return Object.fromEntries(entries) as ColumnMap;
}

function findDetailColumnMap(row: SheetRow): DetailColumnMap | null {
  const normalizedHeaders = row.map((cell) => normalizeTextKey(cell));
  const entries = Object.entries(DETAIL_COLUMNS).map(([key, candidates]) => {
    const index = normalizedHeaders.findIndex((header) => candidates.includes(header as never));
    return [key, index] as const;
  });

  if (entries.some(([, index]) => index < 0)) {
    return null;
  }

  return Object.fromEntries(entries) as DetailColumnMap;
}

function parseSeparatedMovementSheets(workbook: XLSX.WorkBook, issues: CashFlowReportIssue[]): CashFlowReportMovement[] {
  return workbook.SheetNames.flatMap((sheetName) => {
    const transactionType = isDebitSheet(sheetName) ? 'DEBITO' : isCreditSheet(sheetName) ? 'CREDITO' : null;
    if (!transactionType) {
      return [];
    }

    const rows = getSheetRows(workbook, sheetName);
    const headerIndex = rows.findIndex((row) => findDetailColumnMap(row) !== null);
    const columnMap = headerIndex >= 0 ? findDetailColumnMap(rows[headerIndex]) : null;
    if (!columnMap) {
      return [];
    }

    return rows
      .slice(headerIndex + 1)
      .flatMap((row, index) =>
        parseSeparatedMovement(row, headerIndex + index + 2, sheetName, columnMap, transactionType, issues),
      );
  });
}

function parseSeparatedMovement(
  row: SheetRow,
  sourceRow: number,
  sheetName: string,
  columnMap: DetailColumnMap,
  transactionType: CashFlowReportTransactionType,
  issues: CashFlowReportIssue[],
): CashFlowReportMovement[] {
  if (row.every((cell) => !normalizeWhitespace(cell))) {
    return [];
  }

  const documentNumber = normalizeWhitespace(row[columnMap.documentNumber]);
  const accountName = normalizeWhitespace(row[columnMap.accountName]);
  const dueDate = parseReportDate(row[columnMap.dueDate]);
  const valueCents = parseCurrencyToCents(row[columnMap.valueCents]);

  if (!documentNumber && !accountName && !dueDate && valueCents !== null) {
    return [];
  }

  if (!documentNumber || !accountName || !dueDate || valueCents === null) {
    issues.push({
      type: 'invalid_cash_flow_row',
      severity: 'warning',
      sheetName,
      row: sourceRow,
      message: `Linha ${sourceRow} ignorada por documento, conta, data ou valor inválido.`,
    });
    return [];
  }

  return [
    {
      id: createMovementId(sourceRow, documentNumber, accountName, transactionType),
      sourceRow,
      documentNumber,
      transactionType,
      accountName,
      isSettled: false,
      isForecast: true,
      dueDate,
      valueCents,
      isAnticipated: false,
      excludedFromCashFlow: false,
      rawData: {
        documentNumber,
        accountName,
        dueDate: row[columnMap.dueDate],
        value: row[columnMap.valueCents],
        sourceSheet: sheetName,
      },
    },
  ];
}

function parseMovement(
  row: SheetRow,
  sourceRow: number,
  sheetName: string,
  columnMap: ColumnMap,
  issues: CashFlowReportIssue[],
): CashFlowReportMovement[] {
  if (row.every((cell) => !normalizeWhitespace(cell))) {
    return [];
  }

  const documentNumber = normalizeWhitespace(row[columnMap.documentNumber]);
  const transactionType = parseTransactionType(row[columnMap.transactionType]);
  const accountName = normalizeWhitespace(row[columnMap.accountName]);
  const isSettled = parseBoolean(row[columnMap.isSettled]);
  const isForecast = parseBoolean(row[columnMap.isForecast]);
  const dueDate = parseReportDate(row[columnMap.dueDate]);
  const valueCents = parseCurrencyToCents(row[columnMap.valueCents]);

  if (!documentNumber || !transactionType || !accountName || !dueDate || valueCents === null) {
    issues.push({
      type: 'invalid_cash_flow_row',
      severity: 'warning',
      sheetName,
      row: sourceRow,
      message: `Linha ${sourceRow} ignorada por documento, tipo, conta, data ou valor inválido.`,
    });
    return [];
  }

  const isAnticipated = transactionType === 'CREDITO' && isSettled;

  return [
    {
      id: createMovementId(sourceRow, documentNumber, accountName, transactionType),
      sourceRow,
      documentNumber,
      transactionType,
      accountName,
      isSettled,
      isForecast,
      dueDate,
      valueCents,
      isAnticipated,
      excludedFromCashFlow: isAnticipated,
      rawData: {
        documentNumber,
        transactionType: row[columnMap.transactionType],
        accountName,
        isSettled: row[columnMap.isSettled],
        isForecast: row[columnMap.isForecast],
        dueDate: row[columnMap.dueDate],
        value: row[columnMap.valueCents],
      },
    },
  ];
}

function parseBankAccounts(workbook: XLSX.WorkBook): CashFlowReportBankAccount[] {
  for (const sheetName of workbook.SheetNames) {
    const rows = getSheetRows(workbook, sheetName);
    const headerIndex = rows.findIndex((row) => {
      const normalized = row.map((cell) => normalizeTextKey(cell));
      return normalized.includes('BANCO') && normalized.includes('SALDO');
    });

    if (headerIndex < 0) {
      continue;
    }

    const header = rows[headerIndex].map((cell) => normalizeTextKey(cell));
    const codeIndex = header.findIndex((cell) => ['CODIGO', 'COD'].includes(cell));
    const accountIndex = header.findIndex((cell) => cell === 'BANCO');
    const debitIndex = header.findIndex((cell) => cell === 'DEBITO');
    const creditIndex = header.findIndex((cell) => cell === 'CREDITO');
    const runningBalanceIndex = header.findIndex((cell) => cell === 'SALDO');

    if (accountIndex < 0) {
      continue;
    }

    const accounts: CashFlowReportBankAccount[] = [];
    for (const [offset, row] of rows.slice(headerIndex + 1).entries()) {
      const firstCell = normalizeTextKey(row[0]);
      if (firstCell.startsWith('SALDO INICIAL') || firstCell === 'DATA') {
        break;
      }

      const accountLabel = normalizeWhitespace(row[accountIndex]);
      if (!accountLabel) {
        continue;
      }

      const code = codeIndex >= 0 ? normalizeWhitespace(row[codeIndex]) : String(offset + 1).padStart(2, '0');
      const debitCents = debitIndex >= 0 ? parseCurrencyToCents(row[debitIndex]) : null;
      const creditCents = creditIndex >= 0 ? parseCurrencyToCents(row[creditIndex]) : null;
      const balanceCents = creditCents !== null && creditCents !== 0 ? creditCents : debitCents ?? 0;
      const runningBalanceCents = runningBalanceIndex >= 0 ? parseCurrencyToCents(row[runningBalanceIndex]) : null;
      const isGuaranteed = normalizeTextKey(accountLabel).includes('GARANTIDA');

      accounts.push({
        id: createBankAccountId(code, accountLabel),
        code,
        bankName: parseBankName(accountLabel),
        accountLabel,
        debitCents,
        creditCents,
        balanceCents,
        runningBalanceCents,
        isGuaranteed,
        includeInCashFlow: !isGuaranteed,
      });
    }

    if (accounts.length > 0) {
      return accounts;
    }
  }

  return [];
}

function mergeImportedBankAccounts(
  importedAccounts: CashFlowReportBankAccount[],
  previousAccounts: CashFlowReportBankAccount[],
): CashFlowReportBankAccount[] {
  if (previousAccounts.length === 0) {
    return importedAccounts;
  }

  const previousById = new Map(previousAccounts.map((account) => [account.id, account]));
  const importedIds = new Set(importedAccounts.map((account) => account.id));
  const importedWithSavedFlags = importedAccounts.map((account) => {
    const previous = previousById.get(account.id);
    if (!previous) {
      return account;
    }

    return {
      ...account,
      isGuaranteed: previous.isGuaranteed,
      includeInCashFlow: previous.isGuaranteed ? false : previous.includeInCashFlow,
    };
  });
  const manualAccounts = previousAccounts.filter(
    (account) => account.id.startsWith('manual-bank-') && !importedIds.has(account.id),
  );

  return [...importedWithSavedFlags, ...manualAccounts];
}

function calculateBankInitialBalance(accounts: CashFlowReportBankAccount[]): number {
  return accounts.reduce((sum, account) => (account.includeInCashFlow ? sum + account.balanceCents : sum), 0);
}

function parseBankName(accountLabel: string): string {
  return normalizeWhitespace(accountLabel.split('-')[0]) || accountLabel;
}

function createBankAccountId(code: string, accountLabel: string): string {
  return normalizeTextKey(`${code}-${accountLabel}`).toLowerCase().replace(/\s+/g, '-');
}

function parseTransactionType(value: unknown): CashFlowReportTransactionType | null {
  const key = normalizeTextKey(value);
  if (key.startsWith('DEB')) {
    return 'DEBITO';
  }
  if (key.startsWith('CRED')) {
    return 'CREDITO';
  }
  return null;
}

function isDebitSheet(sheetName: string): boolean {
  return normalizeTextKey(sheetName).includes('DEBITO');
}

function isCreditSheet(sheetName: string): boolean {
  return normalizeTextKey(sheetName).includes('CREDITO');
}

function parseBoolean(value: unknown): boolean {
  const key = normalizeTextKey(value);
  return ['TRUE', 'VERDADEIRO', 'SIM', 'YES', '1'].includes(key);
}

function parseReportDate(value: unknown): string | null {
  if (typeof value === 'string') {
    const match = normalizeWhitespace(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (match) {
      const [, month, day, yearText] = match;
      const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
      return `${year.toString().padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return parseExcelDate(value);
}

function buildDailyRows(
  startDate: string,
  endDate: string,
  movements: CashFlowReportMovement[],
  anticipatedMovements: CashFlowReportMovement[],
  initialBalanceCents: number,
): CashFlowReportDataset['dailyRows'] {
  const byDate = movements.reduce<Record<string, { debitCents: number; creditCents: number; movementCount: number }>>(
    (acc, movement) => {
      acc[movement.dueDate] ??= { debitCents: 0, creditCents: 0, movementCount: 0 };
      acc[movement.dueDate].movementCount += 1;
      if (movement.transactionType === 'DEBITO') {
        acc[movement.dueDate].debitCents += movement.valueCents;
      } else {
        acc[movement.dueDate].creditCents += movement.valueCents;
      }
      return acc;
    },
    {},
  );
  const anticipatedByDate = anticipatedMovements.reduce<Record<string, number>>((acc, movement) => {
    acc[movement.dueDate] = (acc[movement.dueDate] ?? 0) + movement.valueCents;
    return acc;
  }, {});

  let balance = initialBalanceCents;
  return enumerateDates(startDate, endDate).map((date) => {
    const day = byDate[date] ?? { debitCents: 0, creditCents: 0, movementCount: 0 };
    const openingBalanceCents = balance;
    const netCents = day.creditCents - day.debitCents;
    balance += netCents;

    return {
      date,
      openingBalanceCents,
      debitCents: day.debitCents,
      creditCents: day.creditCents,
      anticipatedCents: anticipatedByDate[date] ?? 0,
      netCents,
      closingBalanceCents: balance,
      movementCount: day.movementCount,
    };
  });
}

function buildVariations(
  previousMovements: CashFlowReportMovement[],
  currentMovements: CashFlowReportMovement[],
): CashFlowReportVariation[] {
  const previousByKey = groupComparableMovements(previousMovements);
  const matchedPreviousIds = new Set<string>();
  const variations: CashFlowReportVariation[] = [];

  currentMovements.forEach((movement) => {
    const key = createComparableKey(movement);
    const previous = previousByKey.get(key)?.find((candidate) => !matchedPreviousIds.has(candidate.id));
    if (!previous) {
      variations.push({
        id: `variation-new-${movement.id}`,
        documentNumber: movement.documentNumber,
        accountName: movement.accountName,
        transactionType: movement.transactionType,
        variationType: 'NOVO',
        dueDate: movement.dueDate,
        currentValueCents: movement.valueCents,
        previousValueCents: null,
        impactCents: getMovementSignedImpact(movement),
        isAnticipated: movement.isAnticipated,
        description: movement.isAnticipated
          ? 'Crédito antecipado novo, fora do cálculo do fluxo.'
          : 'Lançamento novo em relação a versão publicada anterior.',
      });
      return;
    }

    matchedPreviousIds.add(previous.id);
    const valueChanged = previous.valueCents !== movement.valueCents;
    const dateChanged = previous.dueDate !== movement.dueDate;
    const typeChanged = previous.transactionType !== movement.transactionType;

    if (valueChanged || dateChanged || typeChanged) {
      const previousImpact = getMovementSignedImpact(previous);
      const currentImpact = getMovementSignedImpact(movement);
      variations.push({
        id: `variation-changed-${movement.id}`,
        documentNumber: movement.documentNumber,
        accountName: movement.accountName,
        transactionType: movement.transactionType,
        variationType: typeChanged ? 'TIPO_ALTERADO' : valueChanged ? 'VALOR_ALTERADO' : 'DATA_ALTERADA',
        dueDate: movement.dueDate,
        previousDueDate: previous.dueDate,
        currentValueCents: movement.valueCents,
        previousValueCents: previous.valueCents,
        impactCents: currentImpact - previousImpact,
        isAnticipated: movement.isAnticipated,
        description: valueChanged
          ? 'Valor alterado em relação a versão publicada anterior.'
          : dateChanged
            ? 'Data de vencimento alterada em relação a versão publicada anterior.'
            : 'Tipo do lançamento alterado em relação a versão publicada anterior.',
      });
    }
  });

  return variations.sort((a, b) => Math.abs(b.impactCents) - Math.abs(a.impactCents));
}

function groupComparableMovements(movements: CashFlowReportMovement[]) {
  return movements.reduce<Map<string, CashFlowReportMovement[]>>((acc, movement) => {
    const key = createComparableKey(movement);
    acc.set(key, [...(acc.get(key) ?? []), movement]);
    return acc;
  }, new Map());
}

function createComparableKey(movement: CashFlowReportMovement): string {
  return [
    normalizeTextKey(movement.documentNumber),
    normalizeTextKey(movement.accountName),
    movement.transactionType,
  ].join('|');
}

function createMovementId(
  sourceRow: number,
  documentNumber: string,
  accountName: string,
  transactionType: CashFlowReportTransactionType,
): string {
  const key = normalizeTextKey(`${documentNumber}-${accountName}-${transactionType}`)
    .toLowerCase()
    .replace(/\s+/g, '-');
  return `cash-flow-${sourceRow}-${key}`;
}

function countDuplicateDocuments(movements: CashFlowReportMovement[]): number {
  const counts = movements.reduce<Record<string, number>>((acc, movement) => {
    const key = normalizeTextKey(movement.documentNumber);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.values(counts).filter((count) => count > 1).length;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function buildPeriodLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
  const startMonth = capitalize(formatter.format(start));
  const endMonth = capitalize(formatter.format(end));

  if (start.getUTCFullYear() === end.getUTCFullYear() && startMonth === endMonth) {
    return `${startMonth} de ${start.getUTCFullYear()}`;
  }

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${startMonth} a ${endMonth} de ${start.getUTCFullYear()}`;
  }

  return `${startMonth}/${start.getUTCFullYear()} a ${endMonth}/${end.getUTCFullYear()}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
