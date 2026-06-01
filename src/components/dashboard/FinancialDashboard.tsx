import { useMemo, useState } from 'react';
import { CalendarDays, FileText, Search, SlidersHorizontal } from 'lucide-react';
import CascadingFinancialList from './CascadingFinancialList';
import PieChartPanel from './PieChartPanel';
import { aggregateRecords } from '../../services/financialDataService';
import type { ExcelAnalysis, FinancialSummary } from '../../types/financial';
import { formatCurrency } from '../../utils/formatCurrency';

interface FinancialDashboardProps {
  records: ExcelAnalysis['records'];
  analysis: ExcelAnalysis | null;
  onOpenSettings: () => void;
}

export default function FinancialDashboard({ records, analysis, onOpenSettings }: FinancialDashboardProps) {
  const [selectedGroup, setSelectedGroup] = useState<FinancialSummary | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<FinancialSummary | null>(null);
  const [search, setSearch] = useState('');

  const level = selectedDepartment ? 'person' : selectedGroup ? 'department' : 'group';
  const groups = useMemo(() => aggregateRecords(records, 'group', { search }), [records, search]);
  const chartItems = useMemo(
    () =>
      aggregateRecords(records, level, {
        groupKey: selectedGroup?.key,
        departmentKey: selectedDepartment?.key,
        search,
      }),
    [level, records, search, selectedDepartment?.key, selectedGroup?.key],
  );

  const totalCents = chartItems.reduce((sum, item) => sum + item.totalCents, 0);
  const chartTitle = selectedDepartment
    ? `Distribuição por pessoa`
    : selectedGroup
      ? `Distribuição por departamento`
      : 'Distribuição por agrupamento';
  const selectionLabel = selectedDepartment?.label ?? selectedGroup?.label ?? 'Todos';
  const selectionHint = selectedDepartment?.label ?? selectedGroup?.label ?? undefined;

  function handleSelectGroup(item: FinancialSummary) {
    setSelectedGroup(item);
    setSelectedDepartment(null);
  }

  function handleSelectDepartment(item: FinancialSummary) {
    setSelectedDepartment(item);
  }

  return (
    <section className="dashboard-area" aria-label="Dashboard financeiro">
      {records.length === 0 ? (
        <section className="empty-dashboard">
          <div>
            <span className="section-label">Comece por aqui</span>
            <h3>Importe uma planilha para montar o dashboard.</h3>
            <p>A importação fica em Configurações. Depois de confirmar, esta área mostra os agrupamentos em cascata.</p>
          </div>
          <button type="button" className="primary-action compact" onClick={onOpenSettings}>
            Importar planilha
          </button>
        </section>
      ) : (
        <div className="dashboard-grid reference-grid">
          <section className="panel list-panel">
            <div className="panel-heading">
              <div>
                <h2>Estrutura financeira</h2>
              </div>
              <div className="structure-actions">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar na estrutura..."
                    aria-label="Buscar na estrutura financeira"
                  />
                </label>
                <button type="button" className="filter-button" aria-label="Filtros">
                  <SlidersHorizontal size={20} />
                </button>
              </div>
            </div>
            <CascadingFinancialList
              groups={groups}
              records={records}
              selectedGroup={selectedGroup}
              selectedDepartment={selectedDepartment}
              emptyLabel="Nenhum resultado para os filtros atuais."
              onSelectGroup={handleSelectGroup}
              onSelectDepartment={handleSelectDepartment}
            />
          </section>

          <aside className="panel chart-shell-panel">
            <div className="chart-period-control">
              <button type="button">
                <CalendarDays size={18} />
                Este mês
                <span>⌄</span>
              </button>
            </div>
            <PieChartPanel
              title={chartTitle}
              items={chartItems}
              totalLabel={formatCurrency(totalCents)}
              selectionLabel={selectionLabel}
              selectionHint={selectionHint}
            />
            <div className="chart-footer">
              <div className="tip-card">
                <div className="tip-icon">
                  <SlidersHorizontal size={24} />
                </div>
                <div>
                  <strong>Dica</strong>
                  <p>Selecione um item na estrutura para filtrar e detalhar os dados do gráfico.</p>
                </div>
              </div>
              <button type="button" className="export-card">
                <FileText size={28} />
                <span>
                  <strong>Exportar relatório</strong>
                  <small>Baixe os dados detalhados em Excel ou PDF.</small>
                </span>
                <b>›</b>
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
