import type {
  CashFlowReportDataset,
  CashFlowReportDay,
  CashFlowReportMetrics,
  CashFlowReportMovement,
} from '../types/cashFlowReport';

export function calculateCashFlowReportMetrics(dataset: CashFlowReportDataset): CashFlowReportMetrics {
  const lastDay = dataset.dailyRows[dataset.dailyRows.length - 1];
  const minDay = dataset.dailyRows.reduce<CashFlowReportDay | null>(
    (currentMin, day) => (!currentMin || day.closingBalanceCents < currentMin.closingBalanceCents ? day : currentMin),
    null,
  );

  return {
    initialBalanceCents: dataset.initialBalanceCents,
    totalDebitsCents: dataset.dailyRows.reduce((sum, day) => sum + day.debitCents, 0),
    totalCreditsCents: dataset.dailyRows.reduce((sum, day) => sum + day.creditCents, 0),
    anticipatedCreditsCents: dataset.anticipatedMovements.reduce((sum, movement) => sum + movement.valueCents, 0),
    closingBalanceCents: lastDay?.closingBalanceCents ?? dataset.initialBalanceCents,
    minBalanceCents: minDay?.closingBalanceCents ?? dataset.initialBalanceCents,
    minBalanceDate: minDay?.date ?? dataset.startDate,
    variationCount: dataset.variations.length,
  };
}

export function formatCashFlowReportDate(date: string | null | undefined): string {
  if (!date) {
    return '-';
  }

  const [, month, day] = date.split('-');
  return day && month ? `${day}/${month}` : date;
}

export function getMovementSignedImpact(movement: Pick<CashFlowReportMovement, 'transactionType' | 'valueCents' | 'isAnticipated'>): number {
  if (movement.isAnticipated) {
    return 0;
  }

  return movement.transactionType === 'CREDITO' ? movement.valueCents : -movement.valueCents;
}

export function getTransactionTypeLabel(type: CashFlowReportMovement['transactionType']): string {
  return type === 'DEBITO' ? 'Débito' : 'Crédito';
}
