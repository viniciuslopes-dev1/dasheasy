import { describe, expect, it, vi } from 'vitest';
import type { CashFlowDataset } from '../types/cashFlow';
import {
  loadAdminCashFlowVersions,
  loadCashFlowVersion,
  loadPublishedCashFlow,
  mapCashFlowVersionRow,
  publishCashFlowVersion,
  saveCashFlowDraft,
} from './cashFlowVersionService';

const dataset: CashFlowDataset = {
  monthLabel: 'Junho de 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  initialForecastClosingCents: 50000,
  sourceFileName: 'fluxo.xlsx',
  bankAccounts: [
    {
      id: 'account-1',
      code: '341',
      bank: 'ITAU',
      description: 'Conta principal',
      balanceCents: 100000,
      includeInCash: true,
      updatedAt: '2026-06-01',
    },
  ],
  movements: [
    {
      id: 'movement-1',
      date: '2026-06-02',
      documentNumber: 'D-1',
      counterparty: 'Fornecedor',
      type: 'DEBITO',
      category: 'A pagar',
      valueCents: 50000,
      status: 'PREVISTO',
      origin: 'IMPORTACAO_INICIAL',
    },
  ],
  changes: [],
  snapshots: [],
};

const versionRow = {
  id: 'cash-version-1',
  version_number: 2,
  status: 'published',
  source_file_name: 'fluxo.xlsx',
  month_label: 'Junho de 2026',
  start_date: '2026-06-01',
  end_date: '2026-06-30',
  movement_count: 1,
  account_count: 1,
  initial_balance_cents: 100000,
  current_forecast_cents: 50000,
  dataset,
  metadata: { warningCount: 0 },
  created_by: 'user-1',
  published_by: 'user-1',
  created_at: '2026-06-18T10:00:00Z',
  published_at: '2026-06-18T10:05:00Z',
};

describe('cashFlowVersionService', () => {
  it('maps a Supabase row into a cash flow version', () => {
    expect(mapCashFlowVersionRow(versionRow)).toEqual({
      id: 'cash-version-1',
      versionNumber: 2,
      status: 'published',
      sourceFileName: 'fluxo.xlsx',
      monthLabel: 'Junho de 2026',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      movementCount: 1,
      accountCount: 1,
      initialBalanceCents: 100000,
      currentForecastCents: 50000,
      dataset,
      metadata: { warningCount: 0 },
      createdBy: 'user-1',
      publishedBy: 'user-1',
      createdAt: '2026-06-18T10:00:00Z',
      publishedAt: '2026-06-18T10:05:00Z',
    });
  });

  it('loads only the published cash flow for the public dashboard', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({ data: versionRow, error: null })),
    };
    const client = { from: vi.fn(() => query) };

    await expect(loadPublishedCashFlow(client as never)).resolves.toEqual({
      version: expect.objectContaining({ id: 'cash-version-1', status: 'published' }),
      dataset,
    });
    expect(query.eq).toHaveBeenCalledWith('status', 'published');
  });

  it('saves an imported dataset as an admin draft', async () => {
    const query = {
      insert: vi.fn(() => query),
      select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: { ...versionRow, status: 'draft', published_at: null }, error: null })),
    };
    const client = { from: vi.fn(() => query) };

    await expect(saveCashFlowDraft(dataset, 'user-1', client as never)).resolves.toEqual(
      expect.objectContaining({ status: 'draft', sourceFileName: 'fluxo.xlsx' }),
    );
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        source_file_name: 'fluxo.xlsx',
        dataset,
        created_by: 'user-1',
      }),
    );
  });

  it('lists lightweight admin versions and loads a selected full dataset', async () => {
    const listQuery = {
      select: vi.fn(() => listQuery),
      order: vi.fn(async () => ({ data: [{ ...versionRow, dataset: undefined }], error: null })),
    };
    const detailQuery = {
      select: vi.fn(() => detailQuery),
      eq: vi.fn(() => detailQuery),
      maybeSingle: vi.fn(async () => ({ data: versionRow, error: null })),
    };
    const client = {
      from: vi.fn()
        .mockReturnValueOnce(listQuery)
        .mockReturnValueOnce(detailQuery),
    };

    await expect(loadAdminCashFlowVersions(client as never)).resolves.toEqual([
      expect.objectContaining({ id: 'cash-version-1', dataset: null }),
    ]);
    await expect(loadCashFlowVersion('cash-version-1', client as never)).resolves.toEqual({
      version: expect.objectContaining({ id: 'cash-version-1' }),
      dataset,
    });
  });

  it('publishes through the dedicated database RPC', async () => {
    const rpc = vi.fn(async () => ({ error: null }));

    await publishCashFlowVersion('cash-version-1', { rpc } as never);

    expect(rpc).toHaveBeenCalledWith('publish_cash_flow_version', {
      target_version_id: 'cash-version-1',
    });
  });
});
