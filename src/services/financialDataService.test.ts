import { describe, expect, it } from 'vitest';
import { aggregateRecords } from './financialDataService';
import type { FinancialRecord } from '../types/financial';

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
    departmentName: 'Financeiro',
    departmentKey: 'FINANCEIRO',
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

describe('financialDataService', () => {
  it('aggregates records by grouping level', () => {
    expect(aggregateRecords(records, 'group')).toEqual([
      expect.objectContaining({ key: 'MATERIA PRIMA', label: 'Matéria Prima', totalCents: 50000, recordCount: 1 }),
      expect.objectContaining({ key: 'SALARIOS', label: 'Salários', totalCents: 30000, recordCount: 2 }),
    ]);
  });

  it('filters and aggregates records by department', () => {
    expect(aggregateRecords(records, 'department', { groupKey: 'SALARIOS' })).toEqual([
      expect.objectContaining({ key: 'FINANCEIRO', label: 'Financeiro', totalCents: 20000 }),
      expect.objectContaining({ key: 'ADMINISTRATIVO', label: 'Administrativo', totalCents: 10000 }),
    ]);
  });

  it('filters and aggregates records by person with search', () => {
    expect(
      aggregateRecords(records, 'person', {
        groupKey: 'SALARIOS',
        departmentKey: 'ADMINISTRATIVO',
        search: 'ana',
      }),
    ).toEqual([expect.objectContaining({ key: 'ANA', label: 'Ana', totalCents: 10000 })]);
  });
});

