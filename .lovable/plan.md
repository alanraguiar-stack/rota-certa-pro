

# Corrigir pipeline de dados do Romaneio de Carga

## Problema confirmado
Consultei o banco: todos os 20 pedidos desta rota têm `pedido_id` preenchido mas **zero itens** na tabela `order_items`. O romaneio sai vazio porque depende 100% de `order_items` para consolidar produtos — e esses itens nunca foram persistidos.

## Causa raiz
O fluxo de importação tem uma falha no momento de persistir os itens:

1. **Na importação inicial**: O `mergeItinerarioWithADV` faz `...advOrder` que deveria incluir `items[]`, mas o match dentro de `addOrders` entre os pedidos originais e os inseridos no banco falha silenciosamente — o log `[addOrders] No match for items of:` provavelmente aparece no console mas é ignorado.

2. **O match é frágil**: Usa `client_name + weight_kg` como fallback quando `pedido_id` não bate. Diferenças de normalização entre o nome que chega do merge e o que é inserido no banco causam falhas de casamento.

3. **Sem validação**: O sistema permite avançar o workflow mesmo com zero itens persistidos — não há barreira.

## O que vou corrigir

### 1. Tornar o match em `addOrders` determinístico por `pedido_id`
O `pedido_id` já está sendo salvo nos orders. Mas o match dentro de `addOrders` compara `io.pedido_id === original.pedido_id` de forma exata. Preciso normalizar ambos (remover zeros à esquerda, caracteres não-numéricos) — exatamente como o `reimportItems` já faz.

### 2. Adicionar validação pós-inserção em `addOrders`
Após inserir os `order_items`, verificar quantos foram realmente inseridos. Se zero itens foram persistidos mas os pedidos originais tinham itens, exibir toast de alerta claro.

### 3. Bloquear geração do PDF quando `consolidatedProducts` está vazio
Em `LoadingManifest.tsx`, o botão de download/impressão já está condicionado a `noItems`, mas isso verifica `ordersLackDetails` que olha `order.items`. Preciso garantir que `consolidatedProducts.length === 0` também bloqueia — e mostrar mensagem clara com o botão de reimport.

### 4. Adicionar fallback robusto no `addOrders`: se match por ID falhar, normalizar ambos os lados
Aplicar a mesma normalização `replace(/\D/g, '').replace(/^0+/, '')` tanto no `original.pedido_id` quanto no `insertedOrder.pedido_id`.

### 5. Log de diagnóstico detalhado
Adicionar contadores de match por tipo (ID vs nome+peso vs sem match) para facilitar debug futuro.

## Arquivos a editar
- `src/hooks/useRoutes.ts` — normalizar `pedido_id` no match de `addOrders`; validação pós-inserção
- `src/components/route/LoadingManifest.tsx` — blindar contra PDF vazio baseado em `consolidatedProducts.length`

## Resultado esperado
- Itens persistidos corretamente na criação da rota (match por `pedido_id` normalizado)
- Romaneio com produtos consolidados conforme a tabela de vendas detalhadas
- PDF nunca gerado vazio — erro claro quando faltar detalhamento
- Reimport funcional como fallback

