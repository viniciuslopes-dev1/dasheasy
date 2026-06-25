import { ChangeEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { analyzeCashFlowReportExcelFile } from '../../services/cashFlowReportImportService';
import { calculateCashFlowReportMetrics } from '../../services/cashFlowReportService';
import { saveCashFlowReportDraft } from '../../services/cashFlowReportVersionService';
import { isLocalTestMode } from '../../services/localTestMode';
import type {
  CashFlowReportDataset,
  CashFlowReportImportSummary,
  CashFlowReportVersion,
} from '../../types/cashFlowReport';
import { formatCurrency } from '../../utils/formatCurrency';

interface CashFlowReportUploadProps {
  userId?: string;
  baselineDataset?: CashFlowReportDataset | null;
  onImported: (dataset: CashFlowReportDataset, version?: CashFlowReportVersion | null) => void;
}

export default function CashFlowReportUpload({ userId, baselineDataset, onImported }: CashFlowReportUploadProps) {
  const [dataset, setDataset] = useState<CashFlowReportDataset | null>(null);
  const [summary, setSummary] = useState<CashFlowReportImportSummary | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setDataset(null);
    setSummary(null);
    setError('');
    setSuccess('');

    if (!file) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeCashFlowReportExcelFile(file, baselineDataset);
      setDataset(result.dataset);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel analisar a planilha de fluxo de caixa.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSaveDraft() {
    if (!dataset) {
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!isLocalTestMode && supabase && !userId) {
        throw new Error('Faca login como administrador para salvar a versao.');
      }

      const version = await saveCashFlowReportDraft(dataset, userId);
      onImported(dataset, version);
      setSuccess(
        isLocalTestMode
          ? 'Rascunho salvo somente neste navegador. Publique para atualizar a visualizacao local.'
          : supabase
          ? 'Rascunho salvo. Publique o fluxo para atualizar o link principal.'
          : 'Supabase nao configurado: dados carregados apenas para analise.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar o rascunho do fluxo de caixa.');
    } finally {
      setIsSaving(false);
    }
  }

  const metrics = dataset ? calculateCashFlowReportMetrics(dataset) : null;

  return (
    <section className="panel upload-panel" aria-label="Importacao do fluxo de caixa">
      <div className="panel-heading">
        <div>
          <h2>Importar fluxo de caixa</h2>
          <p>A planilha cria uma nova versao em rascunho. Antecipados ficam fora do calculo diario.</p>
        </div>
        <FileSpreadsheet size={22} />
      </div>

      <label className="upload-dropzone">
        <UploadCloud size={24} />
        <span>{summary?.fileName ?? 'Selecione a planilha de fluxo de caixa'}</span>
        <input
          aria-label="Selecionar planilha de fluxo de caixa"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={isAnalyzing || isSaving}
        />
      </label>

      {isAnalyzing ? <div className="status muted">Analisando débitos, créditos, antecipados e variações...</div> : null}
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

      {dataset && summary && metrics ? (
        <div className="analysis-preview">
          <div className="metric-grid">
            <div>
              <span>Lançamentos</span>
              <strong>{summary.movementCount}</strong>
            </div>
            <div>
              <span>Dias</span>
              <strong>{summary.dailyRowCount}</strong>
            </div>
            <div>
              <span>Antecipados</span>
              <strong>{summary.anticipatedCount}</strong>
            </div>
            <div>
              <span>Saldo final</span>
              <strong>{formatCurrency(metrics.closingBalanceCents)}</strong>
            </div>
          </div>

          <div className="cash-flow-upload-summary">
            <span>{summary.debitMovementCount} débitos</span>
            <span>{summary.creditMovementCount} créditos</span>
            <span>{summary.variationCount} variações</span>
            <span>{summary.duplicateDocumentCount} documentos repetidos</span>
          </div>

          <button className="primary-action" type="button" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? 'Salvando rascunho...' : 'Salvar rascunho'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
