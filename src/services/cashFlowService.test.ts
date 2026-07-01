import { describe, expect, it } from 'vitest';
import {
  calculateCashFlowMetrics,
  calculateDailyCashFlow,
  expectedSampleTotals,
  sampleCashFlowDataset,
} from './cashFlowService';

describe('cashFlowService', () => {
  it('calculates projected cash flow totals from movements', () => {
    const metrics = calculateCashFlowMetrics(sampleCashFlowDataset);

    expect(metrics.totalDebitsCents).toBe(expectedSampleTotals.totalDebitsCents);
    expect(metrics.totalCreditsCents).toBe(expectedSampleTotals.totalCreditsCents);
    expect(metrics.currentForecastClosingCents).toBe(expectedSampleTotals.currentForecastClosingCents);
  });

  it('keeps days without movements in the daily projection', () => {
    const dailyCashFlow = calculateDailyCashFlow(sampleCashFlowDataset);
    const dayWithoutMovement = dailyCashFlow.find((day) => day.date === '2026-06-21');

    expect(dayWithoutMovement).toMatchObject({
      debitCents: 0,
      creditCents: 0,
      netCents: 0,
      projectedBalanceCents: 28000000,
    });
  });

  it('identifies the lowest projected balance date', () => {
    const metrics = calculateCashFlowMetrics(sampleCashFlowDataset);

    expect(metrics.minProjectedBalanceDate).toBe('2026-06-11');
    expect(metrics.minProjectedBalanceCents).toBe(expectedSampleTotals.minProjectedBalanceCents);
  });

  it('calculates accumulated variation from imported changes', () => {
    const metrics = calculateCashFlowMetrics({
      ...sampleCashFlowDataset,
      initialForecastClosingCents: 0,
      dailyEntries: [
        {
          date: '2026-06-01',
          debitCents: 0,
          creditCents: 0,
          projectedBalanceCents: 500000,
        },
      ],
      changes: [
        {
          id: 'change-positive',
          registeredAt: '2026-06-02',
          affectedDate: '2026-06-03',
          title: 'Credito novo',
          changeType: 'CRIADO',
          movementType: 'CREDITO',
          impactCents: 200000,
          reason: 'Importado pelo fluxo de caixa.',
        },
        {
          id: 'change-negative',
          registeredAt: '2026-06-02',
          affectedDate: '2026-06-03',
          title: 'Debito alterado',
          changeType: 'VALOR_ALTERADO',
          movementType: 'DEBITO',
          impactCents: -50000,
          reason: 'Importado pelo fluxo de caixa.',
        },
      ],
    });

    expect(metrics.accumulatedVariationCents).toBe(150000);
  });
});
