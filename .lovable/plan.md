

# Plano: Corrigir Sequenciamento Intra-Cidade

## O que muda

A função `nearestNeighborWithinCity` em `src/lib/autoRouterEngine.ts` tem um guard que verifica coordenadas reais (`o.latitude && o.longitude`). Como a geocodificação Nominatim foi removida, essa condição nunca é verdadeira — o sistema sempre cai no fallback de ordenação alfabética por CEP/rua.

O algoritmo de nearest-neighbor logo abaixo do guard já usa `estimatedLat/estimatedLng` (que existem para todos os pedidos). Basta remover o guard.

## Impacto

- **Intra-cidade**: sequência passa a seguir proximidade geográfica real em vez de ordem alfabética
- **Inter-cidade (indireto)**: o último ponto de cada cidade fica mais coerente geograficamente, melhorando o "exit point" para a próxima cidade

## Mudança

### `src/lib/autoRouterEngine.ts` — função `nearestNeighborWithinCity`

Remover as linhas 1365-1373 (o bloco `hasRealCoords` + fallback):

```typescript
// REMOVER:
const hasRealCoords = orders.some(o => o.latitude && o.longitude);
if (!hasRealCoords) {
  orders.sort((a, b) => sortWithinCity(a, b));
  streetGroupSweep(orders);
  return;
}
```

O algoritmo nearest-neighbor que já existe nas linhas 1375-1421 assume o controle para todos os casos, usando as coordenadas estimadas.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Remover fallback alfabético (6 linhas), nearest-neighbor passa a ser usado sempre |

