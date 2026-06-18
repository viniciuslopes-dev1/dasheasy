import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CashFlowVersionHistory from './CashFlowVersionHistory';
import type { CashFlowVersion } from '../../types/cashFlow';

const version: CashFlowVersion = {
  id: 'cash-version-1',
  versionNumber: 1,
  status: 'draft',
  sourceFileName: 'fluxo.xlsx',
  monthLabel: 'Junho de 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  movementCount: 25,
  accountCount: 4,
  initialBalanceCents: 100000,
  currentForecastCents: 75000,
  dataset: null,
  metadata: {},
  createdBy: 'user-1',
  publishedBy: null,
  createdAt: '2026-06-18T10:00:00Z',
  publishedAt: null,
};

describe('CashFlowVersionHistory', () => {
  it('lists cash flow versions and publishes the selected draft', () => {
    const onPublishVersion = vi.fn();

    render(
      <CashFlowVersionHistory
        versions={[version]}
        activeVersionId="cash-version-1"
        isPublishing={false}
        onClose={vi.fn()}
        onSelectVersion={vi.fn()}
        onPublishVersion={onPublishVersion}
      />,
    );

    expect(screen.getByText('Historico do fluxo de caixa')).toBeInTheDocument();
    expect(screen.getByText('fluxo.xlsx')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(onPublishVersion).toHaveBeenCalledWith('cash-version-1');
  });
});
