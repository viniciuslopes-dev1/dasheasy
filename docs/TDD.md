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
