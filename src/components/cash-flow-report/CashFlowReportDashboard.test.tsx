import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CashFlowReportDashboard from './CashFlowReportDashboard';
import type { CashFlowReportDataset } from '../../types/cashFlowReport';

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
});
