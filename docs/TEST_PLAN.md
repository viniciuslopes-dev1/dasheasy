# Test Plan

## Testes Automatizados

- `normalizeTextKey` remove acentos, normaliza caixa e espaços.
- `parseCurrencyToCents` trata números, moeda brasileira e strings numéricas.
- `parseExcelDate` trata datas do Excel, ISO e objetos `Date`.
- `analyzeWorkbookRows` detecta blocos hierárquicos e ignora cabeçalhos/totais repetidos.
- `aggregateRecords` recalcula totais por nível hierárquico.

## Testes Manuais

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

## Riscos

- Planilhas futuras podem trocar nomes de cabeçalho.
- `Razão Social` pode conter pessoas e fornecedores; a UI deve chamar o campo de pessoa/responsável apenas no contexto visual.
- Dados de múltiplas empresas exigem autenticação e `company_id` obrigatório antes de produção.

