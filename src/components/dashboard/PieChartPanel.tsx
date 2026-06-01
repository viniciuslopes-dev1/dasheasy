import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { FinancialSummary } from '../../types/financial';
import { formatCurrency, formatPercent } from '../../utils/formatCurrency';

const COLORS = ['#2f6f5e', '#7b9f35', '#c68d2d', '#2d7b8f', '#8b6f47', '#5b7c99', '#9b5c4a', '#68745f', '#b35c7a', '#4f8f77', '#9a7b31'];

interface PieChartPanelProps {
  title: string;
  items: FinancialSummary[];
  totalLabel: string;
  selectionLabel: string;
  selectionHint?: string;
}

function toChartData(items: FinancialSummary[]) {
  const positive = items.filter((item) => item.totalCents > 0);
  const top = positive.slice(0, 4);
  const rest = positive.slice(4);
  if (rest.length === 0) {
    return top;
  }

  return [
    ...top,
    {
      key: 'OUTROS',
      label: 'Outros',
      totalCents: rest.reduce((sum, item) => sum + item.totalCents, 0),
      recordCount: rest.reduce((sum, item) => sum + item.recordCount, 0),
    },
  ];
}

function formatCompactCurrency(cents: number): string {
  if (cents >= 100000000) {
    return `R$ ${(cents / 100000000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}M`;
  }

  return formatCurrency(cents);
}

export default function PieChartPanel({ title, items, totalLabel, selectionLabel, selectionHint }: PieChartPanelProps) {
  const data = toChartData(items);
  const total = data.reduce((sum, item) => sum + item.totalCents, 0);

  return (
    <section className="chart-panel" aria-label={title}>
      <div className="chart-heading">
        <div>
          <h2>Valor total</h2>
          <strong>{total > 0 ? totalLabel : 'R$ 0,00'}</strong>
          <p>
            Baseado na seleção atual
            {selectionHint ? <span>{selectionHint}</span> : null}
          </p>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="chart-content">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={390}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="totalCents"
                  nameKey="label"
                  innerRadius="46%"
                  outerRadius="86%"
                  paddingAngle={0}
                  stroke="rgba(11, 17, 29, 0.9)"
                  strokeWidth={1}
                  label={({ percent }) => (percent && percent >= 0.045 ? formatPercent(percent).replace(',0', '') : '')}
                  labelLine={false}
                >
                  {data.map((item, index) => (
                    <Cell key={item.key} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    background: '#111a2b',
                    border: '1px solid rgba(142, 159, 185, 0.25)',
                    borderRadius: 10,
                    color: '#f8fbff',
                  }}
                />
                <Legend wrapperStyle={{ display: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span>Total</span>
              <strong>{formatCompactCurrency(total)}</strong>
              <small>{selectionLabel === 'Todos' ? '100%' : selectionLabel}</small>
            </div>
          </div>
          <div className="chart-legend-list">
            {data.slice(0, 8).map((item, index) => {
              const percent = total > 0 ? item.totalCents / total : 0;
              return (
                <div className="chart-legend-row" key={item.key}>
                  <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
                  <strong>{item.label}</strong>
                  <small>{formatPercent(percent)}</small>
                  <b>{formatCurrency(item.totalCents)}</b>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">O gráfico aparecerá quando houver valores importados.</div>
      )}
    </section>
  );
}
