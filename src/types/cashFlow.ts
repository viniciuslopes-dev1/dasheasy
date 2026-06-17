export type CashFlowTransactionType = 'DEBITO' | 'CREDITO';
export type CashFlowStatus = 'PREVISTO' | 'PAGO' | 'RECEBIDO' | 'CANCELADO' | 'ATRASADO';
export type CashFlowOrigin = 'IMPORTACAO_INICIAL' | 'IMPORTACAO_ATUALIZACAO' | 'LANCAMENTO_MANUAL' | 'VARIACAO';
export type CashFlowChangeType = 'CRIADO' | 'VALOR_ALTERADO' | 'DATA_ALTERADA' | 'CANCELADO' | 'RESTAURADO';

export interface BankAccount {
  id: string;
  code: string;
  bank: string;
  description: string;
  balanceCents: number;
  includeInCash: boolean;
  updatedAt: string;
}

export interface CashFlowMovement {
  id: string;
  date: string;
  documentNumber: string;
  counterparty: string;
  type: CashFlowTransactionType;
  category: string;
  valueCents: number;
  status: CashFlowStatus;
  origin: CashFlowOrigin;
}

export interface CashFlowChange {
  id: string;
  registeredAt: string;
  affectedDate: string;
  title: string;
  changeType: CashFlowChangeType;
  movementType: CashFlowTransactionType;
  impactCents: number;
  reason: string;
}

export interface CashFlowSnapshot {
  id: string;
  snapshotDate: string;
  closingForecastCents: number;
}

export interface DailyCashFlow {
  date: string;
  debitCents: number;
  creditCents: number;
  netCents: number;
  projectedBalanceCents: number;
}

export interface CashFlowDataset {
  monthLabel: string;
  startDate: string;
  endDate: string;
  initialForecastClosingCents: number;
  bankAccounts: BankAccount[];
  movements: CashFlowMovement[];
  changes: CashFlowChange[];
  snapshots: CashFlowSnapshot[];
}

export interface CashFlowMetrics {
  initialBalanceCents: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  initialForecastClosingCents: number;
  currentForecastClosingCents: number;
  accumulatedVariationCents: number;
  minProjectedBalanceCents: number;
  minProjectedBalanceDate: string;
}
