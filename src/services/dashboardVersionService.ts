import { supabase } from '../lib/supabase';
import type {
  DashboardDataset,
  DashboardVersion,
  DashboardVersionStatus,
  ExcelAnalysis,
  FinancialRecord,
} from '../types/financial';
import { isLocalTestMode } from './localTestMode';
import {
  loadLocalAdminDashboardVersions,
  loadLocalDashboardVersion,
  loadLocalPublishedDashboard,
  publishLocalDashboardVersion,
  saveLocalDashboardDraft,
} from './localVersionStore';

type SupabaseQueryClient = {
  from: (table: string) => any;
  rpc?: (fn: string, args?: Record<string, unknown>) => any;
};

export function mapDashboardVersionRow(row: any): DashboardVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status as DashboardVersionStatus,
    sourceFileName: row.source_file_name,
    sheetName: row.sheet_name,
    recordCount: row.record_count,
    blockCount: row.block_count,
    totalAmountCents: row.total_amount_cents,
    metadata: row.metadata ?? {},
    createdBy: row.created_by ?? null,
    publishedBy: row.published_by ?? null,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? null,
  };
}

export function mapFinancialRecordRow(row: any): FinancialRecord {
  const rawData = row.raw_data ?? {};
  return {
    id: row.id,
    importId: row.import_id,
    versionId: row.version_id,
    sourceRow: row.source_row,
    groupName: row.group_name,
    groupKey: row.group_key,
    departmentName: row.department_name,
    departmentKey: row.department_key,
    classificationName: row.classification_name,
    classificationKey: row.classification_key,
    financialType: row.financial_type,
    financialTypeKey: row.financial_type_key,
    documentNumber: row.document_number,
    personName: row.person_name,
    personKey: row.person_key,
    dueDate: row.due_date,
    amountCents: row.amount_cents,
    detailGroupName: row.detail_group_name,
    detailGroupKey: row.detail_group_key,
    rawData,
    dedupeKey: rawData.logicalDedupeKey ?? row.dedupe_key,
  };
}

export function mapRecordToInsertRow(record: FinancialRecord, importId: string, versionId: string) {
  return {
    import_id: importId,
    version_id: versionId,
    source_row: record.sourceRow,
    group_name: record.groupName,
    group_key: record.groupKey,
    department_name: record.departmentName,
    department_key: record.departmentKey,
    classification_name: record.classificationName,
    classification_key: record.classificationKey,
    financial_type: record.financialType,
    financial_type_key: record.financialTypeKey,
    document_number: record.documentNumber,
    person_name: record.personName,
    person_key: record.personKey,
    due_date: record.dueDate,
    amount_cents: record.amountCents,
    detail_group_name: record.detailGroupName,
    detail_group_key: record.detailGroupKey,
    raw_data: {
      ...record.rawData,
      logicalDedupeKey: record.dedupeKey,
    },
    dedupe_key: `${record.dedupeKey}|ROW:${record.sourceRow}`,
  };
}

function getClient(client?: SupabaseQueryClient | null): SupabaseQueryClient | null {
  return client ?? supabase;
}

async function loadVersionRecords(versionId: string, client?: SupabaseQueryClient | null): Promise<FinancialRecord[]> {
  const db = getClient(client);
  if (!db) {
    return [];
  }

  const { data, error } = await db
    .from('financial_records')
    .select('*')
    .eq('version_id', versionId)
    .order('source_row', { ascending: true });

  if (error) {
    throw new Error('Não foi possível carregar os lançamentos financeiros.');
  }

  return (data ?? []).map(mapFinancialRecordRow);
}

export async function loadPublishedDashboard(client?: SupabaseQueryClient | null): Promise<DashboardDataset> {
  if (isLocalTestMode && !client) {
    return loadLocalPublishedDashboard();
  }

  const db = getClient(client);
  if (!db) {
    return { version: null, records: [] };
  }

  const { data, error } = await db
    .from('dashboard_versions')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Não foi possível carregar o dashboard publicado.');
  }

  if (!data) {
    return { version: null, records: [] };
  }

  const version = mapDashboardVersionRow(data);
  const records = await loadVersionRecords(version.id, db);
  return { version, records };
}

