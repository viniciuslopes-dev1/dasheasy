import { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  FileText,
  Home,
  LogOut,
  Moon,
  PieChart,
  Settings,
  Table2,
  Users,
  X,
} from 'lucide-react';
import ExcelUpload from './components/ExcelUpload';
import FinancialDashboard from './components/dashboard/FinancialDashboard';
import type { ExcelAnalysis } from './types/financial';
import { formatCurrency } from './utils/formatCurrency';

export default function App() {
  const [activeAnalysis, setActiveAnalysis] = useState<ExcelAnalysis | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const totalLabel = useMemo(
    () => (activeAnalysis ? formatCurrency(activeAnalysis.totalAmountCents) : 'R$ 0,00'),
    [activeAnalysis],
  );

  function handleImported(analysis: ExcelAnalysis) {
    setActiveAnalysis(analysis);
    setIsSettingsOpen(false);
  }

  return (
    <main className="app-frame">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-block">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <strong>Finanças</strong>
        </div>
        <nav className="side-nav">
          <button className="side-nav-item active" type="button" aria-label="Visão geral">
            <Home size={22} />
          </button>
          <button className="side-nav-item" type="button" aria-label="Gráficos">
            <PieChart size={22} />
          </button>
          <button className="side-nav-item" type="button" aria-label="Tabelas">
            <Table2 size={22} />
          </button>
          <button className="side-nav-item" type="button" aria-label="Empresas">
            <Building2 size={22} />
          </button>
          <button className="side-nav-item" type="button" aria-label="Usuários">
            <Users size={22} />
          </button>
          <button className="side-nav-item" type="button" aria-label="Documentos">
            <FileText size={22} />
          </button>
          <button className="side-nav-item" type="button" aria-label="Configurações" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={22} />
          </button>
        </nav>
        <button className="side-exit" type="button" aria-label="Sair">
          <LogOut size={18} />
        </button>
      </aside>

      <section className="app-content">
        <header className="topbar">
          <div className="topbar-title">
            <h1>Visão geral</h1>
            <p>Análise consolidada dos valores por categoria</p>
          </div>
          <div className="topbar-actions">
            <button className="top-icon-button" type="button" aria-label="Alternar tema">
              <Moon size={21} />
            </button>
            <button className="top-icon-button" type="button" aria-label="Notificações">
              <Bell size={21} />
            </button>
            <div className="admin-chip">
              <span>AD</span>
            </div>
            <strong className="admin-label">Admin</strong>
            <span className="admin-chevron">⌄</span>
          </div>
        </header>

        <FinancialDashboard
          records={activeAnalysis?.records ?? []}
          analysis={activeAnalysis}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
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
