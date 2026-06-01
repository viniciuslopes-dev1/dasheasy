import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { FinancialSummary } from '../../types/financial';
import { formatCurrency, formatPercent } from '../../utils/formatCurrency';

const COLORS = ['#2f6f5e', '#7b9f35', '#c68d2d', '#2d7b8f', '#8b6f47', '#5b7c99', '#9b5c4a', '#68745f', '#b35c7a', '#4f8f77', '#9a7b31'];

interface PieChartPanelProps {
  title: string;
  items: FinancialSummary[];
}

function toChartData(items: FinancialSummary[]) {
  const positive = items.filter((item) => item.totalCents > 0);
  const top = positive.slice(0, 10);
  const rest = positive.slice(10);
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

export default function PieChartPanel({ title, items }: PieChartPanelProps) {
  const data = toChartData(items);
  const total = data.reduce((sum, item) => sum + item.totalCents, 0);

  return (
    <section className="panel chart-panel" aria-label={title}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{total > 0 ? formatCurrency(total) : 'Sem valores positivos para exibir'}</p>
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie
              data={data}
              dataKey="totalCents"
              nameKey="label"
              innerRadius={68}
              outerRadius={112}
              paddingAngle={1}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((item, index) => (
                <Cell key={item.key} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Valor']}
              labelFormatter={(label) => String(label)}
            />
            <Legend
              formatter={(value) => {
                const item = data.find((entry) => entry.label === value);
                const percent = item && total > 0 ? formatPercent(item.totalCents / total) : '';
                return `${value} ${percent}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="empty-state">O gráfico aparecerá quando houver valores importados.</div>
      )}
    </section>
  );
}

