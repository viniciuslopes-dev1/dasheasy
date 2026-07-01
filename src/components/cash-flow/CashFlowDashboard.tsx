import { useEffect, useMemo, useState } from 'react';
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
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  FileSpreadsheet,
  Landmark,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  calculateCashFlowMetrics,
  calculateDailyCashFlow,
  formatCashFlowDate,
} from '../../services/cashFlowService';
import type { BankAccount, CashFlowDataset, CashFlowMovement, CashFlowTransactionType } from '../../types/cashFlow';
import { formatCurrency } from '../../utils/formatCurrency';

type CashFlowTab = 'dashboard' | 'movements' | 'variations' | 'accounts';
type MovementTypeFilter = 'ALL' | CashFlowTransactionType;
type DateRangePreset = 'CURRENT_MONTH' | 'FULL' | 'NEXT_15' | 'NEXT_30' | 'NEXT_60' | 'CUSTOM';
type DailyCashFlowRow = ReturnType<typeof calculateDailyCashFlow>[number];

const CASH_FLOW_TABS: Array<{ value: CashFlowTab; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'variations', label: 'Variações' },
];

const DATE_RANGE_PRESETS: Array<{ value: DateRangePreset; label: string; days?: number }> = [
  { value: 'CURRENT_MONTH', label: 'Mês atual' },
  { value: 'FULL', label: 'Tudo' },
  { value: 'NEXT_15', label: '15 dias', days: 15 },
  { value: 'NEXT_30', label: '30 dias', days: 30 },
  { value: 'NEXT_60', label: '60 dias', days: 60 },
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
  return type === 'DEBITO' ? 'Débito' : 'Crédito';
}

function getVariationLabel(valueCents: number): string {
  return valueCents >= 0 ? `+${formatCurrency(valueCents)}` : formatCurrency(valueCents);
}

function balanceDot(props: { cx?: number; cy?: number; payload?: { saldo: number } }) {
  if (props.cx === undefined || props.cy === undefined || !props.payload) {
    return <g key="empty-balance-dot" />;
  }

  const isNegative = props.payload.saldo < 0;
  return (
    <circle
      key={`balance-dot-${props.cx}-${props.cy}`}
      cx={props.cx}
      cy={props.cy}
      r={isNegative ? 5 : 3}
      fill={isNegative ? '#ff6b6b' : '#65d6ad'}
      stroke="#0b1424"
      strokeWidth={2}
    />
  );
}

interface CashFlowDashboardProps {
  dataset: CashFlowDataset | null;
}

