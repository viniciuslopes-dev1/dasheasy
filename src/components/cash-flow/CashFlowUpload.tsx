import { ChangeEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { analyzeCashFlowExcelFile } from '../../services/cashFlowImportService';
import { calculateCashFlowMetrics } from '../../services/cashFlowService';
import { saveCashFlowDraft } from '../../services/cashFlowVersionService';
import type {
  CashFlowDataset,
  CashFlowImportSummary,
  CashFlowVersion,
} from '../../types/cashFlow';
import { formatCurrency } from '../../utils/formatCurrency';

interface CashFlowUploadProps {
  userId?: string;
  onImported: (dataset: CashFlowDataset, version?: CashFlowVersion | null) => void;
}

export default function CashFlowUpload({ userId, onImported }: CashFlowUploadProps) {
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
      const result = await analyzeCashFlowExcelFile(file);
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
      if (supabase && !userId) {
        throw new Error('Faca login como administrador para salvar a versao.');
      }

      const version = await saveCashFlowDraft(dataset, userId);
      onImported(dataset, version);
      setSuccess(
        supabase
          ? 'Rascunho salvo. Publique a versao para atualizar o link principal.'
          : 'Supabase nao configurado: dados carregados apenas para analise.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar o rascunho do fluxo de caixa.');
    } finally {
      setIsSaving(false);
    }
  }

  const metrics = dataset ? calculateCashFlowMetrics(dataset) : null;

  return (
    <section className="panel upload-panel" aria-label="Importacao do fluxo de caixa">
      <div className="panel-heading">
        <div>
          <h2>Importar fluxo de caixa</h2>
          <p>A planilha cria uma nova versao em rascunho antes de aparecer no link principal.</p>
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

      {isAnalyzing ? <div className="status muted">Analisando contas, dias, debitos e creditos...</div> : null}
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
              <span>Previsao atual</span>
              <strong>{formatCurrency(metrics.currentForecastClosingCents)}</strong>
            </div>
            <div>
              <span>Alertas</span>
              <strong>{summary.issues.length}</strong>
            </div>
          </div>

          <div className="cash-flow-upload-summary">
            <span>{summary.debitMovementCount} debitos</span>
            <span>{summary.creditMovementCount} creditos</span>
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
