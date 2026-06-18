import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CashFlowDashboard from './CashFlowDashboard';
import { sampleCashFlowDataset } from '../../services/cashFlowService';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

describe('CashFlowDashboard', () => {
  it('renders an empty public view without upload controls', () => {
    render(<CashFlowDashboard dataset={null} />);

    expect(screen.getByText('Nenhum fluxo de caixa publicado ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Importar planilha')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 628.052,98')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegacao do fluxo de caixa' })).not.toBeInTheDocument();
  });

  it('renders the supplied published dataset', () => {
    render(<CashFlowDashboard dataset={sampleCashFlowDataset} />);

    expect(screen.getAllByText('R$ 628.052,98').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Navegacao do fluxo de caixa' })).toBeInTheDocument();
    expect(screen.queryByText('Importar planilha')).not.toBeInTheDocument();
  });
});
