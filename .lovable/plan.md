

# Plano: Corrigir Alerta Falso de "Distribuição Inconsistente"

## Problema

A condição na linha 502-503 do `RouteDetails.tsx` inclui `trucks_assigned` na lista de status que disparam o alerta:

```typescript
const isInconsistent = (isZero || isPartial) && 
  (route.status === 'loading' || route.status === 'distributed' || 
   route.status === 'loading_confirmed' || route.status === 'trucks_assigned');
```

O status `trucks_assigned` é o estado **normal** logo após selecionar caminhões e **antes** de rodar a distribuição. Nesse momento, é esperado que não haja assignments. O alerta só deveria aparecer quando o status já avançou para `loading` ou além, mas os assignments estão faltando.

Dados da rota atual confirmam:
- Status: `trucks_assigned` (correto — distribuição ainda não foi executada)
- 64 pedidos, 0 assignments (esperado neste estágio)
- Capacidade total: 10.050kg vs peso total: 5.702kg (sobra de capacidade)

## Solução

### `src/pages/RouteDetails.tsx`

Remover `'trucks_assigned'` da condição do alerta. O alerta só aparece quando o status é `loading`, `distributed` ou `loading_confirmed` mas os assignments estão zerados ou incompletos — indicando uma inconsistência real.

```typescript
const isInconsistent = (isZero || isPartial) && 
  (route.status === 'loading' || route.status === 'distributed' || 
   route.status === 'loading_confirmed');
```

Uma linha alterada, zero risco de efeito colateral.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | Remover `trucks_assigned` da condição do alerta de inconsistência |

