# Estado vazio do fluxo de caixa

## Objetivo

Remover os dados demonstrativos exibidos automaticamente na secao de fluxo de
caixa. A interface deve mostrar dados financeiros somente depois que o usuario
importar uma planilha de fluxo de caixa valida.

## Comportamento inicial

- O modulo inicia sem `CashFlowDataset`.
- O cabecalho e o controle de importacao continuam visiveis.
- Um estado vazio informa que nenhuma planilha foi carregada.
- Metricas, abas, graficos, tabelas, variacoes e contas bancarias nao sao
  renderizados antes da importacao.
- Nenhum valor financeiro ficticio ou zerado e apresentado como se fosse um
  dado real.

## Comportamento apos importacao

- A importacao continua sendo local e nao grava dados no Supabase.
- Uma importacao valida define o dataset ativo e libera todas as visualizacoes
  existentes.
- O nome do arquivo importado aparece no cabecalho.
- O resumo, avisos e mensagem de sucesso existentes continuam funcionando.
- Uma falha de importacao mantem o estado vazio e mostra a mensagem de erro.

## Limites

- Nao alterar o parser da planilha.
- Nao alterar os calculos financeiros.
- Nao adicionar persistencia local ou remota.
- Nao alterar o fluxo principal de importacao do dashboard financeiro.
- Nao remover o dataset demonstrativo do service se ele ainda for necessario
  para testes unitarios dos calculos; ele apenas deixa de ser usado na tela.

## Testes

- Confirmar que a tela inicial nao exibe valores ou secoes demonstrativas.
- Confirmar que o botao de importacao permanece disponivel.
- Confirmar que, depois de uma importacao valida, o dashboard completo aparece.
- Executar testes unitarios existentes e o build.
- Verificar visualmente o estado vazio e o estado importado no navegador.
