import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CashFlowReportDashboard from './CashFlowReportDashboard';
import type { CashFlowReportDataset, CashFlowReportDay } from '../../types/cashFlowReport';

function makeReportDays(startDate: string, endDate: string): CashFlowReportDay[] {
  const rows: CashFlowReportDay[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    rows.push({
      date,
      openingBalanceCents: 0,
      debitCents: date === '2026-07-10' ? 10000 : 0,
      creditCents: date === '2026-07-15' ? 25000 : 0,
      anticipatedCents: 0,
      netCents: date === '2026-07-10' ? -10000 : date === '2026-07-15' ? 25000 : 0,
      closingBalanceCents: date >= '2026-07-15' ? 15000 : date >= '2026-07-10' ? -10000 : 0,
      movementCount: date === '2026-07-10' || date === '2026-07-15' ? 1 : 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rows;
}

const datasetWithoutBanks: CashFlowReportDataset = {
  sourceFileName: 'fluxo.xlsx',
  importedAt: '2026-07-01T00:00:00.000Z',
  sheetName: 'Planilha1',
  monthLabel: 'Julho de 2026',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  initialBalanceCents: 0,
  initialBalanceSource: 'not_informed',
  bankAccounts: [],
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
      valueCents: 10000,
      isAnticipated: false,
      excludedFromCashFlow: false,
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
      valueCents: 10000,
      isAnticipated: false,
      excludedFromCashFlow: false,
      rawData: {},
    },
  ],
  anticipatedMovements: [],
  dailyRows: [
    {
      date: '2026-07-01',
      openingBalanceCents: 0,
      debitCents: 10000,
      creditCents: 0,
      anticipatedCents: 0,
      netCents: -10000,
      closingBalanceCents: -10000,
      movementCount: 1,
    },
    {
      date: '2026-07-02',
      openingBalanceCents: -10000,
      debitCents: 0,
      creditCents: 0,
      anticipatedCents: 0,
      netCents: 0,
      closingBalanceCents: -10000,
      movementCount: 0,
    },
  ],
  variations: [],
  issues: [],
};

const multiMonthReportDataset: CashFlowReportDataset = {
  ...datasetWithoutBanks,
  monthLabel: 'Junho a Agosto de 2026',
  startDate: '2026-06-01',
  endDate: '2026-08-31',
  dailyRows: makeReportDays('2026-06-01', '2026-08-31'),
};

const futureReportDataset: CashFlowReportDataset = {
  ...datasetWithoutBanks,
  monthLabel: 'Julho a Setembro de 2026',
  startDate: '2026-07-11',
  endDate: '2026-09-30',
  dailyRows: makeReportDays('2026-07-11', '2026-09-30'),
};

describe('CashFlowReportDashboard', () => {
  it('keeps manual bank editing inside the banks tab in admin mode', async () => {
    const onSaveDataset = vi.fn().mockResolvedValue(undefined);
    render(
      <CashFlowReportDashboard
        dataset={datasetWithoutBanks}
        isEditable
        versionId="version-1"
        onSaveDataset={onSaveDataset}
      />,
    );

    expect(screen.getByRole('button', { name: 'Bancos' })).toBeInTheDocument();
    expect(screen.getByText('Bancos e saldos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bancos' }));

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('ITAU - (53395) - POA'), {
      target: { value: 'ITAU - (53395) - POA' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('0,00')[2], { target: { value: '950.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByDisplayValue('ITAU - (53395) - POA')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Saldo considerado:') && content.includes('950,25'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar bancos' }));

    await waitFor(() => expect(onSaveDataset).toHaveBeenCalledTimes(1));
    expect(onSaveDataset.mock.calls[0][0].bankAccounts).toHaveLength(1);
    expect(onSaveDataset.mock.calls[0][0].initialBalanceCents).toBe(95025);
  });

  it('shows manually added banks in the compact bank sheet above the daily flow', () => {
    render(<CashFlowReportDashboard dataset={datasetWithoutBanks} isEditable versionId="version-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Bancos' }));
    fireEvent.change(screen.getByPlaceholderText('ITAU - (53395) - POA'), {
      target: { value: 'ITAU - (53395) - POA' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('0,00')[2], { target: { value: '950.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(screen.getByRole('button', { name: /Fluxo/ }));

    expect(screen.getByRole('heading', { name: 'Bancos e saldos' })).toBeInTheDocument();
    const compactBankTable = screen.getByRole('table', { name: 'Bancos do fluxo de caixa' });
    expect(compactBankTable).toBeInTheDocument();
    expect(within(compactBankTable).getByText('ITAU')).toBeInTheDocument();
    expect(within(compactBankTable).getByText('ITAU - (53395) - POA')).toBeInTheDocument();
    expect(within(compactBankTable).getAllByText('R$ 950,25')).toHaveLength(2);
  });

  it('defaults a multi-month cash flow report to the current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    try {
      render(<CashFlowReportDashboard dataset={multiMonthReportDataset} />);

      expect(screen.getByRole('button', { name: /01\/07 a 31\/07/ })).toBeInTheDocument();
      expect(screen.getByText('31 dias')).toBeInTheDocument();
      expect(screen.getByText('01/07')).toBeInTheDocument();
      expect(screen.getByText('31/07')).toBeInTheDocument();
      expect(screen.queryByText('30/06')).not.toBeInTheDocument();
      expect(screen.queryByText('01/08')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the period switcher in the top cash flow header', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    try {
      const { container } = render(<CashFlowReportDashboard dataset={multiMonthReportDataset} />);

      const header = container.querySelector('.cash-report-header');

      expect(header).not.toBeNull();
      expect(within(header as HTMLElement).getByRole('button', { name: /01\/07 a 31\/07/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('highlights the projected final balance card in the cash flow header', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    try {
      const { container } = render(<CashFlowReportDashboard dataset={multiMonthReportDataset} />);

      const finalBalanceCard = container.querySelector('.cash-report-header-kpis');

      expect(finalBalanceCard).toHaveClass('final-balance-card');
      expect(finalBalanceCard).toHaveClass('final-balance-card-positive');
      expect(within(finalBalanceCard as HTMLElement).getByText('Saldo final projetado')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the projected final balance card as negative when the closing balance is below zero', () => {
    const { container } = render(<CashFlowReportDashboard dataset={datasetWithoutBanks} />);

    const finalBalanceCard = container.querySelector('.cash-report-header-kpis');

    expect(finalBalanceCard).toHaveClass('final-balance-card');
    expect(finalBalanceCard).toHaveClass('final-balance-card-negative');
    expect(finalBalanceCard).toHaveTextContent('-R$ 100,00');
  });

  it('uses the real current calendar month for the report when today is the last day of a 30-day month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));

    try {
      render(<CashFlowReportDashboard dataset={multiMonthReportDataset} />);

      expect(screen.getByRole('button', { name: /01\/06 a 30\/06/ })).toBeInTheDocument();
      expect(screen.getByText('30 dias')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /01\/06 a 31\/08/ })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls forward to the first available month when the current month is not in the report', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00.000Z'));

    try {
      render(<CashFlowReportDashboard dataset={futureReportDataset} />);

      expect(screen.getByRole('button', { name: /11\/07 a 31\/07/ })).toBeInTheDocument();
      expect(screen.getByText('21 dias')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /11\/07 a 30\/09/ })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks debit, credit, and balance columns with semantic financial classes', () => {
    const { container } = render(<CashFlowReportDashboard dataset={datasetWithoutBanks} />);
    const dailyTable = container.querySelector('.cash-flow-statement-table') as HTMLTableElement | null;

    expect(dailyTable).not.toBeNull();
    expect(within(dailyTable as HTMLTableElement).getByRole('columnheader', { name: 'Débito' })).toHaveClass('debit-heading');
    expect(within(dailyTable as HTMLTableElement).getByRole('columnheader', { name: 'Crédito' })).toHaveClass('credit-heading');
    expect(within(dailyTable as HTMLTableElement).getByRole('columnheader', { name: 'Saldo' })).toHaveClass('balance-heading');

    const firstDayCells = Array.from((dailyTable as HTMLTableElement).querySelectorAll('tbody tr')[1].querySelectorAll('td'));
    expect(firstDayCells[1]).toHaveClass('debit-value');
    expect(firstDayCells[2]).toHaveClass('credit-value');
    expect(firstDayCells[3]).toHaveClass('balance-negative-value');
  });
});
