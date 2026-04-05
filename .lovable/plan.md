

# Plano: Aprendizado Automático ao Bloquear + Proteger Caminhões Bloqueados

## O que será feito

### 1. Salvar snapshot automaticamente ao bloquear caminhão
Quando o usuário clica "Bloquear", o sistema salva imediatamente a sequência atual daquele caminhão em `route_history_patterns` com `was_manually_moved = true` para todos os pedidos. Sem botão extra.

**Arquivo:** `src/pages/RouteDetails.tsx` — `handleLockTruck`

### 2. Não re-otimizar caminhões bloqueados ao confirmar
No `handleConfirmAllRoutesAndProceed`, o `optimizeRoutes` atualmente re-otimiza TODOS os caminhões. Precisamos passar os IDs bloqueados para que o mutation os pule.

**Arquivo:** `src/pages/RouteDetails.tsx` — passar `lockedTruckIds` ao chamar optimize
**Arquivo:** `src/hooks/useRoutes.ts` — `optimizeRoutesMutation` receber lista de truck IDs a pular (skip locked trucks no loop da linha 659)

## Resumo técnico

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | `handleLockTruck`: salvar snapshot ao banco imediatamente; `handleConfirmAllRoutesAndProceed`: passar lockedTruckIds ao optimize |
| `src/hooks/useRoutes.ts` | `optimizeRoutesMutation`: aceitar `excludeTruckIds` e pular esses trucks no loop de otimização |

