# Implementation Plan

## Estado atual

O sistema tem duas superfícies:

- `/`: dashboard público somente leitura.
- `/admin`: área autenticada para o usuário principal importar planilhas, revisar versões, publicar e republicar.

## Fluxo público

1. Usuário acessa o link principal.
2. O app carrega a versão `published` do Supabase.
3. O dashboard e comparações usam apenas registros ligados à versão publicada.
4. Não há botão de importação nem configuração no público.

## Fluxo admin

1. Admin acessa `/admin`.
2. Se não houver sessão, vê tela de login.
3. Após login, o app carrega o histórico de versões.
4. A versão mais recente aparece no dashboard admin.
5. Ao importar uma planilha, o sistema cria uma versão `draft`.
6. O admin revisa os dados.
7. Ao clicar em publicar/republicar, a versão escolhida vira `published` e a anterior vira `archived`.

## Arquivos principais

- `src/App.tsx`: separa público/admin, sessão, carregamento e publicação.
- `src/components/admin/AdminLogin.tsx`: login por e-mail e senha via Supabase Auth.
- `src/components/admin/AdminDashboard.tsx`: workspace admin.
- `src/components/admin/VersionHistory.tsx`: histórico, seleção e republicação.
- `src/components/ExcelUpload.tsx`: cria rascunho versionado.
- `src/services/dashboardVersionService.ts`: leitura pública, leitura admin, rascunho e publicação.
- `supabase/migrations/002_dashboard_versions.sql`: schema de versões, RLS e RPC de publicação.

## Testes

- `src/services/dashboardVersionService.test.ts`: mapeamento de versões/registros, leitura publicada e chamada de publicação via RPC.
- Testes existentes continuam cobrindo parser, normalização, agregações e cascata.

## Próximas etapas operacionais

1. Aplicar a migration `002_dashboard_versions.sql` no Supabase.
2. Criar o usuário principal em Supabase Auth usando e-mail técnico derivado do nome. Exemplo: nome `vinicius` vira `vinicius@dasheasy.local`.
3. Inserir o ID desse usuário em `public.admin_users`.
4. Garantir que `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estejam configuradas na Vercel.
5. Fazer login em `/admin`, importar a planilha, revisar e publicar.
6. Validar o link público `/`.

## Fluxo de caixa operacional

- A antiga tela de fluxo foi renomeada para Previsao Financeira.
- O novo Fluxo de Caixa usa `cash_flow_reports`, com versoes independentes.
- O admin importa a planilha do cliente em `/admin` na aba Fluxo de caixa.
- A importacao le a planilha real, separa antecipados, calcula o saldo dia a
  dia e salva como rascunho.
- Ao publicar, o link principal mostra uma tabela com dias, saldo inicial,
  debito, credito, liquido, antecipados e saldo final.
- Movimentacoes e Contas saem da Previsao Financeira e ficam no novo fluxo.
- Variacoes sao calculadas comparando a nova importacao com a versao de fluxo
  carregada anteriormente: novos titulos, valor alterado, data alterada, tipo
  alterado ou removidos.
- Aplicar `supabase/migrations/20260624004145_cash_flow_reports.sql` antes de
  usar o novo Fluxo de Caixa com Supabase.
 
