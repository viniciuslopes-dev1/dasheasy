import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownUp, BarChart3, Search, SlidersHorizontal } from 'lucide-react';
import { aggregateRecords } from '../../services/financialDataService';
import type { DashboardLevel, ExcelAnalysis, FinancialSummary } from '../../types/financial';
import { formatCurrency, formatPercent } from '../../utils/formatCurrency';

type ComparisonMode = Extract<DashboardLevel, 'group' | 'department' | 'person'>;

interface ComparisonDashboardProps {
  records: ExcelAnalysis['records'];
  onOpenSettings: () => void;
}

const MODE_OPTIONS: Array<{ value: ComparisonMode; label: string; description: string }> = [
  { value: 'department', label: 'Departamentos', description: 'Compare centros dentro de um agrupamento.' },
  { value: 'group', label: 'Agrupamentos', description: 'Compare os grandes blocos financeiros.' },
  { value: 'person', label: 'Pessoas', description: 'Compare pessoas, fornecedores ou responsáveis.' },
];

const BAR_COLORS = ['#2f6f5e', '#7b9f35', '#c68d2d', '#2d7b8f', '#8b6f47', '#5b7c99', '#9b5c4a', '#68745f'];

function getModeLabel(mode: ComparisonMode): string {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? 'Comparação';
}

function getShortLabel(label: string): string {
  return label.length > 24 ? `${label.slice(0, 22)}...` : label;
}

