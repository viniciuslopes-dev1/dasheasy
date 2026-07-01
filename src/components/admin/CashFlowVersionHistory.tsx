import { CheckCircle2, Clock3, RotateCcw, X } from 'lucide-react';
import type { CashFlowVersion } from '../../types/cashFlow';
import { formatCurrency } from '../../utils/formatCurrency';

interface CashFlowVersionHistoryProps {
  versions: CashFlowVersion[];
  activeVersionId?: string;
  isPublishing: boolean;
  onClose: () => void;
  onSelectVersion: (versionId: string) => void;
  onPublishVersion: (versionId: string) => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Ainda não publicado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function CashFlowVersionHistory({
  versions,
  activeVersionId,
  isPublishing,
  onClose,
  onSelectVersion,
  onPublishVersion,
}: CashFlowVersionHistoryProps) {
  return (
    <aside className="version-drawer" aria-label="Historico da previsão financeira">
      <div className="version-drawer-header">
        <div>
          <span className="section-label">Historico</span>
          <h2>Historico da previsão financeira</h2>
          <p>Revise, publique ou restaure uma versão anterior.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar histórico" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="version-empty">Nenhuma versão de previsão salva. Importe uma planilha para criar o primeiro rascunho.</div>
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
                    {version.monthLabel} - {version.movementCount} movimentacoes
                  </small>
                  <small>Previsão: {formatCurrency(version.currentForecastCents)}</small>
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
