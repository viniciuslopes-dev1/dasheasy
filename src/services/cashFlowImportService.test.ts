import { describe, expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import { analyzeCashFlowWorkbook } from './cashFlowImportService';

function buildForecastWorkbook({
  dayRows,
  debitRows,
  creditRows,
}: {
  dayRows: unknown[][];
  debitRows: unknown[][];
  creditRows: unknown[][];
}) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['RELATÓRIO DE FLUXO DE CAIXA'],
      ['Codigo', 'Banco', 'Débito', null, 'Crédito', 'Saldo'],
      ['01', 'ITAU - CONTA', null, null, 1000, 1000],
      ['SALDO INICIAL', null, null, null, null, 1000],
      ['DATA', null, 'Débito', null, 'Crédito', 'Saldo'],
      ...dayRows,
    ]),
    'FLUXO DE CAIXA',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Nº Documento', 'Data Vencimento', 'Razão Social', 'Valor Total'], ...debitRows]),
    'DÉBITO',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Nº Documento', 'Data Vencimento', 'Razão Social', 'Valor Total'], ...creditRows]),
    'CRÉDITO',
  );
  return workbook;
}

describe('cashFlowImportService', () => {
  it('imports cash flow workbook sheets without using Supabase', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['RELATÓRIO DE FLUXO DE CAIXA'],
        ['Codigo', 'Banco', 'Débito', null, 'Crédito', 'Saldo'],
        ['01', 'ITAU - CONTA', null, null, 1000, 1000],
        ['02', 'ITAU - GARANTIDA', -500, null, null, 1000],
        ['SALDO INICIAL', null, null, null, null, 1000],
        ['DATA', null, 'Débito', null, 'Crédito', 'Saldo'],
        ['2026-06-02', null, 200, null, 0, 800],
        ['2026-06-03', null, 50, null, 100, 850],
      ]),
      'FLUXO DE CAIXA',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Nº Documento', 'Data Vencimento', 'Razão Social', 'Valor Total'],
        ['D-1', '2026-06-02', 'Fornecedor A', 200],
        [null, null, null, 200],
      ]),
      'DÉBITO',
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Nº Documento', 'Data Vencimento', 'Razão Social', 'Valor Total'],
        ['C-1', '2026-06-03', 'Cliente A', 100],
        [null, null, null, 100],
      ]),
      'CRÉDITO',
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['apoio']]), 'Planilha6');

    const result = analyzeCashFlowWorkbook(workbook, 'fluxo.xlsx');

    expect(result.dataset.bankAccounts).toHaveLength(2);
    expect(result.dataset.bankAccounts[1].includeInCash).toBe(false);
    expect(result.dataset.dailyEntries).toHaveLength(2);
    expect(result.dataset.movements).toHaveLength(2);
    expect(result.summary.debitMovementCount).toBe(1);
    expect(result.summary.creditMovementCount).toBe(1);
    expect(result.summary.ignoredSheetNames).toEqual(['Planilha6']);
    expect(result.summary.issues.some((issue) => issue.type === 'ignored_sheet')).toBe(true);
  });

  it('merges a new forecast import into the previous accumulated dataset', () => {
    const previous = analyzeCashFlowWorkbook(
      buildForecastWorkbook({
        dayRows: [
          ['2026-06-01', null, 100, null, 0, 900],
          ['2026-06-02', null, 200, null, 50, 750],
        ],
        debitRows: [['D-1', '2026-06-01', 'Fornecedor A', 100]],
        creditRows: [['C-1', '2026-06-02', 'Cliente A', 50]],
      }),
      'previsao-dia-1.xlsx',
    ).dataset;

    const current = analyzeCashFlowWorkbook(
      buildForecastWorkbook({
        dayRows: [
          ['2026-06-02', null, 250, null, 50, 700],
          ['2026-06-03', null, 0, null, 300, 1000],
        ],
        debitRows: [['D-1', '2026-06-01', 'Fornecedor A', 150]],
        creditRows: [
          ['C-1', '2026-06-02', 'Cliente A', 50],
          ['C-2', '2026-06-03', 'Cliente B', 300],
        ],
      }),
      'previsao-dia-2.xlsx',
      previous,
    ).dataset;

    expect(current.movements.map((movement) => movement.documentNumber)).toEqual(
      expect.arrayContaining(['D-1', 'C-1', 'C-2']),
    );
    expect(current.dailyEntries?.map((entry) => entry.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(current.changes.map((change) => change.changeType)).toEqual(expect.arrayContaining(['VALOR_ALTERADO', 'CRIADO']));
    expect(current.initialForecastClosingCents).toBe(previous.initialForecastClosingCents);
  });
});
