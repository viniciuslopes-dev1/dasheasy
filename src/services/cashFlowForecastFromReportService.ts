import type {
  BankAccount,
  CashFlowChange,
  CashFlowDataset,
  CashFlowMovement,
  CashFlowOrigin,
  CashFlowStatus,
  CashFlowTransactionType,
} from '../types/cashFlow';
import type {
  CashFlowReportBankAccount,
  CashFlowReportDataset,
  CashFlowReportMovement,
  CashFlowReportVariation,
} from '../types/cashFlowReport';

export function createForecastDatasetFromCashFlowReport(
  reportDataset: CashFlowReportDataset,
  previousForecastDataset?: CashFlowDataset | null,
): CashFlowDataset {
  const closingForecastCents =
    reportDataset.dailyRows[reportDataset.dailyRows.length - 1]?.closingBalanceCents ?? reportDataset.initialBalanceCents;

  return {
    monthLabel: reportDataset.monthLabel,
    startDate: reportDataset.startDate,
    endDate: reportDataset.endDate,
    initialForecastClosingCents: previousForecastDataset?.initialForecastClosingCents ?? closingForecastCents,
    sourceFileName: reportDataset.sourceFileName,
    importedAt: reportDataset.importedAt,
    bankAccounts: reportDataset.bankAccounts.map(mapReportBankAccountToForecast),
    dailyEntries: reportDataset.dailyRows.map((day) => ({
      date: day.date,
      debitCents: day.debitCents,
      creditCents: day.creditCents,
      projectedBalanceCents: day.closingBalanceCents,
    })),
    movements: reportDataset.cashFlowMovements.map(mapReportMovementToForecast),
    changes: reportDataset.variations.map(mapReportVariationToForecastChange),
    snapshots: [
      ...(previousForecastDataset?.snapshots ?? []),
      {
        id: `snapshot-report-${reportDataset.importedAt ?? Date.now()}`,
        snapshotDate: (reportDataset.importedAt ?? new Date().toISOString()).slice(0, 10),
        closingForecastCents,
      },
    ],
    issues: reportDataset.issues.map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      message: issue.message,
      row: issue.row,
      sheetName: issue.sheetName,
    })),
  };
}

function mapReportBankAccountToForecast(account: CashFlowReportBankAccount): BankAccount {
  return {
    id: account.id,
    code: account.code,
    bank: account.bankName,
    description: account.accountLabel,
    balanceCents: account.balanceCents,
    includeInCash: account.includeInCashFlow,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

function mapReportMovementToForecast(movement: CashFlowReportMovement): CashFlowMovement {
  return {
    id: movement.id,
    date: movement.dueDate,
    documentNumber: movement.documentNumber,
    counterparty: movement.accountName,
    type: movement.transactionType as CashFlowTransactionType,
    category: movement.isForecast ? 'Previsão' : 'Movimentação',
    valueCents: movement.valueCents,
    status: mapReportMovementStatus(movement),
    origin: 'IMPORTACAO_ATUALIZACAO' as CashFlowOrigin,
  };
}

function mapReportVariationToForecastChange(variation: CashFlowReportVariation): CashFlowChange {
  return {
    id: `forecast-variation-${variation.id}`,
    registeredAt: new Date().toISOString().slice(0, 10),
    affectedDate: variation.dueDate ?? variation.previousDueDate ?? new Date().toISOString().slice(0, 10),
    title: `${variation.documentNumber} - ${variation.accountName}`,
    changeType: mapReportVariationTypeToForecastChangeType(variation.variationType),
    movementType: variation.transactionType as CashFlowTransactionType,
    impactCents: variation.impactCents,
    reason: variation.description,
  };
}

function mapReportVariationTypeToForecastChangeType(
  variationType: CashFlowReportVariation['variationType'],
): CashFlowChange['changeType'] {
  if (variationType === 'NOVO') {
    return 'CRIADO';
  }

  if (variationType === 'REMOVIDO') {
    return 'CANCELADO';
  }

  if (variationType === 'TIPO_ALTERADO') {
    return 'VALOR_ALTERADO';
  }

  return variationType;
}

function mapReportMovementStatus(movement: CashFlowReportMovement): CashFlowStatus {
  if (!movement.isSettled) {
    return 'PREVISTO';
  }

  return movement.transactionType === 'CREDITO' ? 'RECEBIDO' : 'PAGO';
}
