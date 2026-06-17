import { CheckCircle2, Clock3, RotateCcw, X } from 'lucide-react';
import type { DashboardVersion } from '../../types/financial';
import { formatCurrency } from '../../utils/formatCurrency';

interface VersionHistoryProps {
  versions: DashboardVersion[];
  activeVersionId?: string;
  isPublishing: boolean;
  onClose: () => void;
  onSelectVersion: (versionId: string) => void;
  onPublishVersion: (versionId: string) => void;
}

function getStatusLabel(version: DashboardVersion): string {
  if (version.status === 'published') {
    return 'Publicado';
  }

  if (version.status === 'draft') {
    return 'Rascunho';
  }

  return 'Histórico';
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

export default function VersionHistory({
  versions,
  activeVersionId,
  isPublishing,
  onClose,
  onSelectVersion,
  onPublishVersion,
}: VersionHistoryProps) {
  return (
    <aside className="version-drawer" aria-label="Histórico de versões">
      <div className="version-drawer-header">
        <div>
          <span className="section-label">Histórico</span>
          <h2>Versões do dashboard</h2>
          <p>Selecione uma versão para revisar ou republicar.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar histórico" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="version-empty">Nenhuma versão salva ainda. Importe uma planilha para criar o primeiro rascunho.</div>
      ) : (
        <div className="version-list">
          {versions.map((version) => {
            const isActive = version.id === activeVersionId;
            const actionLabel = version.status === 'published' ? 'Publicado' : version.status === 'draft' ? 'Publicar' : 'Republicar';
            return (
              <article className={isActive ? 'version-card active' : 'version-card'} key={version.id}>
                <button type="button" className="version-main" onClick={() => onSelectVersion(version.id)}>
                  <span className={`version-status ${version.status}`}>
                    {version.status === 'published' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                    {getStatusLabel(version)}
                  </span>
                  <strong>Versão {version.versionNumber}</strong>
                  <small>{version.sourceFileName}</small>
                  <small>
                    {version.recordCount} itens • {formatCurrency(version.totalAmountCents)}
                  </small>
                  <small>{version.status === 'published' ? `Publicado em ${formatDate(version.publishedAt)}` : `Criado em ${formatDate(version.createdAt)}`}</small>
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
