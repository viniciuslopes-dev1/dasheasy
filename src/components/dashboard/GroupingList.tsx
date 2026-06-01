import type { FinancialSummary } from '../../types/financial';
import { formatCurrency } from '../../utils/formatCurrency';

interface GroupingListProps {
  items: FinancialSummary[];
  activeKey?: string;
  emptyLabel: string;
  onSelect: (item: FinancialSummary) => void;
}

export default function GroupingList({ items, activeKey, emptyLabel, onSelect }: GroupingListProps) {
  if (items.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="grouping-list">
      {items.map((item) => (
        <button
          type="button"
          key={item.key}
          className={item.key === activeKey ? 'group-row active' : 'group-row'}
          onClick={() => onSelect(item)}
        >
          <span>
            <strong>{item.label}</strong>
            <small>{item.recordCount} registros</small>
          </span>
          <b>{formatCurrency(item.totalCents)}</b>
        </button>
      ))}
    </div>
  );
}

