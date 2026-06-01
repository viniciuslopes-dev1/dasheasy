import { useState } from 'react';
import {
  Home,
  PieChart,
  UploadCloud,
  X,
} from 'lucide-react';
import ExcelUpload from './components/ExcelUpload';
import ComparisonDashboard from './components/comparisons/ComparisonDashboard';
import FinancialDashboard from './components/dashboard/FinancialDashboard';
import type { ExcelAnalysis } from './types/financial';

type AppView = 'overview' | 'comparisons';

export default function App() {
  const [activeAnalysis, setActiveAnalysis] = useState<ExcelAnalysis | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('overview');
  const pageTitle = activeView === 'comparisons' ? 'Comparações' : 'Visão geral';
  const pageDescription =
    activeView === 'comparisons'
      ? 'Compare departamentos, agrupamentos e responsáveis'
      : 'Análise consolidada dos valores por categoria';

  function handleImported(analysis: ExcelAnalysis) {
    setActiveAnalysis(analysis);
    setIsSettingsOpen(false);
  }

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
        </nav>
      </aside>

      <section className="app-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
          <div className="topbar-actions">
            <button className="import-top-button" type="button" onClick={() => setIsSettingsOpen(true)}>
              <UploadCloud size={17} />
              Importar
            </button>
          </div>
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
          </div>
        </header>

        {activeView === 'comparisons' ? (
          <ComparisonDashboard records={activeAnalysis?.records ?? []} onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : (
          <FinancialDashboard
            records={activeAnalysis?.records ?? []}
            analysis={activeAnalysis}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </section>

      {isSettingsOpen ? (
        <div className="settings-overlay" role="presentation">
          <button className="settings-backdrop" type="button" aria-label="Fechar configurações" onClick={() => setIsSettingsOpen(false)} />
          <aside className="settings-drawer" aria-label="Configurações de importação">
            <div className="settings-drawer-header">
              <div>
                <h2>Configurações</h2>
                <p>Importe uma nova planilha ou revise a análise antes de carregar no dashboard.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Fechar configurações" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <ExcelUpload onImported={handleImported} />
          </aside>
        </div>
      ) : null}
    </main>
  );
}