export async function loadDashboardVersion(versionId: string, client?: SupabaseQueryClient | null): Promise<DashboardDataset> {
  if (isLocalTestMode && !client) {
    return loadLocalDashboardVersion(versionId);
  }

  const db = getClient(client);
  if (!db) {
    return { version: null, records: [] };
  }

  const { data, error } = await db.from('dashboard_versions').select('*').eq('id', versionId).maybeSingle();
  if (error) {
    throw new Error('Não foi possível carregar a versão selecionada.');
  }

  if (!data) {
    return { version: null, records: [] };
  }

  return {
    version: mapDashboardVersionRow(data),
    records: await loadVersionRecords(versionId, db),
  };
}

export async function loadAdminDashboardVersions(client?: SupabaseQueryClient | null): Promise<DashboardVersion[]> {
  if (isLocalTestMode && !client) {
    return loadLocalAdminDashboardVersions();
  }

  const db = getClient(client);
  if (!db) {
    return [];
  }

  const { data, error } = await db
    .from('dashboard_versions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Não foi possível carregar o histórico de versões.');
  }

  return (data ?? []).map(mapDashboardVersionRow);
}

export async function publishDashboardVersion(versionId: string, client?: SupabaseQueryClient | null): Promise<void> {
  if (isLocalTestMode && !client) {
    publishLocalDashboardVersion(versionId);
    return;
  }

  const db = getClient(client);
  if (!db?.rpc) {
    throw new Error('Supabase não está configurado para publicar versões.');
  }

  const { error } = await db.rpc('publish_dashboard_version', {
    target_version_id: versionId,
  });

  if (error) {
    throw new Error('Não foi possível publicar a versão selecionada.');
  }
}

export async function saveDashboardDraft(
  analysis: ExcelAnalysis,
  sourceFileName: string,
  userId?: string,
  client?: SupabaseQueryClient | null,
): Promise<DashboardVersion | null> {
  if (isLocalTestMode && !client) {
    return saveLocalDashboardDraft(analysis, sourceFileName, userId);
  }

  const db = getClient(client);
  if (!db) {
    return null;
  }

  const metadata = {
    declaredTotalAmountCents: analysis.declaredTotalAmountCents,
    issueCounts: analysis.issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.type] = (acc[issue.type] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const { data: versionRow, error: versionError } = await db
    .from('dashboard_versions')
    .insert({
      status: 'draft',
      source_file_name: sourceFileName,
      sheet_name: analysis.sheetName,
      record_count: analysis.recordCount,
      block_count: analysis.blockCount,
      total_amount_cents: analysis.totalAmountCents,
      metadata,
      created_by: userId ?? null,
    })
    .select()
    .single();

  if (versionError) {
    throw new Error('Não foi possível criar a versão do dashboard.');
  }

  const version = mapDashboardVersionRow(versionRow);
  const { data: importRow, error: importError } = await db
    .from('financial_imports')
    .insert({
      version_id: version.id,
      user_id: userId ?? null,
      source_file_name: sourceFileName,
      sheet_name: analysis.sheetName,
      record_count: analysis.recordCount,
      block_count: analysis.blockCount,
      total_amount_cents: analysis.totalAmountCents,
      metadata,
    })
    .select()
    .single();

  if (importError) {
    throw new Error('Não foi possível salvar a importação no Supabase.');
  }

  const rows = analysis.records.map((record) => mapRecordToInsertRow(record, importRow.id, version.id));

  const { error: recordsError } = await db.from('financial_records').insert(rows);
  if (recordsError) {
    const detail = recordsError.message ? ` Detalhe: ${recordsError.message}` : '';
    throw new Error(`Não foi possível salvar os lançamentos no Supabase.${detail}`);
  }

  return version;
}
