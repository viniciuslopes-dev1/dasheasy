import { describe, expect, it } from 'vitest';
import { analyzeWorkbookRows } from './excelImportService';

describe('excelImportService', () => {
  it('detects repeated financial blocks and reconciles detail totals', () => {
    const rows = [
      ['NATUREZA', 'DEPARTAMENTO', 'CLASSIFICAÇÃO', 'TIPO', 'VALOR'],
      ['Salários', 'Administrativo', 'Administrativo', 'Despesa', 41254.54],
      ['GRUPO SALARIOS', null, null, null, null],
      ['Nº Documento', 'Razão Social', 'Data Vencimento', 'Valor Total', 'Nome Grupo'],
      ['26/05-SALARIO', 'DELMA REGINA FERNANDES', '2026-05-04T00:00:00', 2375, 'SALÁRIOS'],
      ['26/05-SALARIO F', 'ELISABET SOCOLOWSKI', '2026-05-15T00:00:00', 8828.65, 'SERVIÇO ADMINISTRATIVO'],
      ['TOTAL', null, null, 11203.65, null],
      ['Transporte de funcionarios', 'PCP', 'Administrativo', 'Despesa', '475,44'],
      ['GRUPO TRANSPORTE DE FUNCIONÁRIOS', null, null, null, null],
      ['Nº Documento', 'Razão Social', 'Data Vencimento', 'Valor Total', 'Nome Grupo'],
      ['26/05-V.T', 'SANDRA REGINA PINTO', '2026-05-25T00:00:00', '475,44', 'TRANSPORTE DE FUNCIONÁRIOS'],
      ['TOTAL', null, null, '475,44', null],
    ];

    const analysis = analyzeWorkbookRows(rows, 'Planilha1');

    expect(analysis.blockCount).toBe(2);
    expect(analysis.recordCount).toBe(3);
    expect(analysis.totalAmountCents).toBe(1167909);
    expect(analysis.issues.some((issue) => issue.type === 'block_total_mismatch')).toBe(true);
    expect(analysis.issues.some((issue) => issue.type === 'group_detail_mismatch')).toBe(true);
    expect(analysis.records[0]).toMatchObject({
      groupName: 'Salários',
      departmentName: 'Administrativo',
      personName: 'DELMA REGINA FERNANDES',
      amountCents: 237500,
      dueDate: '2026-05-04',
      detailGroupName: 'SALÁRIOS',
    });
  });

  it('reports missing internal headers as an incompatible sheet', () => {
    const analysis = analyzeWorkbookRows(
      [
        ['NATUREZA', 'DEPARTAMENTO', 'VALOR'],
        ['Salários', 'Administrativo', 100],
      ],
      'Planilha Vazia',
    );

    expect(analysis.blockCount).toBe(0);
    expect(analysis.recordCount).toBe(0);
    expect(analysis.issues[0]).toMatchObject({ type: 'missing_internal_headers' });
  });
});

