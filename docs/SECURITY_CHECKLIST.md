# Security Checklist

- [x] Não armazenar secrets Supabase no frontend.
- [x] Usar apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no cliente.
- [x] Separar link público `/` da área administrativa `/admin`.
- [x] Exigir Supabase Auth para importar, publicar e republicar versões.
- [x] Usar nome de acesso no formulário sem criar autenticação caseira; o nome vira e-mail técnico do Supabase Auth.
- [x] Restringir administração à allowlist `admin_users`.
- [x] Remover botão de importação do link público.
- [x] Criar versionamento para evitar que uma importação ruim altere o público automaticamente.
- [x] Manter histórico de versões e permitir republicação.
- [x] Habilitar RLS nas tabelas expostas.
- [x] Permitir leitura `anon` apenas da versão `published`.
- [x] Permitir escrita apenas para usuário `authenticated`.
- [x] Preservar `raw_data` para auditoria.
- [x] Tratar erros sem stack trace na UI.
- [x] Validar extensão de arquivo antes da leitura.
- [x] Não apagar dados antigos ao importar nova planilha.
- [ ] Aplicar `supabase/migrations/002_dashboard_versions.sql` no projeto Supabase de produção.
- [ ] Criar a conta principal do admin no Supabase Auth com e-mail técnico baseado no nome de acesso.
- [ ] Inserir o `auth.users.id` dessa conta em `public.admin_users`.
- [ ] Revisar no painel Supabase se as tabelas novas estão expostas à Data API com RLS ativo.
- [ ] Definir `company_id` real quando houver multiempresa.
# Fluxo de caixa

- [x] `cash_flow_versions` possui RLS habilitado.
- [x] Visitantes anonimos leem somente a versao publicada.
- [x] Rascunhos e historico exigem usuario autenticado em `admin_users`.
- [x] Novas versoes exigem `created_by = auth.uid()`.
- [x] Publicacao exige `is_dashboard_admin()`.
- [x] O frontend usa somente a chave publica do Supabase.
- [x] Grants da Data API foram declarados explicitamente.
