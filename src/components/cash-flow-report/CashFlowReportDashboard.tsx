import { useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Search, TrendingDown, TrendingUp } from 'lucide-react';
import type { CashFlowReportDataset, CashFlowReportMovement, CashFlowReportVariation } from '../../types/cashFlowReport';
import {
  calculateCashFlowReportMetrics,
  formatCashFlowReportDate,
  getTransactionTypeLabel,
} from '../../services/cashFlowReportService';
import { formatCurrency } from '../../utils/formatCurrency';

type CashFlowReportTab = 'daily' | 'movements' | 'anticipated' | 'variations';
type MovementFilter = 'ALL' | 'DEBITO' | 'CREDITO';

const TABS: Array<{ value: CashFlowReportTab; label: string }> = [
  { value: 'daily', label: 'Fluxo diário' },
  { value: 'movements', label: 'Movimentações' },
  { value: 'anticipated', label: 'Antecipados' },
  { value: 'variations', label: 'Variações' },
];

interface CashFlowReportDashboardProps {
  dataset: CashFlowReportDataset | null;
}

export default function CashFlowReportDashboard({ dataset }: CashFlowReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<CashFlowReportTab>('daily');
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');

  const metrics = useMemo(() => (dataset ? calculateCashFlowReportMetrics(dataset) : null), [dataset]);
  const variationImpactCents = useMemo(
    () => dataset?.variations.reduce((sum, variation) => sum + variation.impactCents, 0) ?? 0,
    [dataset],
  );
  const variationDates = useMemo(() => {
    const dates = new Set<string>();
    dataset?.variations.forEach((variation) => {
      if (variation.dueDate) {
        dates.add(variation.dueDate);
      }
      if (variation.previousDueDate) {
        dates.add(variation.previousDueDate);
      }
    });
    return dates;
  }, [dataset]);
  const filteredMovements = useMemo(
    () =>
      (dataset?.cashFlowMovements ?? []).filter((movement) => {
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          [movement.documentNumber, movement.accountName, movement.dueDate].join(' ').toLowerCase().includes(normalizedSearch);
        const matchesType = movementFilter === 'ALL' || movement.transactionType === movementFilter;
        return matchesSearch && matchesType;
      }),
    [dataset, movementFilter, search],
  );

  if (!dataset || !metrics) {
    return (
      <section className="dashboard-area cash-report-area" aria-label="Fluxo de caixa">
        <div className="cash-report-shell">
          <section className="panel cash-flow-empty-state">
            <FileSpreadsheet size={28} />
            <div>
              <h3>Nenhum fluxo de caixa publicado ainda.</h3>
              <p>Quando o administrador publicar uma planilha, o fluxo diario aparecera aqui em formato de planilha.</p>
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-area cash-report-area" aria-label="Fluxo de caixa">
      <div className="cash-report-shell">
        <section className="panel cash-report-header">
          <div>
            <span className="section-label">Fluxo de caixa</span>
            <h2>{dataset.monthLabel}</h2>
            <p>
              Créditos baixados entram em Antecipados e ficam fora do cálculo do fluxo. Saldo inicial não informado na
              planilha: cálculo iniciado em R$ 0,00.
            </p>
          </div>
          <div className="cash-report-header-kpis">
            <span>Saldo final projetado</span>
            <strong>{formatCurrency(metrics.closingBalanceCents)}</strong>
            <small>{dataset.monthLabel}</small>
          </div>
        </section>

        <div className="cash-report-metrics">
          <Metric label="Saldo inicial" value={metrics.initialBalanceCents} />
          <Metric label="Débitos" value={metrics.totalDebitsCents} tone="negative" icon={<TrendingDown size={17} />} />
          <Metric label="Créditos" value={metrics.totalCreditsCents} tone="positive" icon={<TrendingUp size={17} />} />
          <Metric label="Antecipados" value={metrics.anticipatedCreditsCents} />
          <Metric
            label="Variação acumulada"
            value={variationImpactCents}
            tone={variationImpactCents < 0 ? 'negative' : 'positive'}
          />
          <Metric label="Menor saldo" value={metrics.minBalanceCents} tone="negative" note={formatCashFlowReportDate(metrics.minBalanceDate)} />
          <Metric label="Variações" value={metrics.variationCount} numeric />
        </div>

        <nav className="cash-flow-tabs" aria-label="Navegação do fluxo de caixa">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={activeTab === tab.value ? 'active' : ''}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'daily' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Planilha diária do fluxo</h3>
                <p>O saldo final de um dia vira o saldo inicial do próximo.</p>
              </div>
              <span className="cash-flow-chip">{dataset.dailyRows.length} dias</span>
            </div>
            <div className="cash-report-table-wrap">
              <table className="cash-report-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Saldo inicial</th>
                    <th>Débito</th>
                    <th>Crédito</th>
                    <th>Líquido</th>
                    <th>Antecipado</th>
                    <th>Saldo final</th>
                    <th>Títulos</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.dailyRows.map((day) => (
                    <tr key={day.date} className={variationDates.has(day.date) ? 'changed-row' : undefined}>
                      <td>{formatCashFlowReportDate(day.date)}</td>
                      <td>{formatCurrency(day.openingBalanceCents)}</td>
                      <td className="negative-value">{formatCurrency(day.debitCents)}</td>
                      <td className="positive-value">{formatCurrency(day.creditCents)}</td>
                      <td className={day.netCents < 0 ? 'negative-value' : 'positive-value'}>{formatCurrency(day.netCents)}</td>
                      <td>{day.anticipatedCents > 0 ? formatCurrency(day.anticipatedCents) : '-'}</td>
                      <td className={day.closingBalanceCents < 0 ? 'negative-value' : 'positive-value'}>{formatCurrency(day.closingBalanceCents)}</td>
                      <td>{day.movementCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'movements' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Movimentações do fluxo</h3>
                <p>Lista de débitos e créditos que entram no cálculo diário.</p>
              </div>
              <TableFilters search={search} setSearch={setSearch} filter={movementFilter} setFilter={setMovementFilter} />
            </div>
            <MovementTable movements={filteredMovements} />
          </section>
        ) : null}

        {activeTab === 'anticipated' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Antecipados</h3>
                <p>Créditos com Baixado = TRUE. Eles são exibidos, mas não entram no fluxo de caixa.</p>
              </div>
              <span className="cash-flow-chip">{dataset.anticipatedMovements.length} títulos</span>
            </div>
            <MovementTable movements={dataset.anticipatedMovements} />
          </section>
        ) : null}

        {activeTab === 'variations' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Variações</h3>
                <p>Novos títulos, valores alterados e datas alteradas contra a base acumulada anterior.</p>
              </div>
              <span className="cash-flow-chip">{dataset.variations.length} variações</span>
            </div>
            <VariationTable variations={dataset.variations} />
          </section>
        ) : null}

        {dataset.issues.length ? (
          <section className="cash-report-note">
            <AlertTriangle size={16} />
            <span>{dataset.issues[0].message}</span>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  icon,
  note,
  numeric = false,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'positive' | 'negative';
  icon?: React.ReactNode;
  note?: string;
  numeric?: boolean;
}) {
  return (
    <article className={`cash-flow-metric ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{numeric ? value.toLocaleString('pt-BR') : formatCurrency(value)}</strong>
        {note ? <small>{note}</small> : null}
      </div>
      {icon ? <i>{icon}</i> : null}
    </article>
  );
}

function TableFilters({
  search,
  setSearch,
  filter,
  setFilter,
}: {
  search: string;
  setSearch: (value: string) => void;
  filter: MovementFilter;
  setFilter: (value: MovementFilter) => void;
}) {
  return (
    <div className="cash-flow-filter-bar">
      <label className="cash-flow-search">
        <Search size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, conta ou data..." />
      </label>
      <select value={filter} onChange={(event) => setFilter(event.target.value as MovementFilter)}>
        <option value="ALL">Todos</option>
        <option value="DEBITO">Débitos</option>
        <option value="CREDITO">Créditos</option>
      </select>
    </div>
  );
}

function MovementTable({ movements }: { movements: CashFlowReportMovement[] }) {
  if (movements.length === 0) {
    return <div className="empty-state">Nenhuma movimentação encontrada.</div>;
  }

  return (
    <div className="cash-report-table-wrap">
      <table className="cash-report-table movement">
        <thead>
          <tr>
            <th>Data</th>
            <th>Documento</th>
            <th>Conta / Razão social</th>
            <th>Tipo</th>
            <th>Previsão</th>
            <th>Baixado</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatCashFlowReportDate(movement.dueDate)}</td>
              <td>{movement.documentNumber}</td>
              <td>{movement.accountName}</td>
              <td>
                <span className={movement.transactionType === 'DEBITO' ? 'movement-type debit' : 'movement-type credit'}>
                  {getTransactionTypeLabel(movement.transactionType)}
                </span>
              </td>
              <td>{movement.isForecast ? 'Sim' : 'Não'}</td>
              <td>{movement.isSettled ? 'Sim' : 'Não'}</td>
              <td>{formatCurrency(movement.valueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariationTable({ variations }: { variations: CashFlowReportVariation[] }) {
  if (variations.length === 0) {
    return <div className="empty-state">Nenhuma variação encontrada contra a versão anterior.</div>;
  }

  return (
    <div className="cash-report-table-wrap">
      <table className="cash-report-table movement">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Conta / Razão social</th>
            <th>Tipo</th>
            <th>Variação</th>
            <th>Data anterior</th>
            <th>Data atual</th>
            <th>Valor anterior</th>
            <th>Valor atual</th>
            <th>Impacto</th>
          </tr>
        </thead>
        <tbody>
          {variations.map((variation) => (
            <tr key={variation.id} className={variation.impactCents < 0 ? 'variation-negative-row' : 'variation-positive-row'}>
              <td>{variation.documentNumber}</td>
              <td>{variation.accountName}</td>
              <td>{getTransactionTypeLabel(variation.transactionType)}</td>
              <td>{variation.variationType.replace(/_/g, ' ')}</td>
              <td>{formatCashFlowReportDate(variation.previousDueDate)}</td>
              <td>{formatCashFlowReportDate(variation.dueDate)}</td>
              <td>{variation.previousValueCents === null || variation.previousValueCents === undefined ? '-' : formatCurrency(variation.previousValueCents)}</td>
              <td>{variation.currentValueCents === null || variation.currentValueCents === undefined ? '-' : formatCurrency(variation.currentValueCents)}</td>
              <td className={variation.impactCents < 0 ? 'negative-value' : 'positive-value'}>{formatCurrency(variation.impactCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
