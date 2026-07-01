import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { History, Home, LogOut, PieChart, Table2, UploadCloud, WalletCards, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import {
  loadAdminDashboardVersions,
  loadDashboardVersion,
  loadPublishedDashboard,
  publishDashboardVersion,
} from './services/dashboardVersionService';
import {
  loadAdminCashFlowVersions,
  loadCashFlowVersion,
  loadPublishedCashFlow,
  publishCashFlowVersion,
} from './services/cashFlowVersionService';
import {
  loadAdminCashFlowReportVersions,
  loadCashFlowReportVersion,
  loadPublishedCashFlowReport,
  publishCashFlowReportVersion,
  updateCashFlowReportVersionDataset,
} from './services/cashFlowReportVersionService';
import { isDashboardAdmin } from './services/adminAuthorizationService';
import { clearLocalTestStore } from './services/localVersionStore';
import { isLocalTestMode, LOCAL_TEST_USER_ID, LOCAL_TEST_USER_NAME } from './services/localTestMode';
import type { CashFlowDataset, CashFlowVersion, CashFlowVersionDataset } from './types/cashFlow';
import type {
  CashFlowReportDataset,
  CashFlowReportVersion,
  CashFlowReportVersionDataset,
} from './types/cashFlowReport';
import type { DashboardDataset, DashboardVersion, ExcelAnalysis } from './types/financial';
import type { AppView } from './types/navigation';

const EMPTY_DATASET: DashboardDataset = { version: null, records: [] };
const EMPTY_CASH_FLOW_DATASET: CashFlowVersionDataset = { version: null, dataset: null };
const EMPTY_CASH_FLOW_REPORT_DATASET: CashFlowReportVersionDataset = { version: null, dataset: null };
const PUBLIC_DASHBOARD_CACHE_KEY = 'dasheasy:published-dashboard';
const PUBLIC_CASH_FLOW_CACHE_KEY = 'dasheasy:published-cash-flow';
const PUBLIC_CASH_FLOW_REPORT_CACHE_KEY = 'dasheasy:published-cash-flow-report';
const LOCAL_TEST_SESSION = {
  access_token: 'local-test-token',
  refresh_token: 'local-test-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: LOCAL_TEST_USER_ID,
    email: 'admin-local@dasheasy.test',
    user_metadata: {
      name: LOCAL_TEST_USER_NAME,
    },
  },
} as unknown as Session;

const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const CashFlowReportVersionHistory = lazy(() => import('./components/admin/CashFlowReportVersionHistory'));
const CashFlowVersionHistory = lazy(() => import('./components/admin/CashFlowVersionHistory'));
const VersionHistory = lazy(() => import('./components/admin/VersionHistory'));
const CashFlowReportDashboard = lazy(() => import('./components/cash-flow-report/CashFlowReportDashboard'));
const CashFlowReportUpload = lazy(() => import('./components/cash-flow-report/CashFlowReportUpload'));
const ExcelUpload = lazy(() => import('./components/ExcelUpload'));
const CashFlowDashboard = lazy(() => import('./components/cash-flow/CashFlowDashboard'));
const ComparisonDashboard = lazy(() => import('./components/comparisons/ComparisonDashboard'));
const FinancialDashboard = lazy(() => import('./components/dashboard/FinancialDashboard'));

function RouteLoading() {
  return (
    <section className="route-loading" aria-label="Carregando módulo">
      <span>Carregando...</span>
    </section>
  );
}

function readCachedPublishedDashboard(): DashboardDataset {
  try {
    const cached = window.localStorage.getItem(PUBLIC_DASHBOARD_CACHE_KEY);
    return cached ? JSON.parse(cached) : EMPTY_DATASET;
  } catch {
    return EMPTY_DATASET;
  }
}

function writeCachedPublishedDashboard(dataset: DashboardDataset) {
  try {
    if (dataset.version) {
      window.localStorage.setItem(PUBLIC_DASHBOARD_CACHE_KEY, JSON.stringify(dataset));
    } else {
      window.localStorage.removeItem(PUBLIC_DASHBOARD_CACHE_KEY);
    }
  } catch {
    // localStorage can be unavailable in private contexts; the app still works without cache.
  }
}

function readCachedPublishedCashFlow(): CashFlowVersionDataset {
  try {
    const cached = window.localStorage.getItem(PUBLIC_CASH_FLOW_CACHE_KEY);
    return cached ? JSON.parse(cached) : EMPTY_CASH_FLOW_DATASET;
  } catch {
    return EMPTY_CASH_FLOW_DATASET;
  }
}

