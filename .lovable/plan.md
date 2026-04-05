

# Plano: Aprendizado de Sequenciamento Manual

## Problema Atual

Hoje o sistema tem 3 lacunas no aprendizado:

1. **Reordenamentos dentro do caminhão não são rastreados** — Quando você move um pedido de posição 5 para posição 2, o `was_manually_moved` não é marcado (só marca quando move entre caminhões)
2. **`was_manually_moved` é salvo no banco mas nunca lido** — O `historyPatternEngine` ignora completamente essa flag
3. **O motor aprende agrupamento de cidades, mas não sequência de bairros** — Ele sabe que "Osasco + Carapicuíba vão juntas" mas não sabe que "KM 18 deve vir antes de Bonfim"

## Solução: Aprendizado de Sequência por Bairro

### 1. Rastrear reordenamentos manuais (`RouteDetails.tsx`)

No `handleReorderInTruck`, adicionar o orderId ao `manuallyMovedOrderIds` — assim tanto movimentos entre caminhões quanto reordenamentos internos são marcados.

### 2. Criar motor de aprendizado de sequência (`historyPatternEngine.ts`)

Nova função `extractNeighborhoodSequencePatterns` que:
- Lê os patterns com `was_manually_moved = true` (peso 2x) e normais (peso 1x)
- Para cada cidade, extrai a ordem relativa dos bairros: "Bairro A veio antes de Bairro B em X rotas"
- Gera um grafo de precedência por cidade (ex: `km 18 → quitauna → bonfim → umuarama`)

Adiciona ao `ExtractedPatterns`:
```
neighborhoodSequences: Map<string, string[]>  // cidade → bairros ordenados
```

### 3. Aplicar sequência aprendida no motor de roteamento (`autoRouterEngine.ts`)

No `optimizeDeliverySequence`, após agrupar pedidos por cidade:
- Consultar `neighborhoodSequences` para a cidade
- Se existe sequência aprendida, usar como critério de ordenação primário (antes do nearest-neighbor)
- Pedidos de bairros com posição definida no histórico são sequenciados conforme o padrão aprendido
- Pedidos de bairros novos (sem histórico) são encaixados por nearest-neighbor entre os bairros conhecidos

### 4. Dar peso dobrado a movimentos manuais

No `extractNeighborhoodSequencePatterns`, quando um pedido tem `was_manually_moved = true`, a relação de precedência entre seus bairros vizinhos conta com peso 2x, acelerando o aprendizado.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | Marcar `manuallyMovedOrderIds` também em reordenamentos internos |
| `src/lib/historyPatternEngine.ts` | Nova função `extractNeighborhoodSequencePatterns` + adicionar ao `ExtractedPatterns` |
| `src/hooks/useHistoryPatterns.ts` | Passar `was_manually_moved` na query SELECT |
| `src/lib/autoRouterEngine.ts` | Usar `neighborhoodSequences` como critério primário na ordenação intra-cidade |

