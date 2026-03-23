

# Fix: Pedidos Não Distribuídos + Detecção de Atribuição Parcial

## Causa Raiz

Dois problemas combinados:

### Problema 1: Pedidos órfãos no autoComposeRoute
A rota tem 58 pedidos mas apenas 3 caminhões (EUK5J26, FDK8A66, TRC1Z00). O motor de territórios tem 6 territórios (Barueri, Osasco, Carapicuíba, Jandira, Embu, Apoio). Com 3 caminhões, apenas 3 territórios recebem caminhão. Os outros territórios (Jandira, Embu, Apoio) ficam sem caminhão e seus pedidos **nunca são atribuídos**.

O Step 5c (non-territory trucks) deveria pegar esses pedidos, mas a lista `nonTerritoryTrucks` está vazia — todos os 3 caminhões já foram usados nos territórios.

Cidades não atribuídas na rota atual: Embu(5), São Paulo(5), Caieiras(3), Itapevi(2), Santana de Parnaíba(2), Jandira(1), Pirapora do Bom Jesus(1) = **19 pedidos perdidos**.

### Problema 2: Card de recuperação não aparece
A condição do alerta de inconsistência é `!hasAssignments` — mas a rota TEM 39 assignments. O card só aparece quando há ZERO assignments. **Atribuição parcial** (39 de 58) não é detectada.

## Solução

### Mudança 1: `src/lib/autoRouterEngine.ts` — Fallback para pedidos órfãos

Após o Step 5d (consolidação) e antes do Step 5e (rebalanceamento), adicionar um **Step 5d.5: Fallback distribution**:
- Coletar todos os pedidos que não foram atribuídos a nenhum caminhão
- Distribuir por nearest-fit nos caminhões que ainda têm capacidade (peso e entregas)
- Priorizar caminhões com cidades vizinhas ao pedido órfão
- Se nenhum caminhão tem capacidade, o pedido vai para `unassignedOrders` com warning explícito

### Mudança 2: `src/pages/RouteDetails.tsx` — Detecção de atribuição parcial

Substituir a condição `!hasAssignments` por detecção inteligente:
- Calcular `totalAssigned` (soma de assignments de todos os route_trucks)
- Comparar com `route.total_orders`
- Se `totalAssigned > 0 && totalAssigned < route.total_orders`: mostrar card "Distribuição incompleta" com botão "Redistribuir Cargas"
- Manter o card existente para `totalAssigned === 0`

### Mudança 3: `src/hooks/useRoutes.ts` — Bloquear avanço com pedidos não atribuídos

No `distributeLoadMutation`, após o insert de assignments:
- Comparar total de assignments inseridos com total de pedidos da rota
- Se não baterem, adicionar warning no toast mas **não avançar status para 'loading'** — manter em 'trucks_assigned' para forçar redistribuição
- Logar detalhadamente quais pedidos ficaram de fora e porquê

### Mudança 4: Card de redistribuição sempre visível

No `RouteDetails.tsx`, na etapa `distribute_load` e `loading_manifest`:
- Se houver pedidos não atribuídos, mostrar card com lista das cidades/pedidos faltantes
- Botão "Redistribuir Cargas" que chama `distributeLoad.mutateAsync()` novamente

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Step 5d.5: fallback distribution para pedidos órfãos |
| `src/pages/RouteDetails.tsx` | Detecção de atribuição parcial + card de redistribuição |
| `src/hooks/useRoutes.ts` | Bloquear avanço de status quando há pedidos não atribuídos |

