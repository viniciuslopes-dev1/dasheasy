import { ArrowLeft } from 'lucide-react';

interface BreadcrumbNavigationProps {
  groupLabel?: string;
  departmentLabel?: string;
  onBack: () => void;
  onRoot: () => void;
  onGroup: () => void;
}

export default function BreadcrumbNavigation({
  groupLabel,
  departmentLabel,
  onBack,
  onRoot,
  onGroup,
}: BreadcrumbNavigationProps) {
  return (
    <nav className="breadcrumbs" aria-label="Navegação hierárquica">
      {(groupLabel || departmentLabel) && (
        <button type="button" className="back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
      )}
      <button type="button" onClick={onRoot} className={!groupLabel ? 'current' : ''}>
        Todos os agrupamentos
      </button>
      {groupLabel ? (
        <>
          <span>/</span>
          <button type="button" onClick={onGroup} className={!departmentLabel ? 'current' : ''}>
            {groupLabel}
          </button>
        </>
      ) : null}
      {departmentLabel ? (
        <>
          <span>/</span>
          <span className="current">{departmentLabel}</span>
        </>
      ) : null}
    </nav>
  );
}

