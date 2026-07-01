export type CashFlowReportTransactionType = 'DEBITO' | 'CREDITO';
export type CashFlowReportVersionStatus = 'draft' | 'published' | 'archived';
export type CashFlowReportVariationType =
  | 'NOVO'
  | 'VALOR_ALTERADO'
  | 'DATA_ALTERADA'
  | 'TIPO_ALTERADO'
  | 'REMOVIDO';

export interface CashFlowReportMovement {
  id: string;
  sourceRow: number;
  documentNumber: string;
  transactionType: CashFlowReportTransactionType;
  accountName: string;
  isSettled: boolean;
  isForecast: boolean;
  dueDate: string;
  valueCents: number;
  isAnticipated: boolean;
  excludedFromCashFlow: boolean;
  rawData: Record<string, unknown>;
}

export interface CashFlowReportBankAccount {
  id: string;
  code: string;
  bankName: string;
  accountLabel: string;
  debitCents?: number | null;
  creditCents?: number | null;
  balanceCents: number;
  runningBalanceCents: number | null;
  isGuaranteed: boolean;
  includeInCashFlow: boolean;
}

export interface CashFlowReportDay {
  date: string;
  openingBalanceCents: number;
  debitCents: number;
  creditCents: number;
  anticipatedCents: number;
  netCents: number;
  closingBalanceCents: number;
  movementCount: number;
}

export interface CashFlowReportVariation {
  id: string;
  documentNumber: string;
  accountName: string;
  transactionType: CashFlowReportTransactionType;
  variationType: CashFlowReportVariationType;
  dueDate: string | null;
  previousDueDate?: string | null;
  currentValueCents?: number | null;
  previousValueCents?: number | null;
  impactCents: number;
  isAnticipated: boolean;
  description: string;
}

export interface CashFlowReportIssue {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  row?: number;
  sheetName?: string;
}

export interface CashFlowReportDataset {
  sourceFileName?: string;
  importedAt?: string;
  sheetName: string;
  monthLabel: string;
  startDate: string;
  endDate: string;
  initialBalanceCents: number;
  initialBalanceSource: 'spreadsheet' | 'not_informed';
  bankAccounts: CashFlowReportBankAccount[];
  movements: CashFlowReportMovement[];
  cashFlowMovements: CashFlowReportMovement[];
  anticipatedMovements: CashFlowReportMovement[];
  dailyRows: CashFlowReportDay[];
  variations: CashFlowReportVariation[];
  issues: CashFlowReportIssue[];
}

export interface CashFlowReportMetrics {
  initialBalanceCents: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  anticipatedCreditsCents: number;
  closingBalanceCents: number;
  minBalanceCents: number;
  minBalanceDate: string;
  variationCount: number;
}

export interface CashFlowReportImportSummary {
  fileName: string;
  sheetNames: string[];
  sheetName: string;
  movementCount: number;
  cashFlowMovementCount: number;
  debitMovementCount: number;
  creditMovementCount: number;
  anticipatedCount: number;
  bankAccountCount: number;
  dailyRowCount: number;
  variationCount: number;
  duplicateDocumentCount: number;
  issues: CashFlowReportIssue[];
}

export interface CashFlowReportImportResult {
  dataset: CashFlowReportDataset;
  summary: CashFlowReportImportSummary;
}

export interface CashFlowReportVersion {
  id: string;
  versionNumber: number;
  status: CashFlowReportVersionStatus;
  sourceFileName: string;
  monthLabel: string;
  startDate: string;
  endDate: string;
  movementCount: number;
  dailyRowCount: number;
  anticipatedCount: number;
  variationCount: number;
  initialBalanceCents: number;
  closingBalanceCents: number;
  dataset: CashFlowReportDataset | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface CashFlowReportVersionDataset {
  version: CashFlowReportVersion | null;
  dataset: CashFlowReportDataset | null;
}
