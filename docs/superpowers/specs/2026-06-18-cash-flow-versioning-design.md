# Versionamento e publicacao do fluxo de caixa

## Objetivo

Aplicar ao fluxo de caixa o mesmo modelo administrativo do dashboard
financeiro:

- somente usuarios administradores autenticados podem importar planilhas;
- cada importacao cria uma nova versao em rascunho;
- o administrador revisa e publica a versao escolhida;
- o link publico exibe somente a versao publicada;
- novas importacoes nao alteram o link publico ate serem publicadas;
- versoes anteriores permanecem no historico e podem ser republicadas.

## Separacao dos modulos

O fluxo de caixa tera versionamento independente do dashboard financeiro.
Versoes, publicacao e historico de um modulo nao alteram o outro.

O botao de historico da barra lateral usa a secao ativa:

- em Visao geral e Comparacoes, abre o historico financeiro existente;
- em Fluxo de caixa, abre o historico exclusivo do fluxo de caixa.

O botao Importar tambem respeita a secao ativa:

- em Visao geral e Comparacoes, abre o importador financeiro existente;
- em Fluxo de caixa, abre o importador de fluxo de caixa.

## Banco de dados

Criar a tabela `public.cash_flow_versions` com:

- `id`;
- `version_number`;
- `status`: `draft`, `published` ou `archived`;
- `source_file_name`;
- `month_label`;
- `start_date`;
- `end_date`;
- `movement_count`;
- `account_count`;
- `initial_balance_cents`;
- `current_forecast_cents`;
- `dataset` em `jsonb`;
- `metadata` em `jsonb`;
- `created_by`;
- `published_by`;
- `created_at`;
- `published_at`.

O `dataset` preserva a estrutura completa produzida pelo parser atual:
contas, lancamentos, fluxo diario, variacoes, snapshots e alertas. Essa escolha
mantem a primeira versao simples e fiel ao Excel, sem duplicar a modelagem
financeira existente.

Havera no maximo uma versao publicada de fluxo de caixa. A funcao
`publish_cash_flow_version(uuid)` arquiva a publicada atual e publica a versao
selecionada dentro da mesma transacao.

## Seguranca

Todas as operacoes usam a chave publica do frontend e sao protegidas pelo
Supabase Auth e por RLS.

- `anon` pode selecionar somente a versao com status `published`;
- `authenticated` pode selecionar, inserir e atualizar somente se
  `public.is_dashboard_admin()` retornar verdadeiro;
- uma nova versao deve ter `created_by = auth.uid()`;
- a funcao de publicacao verifica que o usuario e administrador;
- nenhuma chave `service_role` sera colocada no frontend;
- serao adicionados `GRANT` explicitos para as novas tabelas e funcoes.

## Servico da aplicacao

Criar `cashFlowVersionService.ts` com operacoes independentes:

- salvar rascunho;
- carregar a versao publicada;
- listar todas as versoes para o administrador;
- carregar uma versao especifica;
- publicar ou republicar uma versao.

O servico converte as linhas do Supabase para tipos TypeScript e devolve o
`CashFlowDataset` pronto para o componente visual.

## Fluxo administrativo

1. O administrador abre `/admin` e seleciona Fluxo de caixa.
2. O sistema carrega a versao mais recente para revisao.
3. O administrador clica em Importar.
4. O Excel e validado e analisado pelo parser existente.
5. O dataset e salvo no Supabase como nova versao `draft`.
6. A tela mostra o rascunho sem alterar o link publico.
7. O administrador abre o historico e clica em Publicar.
8. A versao anterior vira `archived` e o rascunho vira `published`.

Falhas de parsing nao criam versao. Falhas de banco mantem a versao atual e
mostram uma mensagem clara ao administrador.

## Fluxo publico

Ao abrir a secao Fluxo de caixa no link principal:

- o sistema busca a ultima versao publicada no Supabase;
- enquanto carrega, mostra estado de carregamento;
- se nao houver versao publicada, mostra o estado vazio;
- quando houver, renderiza o dashboard completo sem controles de importacao;
- um cache local separado pode acelerar a abertura, mas o Supabase continua
  sendo a fonte oficial e atualiza o cache.

## Componentes

`CashFlowDashboard` recebera o dataset e a permissao de importar por props. O
componente nao sera responsavel por decidir autenticacao ou publicacao.

Sera criado um importador administrativo de fluxo de caixa que reutiliza
`analyzeCashFlowExcelFile`, mostra o resumo da analise e salva o rascunho.

O historico pode reutilizar a estrutura visual do drawer existente, com tipos e
textos especificos para fluxo de caixa.

## Performance

- a tela publica faz uma consulta para a versao publicada;
- o dataset completo e carregado em uma unica linha `jsonb`;
- listagens administrativas nao precisam trazer o `dataset` completo;
- a versao selecionada e carregada sob demanda;
- os indices cobrem `status` e `created_at`.

## Testes

- mapeamento entre linha do Supabase e versao de fluxo;
- criacao de rascunho com o usuario autenticado;
- carregamento da versao publicada;
- listagem e carregamento administrativo;
- chamada da funcao de publicacao;
- importador cria rascunho e nao publica automaticamente;
- tela publica nao mostra upload;
- tela administrativa permite upload;
- historicos financeiro e de fluxo permanecem separados;
- RLS impede leitura publica de rascunhos;
- RLS impede importacao por usuario nao administrador;
- build, testes e verificacao manual em `/` e `/admin`.

## Fora do escopo

- edicao manual de lancamentos;
- comparacao automatica entre duas planilhas de fluxo;
- exclusao de versoes;
- armazenamento do arquivo Excel original;
- normalizacao do dataset em varias tabelas relacionais;
- sincronizacao em tempo real.
