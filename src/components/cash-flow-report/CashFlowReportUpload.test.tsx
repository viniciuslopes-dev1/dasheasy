import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashFlowReportUpload from './CashFlowReportUpload';
import { createForecastDatasetFromCashFlowReport } from '../../services/cashFlowForecastFromReportService';
import { analyzeCashFlowReportExcelFile } from '../../services/cashFlowReportImportService';
import { saveCashFlowReportDraft } from '../../services/cashFlowReportVersionService';
import { saveCashFlowDraft } from '../../services/cashFlowVersionService';
import type { CashFlowDataset } from '../../types/cashFlow';
import type { CashFlowReportDataset } from '../../types/cashFlowReport';

vi.mock('../../services/cashFlowReportImportService', () => ({
  analyzeCashFlowReportExcelFile: vi.fn(),
}));

vi.mock('../../services/cashFlowReportVersionService', () => ({
  saveCashFlowReportDraft: vi.fn(),
}));

vi.mock('../../services/cashFlowVersionService', () => ({
  saveCashFlowDraft: vi.fn(),
}));

vi.mock('../../services/cashFlowForecastFromReportService', () => ({
  createForecastDatasetFromCashFlowReport: vi.fn(),
}));

const reportDataset: CashFlowReportDataset = {
  sourceFileName: 'fluxo.xlsx',
  importedAt: '2026-07-02T10:00:00.000Z',
  sheetName: 'FLUXO DE CAIXA',
  monthLabel: 'Julho de 2026',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  initialBalanceCents: 100000,
  initialBalanceSource: 'spreadsheet',
  bankAccounts: [],
  movements: [],
  cashFlowMovements: [],
  anticipatedMovements: [],
  dailyRows: [
    {
      date: '2026-07-01',
      openingBalanceCents: 100000,
      debitCents: 0,
      creditCents: 0,
      anticipatedCents: 0,
      netCents: 0,
      closingBalanceCents: 100000,
      movementCount: 0,
    },
  ],
  variations: [],
  issues: [],
};

const forecastDataset: CashFlowDataset = {
  monthLabel: 'Julho de 2026',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  initialForecastClosingCents: 100000,
  sourceFileName: 'fluxo.xlsx',
  importedAt: '2026-07-02T10:00:00.000Z',
  bankAccounts: [],
  dailyEntries: [],
  movements: [],
  changes: [],
  snapshots: [],
  issues: [],
};

describe('CashFlowReportUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the cash flow report and the financial forecast from the same spreadsheet', async () => {
    const onImported = vi.fn();
    const onForecastImported = vi.fn();
    vi.mocked(analyzeCashFlowReportExcelFile).mockResolvedValue({
      dataset: reportDataset,
      summary: {
        fileName: 'fluxo.xlsx',
        sheetNames: ['FLUXO DE CAIXA'],
        sheetName: 'FLUXO DE CAIXA',
        movementCount: 0,
        cashFlowMovementCount: 0,
        debitMovementCount: 0,
        creditMovementCount: 0,
        anticipatedCount: 0,
        bankAccountCount: 0,
        dailyRowCount: 1,
        variationCount: 0,
        duplicateDocumentCount: 0,
        issues: [],
      },
    });
    vi.mocked(createForecastDatasetFromCashFlowReport).mockReturnValue(forecastDataset);
    vi.mocked(saveCashFlowReportDraft).mockResolvedValue({
      id: 'report-version-1',
      versionNumber: 1,
      status: 'draft',
      sourceFileName: 'fluxo.xlsx',
      monthLabel: 'Julho de 2026',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      movementCount: 0,
      dailyRowCount: 1,
      anticipatedCount: 0,
      variationCount: 0,
      initialBalanceCents: 100000,
      closingBalanceCents: 100000,
      dataset: reportDataset,
      metadata: {},
      createdBy: 'user-1',
      publishedBy: null,
      createdAt: '2026-07-02T10:00:00Z',
      publishedAt: null,
    });
    vi.mocked(saveCashFlowDraft).mockResolvedValue({
      id: 'forecast-version-1',
      versionNumber: 1,
      status: 'draft',
      sourceFileName: 'fluxo.xlsx',
      monthLabel: 'Julho de 2026',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      movementCount: 0,
      accountCount: 0,
      initialBalanceCents: 100000,
      currentForecastCents: 100000,
      dataset: forecastDataset,
      metadata: {},
      createdBy: 'user-1',
      publishedBy: null,
      createdAt: '2026-07-02T10:00:00Z',
      publishedAt: null,
    });

    render(
      <CashFlowReportUpload
        userId="user-1"
        baselineForecastDataset={forecastDataset}
        onImported={onImported}
        onForecastImported={onForecastImported}
      />,
    );

    const file = new File(['cash-flow'], 'fluxo.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText('Selecionar planilha de fluxo de caixa'), {
      target: { files: [file] },
    });

    await screen.findByText('0 débitos');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => {
      expect(saveCashFlowReportDraft).toHaveBeenCalledWith(reportDataset, 'user-1');
      expect(createForecastDatasetFromCashFlowReport).toHaveBeenCalledWith(reportDataset, forecastDataset);
      expect(saveCashFlowDraft).toHaveBeenCalledWith(forecastDataset, 'user-1');
      expect(onImported).toHaveBeenCalledWith(
        reportDataset,
        expect.objectContaining({ id: 'report-version-1' }),
      );
      expect(onForecastImported).toHaveBeenCalledWith(
        forecastDataset,
        expect.objectContaining({ id: 'forecast-version-1' }),
      );
    });
  });
});
