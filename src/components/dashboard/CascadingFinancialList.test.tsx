import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CascadingFinancialList from './CascadingFinancialList';
import type { FinancialRecord, FinancialSummary } from '../../types/financial';

const records: FinancialRecord[] = [
  {
    sourceRow: 5,
    groupName: 'Salários',
    groupKey: 'SALARIOS',
    departmentName: 'Administrativo',
    departmentKey: 'ADMINISTRATIVO',
    classificationName: 'Administrativo',
    classificationKey: 'ADMINISTRATIVO',
    financialType: 'Despesa',
    financialTypeKey: 'DESPESA',
    documentNumber: '1',
    personName: 'Ana',
    personKey: 'ANA',
    dueDate: '2026-05-04',
    amountCents: 10000,
    detailGroupName: 'SALÁRIOS',
    detailGroupKey: 'SALARIOS',
    rawData: {},
    dedupeKey: 'a',
  },
  {
    sourceRow: 6,
    groupName: 'Salários',
    groupKey: 'SALARIOS',
    departmentName: 'Administrativo',
    departmentKey: 'ADMINISTRATIVO',
    classificationName: 'Administrativo',
    classificationKey: 'ADMINISTRATIVO',
    financialType: 'Despesa',
    financialTypeKey: 'DESPESA',
    documentNumber: '2',
    personName: 'Bruno',
    personKey: 'BRUNO',
    dueDate: '2026-05-05',
    amountCents: 20000,
    detailGroupName: 'SALÁRIOS',
    detailGroupKey: 'SALARIOS',
    rawData: {},
    dedupeKey: 'b',
  },
  {
    sourceRow: 7,
    groupName: 'Matéria Prima',
    groupKey: 'MATERIA PRIMA',
    departmentName: 'Fundição',
    departmentKey: 'FUNDICAO',
    classificationName: 'Operacional',
    classificationKey: 'OPERACIONAL',
    financialType: 'Custo',
    financialTypeKey: 'CUSTO',
    documentNumber: '3',
    personName: 'Fornecedor A',
    personKey: 'FORNECEDOR A',
    dueDate: '2026-05-06',
    amountCents: 50000,
    detailGroupName: 'MATERIA PRIMA',
    detailGroupKey: 'MATERIA PRIMA',
    rawData: {},
    dedupeKey: 'c',
  },
];

const groups: FinancialSummary[] = [
  { key: 'MATERIA PRIMA', label: 'Matéria Prima', totalCents: 50000, recordCount: 1 },
  { key: 'SALARIOS', label: 'Salários', totalCents: 30000, recordCount: 2 },
];

describe('CascadingFinancialList', () => {
  it('opens departments and people inline as a cascade', async () => {
    const onSelectGroup = vi.fn();
    const onSelectDepartment = vi.fn();

    render(
      <CascadingFinancialList
        groups={groups}
        records={records}
        selectedGroup={null}
        selectedDepartment={null}
        emptyLabel="Sem dados"
        onSelectGroup={onSelectGroup}
        onSelectDepartment={onSelectDepartment}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Salários/ }));

    expect(onSelectGroup).toHaveBeenCalledWith(groups[1]);
    expect(screen.getByRole('button', { name: /Administrativo/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Administrativo/ }));

    expect(onSelectDepartment).toHaveBeenCalledWith(expect.objectContaining({ key: 'ADMINISTRATIVO' }));
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });
});
