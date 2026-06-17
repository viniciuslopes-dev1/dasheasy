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
});
