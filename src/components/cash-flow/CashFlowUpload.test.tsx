import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashFlowUpload from './CashFlowUpload';
import { analyzeCashFlowExcelFile } from '../../services/cashFlowImportService';
import { saveCashFlowDraft } from '../../services/cashFlowVersionService';
import { sampleCashFlowDataset } from '../../services/cashFlowService';

vi.mock('../../services/cashFlowImportService', () => ({
  analyzeCashFlowExcelFile: vi.fn(),
}));

vi.mock('../../services/cashFlowVersionService', () => ({
  saveCashFlowDraft: vi.fn(),
}));

describe('CashFlowUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('analyzes the Excel and saves a draft without publishing it', async () => {
    const onImported = vi.fn();
    vi.mocked(analyzeCashFlowExcelFile).mockResolvedValue({
      dataset: sampleCashFlowDataset,
      summary: {
        fileName: 'fluxo.xlsx',
        sheetNames: ['FLUXO DE CAIXA', 'DEBITO', 'CREDITO'],
        bankAccountCount: 5,
        dailyEntryCount: 20,
        debitMovementCount: 15,
        creditMovementCount: 10,
        ignoredSheetNames: [],
        issues: [],
      },
    });
    vi.mocked(saveCashFlowDraft).mockResolvedValue({
      id: 'version-1',
      versionNumber: 1,
      status: 'draft',
      sourceFileName: 'fluxo.xlsx',
      monthLabel: sampleCashFlowDataset.monthLabel,
      startDate: sampleCashFlowDataset.startDate,
      endDate: sampleCashFlowDataset.endDate,
      movementCount: sampleCashFlowDataset.movements.length,
      accountCount: sampleCashFlowDataset.bankAccounts.length,
      initialBalanceCents: 95024937,
      currentForecastCents: 62805298,
      dataset: sampleCashFlowDataset,
      metadata: {},
      createdBy: 'user-1',
      publishedBy: null,
      createdAt: '2026-06-18T10:00:00Z',
      publishedAt: null,
    });

    render(<CashFlowUpload userId="user-1" onImported={onImported} />);

    const file = new File(['cash-flow'], 'fluxo.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText('Selecionar planilha de fluxo de caixa'), {
      target: { files: [file] },
    });

    await screen.findByText('15 debitos');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => {
      expect(saveCashFlowDraft).toHaveBeenCalledWith(sampleCashFlowDataset, 'user-1');
      expect(onImported).toHaveBeenCalledWith(
        sampleCashFlowDataset,
        expect.objectContaining({ id: 'version-1', status: 'draft' }),
      );
    });
    expect(screen.getByText(/Rascunho salvo/)).toBeInTheDocument();
  });
});
