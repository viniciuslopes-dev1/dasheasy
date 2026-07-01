import type { CashFlowDataset, CashFlowVersion, CashFlowVersionDataset } from '../types/cashFlow';
import type {
  CashFlowReportDataset,
  CashFlowReportVersion,
  CashFlowReportVersionDataset,
} from '../types/cashFlowReport';
import type { DashboardDataset, DashboardVersion, ExcelAnalysis, FinancialRecord } from '../types/financial';
import { calculateCashFlowMetrics } from './cashFlowService';
import { calculateCashFlowReportMetrics } from './cashFlowReportService';

type DashboardEntry = {
  version: DashboardVersion;
  records: FinancialRecord[];
};

type CashFlowEntry = {
  version: CashFlowVersion;
  dataset: CashFlowDataset;
};

type CashFlowReportEntry = {
  version: CashFlowReportVersion;
  dataset: CashFlowReportDataset;
};

type LocalStore = {
  dashboard: DashboardEntry[];
  forecast: CashFlowEntry[];
  cashFlow: CashFlowReportEntry[];
};

const STORE_KEY = 'dasheasy:local-test-store';

const EMPTY_STORE: LocalStore = {
  dashboard: [],
  forecast: [],
  cashFlow: [],
};

function readStore(): LocalStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) {
      return EMPTY_STORE;
    }

    const parsed = JSON.parse(raw) as Partial<LocalStore>;
    return {
      dashboard: parsed.dashboard ?? [],
      forecast: parsed.forecast ?? [],
      cashFlow: parsed.cashFlow ?? [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

function writeStore(store: LocalStore) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nextVersionNumber<T extends { version: { versionNumber: number } }>(entries: T[]) {
  return entries.reduce((max, entry) => Math.max(max, entry.version.versionNumber), 0) + 1;
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(versions: T[]) {
  return [...versions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function clearLocalTestStore() {
  window.localStorage.removeItem(STORE_KEY);
}

export function loadLocalPublishedDashboard(): DashboardDataset {
  const entry = readStore().dashboard.find((item) => item.version.status === 'published');
  return entry ? { version: entry.version, records: entry.records } : { version: null, records: [] };
}

export function loadLocalDashboardVersion(versionId: string): DashboardDataset {
  const entry = readStore().dashboard.find((item) => item.version.id === versionId);
  return entry ? { version: entry.version, records: entry.records } : { version: null, records: [] };
}

export function loadLocalAdminDashboardVersions(): DashboardVersion[] {
  return sortByCreatedAtDesc(readStore().dashboard.map((entry) => entry.version));
}

export function saveLocalDashboardDraft(
  analysis: ExcelAnalysis,
  sourceFileName: string,
  userId?: string,
): DashboardVersion {
  const store = readStore();
  const now = new Date().toISOString();
  const version: DashboardVersion = {
    id: makeId('local-dashboard'),
    versionNumber: nextVersionNumber(store.dashboard),
    status: 'draft',
    sourceFileName,
    sheetName: analysis.sheetName,
    recordCount: analysis.recordCount,
    blockCount: analysis.blockCount,
    totalAmountCents: analysis.totalAmountCents,
    metadata: {
      localTestMode: true,
      issueCount: analysis.issues.length,
    },
    createdBy: userId ?? null,
    publishedBy: null,
    createdAt: now,
    publishedAt: null,
  };

  store.dashboard.unshift({ version, records: analysis.records });
  writeStore(store);
  return version;
}

export function publishLocalDashboardVersion(versionId: string) {
  const store = readStore();
  const now = new Date().toISOString();
  store.dashboard = store.dashboard.map((entry) => {
    if (entry.version.id === versionId) {
      return {
        ...entry,
        version: {
          ...entry.version,
          status: 'published',
          publishedAt: now,
          publishedBy: entry.version.createdBy,
        },
      };
    }

    if (entry.version.status === 'published') {
      return {
        ...entry,
        version: {
          ...entry.version,
          status: 'archived',
        },
      };
    }

    return entry;
  });
  writeStore(store);
}

export function loadLocalPublishedCashFlow(): CashFlowVersionDataset {
  const entry = readStore().forecast.find((item) => item.version.status === 'published');
  return entry ? { version: entry.version, dataset: entry.dataset } : { version: null, dataset: null };
}

export function loadLocalCashFlowVersion(versionId: string): CashFlowVersionDataset {
  const entry = readStore().forecast.find((item) => item.version.id === versionId);
  return entry ? { version: entry.version, dataset: entry.dataset } : { version: null, dataset: null };
}

export function loadLocalAdminCashFlowVersions(): CashFlowVersion[] {
  return sortByCreatedAtDesc(readStore().forecast.map((entry) => entry.version));
}

export function saveLocalCashFlowDraft(dataset: CashFlowDataset, userId?: string): CashFlowVersion {
  const store = readStore();
  const metrics = calculateCashFlowMetrics(dataset);
  const now = new Date().toISOString();
  const version: CashFlowVersion = {
    id: makeId('local-forecast'),
    versionNumber: nextVersionNumber(store.forecast),
    status: 'draft',
    sourceFileName: dataset.sourceFileName ?? 'previsão-financeira.xlsx',
    monthLabel: dataset.monthLabel,
    startDate: dataset.startDate,
    endDate: dataset.endDate,
    movementCount: dataset.movements.length,
    accountCount: dataset.bankAccounts.length,
    initialBalanceCents: metrics.initialBalanceCents,
    currentForecastCents: metrics.currentForecastClosingCents,
    dataset,
    metadata: {
      localTestMode: true,
      issueCount: dataset.issues?.length ?? 0,
    },
    createdBy: userId ?? null,
    publishedBy: null,
    createdAt: now,
    publishedAt: null,
  };

  store.forecast.unshift({ version, dataset });
  writeStore(store);
  return version;
}

export function publishLocalCashFlowVersion(versionId: string) {
  const store = readStore();
  const now = new Date().toISOString();
  store.forecast = store.forecast.map((entry) => {
    if (entry.version.id === versionId) {
      return {
        ...entry,
        version: {
          ...entry.version,
          status: 'published',
          publishedAt: now,
          publishedBy: entry.version.createdBy,
        },
      };
    }

    if (entry.version.status === 'published') {
      return {
        ...entry,
        version: {
          ...entry.version,
          status: 'archived',
        },
      };
    }

    return entry;
  });
  writeStore(store);
}

export function loadLocalPublishedCashFlowReport(): CashFlowReportVersionDataset {
  const entry = readStore().cashFlow.find((item) => item.version.status === 'published');
  return entry ? { version: entry.version, dataset: entry.dataset } : { version: null, dataset: null };
}

export function loadLocalCashFlowReportVersion(versionId: string): CashFlowReportVersionDataset {
  const entry = readStore().cashFlow.find((item) => item.version.id === versionId);
  return entry ? { version: entry.version, dataset: entry.dataset } : { version: null, dataset: null };
}

export function loadLocalAdminCashFlowReportVersions(): CashFlowReportVersion[] {
  return sortByCreatedAtDesc(readStore().cashFlow.map((entry) => entry.version));
}

export function saveLocalCashFlowReportDraft(
  dataset: CashFlowReportDataset,
  userId?: string,
): CashFlowReportVersion {
  const store = readStore();
  const metrics = calculateCashFlowReportMetrics(dataset);
  const now = new Date().toISOString();
  const version: CashFlowReportVersion = {
    id: makeId('local-cash-flow'),
    versionNumber: nextVersionNumber(store.cashFlow),
    status: 'draft',
    sourceFileName: dataset.sourceFileName ?? 'fluxo-de-caixa.xlsx',
    monthLabel: dataset.monthLabel,
    startDate: dataset.startDate,
    endDate: dataset.endDate,
    movementCount: dataset.movements.length,
    dailyRowCount: dataset.dailyRows.length,
    anticipatedCount: dataset.anticipatedMovements.length,
    variationCount: dataset.variations.length,
    initialBalanceCents: dataset.initialBalanceCents,
    closingBalanceCents: metrics.closingBalanceCents,
    dataset,
    metadata: {
      localTestMode: true,
      issueCount: dataset.issues.length,
    },
    createdBy: userId ?? null,
    publishedBy: null,
    createdAt: now,
    publishedAt: null,
  };

  store.cashFlow.unshift({ version, dataset });
  writeStore(store);
  return version;
}

export function updateLocalCashFlowReportVersionDataset(
  versionId: string,
  dataset: CashFlowReportDataset,
): CashFlowReportVersion | null {
  const store = readStore();
  const entryIndex = store.cashFlow.findIndex((entry) => entry.version.id === versionId);
  if (entryIndex < 0) {
    return null;
  }

  const metrics = calculateCashFlowReportMetrics(dataset);
  const entry = store.cashFlow[entryIndex];
  const version: CashFlowReportVersion = {
    ...entry.version,
    sourceFileName: dataset.sourceFileName ?? entry.version.sourceFileName,
    monthLabel: dataset.monthLabel,
    startDate: dataset.startDate,
    endDate: dataset.endDate,
    movementCount: dataset.movements.length,
    dailyRowCount: dataset.dailyRows.length,
    anticipatedCount: dataset.anticipatedMovements.length,
    variationCount: dataset.variations.length,
    initialBalanceCents: dataset.initialBalanceCents,
    closingBalanceCents: metrics.closingBalanceCents,
    dataset,
    metadata: {
      ...entry.version.metadata,
      localTestMode: true,
      issueCount: dataset.issues.length,
      bankAccountCount: dataset.bankAccounts.length,
    },
  };

  store.cashFlow[entryIndex] = {
    version,
    dataset,
  };
  writeStore(store);
  return version;
}

export function publishLocalCashFlowReportVersion(versionId: string) {
  const store = readStore();
  const now = new Date().toISOString();
  store.cashFlow = store.cashFlow.map((entry) => {
    if (entry.version.id === versionId) {
      return {
        ...entry,
        version: {
          ...entry.version,
          status: 'published',
          publishedAt: now,
          publishedBy: entry.version.createdBy,
        },
      };
    }

    if (entry.version.status === 'published') {
      return {
        ...entry,
        version: {
          ...entry.version,
          status: 'archived',
        },
      };
    }

    return entry;
  });
  writeStore(store);
}
