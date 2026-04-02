

# Plano: Reordenamento em Tempo Real (Optimistic Updates)

## Causa Raiz

Cada ação de reordenar (drag-and-drop ou setas) executa esta sequência **bloqueante**:

1. `await reorderSingleDelivery.mutateAsync()` — N chamadas ao banco em paralelo
2. `await refetch()` — re-busca a rota inteira do banco
3. Só então o React re-renderiza com a nova ordem

Resultado: delay de 500ms–2s por operação, tornando o arraste travado.

## Solução: Optimistic Updates

Atualizar a lista localmente **antes** de chamar o banco. Se o banco falhar, reverter.

## Mudanças

### 1. `src/components/route/TruckRouteEditor.tsx` — Estado local otimista

- Adicionar `localOrders` state no `TruckTab` que espelha `truckData.orders`
- No drag-and-drop e nas setas, reordenar `localOrders` **imediatamente** (splice/insert)
- Renderizar a partir de `localOrders` em vez de `truckData.orders`
- Chamar `onReorder` em background (sem `await` bloqueante na UI)
- Se `onReorder` falhar, reverter `localOrders` para o estado anterior e mostrar toast de erro
- Sincronizar `localOrders` com `truckData.orders` via `useEffect` quando os dados do servidor mudarem (para capturar mudanças externas)

### 2. `src/pages/RouteDetails.tsx` — Remover `await refetch()` bloqueante

- No `handleReorderInTruck`: remover o `await refetch()` após o mutate
- A invalidação de queries já acontece no `onSuccess` do mutation (`queryClient.invalidateQueries`)
- O `refetch` redundante causa double-fetch e mais latência

### 3. `src/hooks/useRoutes.ts` — Nenhuma mudança necessária

O mutation já faz `queryClient.invalidateQueries` no `onSuccess`, o que é suficiente para eventual consistency.

## Fluxo após correção

```text
Usuário arrasta item    → UI atualiza INSTANTANEAMENTE (localOrders)
                        → DB update roda em background
                        → Se falhar: reverte localOrders + toast de erro
                        → Se OK: invalidateQueries atualiza dados do servidor
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Estado local otimista para reordenamento instantâneo |
| `src/pages/RouteDetails.tsx` | Remover `await refetch()` redundante no reorder |

