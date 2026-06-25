import { CheckCircle2, Clock3, RotateCcw, X } from 'lucide-react';
import type { CashFlowReportVersion } from '../../types/cashFlowReport';
import { formatCurrency } from '../../utils/formatCurrency';

interface CashFlowReportVersionHistoryProps {
  versions: CashFlowReportVersion[];
  activeVersionId?: string;
  isPublishing: boolean;
  onClose: () => void;
  onSelectVersion: (versionId: string) => void;
  onPublishVersion: (versionId: string) => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Ainda nao publicado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CashFlowReportVersionHistory({
  versions,
  activeVersionId,
  isPublishing,
  onClose,
  onSelectVersion,
  onPublishVersion,
}: CashFlowReportVersionHistoryProps) {
  return (
    <aside className="version-drawer" aria-label="Historico do fluxo de caixa">
      <div className="version-drawer-header">
        <div>
          <span className="section-label">Historico</span>
          <h2>Historico do fluxo de caixa</h2>
          <p>Revise, publique ou restaure uma versao anterior.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar historico" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="version-empty">Nenhuma versao de fluxo salva. Importe uma planilha para criar o primeiro rascunho.</div>
      ) : (
        <div className="version-list">
          {versions.map((version) => {
            const isActive = version.id === activeVersionId;
            const actionLabel =
              version.status === 'published' ? 'Publicado' : version.status === 'draft' ? 'Publicar' : 'Republicar';

            return (
              <article className={isActive ? 'version-card active' : 'version-card'} key={version.id}>
                <button type="button" className="version-main" onClick={() => onSelectVersion(version.id)}>
                  <span className={`version-status ${version.status}`}>
                    {version.status === 'published' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                    {version.status === 'published' ? 'Publicado' : version.status === 'draft' ? 'Rascunho' : 'Historico'}
                  </span>
                  <strong>Versao {version.versionNumber}</strong>
                  <small>{version.sourceFileName}</small>
                  <small>
                    {version.movementCount} lançamentos • {version.dailyRowCount} dias • {version.anticipatedCount} antecipados
                  </small>
                  <small>Saldo final: {formatCurrency(version.closingBalanceCents)}</small>
                  <small>
                    {version.status === 'published'
                      ? `Publicado em ${formatDate(version.publishedAt)}`
                      : `Criado em ${formatDate(version.createdAt)}`}
                  </small>
                </button>
                <button
                  type="button"
                  className="secondary-action version-action"
                  disabled={isPublishing || version.status === 'published'}
                  onClick={() => onPublishVersion(version.id)}
                >
                  {version.status === 'archived' ? <RotateCcw size={15} /> : null}
                  {actionLabel}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