function writeCachedPublishedCashFlow(dataset: CashFlowVersionDataset) {
  try {
    if (dataset.version) {
      window.localStorage.setItem(PUBLIC_CASH_FLOW_CACHE_KEY, JSON.stringify(dataset));
    } else {
      window.localStorage.removeItem(PUBLIC_CASH_FLOW_CACHE_KEY);
    }
  } catch {
    // localStorage can be unavailable in private contexts; the app still works without cache.
  }
}

function readCachedPublishedCashFlowReport(): CashFlowReportVersionDataset {
  try {
    const cached = window.localStorage.getItem(PUBLIC_CASH_FLOW_REPORT_CACHE_KEY);
    return cached ? JSON.parse(cached) : EMPTY_CASH_FLOW_REPORT_DATASET;
  } catch {
    return EMPTY_CASH_FLOW_REPORT_DATASET;
  }
}

function writeCachedPublishedCashFlowReport(dataset: CashFlowReportVersionDataset) {
  try {
    if (dataset.version) {
      window.localStorage.setItem(PUBLIC_CASH_FLOW_REPORT_CACHE_KEY, JSON.stringify(dataset));
    } else {
      window.localStorage.removeItem(PUBLIC_CASH_FLOW_REPORT_CACHE_KEY);
    }
  } catch {
    // localStorage can be unavailable in private contexts; the app still works without cache.
  }
}