export default function CashFlowDashboard({ dataset: sourceDataset }: CashFlowDashboardProps) {
  const [activeTab, setActiveTab] = useState<CashFlowTab>('dashboard');
  const [search, setSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<MovementTypeFilter>('ALL');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => sourceDataset?.bankAccounts ?? []);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('CURRENT_MONTH');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);

  useEffect(() => {
    setBankAccounts(sourceDataset?.bankAccounts ?? []);
    setSelectedDay(null);
    setSearch('');
    setMovementTypeFilter('ALL');
    setActiveTab('dashboard');
    setDateRangePreset('CURRENT_MONTH');
    setCustomStartDate('');
    setCustomEndDate('');
    setIsDateRangeOpen(false);
  }, [sourceDataset]);

  const dataset = useMemo(
    () =>
      sourceDataset
        ? {
            ...sourceDataset,
            bankAccounts,
          }
        : null,
    [bankAccounts, sourceDataset],
  );

  const dailyCashFlow = useMemo(() => (dataset ? calculateDailyCashFlow(dataset) : []), [dataset]);
  const metrics = useMemo(() => (dataset ? calculateCashFlowMetrics(dataset) : null), [dataset]);
  const availableStartDate = dailyCashFlow[0]?.date ?? dataset?.startDate ?? '';
  const availableEndDate = dailyCashFlow[dailyCashFlow.length - 1]?.date ?? dataset?.endDate ?? '';
  const effectiveDateRange = useMemo(
    () => resolveDateRange(dateRangePreset, availableStartDate, availableEndDate, customStartDate, customEndDate),
    [availableEndDate, availableStartDate, customEndDate, customStartDate, dateRangePreset],
  );
  const visibleDailyCashFlow = useMemo(
    () =>
      dailyCashFlow.filter(
        (day) => day.date >= effectiveDateRange.startDate && day.date <= effectiveDateRange.endDate,
      ),
    [dailyCashFlow, effectiveDateRange.endDate, effectiveDateRange.startDate],
  );
  const periodMetrics = useMemo(() => {
    if (!metrics) {
      return null;
    }

    return calculatePeriodMetrics(dailyCashFlow, visibleDailyCashFlow, effectiveDateRange.startDate, metrics.initialBalanceCents);
  }, [dailyCashFlow, effectiveDateRange.startDate, metrics, visibleDailyCashFlow]);
  const negativeDays = visibleDailyCashFlow.filter((day) => day.projectedBalanceCents < 0);
  const selectedDayDetails = selectedDay ? visibleDailyCashFlow.find((day) => day.date === selectedDay) ?? null : null;

  const variationTotals = useMemo(() => {
    const changes = (dataset?.changes ?? []).filter(
      (change) => change.affectedDate >= effectiveDateRange.startDate && change.affectedDate <= effectiveDateRange.endDate,
    );
    const positiveCents = changes
      .filter((change) => change.impactCents > 0)
      .reduce((sum, change) => sum + change.impactCents, 0);
    const negativeCents = changes
      .filter((change) => change.impactCents < 0)
      .reduce((sum, change) => sum + change.impactCents, 0);

    return {
      positiveCents,
      negativeCents,
      netCents: positiveCents + negativeCents,
    };
  }, [dataset, effectiveDateRange.endDate, effectiveDateRange.startDate]);

  const filteredMovements = useMemo(
    () =>
      (dataset?.movements ?? []).filter((movement) => {
        const matchesDate = movement.date >= effectiveDateRange.startDate && movement.date <= effectiveDateRange.endDate;
        const matchesType = movementTypeFilter === 'ALL' || movement.type === movementTypeFilter;
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          [movement.counterparty, movement.documentNumber, movement.category]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

        return matchesDate && matchesType && matchesSearch;
      }),
    [dataset, effectiveDateRange.endDate, effectiveDateRange.startDate, movementTypeFilter, search],
  );

  const visibleChanges = useMemo(
    () =>
      (dataset?.changes ?? []).filter(
        (change) => change.affectedDate >= effectiveDateRange.startDate && change.affectedDate <= effectiveDateRange.endDate,
      ),
    [dataset, effectiveDateRange.endDate, effectiveDateRange.startDate],
  );

  const dailyChartData = visibleDailyCashFlow.map((day) => ({
    date: day.date,
    label: formatCashFlowDate(day.date),
    saldo: day.projectedBalanceCents,
    débitos: day.debitCents,
    créditos: day.creditCents,
  }));

  const snapshotChartData = (dataset?.snapshots ?? [])
    .filter((snapshot) => snapshot.snapshotDate >= effectiveDateRange.startDate && snapshot.snapshotDate <= effectiveDateRange.endDate)
    .map((snapshot) => ({
      label: formatCashFlowDate(snapshot.snapshotDate),
      forecast: snapshot.closingForecastCents,
    }));

  useEffect(() => {
    if (selectedDay && !visibleDailyCashFlow.some((day) => day.date === selectedDay)) {
      setSelectedDay(null);
    }
  }, [selectedDay, visibleDailyCashFlow]);

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

  const periodControl =
    dataset && periodMetrics ? (
      <DateRangeControl
        isOpen={isDateRangeOpen}
        preset={dateRangePreset}
        startDate={effectiveDateRange.startDate}
        endDate={effectiveDateRange.endDate}
        availableStartDate={availableStartDate}
        availableEndDate={availableEndDate}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onToggle={() => setIsDateRangeOpen((current) => !current)}
        onClose={() => setIsDateRangeOpen(false)}
        onPresetChange={(nextPreset) => {
          setDateRangePreset(nextPreset);
          if (nextPreset !== 'CUSTOM') {
            setIsDateRangeOpen(false);
          }
        }}
        onCustomStartDateChange={(value) => {
          setDateRangePreset('CUSTOM');
          setCustomStartDate(value);
        }}
        onCustomEndDateChange={(value) => {
          setDateRangePreset('CUSTOM');
          setCustomEndDate(value);
        }}
      />
    ) : null;

  return (
    <section className="dashboard-area cash-flow-area" aria-label="Previsão financeira">
      <div className="cash-flow-shell">
        <section className="panel cash-flow-hero">
          <div>
            <span className="section-label">Previsão financeira</span>
            <h2>Previsão inicial versus previsão atual</h2>
            <p>
              Controle débitos, créditos e variações para entender quais lançamentos mudaram o saldo previsto do mês.
            </p>
          </div>
          {dataset && periodMetrics ? (
            <div className="cash-flow-hero-side">
              {periodControl}
              <div
                className={`cash-flow-hero-kpi final-balance-card ${getBalanceTone(
                  periodMetrics.currentForecastClosingCents,
                )} ${getFinalBalanceCardToneClass(periodMetrics.currentForecastClosingCents)}`}
              >
              <span>Previsão atual</span>
              <strong>{formatCurrency(periodMetrics.currentForecastClosingCents)}</strong>
              <small>{formatPeriodLabel(effectiveDateRange.startDate, effectiveDateRange.endDate)} no período</small>
              </div>
            </div>
          ) : null}
        </section>

        {!dataset || !metrics || !periodMetrics ? (
          <section className="panel cash-flow-empty-state">
            <FileSpreadsheet size={28} />
            <div>
              <h3>Nenhuma previsão financeira publicada ainda.</h3>
              <p>Quando o administrador publicar uma versão, os indicadores aparecerão aqui automaticamente.</p>
            </div>
          </section>
        ) : (
          <>
        <nav className="cash-flow-tabs" aria-label="Navegação da previsão financeira">
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
              <MetricCard label="Saldo inicio período" value={periodMetrics.initialBalanceCents} tone={getBalanceTone(periodMetrics.initialBalanceCents)} icon={<Banknote size={18} />} />
              <MetricCard label="Total a pagar" value={periodMetrics.totalDebitsCents} tone="debit" icon={<TrendingDown size={18} />} />
              <MetricCard label="Total a receber" value={periodMetrics.totalCreditsCents} tone="credit" icon={<TrendingUp size={18} />} />
              <MetricCard label="Previsão inicial" value={periodMetrics.initialForecastClosingCents} tone={getBalanceTone(periodMetrics.initialForecastClosingCents)} />
              <MetricCard label="Previsão atual" value={periodMetrics.currentForecastClosingCents} tone={getBalanceTone(periodMetrics.currentForecastClosingCents)} />
              <MetricCard label="Variação acumulada" value={periodMetrics.accumulatedVariationCents} tone={periodMetrics.accumulatedVariationCents < 0 ? 'negative' : 'positive'} />
              <MetricCard
                label={`Menor saldo (${formatCashFlowDate(periodMetrics.minProjectedBalanceDate)})`}
                value={periodMetrics.minProjectedBalanceCents}
                tone={getBalanceTone(periodMetrics.minProjectedBalanceCents)}
                icon={<AlertTriangle size={18} />}
              />
            </div>

            <section className="panel cash-flow-chart-panel cash-flow-balance-panel">
              <div className="cash-flow-panel-heading">
                <div>
                  <h3>Saldo diário projetado</h3>
                  <p>
                    {selectedDayDetails
                      ? `${formatCashFlowDate(selectedDayDetails.date)}: ${formatCurrency(selectedDayDetails.projectedBalanceCents)}`
                      : 'Clique em um ponto para destacar o dia.'}
                  </p>
                </div>
                <div className="cash-flow-heading-actions">
                  <span className="cash-flow-chip">{negativeDays.length} dias negativos</span>
                </div>
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
                  <h3>Evolução da previsão de fechamento</h3>
                  <p>Snapshots mostram como a previsão mudou ao longo do mês.</p>
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
                  <Line type="monotone" dataKey="forecast" stroke="#5b8dff" strokeWidth={3} dot={{ r: 4, fill: '#5b8dff' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </section>

            <section className="panel cash-flow-summary-panel">
              <div className="cash-flow-panel-heading">
                <div>
                  <h3>Variações que explicam a mudança</h3>
                  <p>O sistema preserva a previsão inicial e registra o impacto de cada alteração.</p>
                </div>
              </div>
              <div className="variation-balance-row">
                <span>Saldo inicial do período</span>
                <strong>{formatCurrency(periodMetrics.initialForecastClosingCents)}</strong>
              </div>
              {visibleChanges.map((change) => (
                <div className={change.impactCents < 0 ? 'variation-balance-row negative' : 'variation-balance-row positive'} key={change.id}>
                  <span>{change.title}</span>
                  <strong>{getVariationLabel(change.impactCents)}</strong>
                </div>
              ))}
              <div className="variation-balance-row total">
                <span>Previsão atual</span>
                <strong>{formatCurrency(periodMetrics.currentForecastClosingCents)}</strong>
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
                <p>Tabela unica para débitos e créditos, pronta para receber importacao consolidada.</p>
              </div>
              <div className="cash-flow-filter-bar">
                <label className="cash-flow-search">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento, empresa ou categoria..." />
                </label>
                <select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value as MovementTypeFilter)}>
                  <option value="ALL">Todos</option>
                  <option value="DEBITO">Débitos</option>
                  <option value="CREDITO">Créditos</option>
                </select>
              </div>
            </div>
            <MovementTable movements={filteredMovements} />
          </section>
        ) : null}

        {activeTab === 'variations' ? (
          <section className="panel cash-flow-table-panel">
            <div className="variation-overview">
              <MetricCard label="Variações positivas" value={variationTotals.positiveCents} tone="positive" />
              <MetricCard label="Variações negativas" value={variationTotals.negativeCents} tone="negative" />
              <MetricCard label="Variação líquida" value={variationTotals.netCents} tone={variationTotals.netCents < 0 ? 'negative' : 'positive'} />
            </div>
            <div className="cash-flow-change-list">
              {visibleChanges.map((change) => (
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
                <h3>Contas bancárias</h3>
                <p>Defina quais contas entram no saldo disponível. Contas garantidas podem ficar apenas informativas.</p>
              </div>
              <span className="cash-flow-chip">Saldo considerado: {formatCurrency(periodMetrics.initialBalanceCents)}</span>
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
                    {account.includeInCash ? 'Considera no caixa' : 'Não considera'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function DateRangeControl({
  isOpen,
  preset,
  startDate,
  endDate,
  availableStartDate,
  availableEndDate,
  customStartDate,
  customEndDate,
  onPresetChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onToggle,
  onClose,
}: {
  isOpen: boolean;
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  availableStartDate: string;
  availableEndDate: string;
  customStartDate: string;
  customEndDate: string;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="period-menu">
      <button
        type="button"
        className={isOpen ? 'period-menu-button active' : 'period-menu-button'}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <CalendarDays size={15} />
        <span>{formatPeriodLabel(startDate, endDate)}</span>
      </button>

      {isOpen ? (
        <div className="period-popover" role="dialog" aria-label="Selecionar período da previsão">
          <div className="period-popover-header">
            <div>
              <strong>Período do gráfico</strong>
              <small>
                Base: {formatCashFlowDate(availableStartDate)} ate {formatCashFlowDate(availableEndDate)}
              </small>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar filtro de período">
              x
            </button>
          </div>

          <div className="period-actions" role="group" aria-label="Atalhos de período">
            {DATE_RANGE_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preset === option.value ? 'active' : ''}
                onClick={() => onPresetChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="period-date-fields">
            <label>
              <span>De</span>
              <input
                type="date"
                min={availableStartDate}
                max={availableEndDate}
                value={customStartDate || startDate}
                onChange={(event) => onCustomStartDateChange(event.target.value)}
              />
            </label>
            <label>
              <span>Ate</span>
              <input
                type="date"
                min={availableStartDate}
                max={availableEndDate}
                value={customEndDate || endDate}
                onChange={(event) => onCustomEndDateChange(event.target.value)}
              />
            </label>
          </div>

          <button type="button" className="period-apply-button" onClick={onClose}>
            Aplicar período
          </button>
        </div>
      ) : null}
    </div>
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
  tone?: FinancialTone;
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

type FinancialTone = 'neutral' | 'positive' | 'negative' | 'debit' | 'credit' | 'balance-positive' | 'balance-negative';

function getBalanceTone(valueCents: number): FinancialTone {
  return valueCents < 0 ? 'balance-negative' : 'balance-positive';
}

function getFinalBalanceCardToneClass(valueCents: number): 'final-balance-card-positive' | 'final-balance-card-negative' {
  return valueCents < 0 ? 'final-balance-card-negative' : 'final-balance-card-positive';
}

function resolveDateRange(
  preset: DateRangePreset,
  availableStartDate: string,
  availableEndDate: string,
  customStartDate: string,
  customEndDate: string,
) {
  if (!availableStartDate || !availableEndDate) {
    return { startDate: '', endDate: '' };
  }

  if (preset === 'CUSTOM') {
    const startDate = clampDate(customStartDate || availableStartDate, availableStartDate, availableEndDate);
    const endDate = clampDate(customEndDate || availableEndDate, startDate, availableEndDate);
    return { startDate, endDate };
  }

  if (preset === 'CURRENT_MONTH') {
    return resolveCurrentMonthRange(availableStartDate, availableEndDate);
  }

  const selectedPreset = DATE_RANGE_PRESETS.find((option) => option.value === preset);
  if (!selectedPreset?.days) {
    return { startDate: availableStartDate, endDate: availableEndDate };
  }

  const today = new Date().toISOString().slice(0, 10);
  const anchorDate = today >= availableStartDate && today <= availableEndDate ? today : availableStartDate;
  return {
    startDate: anchorDate,
    endDate: minDate(addDays(anchorDate, selectedPreset.days - 1), availableEndDate),
  };
}

function resolveCurrentMonthRange(availableStartDate: string, availableEndDate: string) {
  const monthRange = getCurrentMonthRange();

  if (monthRange.endDate < availableStartDate) {
    const nextAvailableMonth = getMonthRangeForDate(availableStartDate);
    return {
      startDate: availableStartDate,
      endDate: minDate(nextAvailableMonth.endDate, availableEndDate),
    };
  }

  if (monthRange.startDate > availableEndDate) {
    const lastAvailableMonth = getMonthRangeForDate(availableEndDate);
    return {
      startDate: maxDate(lastAvailableMonth.startDate, availableStartDate),
      endDate: availableEndDate,
    };
  }

  return {
    startDate: maxDate(monthRange.startDate, availableStartDate),
    endDate: minDate(monthRange.endDate, availableEndDate),
  };
}

function calculatePeriodMetrics(
  allDays: DailyCashFlowRow[],
  visibleDays: DailyCashFlowRow[],
  startDate: string,
  fallbackInitialBalanceCents: number,
) {
  if (visibleDays.length === 0) {
    return {
      initialBalanceCents: fallbackInitialBalanceCents,
      totalDebitsCents: 0,
      totalCreditsCents: 0,
      initialForecastClosingCents: fallbackInitialBalanceCents,
      currentForecastClosingCents: fallbackInitialBalanceCents,
      accumulatedVariationCents: 0,
      minProjectedBalanceCents: fallbackInitialBalanceCents,
      minProjectedBalanceDate: startDate,
    };
  }

  const firstVisibleDay = visibleDays[0];
  const previousDay = [...allDays].reverse().find((day) => day.date < firstVisibleDay.date);
  const initialBalanceCents = previousDay?.projectedBalanceCents ?? fallbackInitialBalanceCents;
  const totalDebitsCents = visibleDays.reduce((sum, day) => sum + day.debitCents, 0);
  const totalCreditsCents = visibleDays.reduce((sum, day) => sum + day.creditCents, 0);
  const lastDay = visibleDays[visibleDays.length - 1];
  const minDay = visibleDays.reduce((currentMin, day) =>
    day.projectedBalanceCents < currentMin.projectedBalanceCents ? day : currentMin,
  );

  return {
    initialBalanceCents,
    totalDebitsCents,
    totalCreditsCents,
    initialForecastClosingCents: initialBalanceCents,
    currentForecastClosingCents: lastDay.projectedBalanceCents,
    accumulatedVariationCents: lastDay.projectedBalanceCents - initialBalanceCents,
    minProjectedBalanceCents: minDay.projectedBalanceCents,
    minProjectedBalanceDate: minDay.date,
  };
}

function formatPeriodLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 'Período sem datas';
  }

  if (startDate === endDate) {
    return formatCashFlowDate(startDate);
  }

  return `${formatCashFlowDate(startDate)} a ${formatCashFlowDate(endDate)}`;
}

function clampDate(date: string, min: string, max: string) {
  if (date < min) {
    return min;
  }

  if (date > max) {
    return max;
  }

  return date;
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  return {
    startDate: formatLocalDate(year, month + 1, 1),
    endDate: formatLocalDate(year, month + 1, lastDay),
  };
}

function getMonthRangeForDate(date: string) {
  const [year, month] = date.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    startDate: formatLocalDate(year, month, 1),
    endDate: formatLocalDate(year, month, lastDay),
  };
}

function formatLocalDate(year: number, month: number, day: number) {
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
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
