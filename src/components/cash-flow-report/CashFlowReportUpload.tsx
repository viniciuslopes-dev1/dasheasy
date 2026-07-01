import { ChangeEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createForecastDatasetFromCashFlowReport } from '../../services/cashFlowForecastFromReportService';
import { analyzeCashFlowReportExcelFile } from '../../services/cashFlowReportImportService';
import { calculateCashFlowReportMetrics } from '../../services/cashFlowReportService';
import { saveCashFlowReportDraft } from '../../services/cashFlowReportVersionService';
import { saveCashFlowDraft } from '../../services/cashFlowVersionService';
import { isLocalTestMode } from '../../services/localTestMode';
import type { CashFlowDataset, CashFlowVersion } from '../../types/cashFlow';
import type {
  CashFlowReportDataset,
  CashFlowReportImportSummary,
  CashFlowReportVersion,
} from '../../types/cashFlowReport';
import { formatCurrency } from '../../utils/formatCurrency';

interface CashFlowReportUploadProps {
  userId?: string;
  baselineDataset?: CashFlowReportDataset | null;
  baselineForecastDataset?: CashFlowDataset | null;
  onImported: (dataset: CashFlowReportDataset, version?: CashFlowReportVersion | null) => void;
  onForecastImported?: (dataset: CashFlowDataset, version?: CashFlowVersion | null) => void;
}

export default function CashFlowReportUpload({
  userId,
  baselineDataset,
  baselineForecastDataset,
  onImported,
  onForecastImported,
}: CashFlowReportUploadProps) {
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
      setError(err instanceof Error ? err.message : 'Não foi possível analisar a planilha de fluxo de caixa.');
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
        throw new Error('Faça login como administrador para salvar a versão.');
      }

      const forecastDataset = createForecastDatasetFromCashFlowReport(dataset, baselineForecastDataset);
      const version = await saveCashFlowReportDraft(dataset, userId);
      const forecastVersion = await saveCashFlowDraft(forecastDataset, userId);
      onImported(dataset, version);
      onForecastImported?.(forecastDataset, forecastVersion);
      setSuccess(
        isLocalTestMode
          ? 'Rascunhos de fluxo e previsão salvos somente neste navegador. Publique para atualizar a visualização local.'
          : supabase
          ? 'Rascunhos de fluxo e previsão salvos. Publique para atualizar o link principal.'
          : 'Supabase não configurado: dados carregados apenas para análise.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar os rascunhos de fluxo e previsão.');
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
          <p>A mesma planilha cria rascunhos de Fluxo de caixa e Previsão financeira.</p>
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
              <span>Bancos</span>
              <strong>{summary.bankAccountCount}</strong>
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
