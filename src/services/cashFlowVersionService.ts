import { supabase } from '../lib/supabase';
import type {
  CashFlowDataset,
  CashFlowVersion,
  CashFlowVersionDataset,
  CashFlowVersionStatus,
} from '../types/cashFlow';
import { calculateCashFlowMetrics } from './cashFlowService';
import { isLocalTestMode } from './localTestMode';
import {
  loadLocalAdminCashFlowVersions,
  loadLocalCashFlowVersion,
  loadLocalPublishedCashFlow,
  publishLocalCashFlowVersion,
  saveLocalCashFlowDraft,
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
  if (isLocalTestMode && !client) {
    return loadLocalPublishedCashFlow();
  }

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
    throw new Error('Não foi possível carregar a previsão financeira publicada.');
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
  if (isLocalTestMode && !client) {
    return loadLocalAdminCashFlowVersions();
  }

  const db = getClient(client);
  if (!db?.from) {
    return [];
  }

  const { data, error } = await db
    .from('cash_flow_versions')
    .select(VERSION_LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Não foi possível carregar o histórico da previsão financeira.');
  }

  return (data ?? []).map(mapCashFlowVersionRow);
}

export async function loadCashFlowVersion(
  versionId: string,
  client?: SupabaseQueryClient | null,
): Promise<CashFlowVersionDataset> {
  if (isLocalTestMode && !client) {
    return loadLocalCashFlowVersion(versionId);
  }

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
    throw new Error('Não foi possível carregar a versão da previsão financeira.');
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
  if (isLocalTestMode && !client) {
    return saveLocalCashFlowDraft(dataset, userId);
  }

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
      source_file_name: dataset.sourceFileName ?? 'previsão-financeira.xlsx',
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
    throw new Error('Não foi possível criar a versão da previsão financeira.');
  }

  return mapCashFlowVersionRow(data);
}

export async function publishCashFlowVersion(
  versionId: string,
  client?: SupabaseQueryClient | null,
): Promise<void> {
  if (isLocalTestMode && !client) {
    publishLocalCashFlowVersion(versionId);
    return;
  }

  const db = getClient(client);
  if (!db?.rpc) {
    throw new Error('Supabase não está configurado para publicar a previsão financeira.');
  }

  const { error } = await db.rpc('publish_cash_flow_version', {
    target_version_id: versionId,
  });

  if (error) {
    throw new Error('Não foi possível publicar a versão da previsão financeira.');
  }
}
