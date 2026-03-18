

# Fix: Carga não distribuída — pedido_id inválido no preComputedAutoResult

## Causa raiz

O `preComputedAutoResult` é gerado no wizard (`NewRoute.tsx`) antes dos pedidos serem inseridos no banco de dados. Nesse momento, os `ParsedOrder` não possuem `pedido_id` (é `undefined`) ou possuem IDs temporários que **não correspondem** aos UUIDs gerados pelo banco ao salvar.

Quando `distributeLoadMutation` usa `order_id: o.pedido_id!` (linha 459), o valor é `undefined` ou inválido. O insert no `order_assignments` falha silenciosamente (FK violation) ou insere 0 registros. Resultado: todos os caminhões ficam com 0 entregas.

## Solução

Não usar o `preComputedAutoResult` diretamente para os IDs dos pedidos. Em vez disso, **sempre recomputar** o `autoComposeRoute` dentro do `distributeLoadMutation` usando os pedidos reais do banco (que possuem IDs corretos).

Manter o conceito de "pre-computed" apenas para reutilizar a **estratégia e configuração**, não os dados de pedidos em si. Isso é mais seguro e o custo de performance é desprezível (o engine roda em <100ms para 100 pedidos).

### Mudanças em `src/hooks/useRoutes.ts`

- Remover o branch `if (preComputedResult)` que reutiliza o resultado do wizard
- Sempre recalcular com os pedidos reais do banco de dados
- Manter o error handling no insert para capturar falhas

### Mudanças em `src/pages/RouteDetails.tsx` e `src/pages/NewRoute.tsx`

- Remover passagem e recepção de `preComputedAutoResult` via `location.state`
- Remover state `preComputedAutoResult` no RouteDetails
- Simplifica o código e elimina a fonte do bug

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRoutes.ts` | Remover branch de preComputedResult; sempre recalcular |
| `src/pages/RouteDetails.tsx` | Remover state e uso de preComputedAutoResult |
| `src/pages/NewRoute.tsx` | Remover passagem de autoResult no location.state |

