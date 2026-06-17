import { AlertTriangle } from 'lucide-react';
import ComparisonDashboard from '../comparisons/ComparisonDashboard';
import FinancialDashboard from '../dashboard/FinancialDashboard';
import type { AppView } from '../../types/navigation';
import type { DashboardDataset } from '../../types/financial';

interface AdminDashboardProps {
  activeView: AppView;
  dataset: DashboardDataset;
  isLoading: boolean;
  error: string;
  onOpenSettings: () => void;
}

export default function AdminDashboard({
  activeView,
  dataset,
  isLoading,
  error,
  onOpenSettings,
}: AdminDashboardProps) {
  return (
    <section className="admin-workspace">
      {error ? (
        <div className="status error admin-status">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <section className="empty-dashboard admin-loading">
          <div>
            <span className="section-label">Carregando</span>
            <h3>Buscando versões salvas no Supabase.</h3>
          </div>
        </section>
      ) : activeView === 'comparisons' ? (
        <ComparisonDashboard records={dataset.records} onOpenSettings={onOpenSettings} canImport />
      ) : (
        <FinancialDashboard
          records={dataset.records}
          analysis={null}
          onOpenSettings={onOpenSettings}
          canImport
          emptyTitle="Importe uma planilha para criar uma versão."
          emptyDescription="A nova importação será salva como rascunho. Depois, clique em Publicar dashboard para atualizar o link principal."
        />
      )}
    </section>
  );
}
