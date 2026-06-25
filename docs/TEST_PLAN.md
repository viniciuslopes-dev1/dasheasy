# Test Plan

## Testes Automatizados

- `normalizeTextKey` remove acentos, normaliza caixa e espaços.
- `parseCurrencyToCents` trata números, moeda brasileira e strings numéricas.
- `parseExcelDate` trata datas do Excel, ISO e objetos `Date`.
- `analyzeWorkbookRows` detecta blocos hierárquicos e ignora cabeçalhos/totais repetidos.
- `aggregateRecords` recalcula totais por nível hierárquico.

## Testes Manuais

### Ambiente local isolado

- Para testar sem Supabase/Vercel, use `VITE_LOCAL_TEST_MODE=true` em `.env.local`.
- A rota `/admin` deve abrir como `Admin Local`, sem tela de login.
- Importar, salvar rascunho, abrir historico e publicar devem usar apenas `localStorage`.
- Durante esse modo, nenhuma requisicao deve ser feita para `*.supabase.co`.
- Dados publicados no teste local devem aparecer apenas no navegador local usado no teste.

1. Importar `Pasta2.xlsx`.
2. Validar uma aba chamada `Planilha1`.
3. Confirmar que aparecem 80 blocos e 726 lançamentos.
4. Confirmar total geral de R$ 4.995.364,41.
5. Confirmar que `Matéria Prima`, `TRIBUTARIO`, `Salários` e demais agrupamentos aparecem no dashboard.
6. Clicar em `Salários` e validar departamentos.
7. Clicar em um departamento e validar pessoas/razões sociais.
8. Comparar lista e gráfico em cada nível.
9. Testar busca por agrupamento, departamento e pessoa.
10. Testar arquivo inválido.
11. Testar planilha vazia.
12. Testar mobile e desktop.
13. Conferir console do navegador.
14. Importar `Relatorio fluxo de caixa.xlsx` na aba Fluxo de caixa.
15. Confirmar que a tela mostra formato de planilha dia a dia.
16. Confirmar que creditos `Baixado = TRUE` aparecem em Antecipados e nao
    entram no saldo final.
17. Importar uma segunda planilha alterada e validar a aba Variacoes.

## Riscos

- Planilhas futuras podem trocar nomes de cabeçalho.
- `Razão Social` pode conter pessoas e fornecedores; a UI deve chamar o campo de pessoa/responsável apenas no contexto visual.
- Dados de múltiplas empresas exigem autenticação e `company_id` obrigatório antes de produção.
- A planilha de fluxo nao possui saldo inicial; ate existir essa coluna, o
  sistema calcula a partir de R$ 0,00 e mostra essa limitacao.
