# Technical Design Document

## Stack

- React + TypeScript + Vite.
- `@e965/xlsx` para leitura de Excel no frontend, evitando a vulnerabilidade alta sem correção do pacote `xlsx`.
- Supabase JS para persistência.
- Recharts para gráficos.
- Vitest para testes unitários.

## Tipos Principais

- `FinancialImport`: origem de importação, nome do arquivo, aba, totais e metadados.
- `FinancialRecord`: lançamento financeiro normalizado.
- `FinancialSummary`: total agregado usado no dashboard.
- `ExcelAnalysis`: diagnóstico antes da confirmação.

## Decisões Técnicas

- O importador não assume que a planilha é plana. Ele detecta cabeçalhos internos repetidos e interpreta cada bloco financeiro.
- O agrupamento principal vem da linha de resumo (`NATUREZA`), não de `Nome Grupo`, porque a planilha usa `Nome Grupo` como categoria detalhada em vários lançamentos.
- O campo `Razão Social` será tratado genericamente como `person_name`, porque pode representar funcionário, sócio, fornecedor, banco, imposto ou responsável.
- `Nome Grupo` será preservado como `detail_group` para análises secundárias.
- Valores serão persistidos em centavos (`amount_cents`) para evitar erro de ponto flutuante.
- A UI calcula gráficos a partir das mesmas agregações usadas nas listas.

## Contratos de Importação

Entrada aceita:

- `.xlsx`
- `.xls`

Saída da análise:

- abas detectadas;
- contagem de blocos;
- contagem de lançamentos;
- totais;
- prévia;
- inconsistências;
- registros normalizados.

Validações:

- extensão e MIME quando disponível;
- tamanho máximo configurado no frontend;
- existência da aba;
- presença dos cabeçalhos esperados;
- valores monetários parseáveis;
- data válida quando presente;
- linhas de detalhe completas.

## Contratos de Dashboard

Nível geral:

- agrupa por `group_name`.

Nível de agrupamento:

- filtra por `group_name`;
- agrupa por `department_name`.

Nível de departamento:

- filtra por `group_name` e `department_name`;
- agrupa por `person_name`.

## Contratos do Fluxo de Caixa

Entrada esperada:

- Uma aba com colunas de documento, tipo (`Débito` ou `Crédito`), razao social,
  baixado, previsao, data de vencimento e valor total.

Normalizacao:

- `Débito/Crédito` vira `DEBITO` ou `CREDITO`.
- `Baixado = TRUE` em credito vira `isAnticipated = true`.
- `Previsão` vira flag visual do titulo.
- Valores ficam em centavos.
- Datas `m/d/yy` sao interpretadas como datas da planilha do cliente.

Calculo:

- `cashFlowMovements` exclui antecipados.
- `dailyRows` enumera o periodo completo e carrega o saldo de um dia para o
  proximo.
- `variations` compara a nova importacao com a versao anterior usando documento
  + razao social + tipo.

Persistencia:

- `cash_flow_reports` guarda o dataset completo em `jsonb`.
- `publish_cash_flow_report(uuid)` controla a unica versao publicada.
