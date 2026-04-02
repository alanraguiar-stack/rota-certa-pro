

# Plano: Eliminar Flickering no Reordenamento

## Causa Raiz

O flicker acontece por um problema de timing entre o `isReordering` ref e o `invalidateQueries`:

1. Usuário reordena → `isReordering = true` → UI atualiza instantaneamente ✅
2. `await onReorder()` resolve → `finally` seta `isReordering = false`
3. **Mas** o `invalidateQueries` dispara no `onSuccess` do mutation **depois** do `finally`
4. O refetch traz dados do servidor (que podem ter a ordem antiga ainda em cache) → `useEffect` detecta mudança → reseta `localOrders` → **flicker**

Ou seja: `isReordering` fica `false` **antes** do refetch terminar, permitindo que o `useEffect` de sync sobrescreva o estado otimista.

## Correção

### `src/components/route/TruckRouteEditor.tsx`

Substituir a lógica de `isReordering` ref + `useEffect` por uma abordagem mais robusta:

1. **Remover o `isReordering` ref** — ele não é confiável por causa do timing async
2. **No `useEffect` de sync**: comparar os IDs + ordem dos `localOrders` vs `truckData.orders`. Só sincronizar se a **composição** mudou (item adicionado/removido), não se apenas a ordem mudou (que é exatamente o que o optimistic update faz)
3. **Adicionar debounce de sync**: usar um `setTimeout` curto (300ms) para dar tempo ao servidor de responder antes de considerar sync

```typescript
useEffect(() => {
  // Extrair IDs na ordem atual
  const localIds = localOrders.map(o => o.id);
  const serverIds = truckData.orders.map(o => o.id);
  
  // Se a composição mudou (item adicionado/removido), sync imediato
  const localSet = new Set(localIds);
  const serverSet = new Set(serverIds);
  const compositionChanged = localIds.length !== serverIds.length || 
    serverIds.some(id => !localSet.has(id));
  
  if (compositionChanged) {
    setLocalOrders(truckData.orders);
    return;
  }
  
  // Se a ordem é diferente, pode ser o servidor confirmando nosso reorder
  // Só atualizar após um delay para evitar sobrescrever optimistic updates
  const timer = setTimeout(() => {
    setLocalOrders(truckData.orders);
  }, 500);
  
  return () => clearTimeout(timer);
}, [truckData.orders]);
```

4. **Nos handlers**: remover a flag `isReordering` e simplificar — não precisa mais de `previousOrders` para rollback no `finally`, pois o `useEffect` com debounce cuidará da convergência. Manter rollback apenas no `catch`.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Trocar `isReordering` ref por comparação de composição + debounce no sync |

