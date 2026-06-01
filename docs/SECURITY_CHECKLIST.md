# Security Checklist

- [x] Não armazenar secrets Supabase no frontend.
- [x] Usar apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no cliente.
- [x] Validar extensão de arquivo antes da leitura.
- [x] Limitar tamanho de upload no frontend.
- [x] Tratar erros sem stack trace na UI.
- [x] Criar migration com RLS habilitado.
- [x] Criar policies por usuário autenticado.
- [x] Não apagar importações antigas ao importar nova planilha.
- [x] Preservar `raw_data` para auditoria.
- [ ] Definir `company_id` real quando houver multiempresa.
- [ ] Configurar autenticação obrigatória no roteamento quando o produto for para produção.
- [ ] Revisar policies em ambiente Supabase real antes de liberar dados financeiros.

