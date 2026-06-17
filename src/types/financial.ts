export type DashboardLevel = 'group' | 'department' | 'person';

export interface FinancialRecord {
  id?: string;
  importId?: string;
  versionId?: string;
  sourceRow: number;
  groupName: string;
  groupKey: string;
  departmentName: string;
  departmentKey: string;
  classificationName: string;
  classificationKey: string;
  financialType: string;
  financialTypeKey: string;
  documentNumber: string;
  personName: string;
  personKey: string;
  dueDate: string | null;
  amountCents: number;
  detailGroupName: string;
  detailGroupKey: string;
  rawData: Record<string, unknown>;
  dedupeKey: string;
}

export interface FinancialBlock {
  index: number;
  summaryRow: number;
  labelRow: number;
  headerRow: number;
  groupName: string;
  departmentName: string;
  classificationName: string;
  financialType: string;
  declaredTotalCents: number | null;
  detailTotalCents: number;
  recordCount: number;
  groupLabel: string;
}

export type ImportIssueType =
  | 'missing_internal_headers'
  | 'invalid_amount'
  | 'invalid_date'
  | 'incomplete_detail_row'
  | 'block_total_mismatch'
  | 'group_detail_mismatch'
  | 'duplicate_record';

export interface ImportIssue {
  type: ImportIssueType;
  row?: number;
  blockIndex?: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

export interface ExcelAnalysis {
  sheetName: string;
  blockCount: number;
  recordCount: number;
  totalAmountCents: number;
  declaredTotalAmountCents: number;
  blocks: FinancialBlock[];
  records: FinancialRecord[];
  issues: ImportIssue[];
  previewRows: FinancialRecord[];
}

export interface FinancialSummary {
  key: string;
  label: string;
  totalCents: number;
  recordCount: number;
}

export interface SummaryFilters {
  groupKey?: string;
  departmentKey?: string;
  search?: string;
}

export interface SavedFinancialImport {
  id: string;
  source_file_name: string;
  sheet_name: string;
  record_count: number;
  block_count: number;
  total_amount_cents: number;
  created_at: string;
}

export type DashboardVersionStatus = 'draft' | 'published' | 'archived';

export interface DashboardVersion {
  id: string;
  versionNumber: number;
  status: DashboardVersionStatus;
  sourceFileName: string;
  sheetName: string;
  recordCount: number;
  blockCount: number;
  totalAmountCents: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface DashboardDataset {
  version: DashboardVersion | null;
  records: FinancialRecord[];
}
