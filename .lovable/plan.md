

# Diagnóstico: Por que o romaneio saiu vazio novamente

## O que confirmei no banco de dados
Consultei diretamente a tabela `orders` desta rota. Todos os pedidos têm `pedido_id` preenchido corretamente (ex: 281549, 281589, etc.), mas **nenhum tem itens na tabela `order_items`** (`item_count: 0` para todos).

## Causa raiz identificada
O fluxo de inserção de itens em `addOrders` (useRoutes.ts) depende de os pedidos chegarem com o campo `items[]` preenchido. Porém há dois cenários em que isso falha:

1. **Itinerário sem ADV**: Se só o itinerário foi carregado (ou o merge não aconteceu), a função `createOrdersFromItinerario` cria pedidos com `items: []` — o `pedido_id` é salvo, mas sem itens.

2. **Merge não consolidou itens**: Mesmo quando ambos os arquivos são carregados, se o ADV CSV passar pelo "motor inteligente" em vez do parser ADV hierárquico (`parseADVDetailExcel`), cada linha do CSV vira um "pedido" separado com 1 produto. O merge então só casa o primeiro item de cada `pedido_id`, perdendo os demais.

3. **Limite de 1000 linhas do Supabase**: A query que busca `order_items` não tem paginação. Se houver mais de 1000 itens na rota, o romaneio fica incompleto.

## Correções planejadas

### 1. Consolidar itens no addOrders de forma robusta
Em `useRoutes.ts`, quando o `addOrders` recebe pedidos sem `items`, mas com `pedido_id`, guardar o `pedido_id` para uso futuro no reimport. Adicionar log detalhado para diagnosticar quantos pedidos vieram com vs sem itens.

### 2. Corrigir query de order_items para respeitar limite do Supabase
Dividir a query `.in('order_id', orderIds)` em lotes de 200 IDs para evitar o limite de 1000 linhas, garantindo que todos os itens sejam carregados.

### 3. Reimport automático quando itens faltarem
Quando o romaneio detectar que todos os pedidos do caminhão estão sem itens mas têm `pedido_id`, exibir botão proeminente de "Reimportar Detalhamento" em vez de gerar PDF vazio. Bloquear download/impressão quando não há itens.

### 4. Garantir que o ADV CSV sempre use o parser hierárquico
No `DualFileUpload.tsx`, quando um CSV é detectado como ADV hierárquico via `isADVExcelFormat`, ele já usa `parseADVDetailExcel` (linha 165-175). Mas preciso verificar que a detecção funciona corretamente com o CSV do usuário e que os itens são preservados no merge.

### 5. Adicionar fallback no merge: propagar items do ADV mesmo quando o itinerário é a lista mestre
Na função `mergeItinerarioWithADV`, quando `advOrder` tem items mas o resultado do merge não os inclui (improvável mas possível por bug de spread), adicionar verificação explícita.

## Arquivos a editar
- `src/hooks/useRoutes.ts` — paginar query de order_items; melhorar logs no addOrders
- `src/components/route/LoadingManifest.tsx` — bloquear PDF vazio; botão reimport destacado
- `src/components/route/DualFileUpload.tsx` — garantir que CSV ADV use parser correto

## Resultado esperado
- Query de itens sempre completa (sem limite de 1000)
- Romaneio nunca mais gera PDF vazio — mostra aviso e botão de reimport
- Logs detalhados para diagnosticar se itens estão chegando no addOrders
- Parser ADV hierárquico sempre ativado para CSV com formato correto

