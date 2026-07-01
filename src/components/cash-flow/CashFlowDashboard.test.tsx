import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CashFlowDashboard from './CashFlowDashboard';
import { sampleCashFlowDataset } from '../../services/cashFlowService';
import type { CashFlowDataset } from '../../types/cashFlow';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

const multiMonthForecastDataset: CashFlowDataset = {
  monthLabel: 'Junho a Agosto de 2026',
  startDate: '2026-06-01',
  endDate: '2026-08-31',
  initialForecastClosingCents: 100000,
  bankAccounts: [],
  dailyEntries: [
    { date: '2026-06-30', debitCents: 10000, creditCents: 0, projectedBalanceCents: 90000 },
    { date: '2026-07-01', debitCents: 0, creditCents: 20000, projectedBalanceCents: 110000 },
    { date: '2026-07-31', debitCents: 5000, creditCents: 0, projectedBalanceCents: 105000 },
    { date: '2026-08-01', debitCents: 0, creditCents: 30000, projectedBalanceCents: 135000 },
  ],
  movements: [],
  changes: [],
  snapshots: [],
  issues: [],
};

const futureForecastDataset: CashFlowDataset = {
  ...multiMonthForecastDataset,
  monthLabel: 'Julho a Setembro de 2026',
  startDate: '2026-07-11',
  endDate: '2026-09-30',
  dailyEntries: [
    { date: '2026-07-11', debitCents: 10000, creditCents: 0, projectedBalanceCents: 90000 },
    { date: '2026-07-31', debitCents: 0, creditCents: 20000, projectedBalanceCents: 110000 },
    { date: '2026-09-30', debitCents: 5000, creditCents: 0, projectedBalanceCents: 105000 },
  ],
};

describe('CashFlowDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an empty public view without upload controls', () => {
    render(<CashFlowDashboard dataset={null} />);

    expect(screen.getByText('Nenhuma previsão financeira publicada ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Importar planilha')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 628.052,98')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegação da previsão financeira' })).not.toBeInTheDocument();
  });

  it('renders the supplied published dataset', () => {
    render(<CashFlowDashboard dataset={sampleCashFlowDataset} />);

    fireEvent.click(screen.getByRole('button', { name: /01\/06 a 22\/06/ }));

    expect(screen.getByText('Período do gráfico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15 dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60 dias' })).toBeInTheDocument();
    expect(screen.getAllByText('R$ 628.052,98').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Navegação da previsão financeira' })).toBeInTheDocument();
    expect(screen.queryByText('Importar planilha')).not.toBeInTheDocument();
  });

  it('defaults a multi-month forecast to the current month', () => {
    render(<CashFlowDashboard dataset={multiMonthForecastDataset} />);

    expect(screen.getByRole('button', { name: /01\/07 a 31\/07/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /01\/06 a 31\/08/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('R$ 1.050,00').length).toBeGreaterThan(0);
  });

  it('keeps the period switcher in the top forecast header', () => {
    const { container } = render(<CashFlowDashboard dataset={multiMonthForecastDataset} />);

    const hero = container.querySelector('.cash-flow-hero');

    expect(hero).not.toBeNull();
    expect(within(hero as HTMLElement).getByRole('button', { name: /01\/07 a 31\/07/ })).toBeInTheDocument();
  });

  it('highlights the current forecast as the final balance card', () => {
    const { container } = render(<CashFlowDashboard dataset={multiMonthForecastDataset} />);

    const finalBalanceCard = container.querySelector('.cash-flow-hero-kpi');

    expect(finalBalanceCard).toHaveClass('final-balance-card');
    expect(finalBalanceCard).toHaveClass('final-balance-card-positive');
    expect(within(finalBalanceCard as HTMLElement).getByText('Previsão atual')).toBeInTheDocument();
  });

  it('marks the current forecast final balance card as negative when the closing value is below zero', () => {
    const negativeForecastDataset: CashFlowDataset = {
      ...multiMonthForecastDataset,
      dailyEntries: [
        { date: '2026-07-01', debitCents: 0, creditCents: 0, projectedBalanceCents: 10000 },
        { date: '2026-07-31', debitCents: 50000, creditCents: 0, projectedBalanceCents: -40000 },
      ],
    };

    const { container } = render(<CashFlowDashboard dataset={negativeForecastDataset} />);

    const finalBalanceCard = container.querySelector('.cash-flow-hero-kpi');

    expect(finalBalanceCard).toHaveClass('final-balance-card');
    expect(finalBalanceCard).toHaveClass('final-balance-card-negative');
    expect(finalBalanceCard).toHaveTextContent('-R$ 400,00');
  });

  it('uses the real current calendar month when today is the last day of a 30-day month', () => {
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));

    render(<CashFlowDashboard dataset={multiMonthForecastDataset} />);

    expect(screen.getByRole('button', { name: /01\/06 a 30\/06/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /01\/06 a 31\/08/ })).not.toBeInTheDocument();
  });

  it('falls forward to the first available month when the current month is not in the forecast', () => {
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));

    render(<CashFlowDashboard dataset={futureForecastDataset} />);

    expect(screen.getByRole('button', { name: /11\/07 a 31\/07/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /11\/07 a 30\/09/ })).not.toBeInTheDocument();
  });

  it('marks forecast debit and credit metrics with semantic financial classes', () => {
    render(<CashFlowDashboard dataset={multiMonthForecastDataset} />);

    expect(screen.getByText('Total a pagar').closest('article')).toHaveClass('debit');
    expect(screen.getByText('Total a receber').closest('article')).toHaveClass('credit');
  });
});
