import { describe, expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { analyzeCashFlowReportWorkbook } from './cashFlowReportImportService';
import type { CashFlowReportDataset } from '../types/cashFlowReport';

function buildWorkbook(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Planilha1');
  return workbook;
}

const header = ['Nº Documento', 'Débito/Crédito', 'Razão Social', 'Baixado', 'Previsão', 'Data Vencimento', ' Valor Total '];

describe('cashFlowReportImportService', () => {
  it('imports the client cash flow layout and excludes settled credits as anticipated', () => {
    const workbook = buildWorkbook([
      header,
      ['D-1', 'Débito', 'Fornecedor A', 'FALSE', 'TRUE', '7/1/26', 'R$ 1,000.00'],
      ['C-1', 'Crédito', 'Cliente A', 'FALSE', 'FALSE', '7/1/26', 'R$ 700.00'],
      ['C-2', 'Crédito', 'Cliente B', 'TRUE', 'FALSE', '7/1/26', 'R$ 300.00'],
    ]);

    const result = analyzeCashFlowReportWorkbook(workbook, 'fluxo.xlsx');

    expect(result.summary.movementCount).toBe(3);
    expect(result.summary.anticipatedCount).toBe(1);
    expect(result.dataset.anticipatedMovements[0].documentNumber).toBe('C-2');
    expect(result.dataset.dailyRows[0]).toEqual(
      expect.objectContaining({
        debitCents: 100000,
        creditCents: 70000,
        anticipatedCents: 30000,
        closingBalanceCents: -30000,
      }),
    );
  });

  it('detects new and changed movements against the previous published report', () => {
    const previous = analyzeCashFlowReportWorkbook(
      buildWorkbook([
        header,
        ['D-1', 'Débito', 'Fornecedor A', 'FALSE', 'FALSE', '7/1/26', 'R$ 1,000.00'],
      ]),
      'fluxo-antigo.xlsx',
    ).dataset as CashFlowReportDataset;

    const current = analyzeCashFlowReportWorkbook(
      buildWorkbook([
        header,
        ['D-1', 'Débito', 'Fornecedor A', 'FALSE', 'FALSE', '7/1/26', 'R$ 1,500.00'],
        ['C-1', 'Crédito', 'Cliente A', 'FALSE', 'TRUE', '7/2/26', 'R$ 800.00'],
      ]),
      'fluxo-atual.xlsx',
      previous,
    );

    expect(current.summary.variationCount).toBe(2);
    expect(current.dataset.variations.map((variation) => variation.variationType)).toEqual(
      expect.arrayContaining(['VALOR_ALTERADO', 'NOVO']),
    );
    expect(current.dataset.variations.find((variation) => variation.documentNumber === 'D-1')?.impactCents).toBe(-50000);
  });

  it('keeps previous movements when the next imported date window moves forward', () => {
    const previous = analyzeCashFlowReportWorkbook(
      buildWorkbook([
        header,
        ['D-OLD', 'Débito', 'Fornecedor Antigo', 'FALSE', 'TRUE', '7/1/26', 'R$ 100.00'],
        ['D-1', 'Débito', 'Fornecedor A', 'FALSE', 'TRUE', '7/2/26', 'R$ 200.00'],
      ]),
      'fluxo-dia-1.xlsx',
    ).dataset as CashFlowReportDataset;

    const current = analyzeCashFlowReportWorkbook(
      buildWorkbook([
        header,
        ['D-1', 'Débito', 'Fornecedor A', 'FALSE', 'TRUE', '7/2/26', 'R$ 250.00'],
        ['C-1', 'Crédito', 'Cliente A', 'FALSE', 'TRUE', '7/3/26', 'R$ 300.00'],
      ]),
      'fluxo-dia-2.xlsx',
      previous,
    );

    expect(current.dataset.movements.map((movement) => movement.documentNumber)).toEqual(
      expect.arrayContaining(['D-OLD', 'D-1', 'C-1']),
    );
    expect(current.dataset.dailyRows.map((day) => day.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(current.dataset.variations.map((variation) => variation.variationType)).not.toContain('REMOVIDO');
  });
});
