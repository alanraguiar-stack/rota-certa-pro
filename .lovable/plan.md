

# Fix: Busca não encontra entregas — Guard contra null + debug

## Causa raiz

A função `normalizeText` em `TruckRouteEditor.tsx` não tem guard contra `null`/`undefined`. Se qualquer pedido tiver `client_name` ou `address` nulo (o campo `address` pode ser null em `pending_orders`, e o `order` object pode vir com campos undefined do join), o `useMemo` lança uma exceção silenciosa e retorna array vazio — "Nenhuma entrega encontrada" para qualquer busca.

Além disso, o campo `address` no tipo Order pode não conter o endereço completo que o usuário espera — pode estar em campos separados como `city`, `neighborhood`, etc.

## Correção em `src/components/route/TruckRouteEditor.tsx`

1. **Guard null em `normalizeText`**: adicionar `if (!text) return ''` no início da função

2. **Expandir campos de busca**: além de `client_name` e `address`, buscar também em `city`, `neighborhood` e `pedido_id` (se disponíveis no objeto Order)

3. **Log de debug temporário**: adicionar `console.log` no `searchMatches` para validar quantos trucks/orders estão sendo pesquisados (remover depois de confirmar)

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Guard null no normalizeText, expandir campos de busca |

