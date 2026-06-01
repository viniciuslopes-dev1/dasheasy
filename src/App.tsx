import { useMemo, useState } from 'react';
import { Database } from 'lucide-react';
import ExcelUpload from './components/ExcelUpload';
import FinancialDashboard from './components/dashboard/FinancialDashboard';
import type { ExcelAnalysis } from './types/financial';
import { formatCurrency } from './utils/formatCurrency';

export default function App() {
  const [activeAnalysis, setActiveAnalysis] = useState<ExcelAnalysis | null>(null);
  const totalLabel = useMemo(
    () => (activeAnalysis ? formatCurrency(activeAnalysis.totalAmountCents) : 'R$ 0,00'),
    [activeAnalysis],
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>DashEasy Financeiro</h1>
          <p>Importe a planilha, valide a estrutura real e navegue pelos gastos por agrupamento, departamento e pessoa.</p>
        </div>
        <div className="topbar-summary" aria-label="Total financeiro importado">
          <Database size={18} />
          <span>{activeAnalysis ? `${activeAnalysis.recordCount} lançamentos` : 'Sem importação'}</span>
          <strong>{totalLabel}</strong>
        </div>
      </header>

      <section className="workspace">
        <ExcelUpload onImported={setActiveAnalysis} />
        <FinancialDashboard records={activeAnalysis?.records ?? []} analysis={activeAnalysis} />
      </section>
    </main>
  );
}