function clearLocalPublishedCaches() {
  try {
    window.localStorage.removeItem(PUBLIC_DASHBOARD_CACHE_KEY);
    window.localStorage.removeItem(PUBLIC_CASH_FLOW_CACHE_KEY);
    window.localStorage.removeItem(PUBLIC_CASH_FLOW_REPORT_CACHE_KEY);
  } catch {
    // Local maintenance should not block the app if browser storage is unavailable.
  }
}

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');
  const shouldResetLocalTestData =
    isLocalTestMode && new URLSearchParams(window.location.search).has('resetLocalTest');

  if (shouldResetLocalTestData) {
    clearLocalTestStore();
    clearLocalPublishedCaches();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }

  const [session, setSession] = useState<Session | null>(() =>
    isLocalTestMode && isAdminRoute ? LOCAL_TEST_SESSION : null,
  );
  const [isAuthReady, setIsAuthReady] = useState(isLocalTestMode || !supabase);
  const [isAdminAuthorizationReady, setIsAdminAuthorizationReady] = useState(
    isLocalTestMode || !isAdminRoute || !supabase,
  );
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(isLocalTestMode && isAdminRoute);
  const [publishedDataset, setPublishedDataset] = useState<DashboardDataset>(() =>
    isAdminRoute || isLocalTestMode ? EMPTY_DATASET : readCachedPublishedDashboard(),
  );
  const [publishedCashFlow, setPublishedCashFlow] = useState<CashFlowVersionDataset>(() =>
    isAdminRoute || isLocalTestMode ? EMPTY_CASH_FLOW_DATASET : readCachedPublishedCashFlow(),
  );
  const [publishedCashFlowReport, setPublishedCashFlowReport] = useState<CashFlowReportVersionDataset>(() =>
    isAdminRoute || isLocalTestMode ? EMPTY_CASH_FLOW_REPORT_DATASET : readCachedPublishedCashFlowReport(),
  );
  const [adminDataset, setAdminDataset] = useState<DashboardDataset>(EMPTY_DATASET);
  const [adminCashFlow, setAdminCashFlow] = useState<CashFlowVersionDataset>(EMPTY_CASH_FLOW_DATASET);
  const [adminCashFlowReport, setAdminCashFlowReport] = useState<CashFlowReportVersionDataset>(EMPTY_CASH_FLOW_REPORT_DATASET);
  const [versions, setVersions] = useState<DashboardVersion[]>([]);
  const [cashFlowVersions, setCashFlowVersions] = useState<CashFlowVersion[]>([]);
  const [cashFlowReportVersions, setCashFlowReportVersions] = useState<CashFlowReportVersion[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCashFlowPublishing, setIsCashFlowPublishing] = useState(false);
  const [error, setError] = useState('');

  const isAdminAuthenticated = Boolean(session?.user && isAdminAuthorized);
  const pageTitle = isAdminRoute
    ? 'Administração'
    : activeView === 'comparisons'
      ? 'Comparações'
      : activeView === 'cashFlow'
        ? 'Fluxo de caixa'
      : activeView === 'forecast'
        ? 'Previsão financeira'
        : 'Visão geral';
  const pageDescription = isAdminRoute
    ? 'Importe, publique e restaure versões do dashboard'
    : activeView === 'comparisons'
      ? 'Compare departamentos, agrupamentos e responsáveis'
      : activeView === 'cashFlow'
        ? 'Acompanhe débitos, créditos, antecipados e saldo diário'
      : activeView === 'forecast'
        ? 'Acompanhe previsão inicial, saldo projetado e variações'
        : 'Análise consolidada dos valores publicados';

  const currentPublicEmptyText = useMemo(
    () =>
      isDashboardLoading
        ? {
            title: 'Carregando dashboard publicado.',
            description: 'Estamos buscando a versão ativa no Supabase.',
          }
        : {
            title: 'Nenhum dashboard publicado ainda.',
            description: 'Quando o administrador publicar uma versão, os dados aparecerão aqui automaticamente.',
          },
    [isDashboardLoading],
  );

  const refreshPublishedData = useCallback(async () => {
    setIsDashboardLoading(true);
    setError('');
    try {
      const [dataset, cashFlowDataset, cashFlowReportDataset] = await Promise.all([
        loadPublishedDashboard(),
        loadPublishedCashFlow(),
        loadPublishedCashFlowReport(),
      ]);
      setPublishedDataset(dataset);
      setPublishedCashFlow(cashFlowDataset);
      setPublishedCashFlowReport(cashFlowReportDataset);
      if (!isLocalTestMode) {
        writeCachedPublishedDashboard(dataset);
        writeCachedPublishedCashFlow(cashFlowDataset);
        writeCachedPublishedCashFlowReport(cashFlowReportDataset);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o dashboard publicado.');
    } finally {
      setIsDashboardLoading(false);
    }
  }, []);

  const refreshAdminWorkspace = useCallback(async () => {
    if (!isAdminRoute || !session?.user || !isAdminAuthorized) {
      return;
    }

    setIsAdminLoading(true);
    setError('');
    try {
      const [nextVersions, nextCashFlowVersions, nextCashFlowReportVersions] = await Promise.all([
        loadAdminDashboardVersions(),
        loadAdminCashFlowVersions(),
        loadAdminCashFlowReportVersions(),
      ]);
      setVersions(nextVersions);
      setCashFlowVersions(nextCashFlowVersions);
      setCashFlowReportVersions(nextCashFlowReportVersions);

      const [nextDashboard, nextCashFlow, nextCashFlowReport] = await Promise.all([
        nextVersions[0] ? loadDashboardVersion(nextVersions[0].id) : Promise.resolve(EMPTY_DATASET),
        nextCashFlowVersions[0]
          ? loadCashFlowVersion(nextCashFlowVersions[0].id)
          : Promise.resolve(EMPTY_CASH_FLOW_DATASET),
        nextCashFlowReportVersions[0]
          ? loadCashFlowReportVersion(nextCashFlowReportVersions[0].id)
          : Promise.resolve(EMPTY_CASH_FLOW_REPORT_DATASET),
      ]);
      setAdminDataset(nextDashboard);
      setAdminCashFlow(nextCashFlow);
      setAdminCashFlowReport(nextCashFlowReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a área administrativa.');
    } finally {
      setIsAdminLoading(false);
    }
  }, [isAdminAuthorized, isAdminRoute, session?.user]);

  useEffect(() => {
    if (!isAdminRoute) {
      refreshPublishedData();
    }
  }, [isAdminRoute, refreshPublishedData]);

  useEffect(() => {
    if (isLocalTestMode) {
      setSession(isAdminRoute ? LOCAL_TEST_SESSION : null);
      setIsAuthReady(true);
      return;
    }

    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [isAdminRoute]);

  useEffect(() => {
    let isCancelled = false;

    if (!isAdminRoute || !isAuthReady) {
      return;
    }

    if (isLocalTestMode) {
      setSession(LOCAL_TEST_SESSION);
      setIsAdminAuthorized(true);
      setIsAdminAuthorizationReady(true);
      return;
    }

    if (!session?.user) {
      setIsAdminAuthorized(false);
      setIsAdminAuthorizationReady(true);
      return;
    }

    setIsAdminAuthorizationReady(false);

    isDashboardAdmin()
      .then(async (authorized) => {
        if (isCancelled) {
          return;
        }

        setIsAdminAuthorized(authorized);

        if (!authorized) {
          await supabase?.auth.signOut();
        }
      })
      .catch(async (err) => {
        if (isCancelled) {
          return;
        }

        setIsAdminAuthorized(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível verificar o acesso administrativo.',
        );
        await supabase?.auth.signOut();
      })
      .finally(() => {
        if (!isCancelled) {
          setIsAdminAuthorizationReady(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isAdminRoute, isAuthReady, session?.user?.id]);

  useEffect(() => {
    refreshAdminWorkspace();
  }, [refreshAdminWorkspace]);

  async function handleImported(analysis: ExcelAnalysis, version?: DashboardVersion | null) {
    setAdminDataset({ version: version ?? null, records: analysis.records });
    setIsSettingsOpen(false);
    await refreshAdminWorkspace();
  }

  async function handleCashFlowImported(dataset: CashFlowDataset, version?: CashFlowVersion | null) {
    setAdminCashFlow({ version: version ?? null, dataset });
    setIsSettingsOpen(false);
    await refreshAdminWorkspace();
  }

  async function handleCashFlowReportImported(dataset: CashFlowReportDataset, version?: CashFlowReportVersion | null) {
    setAdminCashFlowReport({ version: version ?? null, dataset });
    setIsSettingsOpen(false);
    await refreshAdminWorkspace();
  }

  async function handleSaveCashFlowReportDataset(dataset: CashFlowReportDataset) {
    if (!adminCashFlowReport.version) {
      throw new Error('Importe ou selecione uma versão do fluxo de caixa antes de salvar bancos.');
    }

    const version = await updateCashFlowReportVersionDataset(adminCashFlowReport.version.id, dataset);
    setAdminCashFlowReport({ version: version ?? adminCashFlowReport.version, dataset });
    setCashFlowReportVersions(await loadAdminCashFlowReportVersions());
  }

  async function handleSelectVersion(versionId: string) {
    setError('');
    setIsAdminLoading(true);
    setIsHistoryOpen(false);
    try {
      setAdminDataset(await loadDashboardVersion(versionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a versão selecionada.');
    } finally {
      setIsAdminLoading(false);
    }
  }

  async function handleSelectCashFlowVersion(versionId: string) {
    setError('');
    setIsAdminLoading(true);
    setIsHistoryOpen(false);
    try {
      setAdminCashFlow(await loadCashFlowVersion(versionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a versão de previsão financeira.');
    } finally {
      setIsAdminLoading(false);
    }
  }

  async function handleSelectCashFlowReportVersion(versionId: string) {
    setError('');
    setIsAdminLoading(true);
    setIsHistoryOpen(false);
    try {
      setAdminCashFlowReport(await loadCashFlowReportVersion(versionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir a versão do fluxo de caixa.');
    } finally {
      setIsAdminLoading(false);
    }
  }

  async function handlePublishVersion(versionId: string) {
    setIsPublishing(true);
    setError('');
    try {
      await publishDashboardVersion(versionId);
      setAdminDataset(await loadDashboardVersion(versionId));
      const dataset = await loadPublishedDashboard();
      setPublishedDataset(dataset);
      if (!isLocalTestMode) {
        writeCachedPublishedDashboard(dataset);
      }
      setVersions(await loadAdminDashboardVersions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar a versão selecionada.');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePublishCashFlowVersion(versionId: string) {
    setIsCashFlowPublishing(true);
    setError('');
    try {
      await publishCashFlowVersion(versionId);
      setAdminCashFlow(await loadCashFlowVersion(versionId));
      const dataset = await loadPublishedCashFlow();
      setPublishedCashFlow(dataset);
      if (!isLocalTestMode) {
        writeCachedPublishedCashFlow(dataset);
      }
      setCashFlowVersions(await loadAdminCashFlowVersions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar a previsão financeira.');
    } finally {
      setIsCashFlowPublishing(false);
    }
  }

  async function handlePublishCashFlowReportVersion(versionId: string) {
    setIsCashFlowPublishing(true);
    setError('');
    try {
      await publishCashFlowReportVersion(versionId);
      setAdminCashFlowReport(await loadCashFlowReportVersion(versionId));
      const dataset = await loadPublishedCashFlowReport();
      setPublishedCashFlowReport(dataset);
      if (!isLocalTestMode) {
        writeCachedPublishedCashFlowReport(dataset);
      }
      setCashFlowReportVersions(await loadAdminCashFlowReportVersions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar o fluxo de caixa.');
    } finally {
      setIsCashFlowPublishing(false);
    }
  }

  async function handleSignOut() {
    if (isLocalTestMode) {
      setIsSettingsOpen(false);
      setIsHistoryOpen(false);
      setSession(LOCAL_TEST_SESSION);
      setIsAdminAuthorized(true);
      return;
    }

    await supabase?.auth.signOut();
    setSession(null);
    setIsAdminAuthorized(false);
    setAdminDataset(EMPTY_DATASET);
    setAdminCashFlow(EMPTY_CASH_FLOW_DATASET);
    setAdminCashFlowReport(EMPTY_CASH_FLOW_REPORT_DATASET);
    setVersions([]);
    setCashFlowVersions([]);
    setCashFlowReportVersions([]);
  }

  if (isAdminRoute && (!isAuthReady || !isAdminAuthorizationReady)) {
    return (
      <main className="admin-login-page">
        <section className="panel admin-login-card">
          <span className="section-label">Carregando</span>
          <h1>Verificando sessão administrativa.</h1>
        </section>
      </main>
    );
  }

  if (isAdminRoute && !isAdminAuthenticated) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <AdminLogin onSignedIn={refreshAdminWorkspace} />
      </Suspense>
    );
  }

  const activeDataset = isAdminRoute ? adminDataset : publishedDataset;
  const activeCashFlow = isAdminRoute ? adminCashFlow : publishedCashFlow;
  const activeCashFlowReport = isAdminRoute ? adminCashFlowReport : publishedCashFlowReport;
  const activeVersionCount =
    activeView === 'cashFlow'
      ? cashFlowReportVersions.length
      : activeView === 'forecast'
        ? cashFlowVersions.length
        : versions.length;

  return (
    <main className="app-frame">
      <aside className="sidebar" aria-label="Navegação principal">
        <nav className="side-nav">
          <button
            className={activeView === 'overview' ? 'side-nav-item active' : 'side-nav-item'}
            type="button"
            aria-label="Visão geral"
            onClick={() => setActiveView('overview')}
          >
            <Home size={22} />
          </button>
          <button
            className={activeView === 'comparisons' ? 'side-nav-item active' : 'side-nav-item'}
            type="button"
            aria-label="Comparações"
            onClick={() => setActiveView('comparisons')}
          >
            <PieChart size={22} />
          </button>
          <button
            className={activeView === 'forecast' ? 'side-nav-item active' : 'side-nav-item'}
            type="button"
            aria-label="Previsão financeira"
            onClick={() => setActiveView('forecast')}
          >
            <WalletCards size={22} />
          </button>
          <button
            className={activeView === 'cashFlow' ? 'side-nav-item active' : 'side-nav-item'}
            type="button"
            aria-label="Fluxo de caixa"
            onClick={() => setActiveView('cashFlow')}
          >
            <Table2 size={22} />
          </button>
          {isAdminRoute ? (
            <button
              className="side-nav-item"
              type="button"
              aria-label="Histórico de versões"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History size={22} />
              {activeVersionCount > 0 ? <span className="side-badge">{activeVersionCount}</span> : null}
            </button>
          ) : null}
        </nav>
      </aside>

      <section className="app-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
          {isAdminRoute ? (
            <div className="topbar-actions">
              {isLocalTestMode ? <span className="local-test-pill">Teste local</span> : null}
              <button className="import-top-button" type="button" onClick={() => setIsSettingsOpen(true)}>
                <UploadCloud size={17} />
                Importar
              </button>
              <button className="secondary-top-button" type="button" onClick={handleSignOut}>
                <LogOut size={16} />
                Sair
              </button>
            </div>
          ) : null}
          <div className="mobile-view-switcher" aria-label="Navegação de telas">
            <button
              type="button"
              className={activeView === 'overview' ? 'active' : ''}
              onClick={() => setActiveView('overview')}
            >
              Visão geral
            </button>
            <button
              type="button"
              className={activeView === 'comparisons' ? 'active' : ''}
              onClick={() => setActiveView('comparisons')}
            >
              Comparações
            </button>
            <button
              type="button"
              className={activeView === 'forecast' ? 'active' : ''}
              onClick={() => setActiveView('forecast')}
            >
              Previsão
            </button>
            <button
              type="button"
              className={activeView === 'cashFlow' ? 'active' : ''}
              onClick={() => setActiveView('cashFlow')}
            >
              Fluxo
            </button>
          </div>
        </header>

        {isAdminRoute ? (
          <Suspense fallback={<RouteLoading />}>
            <AdminDashboard
              activeView={activeView}
              dataset={activeDataset}
              cashFlowDataset={activeCashFlow.dataset}
              cashFlowReportDataset={activeCashFlowReport.dataset}
              cashFlowReportVersionId={activeCashFlowReport.version?.id ?? null}
              isLoading={isAdminLoading}
              error={error}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onSaveCashFlowReportDataset={handleSaveCashFlowReportDataset}
            />
          </Suspense>
        ) : activeView === 'comparisons' ? (
          <Suspense fallback={<RouteLoading />}>
            <ComparisonDashboard records={activeDataset.records} />
          </Suspense>
        ) : activeView === 'cashFlow' ? (
          <Suspense fallback={<RouteLoading />}>
            {isDashboardLoading ? <RouteLoading /> : <CashFlowReportDashboard dataset={activeCashFlowReport.dataset} />}
          </Suspense>
        ) : activeView === 'forecast' ? (
          <Suspense fallback={<RouteLoading />}>
            {isDashboardLoading ? <RouteLoading /> : <CashFlowDashboard dataset={activeCashFlow.dataset} />}
          </Suspense>
        ) : (
          <Suspense fallback={<RouteLoading />}>
            <FinancialDashboard
              records={activeDataset.records}
              analysis={null}
              emptyTitle={currentPublicEmptyText.title}
              emptyDescription={currentPublicEmptyText.description}
            />
          </Suspense>
        )}
      </section>

      {isAdminRoute && isSettingsOpen ? (
        <div className="settings-overlay" role="presentation">
          <button className="settings-backdrop" type="button" aria-label="Fechar configurações" onClick={() => setIsSettingsOpen(false)} />
          <aside className="settings-drawer" aria-label="Configurações de importação">
            <div className="settings-drawer-header">
              <div>
                <h2>Configurações</h2>
                <p>Importe uma nova planilha, revise o rascunho e publique quando estiver pronto.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Fechar configurações" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <Suspense fallback={<RouteLoading />}>
              {activeView === 'cashFlow' || activeView === 'forecast' ? (
                <CashFlowReportUpload
                  onImported={handleCashFlowReportImported}
                  onForecastImported={handleCashFlowImported}
                  userId={session?.user.id}
                  baselineDataset={adminCashFlowReport.dataset}
                  baselineForecastDataset={adminCashFlow.dataset}
                />
              ) : (
                <ExcelUpload onImported={handleImported} userId={session?.user.id} />
              )}
            </Suspense>
          </aside>
        </div>
      ) : null}

      {isAdminRoute && isHistoryOpen ? (
        <div className="history-overlay" role="presentation">
          <button
            type="button"
            className="history-backdrop"
            aria-label="Fechar histórico"
            onClick={() => setIsHistoryOpen(false)}
          />
          <Suspense fallback={<RouteLoading />}>
            {activeView === 'cashFlow' ? (
              <CashFlowReportVersionHistory
                versions={cashFlowReportVersions}
                activeVersionId={adminCashFlowReport.version?.id}
                isPublishing={isCashFlowPublishing}
                onClose={() => setIsHistoryOpen(false)}
                onSelectVersion={handleSelectCashFlowReportVersion}
                onPublishVersion={handlePublishCashFlowReportVersion}
              />
            ) : activeView === 'forecast' ? (
              <CashFlowVersionHistory
                versions={cashFlowVersions}
                activeVersionId={adminCashFlow.version?.id}
                isPublishing={isCashFlowPublishing}
                onClose={() => setIsHistoryOpen(false)}
                onSelectVersion={handleSelectCashFlowVersion}
                onPublishVersion={handlePublishCashFlowVersion}
              />
            ) : (
              <VersionHistory
                versions={versions}
                activeVersionId={adminDataset.version?.id}
                isPublishing={isPublishing}
                onClose={() => setIsHistoryOpen(false)}
                onSelectVersion={handleSelectVersion}
                onPublishVersion={handlePublishVersion}
              />
            )}
          </Suspense>
        </div>
      ) : null}
    </main>
  );
}
