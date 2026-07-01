import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CashFlowReportDataset } from '../types/cashFlowReport';

function makeDataset(): CashFlowReportDataset {
  return {
    sourceFileName: 'fluxo.xlsx',
    importedAt: '2026-06-30T12:00:00.000Z',
    sheetName: 'Planilha1',
    monthLabel: 'Junho de 2026',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    initialBalanceCents: 100_000,
    initialBalanceSource: 'spreadsheet',
    bankAccounts: [],
    movements: [],
    cashFlowMovements: [],
    anticipatedMovements: [],
    dailyRows: [
      {
        date: '2026-06-30',
        openingBalanceCents: 100_000,
        debitCents: 20_000,
        creditCents: 45_000,
        anticipatedCents: 0,
        netCents: 25_000,
        closingBalanceCents: 125_000,
        movementCount: 2,
      },
    ],
    variations: [],
    issues: [],
  };
}

describe('localVersionStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps local test imports available in memory when localStorage quota is exceeded', async () => {
    const removeItem = vi.fn();
    const setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn(() => null),
        removeItem,
        setItem,
      },
    });

    const {
      loadLocalAdminCashFlowReportVersions,
      loadLocalPublishedCashFlowReport,
      publishLocalCashFlowReportVersion,
      saveLocalCashFlowReportDraft,
    } = await import('./localVersionStore');

    const draft = saveLocalCashFlowReportDraft(makeDataset(), 'admin-local');
    publishLocalCashFlowReportVersion(draft.id);

    const versions = loadLocalAdminCashFlowReportVersions();
    const published = loadLocalPublishedCashFlowReport();

    expect(setItem).toHaveBeenCalled();
    expect(removeItem).toHaveBeenCalled();
    expect(versions).toHaveLength(1);
    expect(versions[0].status).toBe('published');
    expect(published.dataset?.monthLabel).toBe('Junho de 2026');
    expect(published.dataset?.dailyRows).toHaveLength(1);
  });
});
