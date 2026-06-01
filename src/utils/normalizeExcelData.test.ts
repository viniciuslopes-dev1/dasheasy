import { describe, expect, it } from 'vitest';
import {
  createDedupeKey,
  normalizeTextKey,
  parseCurrencyToCents,
  parseExcelDate,
} from './normalizeExcelData';

describe('normalizeExcelData', () => {
  it('normalizes text keys with accents, punctuation and extra spaces', () => {
    expect(normalizeTextKey('  Transporte de Funcionários  ')).toBe('TRANSPORTE DE FUNCIONARIOS');
    expect(normalizeTextKey('DESPESAS GERAIS- OPERACIONAL')).toBe('DESPESAS GERAIS OPERACIONAL');
  });

  it('parses Brazilian currency and numeric values to cents', () => {
    expect(parseCurrencyToCents('R$ 1.234,56')).toBe(123456);
    expect(parseCurrencyToCents('14794.649999999998')).toBe(1479465);
    expect(parseCurrencyToCents(41254.54)).toBe(4125454);
    expect(parseCurrencyToCents('')).toBeNull();
  });

  it('parses Excel, Date and ISO date values into yyyy-mm-dd', () => {
    expect(parseExcelDate(new Date('2026-05-04T03:00:00.000Z'))).toBe('2026-05-04');
    expect(parseExcelDate('2026-05-19T00:00:00')).toBe('2026-05-19');
    expect(parseExcelDate(46146)).toBe('2026-05-04');
  });

  it('creates stable dedupe keys from relevant record fields', () => {
    const first = createDedupeKey({
      groupName: 'Salários',
      departmentName: 'Administrativo',
      classificationName: 'Administrativo',
      financialType: 'Despesa',
      documentNumber: '26/05-SALARIO',
      personName: 'DELMA REGINA FERNANDES',
      dueDate: '2026-05-04',
      amountCents: 237500,
      detailGroupName: 'SALÁRIOS',
    });
    const second = createDedupeKey({
      groupName: ' SALARIOS ',
      departmentName: 'administrativo',
      classificationName: 'Administrativo',
      financialType: 'Despesa',
      documentNumber: '26/05-SALARIO',
      personName: 'DELMA  REGINA FERNANDES',
      dueDate: '2026-05-04',
      amountCents: 237500,
      detailGroupName: 'salários',
    });

    expect(first).toBe(second);
  });
});
