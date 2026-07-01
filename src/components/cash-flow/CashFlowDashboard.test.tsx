import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

    expect(screen.getByText('Nenhuma previsão financeira publicada ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Importar planilha')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 628.052,98')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegação da previsão financeira' })).not.toBeInTheDocument();
  });

  it('renders the supplied published dataset', () => {
    render(<CashFlowDashboard dataset={sampleCashFlowDataset} />);

    fireEvent.click(screen.getByRole('button', { name: /01\/06 a 22\/06/ }));

    expect(screen.getByText('Período do gráfico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15 dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 dias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '60 dias' })).toBeInTheDocument();
    expect(screen.getAllByText('R$ 628.052,98').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Navegação da previsão financeira' })).toBeInTheDocument();
    expect(screen.queryByText('Importar planilha')).not.toBeInTheDocument();
  });
});
