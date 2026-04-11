

# Corrigir pipeline completo: Romaneio de Carga com cruzamento obrigatório

## Problema raiz confirmado
Consultei o banco de dados: **zero itens em `order_items`** em todas as rotas, apesar de todos os pedidos terem `pedido_id` preenchido. O romaneio sai com tabela de produtos vazia porque depende de `order_items` para consolidar — e esses itens nunca são persistidos.

## Causa raiz técnica
Rastreei todo o fluxo de dados:

1. `parseADVDetailExcel` → gera `ParsedOrder[]` com `items[]` corretos ✅
2. `mergeItinerarioWithADV` → faz `...advOrder` que inclui `items` ✅
3. `handleProcessData` → chama `onDataReady(mergedOrders, true)` ✅
4. `handleAutoDataReady` → `setOrders(filteredOrders)` ✅
5. `handleCreateRoute` → `navigate()` com `pendingOrders: validOrders` ✅
6. `RouteDetails` → `addOrders.mutate(pendingOrders.map(...))` com `items: o.items` ✅
7. **`addOrders` → o log `originalsWithItems` é 0** ❌

O problema está na **serialização via `navigate(state)`**: o React Router serializa o state via `structuredClone` ou similar, e os arrays `items` podem estar sendo perdidos se houver referências circulares ou se o objeto for muito grande. Alternativamente, o `file1Upload` usado em `handleFile2` (linha 493) pode ser um snapshot de estado vazio (closure stale).

## Plano de correção

### 1. Migration: adicionar coluna `unit` na tabela `order_items`
A tabela atual não guarda a unidade de medida (KG, FD, CX, UN). O sistema infere em runtime, mas isso é frágil. Adicionar:
```sql
ALTER TABLE public.order_items ADD COLUMN unit text NOT NULL DEFAULT 'kg';
```

### 2. `src/types/index.ts` — adicionar `unit` aos tipos
- `ParsedOrderItem`: adicionar `unit?: string`
- `OrderItem`: adicionar `unit: string`

### 3. `src/lib/advParser.ts` — salvar `unit` no `ParsedOrderItem`
Na linha 1462, adicionar `unit: unitType || 'kg'` ao item parsed.

### 4. `src/hooks/useRoutes.ts` — corrigir `addOrders` com diagnóstico detalhado
- Adicionar log **antes** do filtro `originalsWithItems` mostrando exatamente o que cada pedido tem
- Se `originalsWithItems.length === 0` mas pedidos têm `pedido_id`, logar alerta claro
- Incluir `unit` no insert de `order_items`

### 5. `src/pages/NewRoute.tsx` — garantir serialização dos itens
Antes de chamar `navigate()`, fazer deep-clone explícito dos itens para evitar perda na serialização:
```typescript
const ordersForState = validOrders.map(o => ({
  ...o,
  items: (o.items || []).map(item => ({ ...item })),
}));
navigate(`/rota/${route.id}`, { state: { pendingOrders: ordersForState, ... } });
```

### 6. `src/pages/RouteDetails.tsx` — validação na recepção dos pedidos
Ao receber `pendingOrders` do state, logar quantos têm itens. Se zero têm itens mas todos têm `pedido_id`, exibir toast de alerta.

### 7. `src/components/route/LoadingManifest.tsx` — usar `unit` do banco
Quando `order.items` tem dados, usar `item.unit` diretamente em vez de inferir via `resolveUnit`.

### 8. `src/hooks/useRoutes.ts` — `reimportItems` também salvar `unit`
Incluir a unidade no reimport para consistência.

### 9. Bloquear romaneio sem itens (já implementado, reforçar)
Se `consolidatedProducts.length === 0`, mostrar erro claro e botão de reimport em destaque.

## Arquivos a editar
- Nova migration SQL (adicionar coluna `unit`)
- `src/types/index.ts`
- `src/lib/advParser.ts`
- `src/hooks/useRoutes.ts`
- `src/pages/NewRoute.tsx`
- `src/pages/RouteDetails.tsx`
- `src/components/route/LoadingManifest.tsx`

## Resultado esperado
- Itens persistidos com unidade de medida na criação da rota
- Serialização robusta via navigate state
- Romaneio com produtos consolidados corretamente por caminhão
- Unidade correta (kg, fardo, caixa, unidade) vinda do banco
- Nunca mais romaneio vazio

