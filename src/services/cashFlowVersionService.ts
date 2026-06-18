import { supabase } from '../lib/supabase';
import type {
  CashFlowDataset,
  CashFlowVersion,
  CashFlowVersionDataset,
  CashFlowVersionStatus,
} from '../types/cashFlow';
import { calculateCashFlowMetrics } from './cashFlowService';

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
  'account_count',
  'initial_balance_cents',
  'current_forecast_cents',
  'metadata',
  'created_by',
  'published_by',
  'created_at',
  'published_at',
].join(',');

function getClient(client?: SupabaseQueryClient | null): SupabaseQueryClient | null {
  return client ?? supabase;
}

export function mapCashFlowVersionRow(row: any): CashFlowVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status as CashFlowVersionStatus,
    sourceFileName: row.source_file_name,
    monthLabel: row.month_label,
    startDate: row.start_date,
    endDate: row.end_date,
    movementCount: row.movement_count,
    accountCount: row.account_count,
    initialBalanceCents: row.initial_balance_cents,
    currentForecastCents: row.current_forecast_cents,
    dataset: row.dataset ?? null,
    metadata: row.metadata ?? {},
    createdBy: row.created_by ?? null,
    publishedBy: row.published_by ?? null,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
  };
}

export async function loadPublishedCashFlow(
  client?: SupabaseQueryClient | null,
): Promise<CashFlowVersionDataset> {
  const db = getClient(client);
  if (!db?.from) {
    return { version: null, dataset: null };
  }

  const { data, error } = await db
    .from('cash_flow_versions')
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

  const version = mapCashFlowVersionRow(data);
  return { version, dataset: version.dataset };
}

export async function loadAdminCashFlowVersions(
  client?: SupabaseQueryClient | null,
): Promise<CashFlowVersion[]> {
  const db = getClient(client);
  if (!db?.from) {
    return [];
  }

  const { data, error } = await db
    .from('cash_flow_versions')
    .select(VERSION_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Nao foi possivel carregar o historico do fluxo de caixa.');
  }

  return (data ?? []).map(mapCashFlowVersionRow);
}

export async function loadCashFlowVersion(
  versionId: string,
  client?: SupabaseQueryClient | null,
): Promise<CashFlowVersionDataset> {
  const db = getClient(client);
  if (!db?.from) {
    return { version: null, dataset: null };
  }

  const { data, error } = await db
    .from('cash_flow_versions')
    .select('*')
    .eq('id', versionId)
    .maybeSingle();

  if (error) {
    throw new Error('Nao foi possivel carregar a versao do fluxo de caixa.');
  }

  if (!data) {
    return { version: null, dataset: null };
  }

  const version = mapCashFlowVersionRow(data);
  return { version, dataset: version.dataset };
}

export async function saveCashFlowDraft(
  dataset: CashFlowDataset,
  userId?: string,
  client?: SupabaseQueryClient | null,
): Promise<CashFlowVersion | null> {
  const db = getClient(client);
  if (!db?.from) {
    return null;
  }

  const metrics = calculateCashFlowMetrics(dataset);
  const metadata = {
    issueCount: dataset.issues?.length ?? 0,
    dailyEntryCount: dataset.dailyEntries?.length ?? 0,
  };

  const { data, error } = await db
    .from('cash_flow_versions')
    .insert({
      status: 'draft',
      source_file_name: dataset.sourceFileName ?? 'fluxo-de-caixa.xlsx',
      month_label: dataset.monthLabel,
      start_date: dataset.startDate,
      end_date: dataset.endDate,
      movement_count: dataset.movements.length,
      account_count: dataset.bankAccounts.length,
      initial_balance_cents: metrics.initialBalanceCents,
      current_forecast_cents: metrics.currentForecastClosingCents,
      dataset,
      metadata,
      created_by: userId ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error('Nao foi possivel criar a versao do fluxo de caixa.');
  }

  return mapCashFlowVersionRow(data);
}

export async function publishCashFlowVersion(
  versionId: string,
  client?: SupabaseQueryClient | null,
): Promise<void> {
  const db = getClient(client);
  if (!db?.rpc) {
    throw new Error('Supabase nao esta configurado para publicar o fluxo de caixa.');
  }

  const { error } = await db.rpc('publish_cash_flow_version', {
    target_version_id: versionId,
  });

  if (error) {
    throw new Error('Nao foi possivel publicar a versao do fluxo de caixa.');
  }
}
