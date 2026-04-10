
Objetivo: corrigir de vez o Romaneio de Carga para que ele mostre somente o compilado dos itens do caminhão, nunca nomes de clientes, e eliminar a sobreposição no rodapé do PDF.

Diagnóstico confirmado
- O problema atual está no próprio código do romaneio, não no dado enviado por você.
- Em `src/components/route/LoadingManifest.tsx`, a função `consolidateProducts` ainda tem um fallback que gera linhas como `Pedido - {cliente}` quando faltam itens detalhados em todos os pedidos. É exatamente isso que faz aparecer nome de cliente no romaneio de carga.
- O PDF também usa posicionamento fixo para conferência/rodapé, então quando a tabela cresce o bloco final pode encostar ou sobrepor.
- O parser ADV já carrega itens detalhados com `product_name`, `quantity` e `weight_kg`, então o romaneio deve ser guiado só por esses itens.

O que vou ajustar
1. Remover definitivamente cliente do Romaneio de Carga
- Eliminar o fallback por cliente em `LoadingManifest.tsx`.
- O romaneio de carga passará a consolidar apenas `order.items`.
- Se um caminhão estiver sem itens detalhados, o sistema não vai mais “inventar” linhas por cliente; vai exibir aviso claro de detalhamento ausente.

2. Consolidar somente por item real
- Agrupar por produto normalizado + unidade resolvida.
- Para itens de peso: somar `weight_kg`.
- Para itens volumétricos: somar `quantity`.
- O resultado será no formato operacional que você descreveu, por exemplo:
  - `MORTADELA X — 50 kg`
  - `REFRIGERANTE Y — 15 fardos`

3. Ajustar o TOTAL e a semântica da tabela
- Manter a tabela com 3 colunas: `#`, `Produto`, `Peso Total`.
- A última coluna continuará mostrando quantidade + unidade compilada, como no modelo correto.
- O TOTAL continuará mostrando a carga total do caminhão.

4. Corrigir paginação e rodapé do PDF
- Refazer a área de conferência/rodapé para respeitar a altura real da tabela.
- Se não houver espaço suficiente, a conferência vai para a próxima página em vez de sobrepor.
- Garantir footer limpo no final da página.

5. Alinhar preview da tela com a mesma regra
- A pré-visualização HTML também ficará sem nome de cliente.
- Quando faltarem itens detalhados, mostrar aviso operacional em vez de lista errada.

6. Verificar componentes paralelos que ainda usam fallback ruim
- Revisar também `src/components/route/TruckManifestCards.tsx`, `SideBySideManifests.tsx` e `LoadConsolidationView.tsx` para evitar que outro fluxo volte a gerar romaneio por cliente ou por `product_description` concatenado.

Arquivos a ajustar
- `src/components/route/LoadingManifest.tsx`
- `src/components/route/TruckManifestCards.tsx`
- possivelmente:
  - `src/components/route/SideBySideManifests.tsx`
  - `src/components/route/LoadConsolidationView.tsx`

Resultado esperado
- nenhum nome de cliente no romaneio de carga
- 1 produto por linha
- quantidades compiladas corretamente por caminhão
- tabela fiel ao relatório detalhado importado no início
- rodapé e conferência sem sobreposição
- aviso claro quando faltarem itens detalhados

Detalhe técnico importante
- A correção principal é remover o fallback `Pedido - cliente` e tornar o romaneio estritamente dependente de `order_items`.
- O PDF de referência que você anexou confirma exatamente esse comportamento: só produtos compilados, em várias páginas quando necessário, sem cliente aparecendo.
