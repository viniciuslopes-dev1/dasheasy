import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import BreadcrumbNavigation from './BreadcrumbNavigation';
import GroupingList from './GroupingList';
import PieChartPanel from './PieChartPanel';
import { aggregateRecords } from '../../services/financialDataService';
import type { ExcelAnalysis, FinancialSummary } from '../../types/financial';
import { formatCurrency } from '../../utils/formatCurrency';

interface FinancialDashboardProps {
  records: ExcelAnalysis['records'];
  analysis: ExcelAnalysis | null;
}

export default function FinancialDashboard({ records, analysis }: FinancialDashboardProps) {
  const [selectedGroup, setSelectedGroup] = useState<FinancialSummary | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<FinancialSummary | null>(null);
  const [search, setSearch] = useState('');

  const level = selectedDepartment ? 'person' : selectedGroup ? 'department' : 'group';
  const summaries = useMemo(() => {
    return aggregateRecords(records, level, {
      groupKey: selectedGroup?.key,
      departmentKey: selectedDepartment?.key,
      search,
    });
  }, [level, records, search, selectedDepartment?.key, selectedGroup?.key]);

  const totalCents = summaries.reduce((sum, item) => sum + item.totalCents, 0);
  const title =
    level === 'person'
      ? `Pessoas em ${selectedDepartment?.label}`
      : level === 'department'
        ? `Departamentos em ${selectedGroup?.label}`
        : 'Agrupamentos principais';

  function handleSelect(item: FinancialSummary) {
    if (level === 'group') {
      setSelectedGroup(item);
      setSelectedDepartment(null);
    } else if (level === 'department') {
      setSelectedDepartment(item);
    }
  }

  function goRoot() {
    setSelectedGroup(null);
    setSelectedDepartment(null);
  }

  function goGroup() {
    setSelectedDepartment(null);
  }

  function goBack() {
    if (selectedDepartment) {
      setSelectedDepartment(null);
    } else {
      setSelectedGroup(null);
    }
  }

  return (
    <section className="dashboard-area" aria-label="Dashboard financeiro">
      <div className="dashboard-header">
        <div>
          <BreadcrumbNavigation
            groupLabel={selectedGroup?.label}
            departmentLabel={selectedDepartment?.label}
            onBack={goBack}
            onRoot={goRoot}
            onGroup={goGroup}
          />
          <h2>{title}</h2>
          <p>
            {analysis
              ? `${analysis.blockCount} blocos, ${analysis.recordCount} lançamentos importados`
              : 'Importe uma planilha para habilitar a visualização.'}
          </p>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar agrupamento, departamento ou pessoa"
            aria-label="Buscar no dashboard"
          />
        </label>
      </div>

      <div className="summary-strip">
        <div>
          <span>Total do nível</span>
          <strong>{formatCurrency(totalCents)}</strong>
        </div>
        <div>
          <span>Itens exibidos</span>
          <strong>{summaries.length}</strong>
        </div>
        <div>
          <span>Nível atual</span>
          <strong>{level === 'group' ? 'Geral' : level === 'department' ? 'Departamento' : 'Pessoa'}</strong>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel list-panel">
          <div className="panel-heading">
            <div>
              <h2>{title}</h2>
              <p>Clique em um item para detalhar o próximo nível.</p>
            </div>
          </div>
          <GroupingList
            items={summaries}
            activeKey={selectedDepartment?.key ?? selectedGroup?.key}
            emptyLabel={records.length === 0 ? 'Nenhum dado importado ainda.' : 'Nenhum resultado para os filtros atuais.'}
            onSelect={handleSelect}
          />
        </section>
        <PieChartPanel title={`Distribuição por ${level === 'group' ? 'agrupamento' : level === 'department' ? 'departamento' : 'pessoa'}`} items={summaries} />
      </div>
    </section>
  );
}

