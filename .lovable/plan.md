

# Revisão Completa do Sistema — Pente Fino e Otimizações

## Problemas Identificados

### 1. **N+1 Queries no `useRouteDetails`** (Performance crítica)
Na linha 190-224 de `useRoutes.ts`, para cada `route_truck`, é feita uma query individual ao banco para buscar `order_assignments`. Com 5 caminhões, são 5 queries separadas. Isso pode ser consolidado em uma única query.

### 2. **`optimizeRoutesMutation` faz updates sequenciais** (Lentidão)
Nas linhas 546-564, para cada assignment de cada caminhão, é feito um `UPDATE` individual ao banco. Com 100 pedidos, são 100+ queries sequenciais. Isso deve ser batched.

### 3. **`distributeLoadMutation` também faz updates sequenciais** (Lentidão)
Nas linhas 434-461, deletes e inserts são feitos um por um para cada route_truck. Pode ser consolidado.

### 4. **`reorderSingleDelivery` faz N updates individuais** (Lentidão)
Nas linhas 974-997, cada assignment recebe um update individual. Para mover 1 pedido em um caminhão com 20 entregas, podem ser até 20 queries.

### 5. **Lock/Unlock de rotas não persiste** (Bug funcional)
Nas linhas 1019-1042, `lockTruckRoute` e `unlockTruckRoute` apenas retornam objetos sem persistir no banco. O estado de lock é perdido ao recarregar a página.

### 6. **`autoComposeRoute` é chamado DUAS vezes** (Desperdício)
Uma vez em `NewRoute.tsx` (linha 89) durante o upload, e novamente em `distributeLoadMutation` (linha 421) ao distribuir carga na `RouteDetails`. A segunda chamada ignora o resultado da primeira.

### 7. **`calculateRecommendedTrucks` no RouteDetails é redundante**
Nas linhas 182-199, existe uma implementação manual de recomendação de frota que já é feita pelo `IntelligentFleetPanel` no wizard.

## Plano de Otimização

### Mudança 1: Batch queries no `useRouteDetails` (`src/hooks/useRoutes.ts`)
- Substituir o `Promise.all` com N queries individuais por UMA query que busca todos os `order_assignments` da rota de uma vez
- Agrupar os resultados por `route_truck_id` em memória
- **Impacto**: Reduz de N+1 para 1 query (onde N = número de caminhões)

### Mudança 2: Batch updates no `optimizeRoutesMutation` (`src/hooks/useRoutes.ts`)
- Ao invés de fazer 1 UPDATE por assignment, coletar todos os updates e executar com `Promise.all` em lotes de 50
- Ou melhor: usar uma edge function/RPC que recebe o array completo e faz o update no servidor
- **Abordagem pragmática**: Agrupar em `Promise.all` com chunks para paralelizar

### Mudança 3: Batch updates no `distributeLoadMutation` (`src/hooks/useRoutes.ts`)
- Consolidar deletes: já deleta por `route_truck_id` (OK)
- Consolidar inserts: juntar todos os assignments de todos os caminhões num único insert
- Consolidar updates de `route_trucks`: usar `Promise.all`

### Mudança 4: Batch `reorderSingleDelivery` (`src/hooks/useRoutes.ts`)
- Coletar todos os updates de sequence e executar em paralelo com `Promise.all`

### Mudança 5: Remover execução duplicada do `autoComposeRoute`
- Passar o resultado da composição automática do wizard para o `RouteDetails` via `location.state`
- No `distributeLoadMutation`, usar o resultado pré-computado se disponível, evitando recálculo

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRoutes.ts` | Batch queries (assignments), batch updates (optimize, distribute, reorder) |
| `src/pages/NewRoute.tsx` | Passar `autoResult` no state de navegação |
| `src/pages/RouteDetails.tsx` | Receber e usar `autoResult` pré-computado |

