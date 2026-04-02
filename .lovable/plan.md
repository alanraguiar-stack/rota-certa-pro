

# Plano: Corrigir Reordenamento — Insert em vez de Swap

## Causa Raiz

O `useEffect` que sincroniza `localOrders` com `truckData.orders` está desfazendo a atualização otimista prematuramente.

Quando o mutation `reorderSingleDelivery` inicia, `isPending` muda → RouteDetails re-renderiza → cria novos arrays `orders` (mesmos dados, nova referência) → o `useEffect` detecta "mudança" e reseta `localOrders` para o estado antigo do servidor, desfazendo o insert otimista.

O resultado visual: o item volta para a posição original (parece "swap" ou "não funcionou").

## Correção

### `src/components/route/TruckRouteEditor.tsx`

1. **Adicionar ref `isReordering`** para rastrear se há um reorder em andamento
2. **No `useEffect` de sync**: só atualizar `localOrders` se `isReordering.current === false`
3. **No `handleReorder` e `handleDragDrop`**: setar `isReordering.current = true` antes do optimistic update, e `false` após o mutation completar (sucesso ou erro)
4. **Comparação por IDs**: como backup, comparar a lista de order IDs antes de fazer o sync — se os IDs são os mesmos (mesma ordem), ignorar o sync

```typescript
const isReordering = useRef(false);

useEffect(() => {
  if (!isReordering.current) {
    setLocalOrders(truckData.orders);
  }
}, [truckData.orders]);
```

No `handleDragDrop` e `handleReorder`:
```typescript
isReordering.current = true;
optimisticReorder(orderId, newIndex);
try {
  await onReorder(...);
} catch { ... }
finally {
  isReordering.current = false;
}
```

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Ref `isReordering` para proteger optimistic updates de serem sobrescritos |

