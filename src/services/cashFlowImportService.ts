import * as XLSX from '@e965/xlsx';
import type {
  BankAccount,
  CashFlowChange,
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

export async function analyzeCashFlowExcelFile(
  file: File,
  previousDataset?: CashFlowDataset | null,
): Promise<CashFlowImportResult> {
  const validationError = validateCashFlowExcelFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return analyzeCashFlowWorkbook(workbook, file.name, previousDataset);
}

export function analyzeCashFlowWorkbook(
  workbook: XLSX.WorkBook,
  fileName = 'planilha.xlsx',
  previousDataset?: CashFlowDataset | null,
): CashFlowImportResult {
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

  const importedMovements = [...debitMovements, ...creditMovements].sort((a, b) => a.date.localeCompare(b.date));
  const movements = previousDataset ? mergeMovements(previousDataset.movements, importedMovements) : importedMovements;
  const dailyEntries = previousDataset
    ? mergeDailyEntries(previousDataset.dailyEntries ?? [], flow.dailyEntries)
    : flow.dailyEntries;
  const bankAccounts = mergeBankAccounts(previousDataset?.bankAccounts ?? [], flow.bankAccounts);
  const lastDailyEntry = flow.dailyEntries[flow.dailyEntries.length - 1];
  const accumulatedLastDailyEntry = dailyEntries[dailyEntries.length - 1];
  const finalForecastCents = accumulatedLastDailyEntry?.projectedBalanceCents ?? lastDailyEntry?.projectedBalanceCents ?? flow.initialBalanceCents;
  const startDate = dailyEntries[0]?.date ?? new Date().toISOString().slice(0, 10);
  const endDate = accumulatedLastDailyEntry?.date ?? startDate;
  const newChanges = previousDataset ? buildChanges(previousDataset.movements, importedMovements, fileName) : [];
  const dataset: CashFlowDataset = {
    monthLabel: buildPeriodLabel(startDate, endDate),
    startDate,
    endDate,
    initialForecastClosingCents: previousDataset?.initialForecastClosingCents ?? finalForecastCents,
    sourceFileName: fileName,
    importedAt: new Date().toISOString(),
    bankAccounts,
    dailyEntries,
    movements,
    changes: [...(previousDataset?.changes ?? []), ...newChanges],
    snapshots: [
      ...(previousDataset?.snapshots ?? []),
      {
        id: `snapshot-${Date.now()}-${normalizeTextKey(fileName).toLowerCase().replace(/\s+/g, '-')}`,
        snapshotDate: new Date().toISOString().slice(0, 10),
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
      bankAccountCount: bankAccounts.length,
      dailyEntryCount: dailyEntries.length,
      debitMovementCount: debitMovements.length,
      creditMovementCount: creditMovements.length,
      ignoredSheetNames,
      issues,
    },
  };
}

function mergeMovements(previousMovements: CashFlowMovement[], importedMovements: CashFlowMovement[]): CashFlowMovement[] {
  const importedByKey = groupComparableMovements(importedMovements);
  const usedImportedIds = new Set<string>();
  const merged = previousMovements.map((previousMovement) => {
    const replacement = importedByKey
      .get(createComparableMovementKey(previousMovement))
      ?.find((candidate) => !usedImportedIds.has(candidate.id));

    if (!replacement) {
      return previousMovement;
    }

    usedImportedIds.add(replacement.id);
    return {
      ...replacement,
      id: previousMovement.id,
      origin:
        previousMovement.valueCents === replacement.valueCents && previousMovement.date === replacement.date
          ? previousMovement.origin
          : 'IMPORTACAO_ATUALIZACAO',
    };
  });

  importedMovements.forEach((movement) => {
    if (!usedImportedIds.has(movement.id)) {
      merged.push({
        ...movement,
        origin: 'IMPORTACAO_ATUALIZACAO',
      });
    }
  });

  return merged.sort((a, b) => a.date.localeCompare(b.date) || a.documentNumber.localeCompare(b.documentNumber));
}

function mergeDailyEntries(previousEntries: CashFlowDailyEntry[], importedEntries: CashFlowDailyEntry[]): CashFlowDailyEntry[] {
  const byDate = new Map(previousEntries.map((entry) => [entry.date, entry]));
  importedEntries.forEach((entry) => {
    byDate.set(entry.date, entry);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeBankAccounts(previousAccounts: BankAccount[], importedAccounts: BankAccount[]): BankAccount[] {
  const byKey = new Map(previousAccounts.map((account) => [createBankAccountKey(account), account]));
  importedAccounts.forEach((account) => {
    const key = createBankAccountKey(account);
    const previous = byKey.get(key);
    byKey.set(key, {
      ...account,
      includeInCash: previous?.includeInCash ?? account.includeInCash,
    });
  });
  return [...byKey.values()];
}

function buildChanges(
  previousMovements: CashFlowMovement[],
  importedMovements: CashFlowMovement[],
  fileName: string,
): CashFlowChange[] {
  const previousByKey = groupComparableMovements(previousMovements);
  const matchedPreviousIds = new Set<string>();
  const registeredAt = new Date().toISOString().slice(0, 10);

  return importedMovements.flatMap((movement): CashFlowChange[] => {
    const previous = previousByKey
      .get(createComparableMovementKey(movement))
      ?.find((candidate) => !matchedPreviousIds.has(candidate.id));

    if (!previous) {
      return [
        {
          id: `change-new-${movement.id}`,
          registeredAt,
          affectedDate: movement.date,
          title: `${movement.documentNumber} - ${movement.counterparty}`,
          changeType: 'CRIADO',
          movementType: movement.type,
          impactCents: getMovementSignedImpact(movement),
          reason: `Titulo novo importado em ${fileName}.`,
        },
      ];
    }

    matchedPreviousIds.add(previous.id);
    const valueChanged = previous.valueCents !== movement.valueCents;
    const dateChanged = previous.date !== movement.date;
    if (!valueChanged && !dateChanged) {
      return [];
    }

    const currentImpact = getMovementSignedImpact(movement);
    const previousImpact = getMovementSignedImpact(previous);
    return [
      {
        id: `change-updated-${movement.id}`,
        registeredAt,
        affectedDate: movement.date,
        title: `${movement.documentNumber} - ${movement.counterparty}`,
        changeType: valueChanged ? 'VALOR_ALTERADO' : 'DATA_ALTERADA',
        movementType: movement.type,
        impactCents: currentImpact - previousImpact,
        reason: valueChanged
          ? `Valor alterado de ${previous.valueCents} para ${movement.valueCents}.`
          : `Data alterada de ${previous.date} para ${movement.date}.`,
      },
    ];
  });
}

function groupComparableMovements(movements: CashFlowMovement[]) {
  return movements.reduce<Map<string, CashFlowMovement[]>>((acc, movement) => {
    const key = createComparableMovementKey(movement);
    acc.set(key, [...(acc.get(key) ?? []), movement]);
    return acc;
  }, new Map());
}

function createComparableMovementKey(movement: Pick<CashFlowMovement, 'documentNumber' | 'counterparty' | 'type'>): string {
  return [normalizeTextKey(movement.documentNumber), normalizeTextKey(movement.counterparty), movement.type].join('|');
}

function createBankAccountKey(account: Pick<BankAccount, 'code' | 'description'>): string {
  return [normalizeTextKey(account.code), normalizeTextKey(account.description)].join('|');
}

function getMovementSignedImpact(movement: Pick<CashFlowMovement, 'type' | 'valueCents'>): number {
  return movement.type === 'CREDITO' ? movement.valueCents : -movement.valueCents;
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

function buildPeriodLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return buildMonthLabel(startDate);
  }

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
