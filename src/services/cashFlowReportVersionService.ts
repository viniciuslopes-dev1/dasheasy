import { supabase } from '../lib/supabase';
import type {
  CashFlowReportDataset,
  CashFlowReportVersion,
  CashFlowReportVersionDataset,
  CashFlowReportVersionStatus,
} from '../types/cashFlowReport';
import { calculateCashFlowReportMetrics } from './cashFlowReportService';
import { isLocalTestMode } from './localTestMode';
import {
  loadLocalAdminCashFlowReportVersions,
  loadLocalCashFlowReportVersion,
  loadLocalPublishedCashFlowReport,
  publishLocalCashFlowReportVersion,
  saveLocalCashFlowReportDraft,
} from './localVersionStore';

type SupabaseQueryClient = {
  from?: (table: string) => any;
  rpc?: (fn: string, args?: Record<string, unknown>) => any;
};

const VERSION_LIST_COLUMNS = [
  'id',
  'version_number',
  'status',
  'source_file_name',
  'month_label',
  'start_date',
  'end_date',
  'movement_count',
  'daily_row_count',
  'anticipated_count',
  'variation_count',
  'initial_balance_cents',
  'closing_balance_cents',
  'metadata',
  'created_by',
  'published_by',
  'created_at',
  'published_at',
].join(',');

function getClient(client?: SupabaseQueryClient | null): SupabaseQueryClient | null {
  return client ?? supabase;
}

export function mapCashFlowReportVersionRow(row: any): CashFlowReportVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status as CashFlowReportVersionStatus,
    sourceFileName: row.source_file_name,
    monthLabel: row.month_label,
    startDate: row.start_date,
    endDate: row.end_date,
    movementCount: row.movement_count,
    dailyRowCount: row.daily_row_count,
    anticipatedCount: row.anticipated_count,
    variationCount: row.variation_count,
    initialBalanceCents: row.initial_balance_cents,
    closingBalanceCents: row.closing_balance_cents,
    dataset: row.dataset ?? null,
    metadata: row.metadata ?? {},
    createdBy: row.created_by ?? null,
    publishedBy: row.published_by ?? null,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
  };
}

export async function loadPublishedCashFlowReport(
  client?: SupabaseQueryClient | null,
): Promise<CashFlowReportVersionDataset> {
  if (isLocalTestMode && !client) {
    return loadLocalPublishedCashFlowReport();
  }

  const db = getClient(client);
  if (!db?.from) {
    return { version: null, dataset: null };
  }

  const { data, error } = await db
    .from('cash_flow_reports')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Nao foi possivel carregar o fluxo de caixa publicado.');
  }

  if (!data) {
    return { version: null, dataset: null };
  }

  const version = mapCashFlowReportVersionRow(data);
  return { version, dataset: version.dataset };
}

export async function loadAdminCashFlowReportVersions(
  client?: SupabaseQueryClient | null,
): Promise<CashFlowReportVersion[]> {
  if (isLocalTestMode && !client) {
    return loadLocalAdminCashFlowReportVersions();
  }

  const db = getClient(client);
  if (!db?.from) {
    return [];
  }

  const { data, error } = await db
    .from('cash_flow_reports')
    .select(VERSION_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Nao foi possivel carregar o historico do fluxo de caixa.');
  }

  return (data ?? []).map(mapCashFlowReportVersionRow);
}

export async function loadCashFlowReportVersion(
  versionId: string,
  client?: SupabaseQueryClient | null,
): Promise<CashFlowReportVersionDataset> {
  if (isLocalTestMode && !client) {
    return loadLocalCashFlowReportVersion(versionId);
  }

  const db = getClient(client);
  if (!db?.from) {
    return { version: null, dataset: null };
  }

  const { data, error } = await db
    .from('cash_flow_reports')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (error) {
    throw new Error('Nao foi possivel carregar a versao do fluxo de caixa.');
  }

  if (!data) {
    return { version: null, dataset: null };
  }

  const version = mapCashFlowReportVersionRow(data);
  return { version, dataset: version.dataset };
}

export async function saveCashFlowReportDraft(
  dataset: CashFlowReportDataset,
  userId?: string,
  client?: SupabaseQueryClient | null,
): Promise<CashFlowReportVersion | null> {
  if (isLocalTestMode && !client) {
    return saveLocalCashFlowReportDraft(dataset, userId);
  }

  const db = getClient(client);
  if (!db?.from) {
    return null;
  }

  const metrics = calculateCashFlowReportMetrics(dataset);
  const metadata = {
    issueCount: dataset.issues.length,
    duplicateDocumentIssue: dataset.issues.some((issue) => issue.type === 'duplicate_document_numbers'),
    cashFlowMovementCount: dataset.cashFlowMovements.length,
  };

  const { data, error } = await db
    .from('cash_flow_reports')
    .insert({
      status: 'draft',
      source_file_name: dataset.sourceFileName ?? 'fluxo-de-caixa.xlsx',
      month_label: dataset.monthLabel,
      start_date: dataset.startDate,
      end_date: dataset.endDate,
      movement_count: dataset.movements.length,
      daily_row_count: dataset.dailyRows.length,
      anticipated_count: dataset.anticipatedMovements.length,
      variation_count: dataset.variations.length,
      initial_balance_cents: dataset.initialBalanceCents,
      closing_balance_cents: metrics.closingBalanceCents,
      dataset,
      metadata,
      created_by: userId ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error('Nao foi possivel criar a versao do fluxo de caixa.');
  }

  return mapCashFlowReportVersionRow(data);
}

export async function publishCashFlowReportVersion(
  versionId: string,
  client?: SupabaseQueryClient | null,
): Promise<void> {
  if (isLocalTestMode && !client) {
    publishLocalCashFlowReportVersion(versionId);
    return;
  }

  const db = getClient(client);
  if (!db?.rpc) {
    throw new Error('Supabase nao esta configurado para publicar o fluxo de caixa.');
  }

  const { error } = await db.rpc('publish_cash_flow_report', {
    target_version_id: versionId,
  });

  if (error) {
    throw new Error('Nao foi possivel publicar a versao do fluxo de caixa.');
  }
}
