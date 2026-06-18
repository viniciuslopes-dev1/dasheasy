# Cash Flow Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir o fluxo de caixa sem dados financeiros ate que uma planilha valida seja importada.

**Architecture:** O componente `CashFlowDashboard` passa a manter um dataset opcional. O cabecalho e o upload ficam sempre visiveis; o dashboard completo e seus calculos so sao renderizados quando a importacao define um dataset.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Recharts, Vite.

---

### Task 1: Cobrir o estado vazio

**Files:**
- Create: `src/components/cash-flow/CashFlowDashboard.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CashFlowDashboard from './CashFlowDashboard';

describe('CashFlowDashboard', () => {
  it('starts empty and waits for a cash flow spreadsheet', () => {
    render(<CashFlowDashboard />);

    expect(screen.getByRole('button', { name: 'Importar planilha' })).toBeInTheDocument();
    expect(screen.getByText('Importe uma planilha de fluxo de caixa para visualizar os dados.')).toBeInTheDocument();
    expect(screen.queryByText('R$ 628.052,98')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegacao do fluxo de caixa' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test -- src/components/cash-flow/CashFlowDashboard.test.tsx`

Expected: FAIL porque a mensagem vazia ainda nao existe e os dados demonstrativos continuam visiveis.

### Task 2: Remover o fallback demonstrativo da tela

**Files:**
- Modify: `src/components/cash-flow/CashFlowDashboard.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Tornar o dataset inicial opcional**

Remover `sampleCashFlowDataset` dos imports e iniciar:

```tsx
const [baseDataset, setBaseDataset] = useState<CashFlowDataset | null>(null);
const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
```

- [ ] **Step 2: Separar a interface permanente da interface dependente de dados**

Manter cabecalho, upload e mensagens sempre visiveis. Quando `dataset` for nulo, renderizar:

```tsx
<section className="panel cash-flow-empty-state">
  <FileSpreadsheet size={28} />
  <div>
    <h3>Importe uma planilha de fluxo de caixa para visualizar os dados.</h3>
    <p>Os indicadores, graficos e movimentacoes aparecerao depois da analise do arquivo.</p>
  </div>
</section>
```

Renderizar KPI, abas, metricas, graficos, variacoes, movimentacoes e contas apenas quando existir dataset.

- [ ] **Step 3: Adicionar estilo do estado vazio**

Adicionar um layout compacto, centralizado e responsivo em `.cash-flow-empty-state`, seguindo as cores e bordas existentes.

- [ ] **Step 4: Executar o teste e confirmar sucesso**

Run: `npm test -- src/components/cash-flow/CashFlowDashboard.test.tsx`

Expected: PASS.

### Task 3: Verificar regressao e interface

**Files:**
- Verify: `src/components/cash-flow/CashFlowDashboard.tsx`
- Verify: `src/services/cashFlowService.test.ts`

- [ ] **Step 1: Executar todos os testes**

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 2: Executar o build**

Run: `npm run build`

Expected: TypeScript e Vite concluem sem erros.

- [ ] **Step 3: Verificar o navegador**

Abrir `http://127.0.0.1:5173/`, acessar `Fluxo` e confirmar:

- O upload esta visivel.
- A mensagem vazia esta visivel.
- Nao existem valores, graficos, abas ou tabelas demonstrativas.
- Nao existem erros no console.

- [ ] **Step 4: Verificar importacao real**

Importar `C:\Users\vlope\Downloads\RELATORIO DE FLUXO DE CAIXA 02.06.2026.xlsx` e confirmar que o dashboard completo passa a ser exibido sem envio ao Supabase.
