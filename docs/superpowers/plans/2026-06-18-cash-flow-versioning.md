# Cash Flow Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir versoes do fluxo de caixa no Supabase, permitindo importacao e publicacao somente no admin e visualizacao somente da versao publicada no link principal.

**Architecture:** O parser atual continua produzindo `CashFlowDataset`. Um servico dedicado salva o dataset completo em `cash_flow_versions`, enquanto `App` coordena datasets e historicos financeiros e de fluxo separadamente. `CashFlowDashboard` recebe dados por props e nunca decide autenticacao ou persistencia.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, Supabase Auth/Postgres/RLS.

---

### Task 1: Tipos e servico de versoes

**Files:**
- Modify: `src/types/cashFlow.ts`
- Create: `src/services/cashFlowVersionService.test.ts`
- Create: `src/services/cashFlowVersionService.ts`

- [ ] Criar tipos `CashFlowVersion`, `CashFlowVersionStatus` e `CashFlowVersionDataset`.
- [ ] Escrever testes para mapear linhas, salvar rascunho, carregar publicada, listar versoes, carregar uma versao e publicar via RPC.
- [ ] Executar os testes e confirmar falha por modulo inexistente.
- [ ] Implementar o servico com consultas separadas para listagem leve e carregamento completo.
- [ ] Executar os testes e confirmar sucesso.

### Task 2: Migration, RLS e publicacao

**Files:**
- Create: `supabase/migrations/<timestamp>_cash_flow_versions.sql`
- Modify: `docs/DATABASE_DESIGN.md`
- Modify: `docs/SECURITY_CHECKLIST.md`

- [ ] Criar a migration com `npx supabase migration new cash_flow_versions`.
- [ ] Criar `cash_flow_versions`, indices, limite de uma publicada e funcao `publish_cash_flow_version`.
- [ ] Habilitar RLS: anon le somente publicada; administradores autenticados leem, inserem e atualizam.
- [ ] Adicionar `GRANT` explicitos para Data API.
- [ ] Aplicar no projeto `yloiswbjzhvxqnkcudnj`.
- [ ] Validar tabela, policies, grants e funcao de publicacao.

### Task 3: Dashboard controlado e importador administrativo

**Files:**
- Modify: `src/components/cash-flow/CashFlowDashboard.test.tsx`
- Modify: `src/components/cash-flow/CashFlowDashboard.tsx`
- Create: `src/components/cash-flow/CashFlowUpload.test.tsx`
- Create: `src/components/cash-flow/CashFlowUpload.tsx`

- [ ] Testar que o dashboard publico recebe dataset e nunca mostra upload.
- [ ] Testar que o dashboard vazio nao mostra dados.
- [ ] Refatorar `CashFlowDashboard` para props `dataset` e remover importacao interna.
- [ ] Testar o upload administrativo: analisa o Excel, mostra resumo e salva rascunho sem publicar.
- [ ] Implementar `CashFlowUpload` usando `analyzeCashFlowExcelFile` e `saveCashFlowDraft`.

### Task 4: Estado global, historico e rotas

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`
- Create: `src/components/admin/CashFlowVersionHistory.tsx`
- Modify: `src/styles.css`

- [ ] Manter datasets, versoes, loading e publicacao separados por modulo.
- [ ] Carregar em paralelo o dashboard financeiro e o fluxo publicado no link publico.
- [ ] Carregar em paralelo os dois historicos no admin.
- [ ] Fazer Importar e Historico respeitarem a secao ativa.
- [ ] Publicar e republicar fluxo sem alterar o dashboard financeiro.
- [ ] Passar o dataset correto ao `CashFlowDashboard`.
- [ ] Manter o publico sem controles administrativos.

### Task 5: Verificacao

**Files:**
- Verify all changed files.

- [ ] Executar `npm test`.
- [ ] Executar `npm run build`.
- [ ] Executar `git diff --check`.
- [ ] Verificar `/`: fluxo vazio ou publicado, sem upload.
- [ ] Verificar `/admin`: importar cria rascunho, historico de fluxo aparece e publicar atualiza o publico.
- [ ] Executar advisors de seguranca e performance no Supabase.
