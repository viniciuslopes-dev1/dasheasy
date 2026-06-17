import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { History, Home, LogOut, PieChart, UploadCloud, WalletCards, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import {
  loadAdminDashboardVersions,
  loadDashboardVersion,
  loadPublishedDashboard,
  publishDashboardVersion,
} from './services/dashboardVersionService';
import type { DashboardDataset, DashboardVersion, ExcelAnalysis } from './types/financial';
import type { AppView } from './types/navigation';

const EMPTY_DATASET: DashboardDataset = { version: null, records: [] };
const PUBLIC_DASHBOARD_CACHE_KEY = 'dasheasy:published-dashboard';

const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const VersionHistory = lazy(() => import('./components/admin/VersionHistory'));
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

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith('/admin');
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!supabase);
  const [publishedDataset, setPublishedDataset] = useState<DashboardDataset>(() =>
    isAdminRoute ? EMPTY_DATASET : readCachedPublishedDashboard(),
  );
  const [adminDataset, setAdminDataset] = useState<DashboardDataset>(EMPTY_DATASET);
  const [versions, setVersions] = useState<DashboardVersion[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');

  const isAdminAuthenticated = Boolean(session?.user);
  const pageTitle = isAdminRoute
    ? 'Administração'
    : activeView === 'comparisons'
      ? 'Comparações'
      : activeView === 'cashFlow'
        ? 'Fluxo de caixa'
        : 'Visão geral';
  const pageDescription = isAdminRoute
    ? 'Importe, publique e restaure versões do dashboard'
    : activeView === 'comparisons'
      ? 'Compare departamentos, agrupamentos e responsáveis'
      : activeView === 'cashFlow'
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

  const refreshPublishedDashboard = useCallback(async () => {
    setIsDashboardLoading(true);
    setError('');
    try {
      const dataset = await loadPublishedDashboard();
      setPublishedDataset(dataset);
      writeCachedPublishedDashboard(dataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o dashboard publicado.');
    } finally {
      setIsDashboardLoading(false);
    }
  }, []);

  const refreshAdminWorkspace = useCallback(async () => {
    if (!isAdminRoute || !session?.user) {
      return;
    }

    setIsAdminLoading(true);
    setError('');
    try {
      const nextVersions = await loadAdminDashboardVersions();
      setVersions(nextVersions);
      if (nextVersions[0]) {
        setAdminDataset(await loadDashboardVersion(nextVersions[0].id));
      } else {
        setAdminDataset(EMPTY_DATASET);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a área administrativa.');
    } finally {
      setIsAdminLoading(false);
    }
  }, [isAdminRoute, session?.user]);

  useEffect(() => {
    if (!isAdminRoute) {
      refreshPublishedDashboard();
    }
  }, [isAdminRoute, refreshPublishedDashboard]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    refreshAdminWorkspace();
  }, [refreshAdminWorkspace]);

  async function handleImported(analysis: ExcelAnalysis, version?: DashboardVersion | null) {
    setAdminDataset({ version: version ?? null, records: analysis.records });
    setIsSettingsOpen(false);
    await refreshAdminWorkspace();
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

  async function handlePublishVersion(versionId: string) {
    setIsPublishing(true);
    setError('');
    try {
      await publishDashboardVersion(versionId);
      setAdminDataset(await loadDashboardVersion(versionId));
      const dataset = await loadPublishedDashboard();
      setPublishedDataset(dataset);
      writeCachedPublishedDashboard(dataset);
      setVersions(await loadAdminDashboardVersions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar a versão selecionada.');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setAdminDataset(EMPTY_DATASET);
    setVersions([]);
  }

  if (isAdminRoute && !isAuthReady) {
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
            className={activeView === 'cashFlow' ? 'side-nav-item active' : 'side-nav-item'}
            type="button"
            aria-label="Fluxo de caixa"
            onClick={() => setActiveView('cashFlow')}
          >
            <WalletCards size={22} />
          </button>
          {isAdminRoute ? (
            <button
              className="side-nav-item"
              type="button"
              aria-label="Histórico de versões"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History size={22} />
              {versions.length > 0 ? <span className="side-badge">{versions.length}</span> : null}
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
              isLoading={isAdminLoading}
              error={error}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </Suspense>
        ) : activeView === 'comparisons' ? (
          <Suspense fallback={<RouteLoading />}>
            <ComparisonDashboard records={activeDataset.records} />
          </Suspense>
        ) : activeView === 'cashFlow' ? (
          <Suspense fallback={<RouteLoading />}>
            <CashFlowDashboard />
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
              <ExcelUpload onImported={handleImported} userId={session?.user.id} />
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
            <VersionHistory
              versions={versions}
              activeVersionId={adminDataset.version?.id}
              isPublishing={isPublishing}
              onClose={() => setIsHistoryOpen(false)}
              onSelectVersion={handleSelectVersion}
              onPublishVersion={handlePublishVersion}
            />
          </Suspense>
        </div>
      ) : null}
    </main>
  );
}
