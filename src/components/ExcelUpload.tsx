import { ChangeEvent, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { saveDashboardDraft } from '../services/dashboardVersionService';
import { analyzeExcelFile } from '../services/excelImportService';
import { supabase } from '../lib/supabase';
import type { DashboardVersion, ExcelAnalysis } from '../types/financial';
import { formatCurrency } from '../utils/formatCurrency';

interface ExcelUploadProps {
  onImported: (analysis: ExcelAnalysis, version?: DashboardVersion | null) => void;
  userId?: string;
}

export default function ExcelUpload({ onImported, userId }: ExcelUploadProps) {
  const [fileName, setFileName] = useState<string>('');
  const [analyses, setAnalyses] = useState<ExcelAnalysis[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const selectedAnalysis = useMemo(
    () => analyses.find((analysis) => analysis.sheetName === selectedSheet) ?? analyses[0] ?? null,
    [analyses, selectedSheet],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSuccess('');
    setError('');
    setAnalyses([]);
    setSelectedSheet('');

    if (!file) {
      return;
    }

    setFileName(file.name);
    setIsAnalyzing(true);
    try {
      const result = await analyzeExcelFile(file);
      setAnalyses(result);
      setSelectedSheet(result[0]?.sheetName ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível analisar a planilha.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConfirmImport() {
    if (!selectedAnalysis) {
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      if (supabase && !userId) {
        throw new Error('Faça login como administrador para salvar a versão no Supabase.');
      }

      const version = await saveDashboardDraft(selectedAnalysis, fileName, userId);
      onImported(selectedAnalysis, version);
      setSuccess(
        supabase
          ? 'Rascunho salvo. Revise os dados e clique em Publicar dashboard para atualizar o link principal.'
          : 'Supabase não configurado: dados carregados localmente para análise.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar a importação.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel upload-panel" aria-label="Importação de planilha Excel">
      <div className="panel-heading">
        <div>
          <h2>Importar Excel</h2>
          <p>A análise cria uma nova versão em rascunho antes de publicar no link principal.</p>
        </div>
        <FileSpreadsheet size={22} />
      </div>

      <label className="upload-dropzone">
        <UploadCloud size={24} />
        <span>{fileName || 'Selecione uma planilha .xlsx ou .xls'}</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
      </label>

      {isAnalyzing ? <div className="status muted">Analisando estrutura, blocos e totais...</div> : null}
      {error ? (
        <div className="status error">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="status success">
          <CheckCircle2 size={16} />
          {success}
        </div>
      ) : null}

      {analyses.length > 0 ? (
        <div className="analysis-preview">
          <div className="sheet-tabs" role="tablist" aria-label="Abas detectadas">
            {analyses.map((analysis) => (
              <button
                type="button"
                key={analysis.sheetName}
                className={analysis.sheetName === selectedAnalysis?.sheetName ? 'active' : ''}
                onClick={() => setSelectedSheet(analysis.sheetName)}
              >
                {analysis.sheetName}
              </button>
            ))}
          </div>

          {selectedAnalysis ? (
            <>
              <div className="metric-grid">
                <div>
                  <span>Blocos</span>
                  <strong>{selectedAnalysis.blockCount}</strong>
                </div>
                <div>
                  <span>Lançamentos</span>
                  <strong>{selectedAnalysis.recordCount}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{formatCurrency(selectedAnalysis.totalAmountCents)}</strong>
                </div>
                <div>
                  <span>Alertas</span>
                  <strong>{selectedAnalysis.issues.length}</strong>
                </div>
              </div>

              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Agrupamento</th>
                      <th>Departamento</th>
                      <th>Pessoa/Razão social</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAnalysis.previewRows.map((record) => (
                      <tr key={`${record.sourceRow}-${record.dedupeKey}`}>
                        <td>{record.groupName}</td>
                        <td>{record.departmentName}</td>
                        <td>{record.personName}</td>
                        <td>{formatCurrency(record.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="primary-action" type="button" onClick={handleConfirmImport} disabled={isSaving}>
                {isSaving ? 'Salvando rascunho...' : 'Salvar rascunho'}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
