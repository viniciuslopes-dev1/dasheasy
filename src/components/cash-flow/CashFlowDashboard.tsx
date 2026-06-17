import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Banknote, CalendarDays, Landmark, Search, TrendingDown, TrendingUp } from 'lucide-react';
import {
  calculateCashFlowMetrics,
  calculateDailyCashFlow,
  formatCashFlowDate,
  sampleCashFlowDataset,
} from '../../services/cashFlowService';
import type { BankAccount, CashFlowMovement, CashFlowTransactionType } from '../../types/cashFlow';
import { formatCurrency } from '../../utils/formatCurrency';

type CashFlowTab = 'dashboard' | 'movements' | 'variations' | 'accounts';
type MovementTypeFilter = 'ALL' | CashFlowTransactionType;

const CASH_FLOW_TABS: Array<{ value: CashFlowTab; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'movements', label: 'Movimentacoes' },
  { value: 'variations', label: 'Variacoes' },
  { value: 'accounts', label: 'Contas' },
];

function compactCurrency(cents: number): string {
  const absolute = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';

  if (absolute >= 100000000) {
    return `${sign}R$ ${(absolute / 100000000).toFixed(1).replace('.', ',')}M`;
  }

  if (absolute >= 100000) {
    return `${sign}R$ ${Math.round(absolute / 100000).toLocaleString('pt-BR')} mil`;
  }

  return formatCurrency(cents);
}

function getMovementTypeLabel(type: CashFlowTransactionType): string {
  return type === 'DEBITO' ? 'Debito' : 'Credito';
}

function getVariationLabel(valueCents: number): string {
  return valueCents >= 0 ? `+${formatCurrency(valueCents)}` : formatCurrency(valueCents);
}

function balanceDot(props: { cx?: number; cy?: number; payload?: { saldo: number } }) {
  if (props.cx === undefined || props.cy === undefined || !props.payload) {
    return <g />;
  }

  const isNegative = props.payload.saldo < 0;
  return (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={isNegative ? 5 : 3}
      fill={isNegative ? '#ff6b6b' : '#65d6ad'}
      stroke="#0b1424"
      strokeWidth={2}
    />
  );
}

