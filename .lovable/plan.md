

# Sequenciamento Progressivo a partir do CD para o Caminhão de Barueri

## Problema

O sequenciamento atual dentro da cidade âncora ordena por **CEP > bairro > rua** (alfabético), ignorando a distância real ao galpão. Resultado: a primeira entrega pode ser longe do CD, forçando deslocamento desnecessário.

## Solução

Alterar `optimizeDeliverySequence` em `src/lib/autoRouterEngine.ts` para que, **na cidade âncora do caminhão**, o critério principal de ordenação seja **distância ao CD (ascendente)** — começa perto do galpão e vai se afastando progressivamente.

Manter o agrupamento por rua (street grouping sweep) para evitar zigue-zague entre ruas próximas.

## Mudanças

### `src/lib/autoRouterEngine.ts`

1. **Novo sort para cidade âncora** — Substituir `sortWithinCity` por um sort baseado em `distanceFromCD` (ascendente) quando os pedidos pertencem à cidade âncora do caminhão. O agrupamento por rua continua ativo via `streetGroupSweep`.

2. **Manter sort atual para cidades de fill** — Cidades complementares (Cotia, Vargem Grande Paulista, etc.) continuam com o sort por CEP > bairro > rua.

3. **Lógica concreta**: No loop da linha ~843, ao processar a `cityGroup` que corresponde à `anchorCity`, ordenar por `distanceFromCD` ascendente em vez de `sortWithinCity`. Depois aplicar `streetGroupSweep` normalmente.

### `src/lib/routing.ts`

Nenhuma mudança necessária — o `nearestNeighborWithProximityBonuses` já é usado apenas no fluxo de otimização pós-distribuição, não afeta o sequenciamento inicial.

## Resultado esperado

Caminhão de Barueri: sai do galpão (Av. Iracema, Jardim Iracema) → primeira entrega é a mais próxima → segue progressivamente se afastando → entregas de fill cities por último.

