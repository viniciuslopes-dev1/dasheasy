# Financial Dashboard Design

## Diagnóstico

`Pasta2.xlsx` contém uma aba `Planilha1` com dados financeiros em blocos repetidos. Cada bloco possui linha de resumo, rótulo de grupo, cabeçalho interno, detalhes e total. A importação deve tratar o formato como hierárquico, não como CSV plano.

## Abordagem Escolhida

Criar uma aplicação React + TypeScript com parser local de Excel, prévia antes da confirmação, persistência no Supabase e dashboard com três níveis: agrupamento, departamento e pessoa/razão social.

## Alternativas Consideradas

- Parser simples por colunas: descartado porque a planilha possui cabeçalhos e totais repetidos.
- Tabelas separadas por tipo financeiro: descartado porque limitaria a solução a salários ou categorias específicas.
- Modelo único de lançamentos com metadados: escolhido por preservar flexibilidade e permitir agregações por qualquer agrupamento.

## Componentes

- Upload e análise da planilha.
- Serviço de normalização e deduplicação.
- Serviço de persistência Supabase.
- Dashboard hierárquico com breadcrumb.
- Lista agregada e gráfico de pizza sincronizados.

## Segurança

O schema usa RLS por `user_id`. O frontend usa somente chave anônima pública e valida arquivo/tamanho antes de ler.

