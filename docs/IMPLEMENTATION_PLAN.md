# Implementation Plan

## Etapas

1. Criar estrutura React + TypeScript sem substituir funcionalidades existentes, pois o repositório está vazio.
2. Adicionar dependências: `@supabase/supabase-js`, `@e965/xlsx`, `recharts`, `lucide-react`, `vite`, `vitest`.
3. Criar tipos financeiros em `src/types/financial.ts`.
4. Criar testes unitários para normalização e parser da planilha.
5. Implementar normalização de texto, moeda, data e deduplicação.
6. Implementar parser de Excel por blocos repetidos.
7. Criar cliente Supabase configurado por variáveis públicas.
8. Criar serviço de persistência e consultas agregadas.
9. Criar migration Supabase com tabelas, índices e RLS.
10. Criar upload com análise, prévia e confirmação.
11. Criar dashboard hierárquico com listas, busca, breadcrumbs e gráficos de pizza.
12. Adicionar estados de loading, erro e vazio.
13. Executar testes, lint/build e verificação manual local.

## Arquivos Planejados

- `src/types/financial.ts`: contratos de dados.
- `src/utils/normalizeExcelData.ts`: normalização e parsing.
- `src/services/excelImportService.ts`: leitura/análise do Excel.
- `src/services/financialDataService.ts`: agregações e importação no Supabase.
- `src/lib/supabase.ts`: cliente Supabase.
- `src/components/ExcelUpload.tsx`: upload, análise e confirmação.
- `src/components/dashboard/FinancialDashboard.tsx`: estado hierárquico.
- `src/components/dashboard/GroupingList.tsx`: lista/tabela dos itens.
- `src/components/dashboard/PieChartPanel.tsx`: gráfico.
- `src/components/dashboard/BreadcrumbNavigation.tsx`: navegação.
- `src/utils/formatCurrency.ts`: moeda brasileira.
- `src/**/*.test.ts`: testes unitários.
- `supabase/migrations/001_financial_imports.sql`: schema.

## Plano de Teste Automatizado

- Normalizar espaços e acentos para chaves.
- Converter valores monetários brasileiros e numéricos para centavos.
- Detectar blocos com cabeçalhos internos.
- Garantir que totais dos detalhes batem com totais do bloco.
- Agregar por agrupamento, departamento e pessoa.
