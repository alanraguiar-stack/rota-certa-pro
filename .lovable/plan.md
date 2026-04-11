

# Fix: Orders lost due to premature sessionStorage clear + ADV upload error

## Root cause

There are **two bugs**:

### Bug 1: Orders never persisted (root cause of "Rota sem pedidos")
In `RouteDetails.tsx` lines 298-311, `sessionStorage.removeItem('pendingOrders')` is called immediately after parsing, **before** checking if `route` is loaded. On first render, `route` is null (still fetching), so:
1. sessionStorage is read and cleared
2. `route` is null → the `addOrders.mutate` block is skipped
3. When `route` loads and the effect re-runs, sessionStorage is already empty
4. Orders are permanently lost

### Bug 2: Unhelpful error when ADV uploaded without orders
The `reimportItems` mutation throws "Rota sem pedidos" which is cryptic. The ADV upload section should detect this state and guide the user.

## Fix

### File: `src/pages/RouteDetails.tsx`

1. **Move `sessionStorage.removeItem` to AFTER successful `addOrders`** — only clear once orders are confirmed persisted in the database. Read from sessionStorage on every effect run until `addOrders` succeeds.

2. **Improve ADV upload error handling** — when `route.orders.length === 0`, show a clear message: "Esta rota ainda não tem pedidos. Primeiro adicione os pedidos do Vendas do Dia antes de importar o detalhamento." instead of the generic error toast.

### File: `src/hooks/useRoutes.ts`

3. **Improve `reimportItems` error message** — change "Rota sem pedidos" to "Esta rota não possui pedidos cadastrados. Importe primeiro o relatório 'Vendas do Dia'."

## Changes summary

```text
RouteDetails.tsx useEffect:
  BEFORE: parse → clear sessionStorage → check route → mutate
  AFTER:  parse (keep in sessionStorage) → check route → mutate → clear sessionStorage on success

ADVUploadSection:
  Add check: if route has 0 orders, show info message instead of upload button

useRoutes.ts reimportItems:
  Better error message
```

## Result
- Orders will reliably persist even if `route` takes time to load
- ADV upload section shows clear guidance when orders are missing
- Existing routes with 0 orders get actionable error messages

