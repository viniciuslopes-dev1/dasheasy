import { useState } from 'react';
import { BriefcaseBusiness, Building2, ChevronDown, ChevronRight, UserRound } from 'lucide-react';
import { aggregateRecords } from '../../services/financialDataService';
import type { FinancialRecord, FinancialSummary } from '../../types/financial';
import { formatCurrency } from '../../utils/formatCurrency';

interface CascadingFinancialListProps {
  groups: FinancialSummary[];
  records: FinancialRecord[];
  selectedGroup: FinancialSummary | null;
  selectedDepartment: FinancialSummary | null;
  emptyLabel: string;
  onSelectGroup: (item: FinancialSummary) => void;
  onSelectDepartment: (item: FinancialSummary) => void;
}

export default function CascadingFinancialList({
  groups,
  records,
  selectedGroup,
  selectedDepartment,
  emptyLabel,
  onSelectGroup,
  onSelectDepartment,
}: CascadingFinancialListProps) {
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [openDepartmentKey, setOpenDepartmentKey] = useState<string | null>(null);
  const effectiveGroupKey = selectedGroup?.key ?? openGroupKey;
  const effectiveDepartmentKey = selectedDepartment?.key ?? openDepartmentKey;

  if (groups.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="cascade-list">
      {groups.map((group) => {
        const isGroupOpen = effectiveGroupKey === group.key;
        const departments = isGroupOpen ? aggregateRecords(records, 'department', { groupKey: group.key }) : [];

        return (
          <div className="cascade-group" key={group.key}>
            <button
              type="button"
              className={isGroupOpen ? 'cascade-row cascade-row-main active' : 'cascade-row cascade-row-main'}
              onClick={() => {
                setOpenGroupKey(group.key);
                setOpenDepartmentKey(null);
                onSelectGroup(group);
              }}
              aria-expanded={isGroupOpen}
            >
              <span className="cascade-icon">{isGroupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              <BriefcaseBusiness className="node-icon group-node-icon" size={24} />
              <span className="cascade-label">
                <strong>{group.label}</strong>
              </span>
              <small className="item-badge">{group.recordCount} itens</small>
              <b>{formatCurrency(group.totalCents)}</b>
            </button>

            {isGroupOpen ? (
              <div className="cascade-children">
                {departments.map((department) => {
                  const isDepartmentOpen = effectiveDepartmentKey === department.key;
                  const people = isDepartmentOpen
                    ? aggregateRecords(records, 'person', {
                        groupKey: group.key,
                        departmentKey: department.key,
                      })
                    : [];

                  return (
                    <div className="cascade-department" key={department.key}>
                      <button
                        type="button"
                        className={isDepartmentOpen ? 'cascade-row cascade-row-child active' : 'cascade-row cascade-row-child'}
                        onClick={() => {
                          setOpenDepartmentKey(department.key);
                          onSelectDepartment(department);
                        }}
                        aria-expanded={isDepartmentOpen}
                      >
                        <span className="cascade-icon">{isDepartmentOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                        <Building2 className="node-icon department-node-icon" size={22} />
                        <span className="cascade-label">
                          <strong>{department.label}</strong>
                        </span>
                        <small className="item-badge">{department.recordCount} itens</small>
                        <b>{formatCurrency(department.totalCents)}</b>
                      </button>

                      {isDepartmentOpen ? (
                        <div className="cascade-people">
                          {people.map((person) => (
                            <div className="cascade-person" key={person.key}>
                              <UserRound className="node-icon person-node-icon" size={21} />
                              <span>
                                <strong>{person.label}</strong>
                              </span>
                              <small className="item-badge person-badge">{person.recordCount} itens</small>
                              <b>{formatCurrency(person.totalCents)}</b>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
