import { ChangeEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { analyzeCashFlowExcelFile } from '../../services/cashFlowImportService';
import { calculateCashFlowMetrics } from '../../services/cashFlowService';
import { saveCashFlowDraft } from '../../services/cashFlowVersionService';
import { isLocalTestMode } from '../../services/localTestMode';
import type {
  CashFlowDataset,
  CashFlowImportSummary,
  CashFlowVersion,
} from '../../types/cashFlow';
import { formatCurrency } from '../../utils/formatCurrency';

interface CashFlowUploadProps {
  userId?: string;
  baselineDataset?: CashFlowDataset | null;
  onImported: (dataset: CashFlowDataset, version?: CashFlowVersion | null) => void;
}

export default function CashFlowUpload({ userId, baselineDataset, onImported }: CashFlowUploadProps) {
  const [dataset, setDataset] = useState<CashFlowDataset | null>(null);
  const [summary, setSummary] = useState<CashFlowImportSummary | null>(null);
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
      const result = await analyzeCashFlowExcelFile(file, baselineDataset);
      setDataset(result.dataset);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível analisar a planilha de previsão financeira.');
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

      const version = await saveCashFlowDraft(dataset, userId);
      onImported(dataset, version);
      setSuccess(
        isLocalTestMode
          ? 'Rascunho salvo somente neste navegador. Publique para atualizar a visualizacao local.'
          : supabase
          ? 'Rascunho salvo. Publique a versão para atualizar o link principal.'
          : 'Supabase não configurado: dados carregados apenas para analise.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o rascunho de previsão financeira.');
    } finally {
      setIsSaving(false);
    }
  }

  const metrics = dataset ? calculateCashFlowMetrics(dataset) : null;

  return (
    <section className="panel upload-panel" aria-label="Importacao da previsão financeira">
      <div className="panel-heading">
        <div>
          <h2>Importar previsão financeira</h2>
          <p>A planilha cria uma nova versão em rascunho antes de aparecer no link principal.</p>
        </div>
        <FileSpreadsheet size={22} />
      </div>

      <label className="upload-dropzone">
        <UploadCloud size={24} />
        <span>{summary?.fileName ?? 'Selecione a planilha de previsão financeira'}</span>
        <input
          aria-label="Selecionar planilha de previsão financeira"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={isAnalyzing || isSaving}
        />
      </label>

      {isAnalyzing ? <div className="status muted">Analisando contas, dias, débitos e créditos...</div> : null}
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
              <span>Contas</span>
              <strong>{summary.bankAccountCount}</strong>
            </div>
            <div>
              <span>Movimentacoes</span>
              <strong>{dataset.movements.length}</strong>
            </div>
            <div>
              <span>Previsão atual</span>
              <strong>{formatCurrency(metrics.currentForecastClosingCents)}</strong>
            </div>
            <div>
              <span>Alertas</span>
              <strong>{summary.issues.length}</strong>
            </div>
          </div>

          <div className="cash-flow-upload-summary">
            <span>{summary.debitMovementCount} débitos</span>
            <span>{summary.creditMovementCount} créditos</span>
            <span>{summary.dailyEntryCount} dias de fluxo</span>
          </div>

          <button className="primary-action" type="button" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? 'Salvando rascunho...' : 'Salvar rascunho'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