export default function CashFlowDashboard() {
  const [activeTab, setActiveTab] = useState<CashFlowTab>('dashboard');
  const [search, setSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementTypeFilter>('ALL');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(sampleCashFlowDataset.bankAccounts);

  const dataset = useMemo(
    () => ({
      ...sampleCashFlowDataset,
      bankAccounts,
    }),
    [bankAccounts],
  );

  const dailyCashFlow = useMemo(() => calculateDailyCashFlow(dataset), [dataset]);
  const metrics = useMemo(() => calculateCashFlowMetrics(dataset), [dataset]);
  const negativeDays = dailyCashFlow.filter((day) => day.projectedBalanceCents < 0);
  const selectedDayDetails = selectedDay ? dailyCashFlow.find((day) => day.date === selectedDay) ?? null : null;

  const variationTotals = useMemo(() => {
    const positiveCents = dataset.changes
      .filter((change) => change.impactCents > 0)
      .reduce((sum, change) => sum + change.impactCents, 0);
    const negativeCents = dataset.changes
      .filter((change) => change.impactCents < 0)
      .reduce((sum, change) => sum + change.impactCents, 0);

    return {
      positiveCents,
      negativeCents,
      netCents: positiveCents + negativeCents,
    };
  }, [dataset.changes]);

  const filteredMovements = useMemo(
    () =>
      dataset.movements.filter((movement) => {
        const matchesType = movementTypeFilter === 'ALL' || movement.type === movementTypeFilter;
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          [movement.counterparty, movement.documentNumber, movement.category]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

        return matchesType && matchesSearch;
      }),
    [dataset.movements, movementTypeFilter, search],
  );

  const dailyChartData = dailyCashFlow.map((day) => ({
    date: day.date,
    label: formatCashFlowDate(day.date),
    saldo: day.projectedBalanceCents,
    debitos: day.debitCents,
    creditos: day.creditCents,
  }));

  const snapshotChartData = dataset.snapshots.map((snapshot) => ({
    label: formatCashFlowDate(snapshot.snapshotDate),
    previsao: snapshot.closingForecastCents,
  }));

  function toggleBankAccount(accountId: string) {
    setBankAccounts((accounts) =>
      accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              includeInCash: !account.includeInCash,
            }
          : account,
      ),
    );
  }

  return (
    <section className="dashboard-area cash-flow-area" aria-label="Fluxo de caixa">
      <div className="cash-flow-shell">
        <section className="panel cash-flow-hero">
          <div>
            <span className="section-label">Fluxo de caixa projetado</span>
            <h2>Previsao inicial versus previsao atual</h2>
            <p>
              Controle debitos, creditos e variacoes para entender quais lancamentos mudaram o saldo previsto do mes.
            </p>
          </div>
          <div className="cash-flow-hero-kpi">
            <span>{dataset.monthLabel}</span>
            <strong>{formatCurrency(metrics.currentForecastClosingCents)}</strong>
            <small>Fechamento atual previsto</small>
          </div>
        </section>

        <nav className="cash-flow-tabs" aria-label="Navegacao do fluxo de caixa">
          {CASH_FLOW_TABS.map((tab) => (
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

        {activeTab === 'dashboard' ? (
          <div className="cash-flow-dashboard-grid">
            <div className="cash-flow-metrics">
              <MetricCard label="Saldo inicial" value={metrics.initialBalanceCents} icon={<Banknote size={18} />} />
              <MetricCard label="Total a pagar" value={metrics.totalDebitsCents} tone="negative" icon={<TrendingDown size={18} />} />
              <MetricCard label="Total a receber" value={metrics.totalCreditsCents} tone="positive" icon={<TrendingUp size={18} />} />
              <MetricCard label="Previsao inicial" value={metrics.initialForecastClosingCents} />
              <MetricCard label="Previsao atual" value={metrics.currentForecastClosingCents} />
              <MetricCard label="Variacao acumulada" value={metrics.accumulatedVariationCents} tone={metrics.accumulatedVariationCents < 0 ? 'negative' : 'positive'} />
              <MetricCard
                label={`Menor saldo (${formatCashFlowDate(metrics.minProjectedBalanceDate)})`}
                value={metrics.minProjectedBalanceCents}
                tone="negative"
                icon={<AlertTriangle size={18} />}
              />
            </div>

            <section className="panel cash-flow-chart-panel cash-flow-balance-panel">
              <div className="cash-flow-panel-heading">
                <div>
                  <h3>Saldo diario projetado</h3>
                  <p>
                    {selectedDayDetails
                      ? `${formatCashFlowDate(selectedDayDetails.date)}: ${formatCurrency(selectedDayDetails.projectedBalanceCents)}`
                      : 'Clique em um ponto para destacar o dia.'}
                  </p>
                </div>
                <span className="cash-flow-chip">{negativeDays.length} dias negativos</span>
              </div>
              <ResponsiveContainer width="100%" height={285}>
                <AreaChart
                  data={dailyChartData}
                  margin={{ top: 16, right: 22, left: 0, bottom: 4 }}
                  onClick={(entry) => {
                    const payload = entry?.activePayload?.[0]?.payload as { date?: string } | undefined;
                    if (payload?.date) {
                      setSelectedDay(payload.date);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2f6f5e" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#2f6f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(112, 132, 165, 0.13)" vertical={false} />
                  <XAxis dataKey="label" stroke="#7e8da5" tick={{ fill: '#9aa8bd', fontSize: 11 }} />
                  <YAxis tickFormatter={compactCurrency} stroke="#7e8da5" tick={{ fill: '#9aa8bd', fontSize: 11 }} width={76} />
                  <Tooltip
                    formatter={(value: number, name) => [formatCurrency(value), name === 'saldo' ? 'Saldo' : name]}
                    labelFormatter={(label) => `Dia ${label}`}
                    contentStyle={{
                      background: '#111a2b',
                      border: '1px solid rgba(142, 159, 185, 0.25)',
                      borderRadius: 10,
                      color: '#f8fbff',
                    }}
                  />
                  <ReferenceLine y={0} stroke="#ff6b6b" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="saldo" stroke="#65d6ad" fill="url(#balanceFill)" strokeWidth={3} dot={balanceDot} activeDot={{ r: 7 }} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section className="panel cash-flow-chart-panel">
              <div className="cash-flow-panel-heading">
                <div>
                  <h3>Evolucao da previsao de fechamento</h3>
                  <p>Snapshots mostram como a previsao mudou ao longo do mes.</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={248}>
                <LineChart data={snapshotChartData} margin={{ top: 16, right: 22, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(112, 132, 165, 0.13)" vertical={false} />
                  <XAxis dataKey="label" stroke="#7e8da5" tick={{ fill: '#9aa8bd', fontSize: 11 }} />
                  <YAxis tickFormatter={compactCurrency} stroke="#7e8da5" tick={{ fill: '#9aa8bd', fontSize: 11 }} width={76} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Fechamento previsto']}
                    labelFormatter={(label) => `Atualizacao ${label}`}
                    contentStyle={{
                      background: '#111a2b',
                      border: '1px solid rgba(142, 159, 185, 0.25)',
                      borderRadius: 10,
                      color: '#f8fbff',
                    }}
                  />
                  <Line type="monotone" dataKey="previsao" stroke="#5b8dff" strokeWidth={3} dot={{ r: 4, fill: '#5b8dff' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="panel cash-flow-summary-panel">
              <div className="cash-flow-panel-heading">
                <div>
                  <h3>Variacoes que explicam a mudanca</h3>
                  <p>O sistema preserva a previsao inicial e registra o impacto de cada alteracao.</p>
                </div>
              </div>
              <div className="variation-balance-row">
                <span>Previsao inicial</span>
                <strong>{formatCurrency(metrics.initialForecastClosingCents)}</strong>
              </div>
              {dataset.changes.map((change) => (
                <div className={change.impactCents < 0 ? 'variation-balance-row negative' : 'variation-balance-row positive'} key={change.id}>
                  <span>{change.title}</span>
                  <strong>{getVariationLabel(change.impactCents)}</strong>
                </div>
              ))}
              <div className="variation-balance-row total">
                <span>Previsao atual</span>
                <strong>{formatCurrency(metrics.currentForecastClosingCents)}</strong>
              </div>
            </section>

            <section className="panel cash-flow-summary-panel">
              <div className="cash-flow-panel-heading">
                <div>
                  <h3>Dias de atencao</h3>
                  <p>Dias em que o saldo projetado fica abaixo de zero.</p>
                </div>
              </div>
              <div className="negative-day-list">
                {negativeDays.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    className={selectedDay === day.date ? 'negative-day active' : 'negative-day'}
                    onClick={() => setSelectedDay((current) => (current === day.date ? null : day.date))}
                  >
                    <CalendarDays size={16} />
                    <span>{formatCashFlowDate(day.date)}</span>
                    <strong>{formatCurrency(day.projectedBalanceCents)}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'movements' ? (
          <section className="panel cash-flow-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Movimentacoes previstas</h3>
                <p>Tabela unica para debitos e creditos, pronta para receber importacao consolidada.</p>
              </div>
              <div className="cash-flow-filter-bar">
                <label className="cash-flow-search">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento, empresa ou categoria..." />
                </label>
                <select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value as MovementTypeFilter)}>
                  <option value="ALL">Todos</option>
                  <option value="DEBITO">Debitos</option>
                  <option value="CREDITO">Creditos</option>
                </select>
              </div>
            </div>
            <MovementTable movements={filteredMovements} />
          </section>
        ) : null}

        {activeTab === 'variations' ? (
          <section className="panel cash-flow-table-panel">
            <div className="variation-overview">
              <MetricCard label="Variacoes positivas" value={variationTotals.positiveCents} tone="positive" />
              <MetricCard label="Variacoes negativas" value={variationTotals.negativeCents} tone="negative" />
              <MetricCard label="Variacao liquida" value={variationTotals.netCents} tone={variationTotals.netCents < 0 ? 'negative' : 'positive'} />
            </div>
            <div className="cash-flow-change-list">
              {dataset.changes.map((change) => (
                <article className="cash-flow-change-card" key={change.id}>
                  <div>
                    <span>{formatCashFlowDate(change.registeredAt)} registrado</span>
                    <strong>{change.title}</strong>
                    <p>{change.reason}</p>
                  </div>
                  <div>
                    <small>Data afetada</small>
                    <b>{formatCashFlowDate(change.affectedDate)}</b>
                  </div>
                  <div>
                    <small>Tipo</small>
                    <b>{getMovementTypeLabel(change.movementType)}</b>
                  </div>
                  <strong className={change.impactCents < 0 ? 'cash-flow-impact negative' : 'cash-flow-impact positive'}>
                    {getVariationLabel(change.impactCents)}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'accounts' ? (
          <section className="panel cash-flow-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Contas bancarias</h3>
                <p>Defina quais contas entram no saldo disponivel. Contas garantidas podem ficar apenas informativas.</p>
              </div>
              <span className="cash-flow-chip">Saldo considerado: {formatCurrency(metrics.initialBalanceCents)}</span>
            </div>
            <div className="bank-account-grid">
              {bankAccounts.map((account) => (
                <article className={account.includeInCash ? 'bank-account-card included' : 'bank-account-card'} key={account.id}>
                  <div className="bank-account-icon">
                    <Landmark size={20} />
                  </div>
                  <div>
                    <span>{account.code}</span>
                    <strong>
                      {account.bank} - {account.description}
                    </strong>
                    <small>Atualizado em {formatCashFlowDate(account.updatedAt)}</small>
                  </div>
                  <b className={account.balanceCents < 0 ? 'negative-value' : ''}>{formatCurrency(account.balanceCents)}</b>
                  <button type="button" className="account-toggle" onClick={() => toggleBankAccount(account.id)} aria-pressed={account.includeInCash}>
                    {account.includeInCash ? 'Considera no caixa' : 'Nao considera'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'positive' | 'negative';
  icon?: React.ReactNode;
}) {
  return (
    <article className={`cash-flow-metric ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{formatCurrency(value)}</strong>
      </div>
      {icon ? <i>{icon}</i> : null}
    </article>
  );
}

function MovementTable({ movements }: { movements: CashFlowMovement[] }) {
  if (movements.length === 0) {
    return <div className="empty-state">Nenhuma movimentacao encontrada para os filtros atuais.</div>;
  }

  return (
    <div className="cash-flow-table-wrap">
      <table className="cash-flow-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Documento</th>
            <th>Empresa</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatCashFlowDate(movement.date)}</td>
              <td>{movement.documentNumber}</td>
              <td>{movement.counterparty}</td>
              <td>
                <span className={movement.type === 'DEBITO' ? 'movement-type debit' : 'movement-type credit'}>{getMovementTypeLabel(movement.type)}</span>
              </td>
              <td>{formatCurrency(movement.valueCents)}</td>
              <td>{movement.status}</td>
              <td>{movement.origin.replace(/_/g, ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
