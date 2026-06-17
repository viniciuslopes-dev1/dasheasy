import { describe, expect, it, vi } from 'vitest';
import {
  loadPublishedDashboard,
  mapDashboardVersionRow,
  mapFinancialRecordRow,
  mapRecordToInsertRow,
  publishDashboardVersion,
} from './dashboardVersionService';

const versionRow = {
  id: 'version-1',
  version_number: 3,
  status: 'published',
  source_file_name: 'custos.xlsx',
  sheet_name: 'Dados',
  record_count: 1,
  block_count: 1,
  total_amount_cents: 12345,
  metadata: { imported: true },
  created_by: 'user-1',
  published_by: 'user-1',
  created_at: '2026-06-16T10:00:00Z',
  published_at: '2026-06-16T10:05:00Z',
};

const recordRow = {
  id: 'record-1',
  import_id: 'import-1',
  version_id: 'version-1',
  source_row: 8,
  group_name: 'Salarios',
  group_key: 'SALARIOS',
  department_name: 'Financeiro',
  department_key: 'FINANCEIRO',
  classification_name: 'Administrativo',
  classification_key: 'ADMINISTRATIVO',
  financial_type: 'Despesa',
  financial_type_key: 'DESPESA',
  document_number: 'NF-1',
  person_name: 'Ana',
  person_key: 'ANA',
  due_date: '2026-06-10',
  amount_cents: 12345,
  detail_group_name: 'SALARIOS',
  detail_group_key: 'SALARIOS',
  raw_data: { col: 'valor' },
  dedupe_key: 'dedupe-1',
};

function createPublishedClient() {
  const versionQuery = {
    select: vi.fn(() => versionQuery),
    eq: vi.fn(() => versionQuery),
    order: vi.fn(() => versionQuery),
    limit: vi.fn(() => versionQuery),
    maybeSingle: vi.fn(async () => ({ data: versionRow, error: null })),
  };
  const recordsQuery = {
    select: vi.fn(() => recordsQuery),
    eq: vi.fn(() => recordsQuery),
    order: vi.fn(async () => ({ data: [recordRow], error: null })),
  };
  const client = {
    from: vi.fn((table: string) => (table === 'dashboard_versions' ? versionQuery : recordsQuery)),
  };

  return { client, versionQuery, recordsQuery };
}

describe('dashboardVersionService', () => {
  it('maps Supabase version rows into dashboard versions', () => {
    expect(mapDashboardVersionRow(versionRow)).toEqual({
      id: 'version-1',
      versionNumber: 3,
      status: 'published',
      sourceFileName: 'custos.xlsx',
      sheetName: 'Dados',
      recordCount: 1,
      blockCount: 1,
      totalAmountCents: 12345,
      metadata: { imported: true },
      createdBy: 'user-1',
      publishedBy: 'user-1',
      createdAt: '2026-06-16T10:00:00Z',
      publishedAt: '2026-06-16T10:05:00Z',
    });
  });

  it('maps Supabase record rows into financial records', () => {
    expect(mapFinancialRecordRow(recordRow)).toEqual(
      expect.objectContaining({
        id: 'record-1',
        importId: 'import-1',
        versionId: 'version-1',
        sourceRow: 8,
        groupName: 'Salarios',
        departmentName: 'Financeiro',
        personName: 'Ana',
        amountCents: 12345,
      }),
    );
  });

  it('loads the current published dashboard and its records', async () => {
    const { client, versionQuery, recordsQuery } = createPublishedClient();

    await expect(loadPublishedDashboard(client as never)).resolves.toEqual({
      version: expect.objectContaining({ id: 'version-1', status: 'published' }),
      records: [expect.objectContaining({ id: 'record-1', versionId: 'version-1' })],
    });

    expect(client.from).toHaveBeenNthCalledWith(1, 'dashboard_versions');
    expect(versionQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(client.from).toHaveBeenNthCalledWith(2, 'financial_records');
    expect(recordsQuery.eq).toHaveBeenCalledWith('version_id', 'version-1');
  });

  it('publishes through the database RPC so only one version becomes active', async () => {
    const rpc = vi.fn(async () => ({ error: null }));

    await publishDashboardVersion('version-1', { rpc } as never);

    expect(rpc).toHaveBeenCalledWith('publish_dashboard_version', {
      target_version_id: 'version-1',
    });
  });

  it('keeps duplicated logical records insertable by adding row identity to persisted dedupe keys', () => {
    const firstRecord = mapFinancialRecordRow({ ...recordRow, id: 'record-1', source_row: 8 });
    const secondRecord = mapFinancialRecordRow({ ...recordRow, id: 'record-2', source_row: 9 });

    const firstRow = mapRecordToInsertRow(firstRecord, 'import-1', 'version-1');
    const secondRow = mapRecordToInsertRow(secondRecord, 'import-1', 'version-1');

    expect(firstRecord.dedupeKey).toBe(secondRecord.dedupeKey);
    expect(firstRow.dedupe_key).not.toBe(secondRow.dedupe_key);
    expect(firstRow.raw_data.logicalDedupeKey).toBe(firstRecord.dedupeKey);
    expect(secondRow.raw_data.logicalDedupeKey).toBe(secondRecord.dedupeKey);
  });
});
