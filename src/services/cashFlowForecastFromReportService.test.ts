import { describe, expect, it } from 'vitest';
import { createForecastDatasetFromCashFlowReport } from './cashFlowForecastFromReportService';
import type { CashFlowDataset } from '../types/cashFlow';
import type { CashFlowReportDataset } from '../types/cashFlowReport';

const reportDataset: CashFlowReportDataset = {
  sourceFileName: 'fluxo.xlsx',
  importedAt: '2026-07-02T10:00:00.000Z',
  sheetName: 'FLUXO DE CAIXA',
  monthLabel: 'Julho de 2026',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  initialBalanceCents: 100000,
  initialBalanceSource: 'spreadsheet',
  bankAccounts: [
    {
      id: 'bank-1',
      code: '01',
      bankName: 'ITAU',
      accountLabel: 'ITAU - CONTA',
      debitCents: null,
      creditCents: 100000,
      balanceCents: 100000,
      runningBalanceCents: 100000,
      isGuaranteed: false,
      includeInCashFlow: true,
    },
  ],
  movements: [
    {
      id: 'm-1',
      sourceRow: 2,
      documentNumber: 'D-1',
      transactionType: 'DEBITO',
      accountName: 'Fornecedor A',
      isSettled: false,
      isForecast: true,
      dueDate: '2026-07-01',
      valueCents: 50000,
      isAnticipated: false,
      excludedFromCashFlow: false,
      rawData: {},
    },
    {
      id: 'm-2',
      sourceRow: 3,
      documentNumber: 'C-1',
      transactionType: 'CREDITO',
      accountName: 'Cliente A',
      isSettled: true,
      isForecast: true,
      dueDate: '2026-07-02',
      valueCents: 30000,
      isAnticipated: true,
      excludedFromCashFlow: true,
      rawData: {},
    },
  ],
  cashFlowMovements: [
    {
      id: 'm-1',
      sourceRow: 2,
      documentNumber: 'D-1',
      transactionType: 'DEBITO',
      accountName: 'Fornecedor A',
      isSettled: false,
      isForecast: true,
      dueDate: '2026-07-01',
      valueCents: 50000,
      isAnticipated: false,
      excludedFromCashFlow: false,
      rawData: {},
    },
  ],
  anticipatedMovements: [
    {
      id: 'm-2',
      sourceRow: 3,
      documentNumber: 'C-1',
      transactionType: 'CREDITO',
      accountName: 'Cliente A',
      isSettled: true,
      isForecast: true,
      dueDate: '2026-07-02',
      valueCents: 30000,
      isAnticipated: true,
      excludedFromCashFlow: true,
      rawData: {},
    },
  ],
  dailyRows: [
    {
      date: '2026-07-01',
      openingBalanceCents: 100000,
      debitCents: 50000,
      creditCents: 0,
      anticipatedCents: 0,
      netCents: -50000,
      closingBalanceCents: 50000,
      movementCount: 1,
    },
    {
      date: '2026-07-02',
      openingBalanceCents: 50000,
      debitCents: 0,
      creditCents: 0,
      anticipatedCents: 30000,
      netCents: 0,
      closingBalanceCents: 50000,
      movementCount: 0,
    },
  ],
  variations: [
    {
      id: 'variation-1',
      documentNumber: 'D-1',
      accountName: 'Fornecedor A',
      transactionType: 'DEBITO',
      variationType: 'VALOR_ALTERADO',
      dueDate: '2026-07-01',
      previousDueDate: '2026-07-01',
      currentValueCents: 50000,
      previousValueCents: 30000,
      impactCents: -20000,
      isAnticipated: false,
      description: 'Valor alterado.',
    },
  ],
  issues: [],
};

describe('cashFlowForecastFromReportService', () => {
  it('creates the financial forecast dataset from the cash flow report dataset', () => {
    const previousForecast: CashFlowDataset = {
      monthLabel: 'Junho de 2026',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      initialForecastClosingCents: 70000,
      sourceFileName: 'fluxo-antigo.xlsx',
      importedAt: '2026-07-01T10:00:00.000Z',
      bankAccounts: [],
      dailyEntries: [],
      movements: [],
      changes: [],
      snapshots: [
        {
          id: 'snapshot-old',
          snapshotDate: '2026-07-01',
          closingForecastCents: 70000,
        },
      ],
      issues: [],
    };

    const forecast = createForecastDatasetFromCashFlowReport(reportDataset, previousForecast);

    expect(forecast.monthLabel).toBe('Julho de 2026');
    expect(forecast.initialForecastClosingCents).toBe(70000);
    expect(forecast.bankAccounts).toEqual([
      expect.objectContaining({
        id: 'bank-1',
        bank: 'ITAU',
        description: 'ITAU - CONTA',
        balanceCents: 100000,
        includeInCash: true,
      }),
    ]);
    expect(forecast.dailyEntries).toEqual([
      expect.objectContaining({ date: '2026-07-01', projectedBalanceCents: 50000 }),
      expect.objectContaining({ date: '2026-07-02', projectedBalanceCents: 50000 }),
    ]);
    expect(forecast.movements).toHaveLength(1);
    expect(forecast.changes).toEqual([
      expect.objectContaining({
        id: 'forecast-variation-variation-1',
        title: 'D-1 - Fornecedor A',
        impactCents: -20000,
      }),
    ]);
    expect(forecast.snapshots).toEqual([
      expect.objectContaining({ id: 'snapshot-old' }),
      expect.objectContaining({ closingForecastCents: 50000 }),
    ]);
  });
});