export default function ComparisonDashboard({ records, onOpenSettings }: ComparisonDashboardProps) {
  const [mode, setMode] = useState<ComparisonMode>('department');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const groups = useMemo(() => aggregateRecords(records, 'group'), [records]);
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0] ?? null;
  const groupFilterKey = mode === 'group' ? undefined : selectedGroup?.key;
  const comparisonItems = useMemo(
    () =>
      aggregateRecords(records, mode, {
        groupKey: groupFilterKey,
        search,
      }),
    [groupFilterKey, mode, records, search],
  );

  const chartItems = comparisonItems.slice(0, 12);
  const totalCents = comparisonItems.reduce((sum, item) => sum + item.totalCents, 0);
  const averageCents = comparisonItems.length > 0 ? Math.round(totalCents / comparisonItems.length) : 0;
  const leader = comparisonItems[0] ?? null;
  const activeItem = activeKey ? comparisonItems.find((item) => item.key === activeKey) ?? null : null;
  const comparisonTitle =
    mode === 'group' ? 'Comparação por agrupamento' : `${getModeLabel(mode)} em ${selectedGroup?.label ?? 'agrupamento'}`;

  useEffect(() => {
    if (!selectedGroupKey && groups[0]) {
      setSelectedGroupKey(groups[0].key);
    }
  }, [groups, selectedGroupKey]);

  useEffect(() => {
    setActiveKey(null);
  }, [mode, selectedGroupKey, search]);

  if (records.length === 0) {
    return (
      <section className="dashboard-area" aria-label="Comparações financeiras">
        <section className="empty-dashboard">
          <div>
            <span className="section-label">Comparações</span>
            <h3>Importe uma planilha para comparar departamentos e valores.</h3>
            <p>Depois da importação, esta área mostra rankings e gráficos comparativos por agrupamento.</p>
          </div>
          <button type="button" className="primary-action compact" onClick={onOpenSettings}>
            Importar planilha
          </button>
        </section>
      </section>
    );
  }

  return (
    <section className="dashboard-area" aria-label="Comparações financeiras">
      <div className="comparison-layout">
        <section className="panel comparison-control-panel">
          <div className="comparison-heading">
            <span className="section-label">Análise comparativa</span>
            <h2>{comparisonTitle}</h2>
            <p>Compare valores lado a lado para encontrar concentrações, desvios e oportunidades de melhoria.</p>
          </div>

          <div className="comparison-control-group">
            <strong>Comparar por</strong>
            <div className="comparison-mode-grid">
              {MODE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={mode === option.value ? 'comparison-mode active' : 'comparison-mode'}
                  onClick={() => setMode(option.value)}
                >
                  <span>{option.label}</span>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </div>

          {mode !== 'group' ? (
            <label className="comparison-field">
              <span>Agrupamento base</span>
              <select value={selectedGroup?.key ?? ''} onChange={(event) => setSelectedGroupKey(event.target.value)}>
                {groups.map((group) => (
                  <option value={group.key} key={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="comparison-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar comparação..."
              aria-label="Filtrar comparação"
            />
          </label>

          <div className="comparison-metrics">
            <div>
              <span>Total comparado</span>
              <strong>{formatCurrency(totalCents)}</strong>
            </div>
            <div>
              <span>Itens</span>
              <strong>{comparisonItems.length}</strong>
            </div>
            <div>
              <span>Média</span>
              <strong>{formatCurrency(averageCents)}</strong>
            </div>
          </div>
        </section>

        <section className="panel comparison-chart-panel">
          <div className="comparison-chart-header">
            <div>
              <h2>Ranking comparativo</h2>
              <p>{activeItem ? `${activeItem.label}: ${formatCurrency(activeItem.totalCents)}` : 'Clique em uma barra ou linha para destacar.'}</p>
            </div>
            <div className="comparison-chip">
              <BarChart3 size={17} />
              Top {Math.min(chartItems.length, 12)}
            </div>
          </div>

          {comparisonItems.length > 0 ? (
            <>
              <div className="comparison-chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartItems} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 10 }}>
                    <CartesianGrid stroke="rgba(112, 132, 165, 0.13)" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => formatCurrency(Number(value)).replace('R$', '').trim()}
                      stroke="#7e8da5"
                      tick={{ fill: '#9aa8bd', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={142}
                      interval={0}
                      tickFormatter={getShortLabel}
                      stroke="#7e8da5"
                      tick={{ fill: '#f4f7ff', fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Valor']}
                      labelFormatter={(label) => String(label)}
                      cursor={{ fill: 'rgba(84, 129, 255, 0.08)' }}
                      contentStyle={{
                        background: '#111a2b',
                        border: '1px solid rgba(142, 159, 185, 0.25)',
                        borderRadius: 10,
                        color: '#f8fbff',
                      }}
                    />
                    <Bar dataKey="totalCents" radius={[0, 8, 8, 0]} barSize={16} onClick={(item: FinancialSummary) => setActiveKey(item.key)}>
                      {chartItems.map((item, index) => (
                        <Cell
                          key={item.key}
                          fill={BAR_COLORS[index % BAR_COLORS.length]}
                          opacity={activeKey && activeKey !== item.key ? 0.45 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="comparison-bottom-grid">
                <div className="comparison-insight-card">
                  <div className="tip-icon">
                    <ArrowDownUp size={22} />
                  </div>
                  <div>
                    <strong>{leader ? `${leader.label} lidera a comparação` : 'Sem líder'}</strong>
                    <p>
                      {leader && totalCents > 0
                        ? `${formatPercent(leader.totalCents / totalCents)} do total filtrado (${formatCurrency(leader.totalCents)}).`
                        : 'Importe e filtre dados para gerar insights comparativos.'}
                    </p>
                  </div>
                </div>

                <div className="comparison-ranking">
                  {comparisonItems.map((item, index) => {
                    const percent = totalCents > 0 ? item.totalCents / totalCents : 0;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        className={activeKey === item.key ? 'comparison-ranking-row active' : 'comparison-ranking-row'}
                        onClick={() => setActiveKey((current) => (current === item.key ? null : item.key))}
                      >
                        <span>{index + 1}</span>
                        <strong>{item.label}</strong>
                        <small>{formatPercent(percent)}</small>
                        <b>{formatCurrency(item.totalCents)}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">Nenhum item encontrado para os filtros atuais.</div>
          )}
        </section>
      </div>
    </section>
  );
}
