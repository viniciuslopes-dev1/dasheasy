import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import type { FinancialSummary } from '../../types/financial';
import { formatCurrency, formatPercent } from '../../utils/formatCurrency';

const COLORS = ['#2f6f5e', '#7b9f35', '#c68d2d', '#2d7b8f', '#8b6f47', '#5b7c99', '#9b5c4a', '#68745f', '#b35c7a', '#4f8f77', '#9a7b31'];
const ACTIVE_SLICE_ANIMATION_MS = 220;
const RADIAN = Math.PI / 180;

interface ActiveSliceShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

interface PieChartPanelProps {
  title: string;
  items: FinancialSummary[];
  totalLabel: string;
  selectionHint?: string;
}

function toChartData(items: FinancialSummary[], showAll: boolean) {
  const positive = items.filter((item) => item.totalCents > 0);

  if (showAll) {
    return positive;
  }

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

function renderActiveSlice(props: unknown, isDismissing: boolean, onToggleActive: () => void) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as ActiveSliceShapeProps;
  const middleAngle = (startAngle + endAngle) / 2;
  const offsetX = Math.cos(-middleAngle * RADIAN) * 8;
  const offsetY = Math.sin(-middleAngle * RADIAN) * 8;
  const animationStyle = {
    '--slice-dx': `${offsetX}px`,
    '--slice-dy': `${offsetY}px`,
  } as CSSProperties;

  return (
    <g
      className={isDismissing ? 'active-pie-slice exiting' : 'active-pie-slice'}
      style={animationStyle}
      onClick={(event) => {
        event.stopPropagation();
        onToggleActive();
      }}
    >
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 7}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="rgba(11, 17, 29, 0.9)"
        strokeWidth={1}
      />
    </g>
  );
}

export default function PieChartPanel({ title, items, totalLabel, selectionHint }: PieChartPanelProps) {
  const [showAllItems, setShowAllItems] = useState(false);
  const [activeVisualKey, setActiveVisualKey] = useState<string | null>(null);
  const [isDismissingActiveSlice, setIsDismissingActiveSlice] = useState(false);
  const dismissTimeoutRef = useRef<number | null>(null);
  const positiveItemsCount = useMemo(() => items.filter((item) => item.totalCents > 0).length, [items]);
  const canShowAll = positiveItemsCount > 5;
  const data = useMemo(() => toChartData(items, showAllItems && canShowAll), [canShowAll, items, showAllItems]);
  const total = data.reduce((sum, item) => sum + item.totalCents, 0);
  const activeVisualIndex = activeVisualKey ? data.findIndex((item) => item.key === activeVisualKey) : -1;
  const activeVisualItem = activeVisualIndex >= 0 ? data[activeVisualIndex] : null;
  const activePercent = activeVisualItem && total > 0 ? activeVisualItem.totalCents / total : 0;

  function clearDismissTimeout() {
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }

  function dismissActiveSlice() {
    if (!activeVisualKey) {
      return;
    }

    clearDismissTimeout();
    setIsDismissingActiveSlice(true);
    dismissTimeoutRef.current = window.setTimeout(() => {
      setActiveVisualKey(null);
      setIsDismissingActiveSlice(false);
      dismissTimeoutRef.current = null;
    }, ACTIVE_SLICE_ANIMATION_MS);
  }

  function selectSlice(key: string) {
    if (activeVisualKey === key && !isDismissingActiveSlice) {
      dismissActiveSlice();
      return;
    }

    clearDismissTimeout();
    setActiveVisualKey(key);
    setIsDismissingActiveSlice(false);
  }

  useEffect(() => {
    setShowAllItems(false);
  }, [items]);

  useEffect(() => {
    clearDismissTimeout();
    setActiveVisualKey(null);
    setIsDismissingActiveSlice(false);
  }, [data]);

  useEffect(
    () => () => {
      clearDismissTimeout();
    },
    [],
  );

  return (
    <section className="chart-panel" aria-label={title}>
      <div className="chart-heading">
        <div>
          <h2>Valor total</h2>
          <strong>{total > 0 ? totalLabel : 'R$ 0,00'}</strong>
          <p>
            Baseado na seleção atual
            {selectionHint ? <span>{selectionHint}</span> : null}
            {canShowAll ? (
              <button
                type="button"
                className="chart-toggle-button"
                aria-pressed={showAllItems}
                onClick={() => setShowAllItems((current) => !current)}
              >
                {showAllItems ? 'Resumir' : `Ver todos (${positiveItemsCount})`}
              </button>
            ) : null}
          </p>
        </div>
      </div>

      {data.length > 0 ? (
        <div className={showAllItems && canShowAll ? 'chart-content chart-content-expanded' : 'chart-content'}>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={245}>
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
                  activeIndex={activeVisualIndex}
                  activeShape={(props: unknown) => renderActiveSlice(props, isDismissingActiveSlice, dismissActiveSlice)}
                  onClick={(_, index) => {
                    const selectedKey = data[index]?.key;
                    if (selectedKey) {
                      selectSlice(selectedKey);
                    }
                  }}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.key}
                      className="pie-slice"
                      fill={COLORS[index % COLORS.length]}
                      opacity={activeVisualKey && activeVisualKey !== item.key ? 0.5 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid rgba(15, 23, 42, 0.14)',
                    borderRadius: 10,
                    color: '#0f172a',
                    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.22)',
                    fontWeight: 800,
                  }}
                  itemStyle={{
                    color: '#0f172a',
                    fontWeight: 900,
                  }}
                  labelStyle={{
                    color: '#334155',
                    fontWeight: 900,
                    marginBottom: 4,
                  }}
                />
                <Legend wrapperStyle={{ display: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span>{activeVisualItem ? 'Selecionado' : 'Total'}</span>
              <strong>{formatCompactCurrency(activeVisualItem?.totalCents ?? total)}</strong>
              {activeVisualItem ? <small>{formatPercent(activePercent)}</small> : null}
            </div>
          </div>
          <div className={showAllItems && canShowAll ? 'chart-legend-list full' : 'chart-legend-list'}>
            {data.map((item, index) => {
              const percent = total > 0 ? item.totalCents / total : 0;
              return (
                <button
                  type="button"
                  className={activeVisualKey === item.key ? 'chart-legend-row active' : 'chart-legend-row'}
                  key={item.key}
                  aria-pressed={activeVisualKey === item.key}
                  onClick={() => selectSlice(item.key)}
                >
                  <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
                  <strong>{item.label}</strong>
                  <small>{formatPercent(percent)}</small>
                  <b>{formatCurrency(item.totalCents)}</b>
                </button>
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
