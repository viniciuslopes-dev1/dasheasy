# Software Design Document

## Contexto

O projeto em `C:\Users\vlope\Documents\dasheasy` estava vazio, contendo apenas `.git`. A solução será criada como uma aplicação web React + TypeScript com Supabase, leitura de Excel e dashboard financeiro hierárquico.

## Diagnóstico da Planilha

Arquivo analisado: `C:\Users\vlope\Downloads\Pasta2.xlsx`.

- Abas: `Planilha1`.
- Dimensão: 1.047 linhas, 8 colunas aparentes; as colunas úteis são A:E.
- Cabeçalho inicial: `NATUREZA`, `DEPARTAMENTO`, `CLASSIFICAÇÃO`, `TIPO`, `VALOR`.
- Estrutura real: 80 blocos financeiros, cada um com:
  - linha de resumo: natureza, departamento, classificação, tipo e total;
  - linha de rótulo mesclada, como `GRUPO SALARIOS`;
  - cabeçalho interno: `Nº Documento`, `Razão Social`, `Data Vencimento`, `Valor Total`, `Nome Grupo`;
  - lançamentos detalhados;
  - linha `TOTAL`.
- Lançamentos detalhados: 726.
- Soma dos totais dos blocos: R$ 4.995.364,41.
- Soma dos lançamentos detalhados: R$ 4.995.364,41.
- Os 80 blocos fecham sem divergência entre detalhe e total declarado.

## Campos Identificados

- Agrupamento principal: `NATUREZA` da linha de resumo do bloco.
- Departamento: `DEPARTAMENTO` da linha de resumo do bloco.
- Classificação: `CLASSIFICAÇÃO` da linha de resumo do bloco.
- Tipo financeiro: `TIPO` da linha de resumo do bloco (`Custo`, `Despesa`, `Investimento`).
- Valor financeiro do bloco: `VALOR` da linha de resumo.
- Documento: `Nº Documento` do detalhe.
- Pessoa, fornecedor ou responsável: `Razão Social` do detalhe.
- Data: `Data Vencimento` do detalhe.
- Valor do lançamento: `Valor Total` do detalhe.
- Categoria detalhada: `Nome Grupo` do detalhe.

## Inconsistências Relevantes

- Há 160 células mescladas, usadas principalmente em linhas de rótulo de grupo.
- Existem cabeçalhos internos repetidos 80 vezes.
- Foram detectadas 139 duplicidades quando a planilha inteira é vista como tabela bruta, mas isso inclui cabeçalhos e totais repetidos.
- Nos lançamentos normalizados, há 1 duplicidade exata.
- Existem 195 lançamentos onde `Nome Grupo` não corresponde exatamente à `NATUREZA` do bloco. Isso parece intencional em alguns casos, como `Salários` contendo `SERVIÇO ADMINISTRATIVO`, `FÉRIAS` ou `PENSÃO ALIMENTICIA`. Por isso, ambos os campos devem ser preservados.
- Não há campos obrigatórios vazios nos 726 lançamentos normalizados.

## Arquitetura

Camadas propostas:

- `services/excelImportService`: lê o workbook, detecta abas e extrai blocos financeiros.
- `utils/normalizeExcelData`: normaliza texto, datas, moeda e chaves de deduplicação.
- `services/financialDataService`: consulta agregações por agrupamento, departamento e pessoa.
- `lib/supabase`: cliente Supabase sem secrets no frontend.
- `components/dashboard`: componentes visuais sem regra de importação.
- `supabase/migrations`: schema seguro, com RLS e índices.

## Fluxo

1. Usuário seleciona `.xlsx` ou `.xls`.
2. A aplicação lê abas e mostra diagnóstico.
3. A aplicação exibe prévia dos blocos e lançamentos.
4. Usuário confirma importação.
5. Dados normalizados são salvos no Supabase.
6. Dashboard consulta agregações por nível:
   - agrupamento principal;
   - departamento dentro do agrupamento;
   - pessoa/razão social dentro do departamento.

