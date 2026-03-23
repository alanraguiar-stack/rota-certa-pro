


# Geocodificação Real + Nearest-Neighbor por Cidade — IMPLEMENTADO

## O que foi feito

### 1. `src/types/index.ts`
- Adicionado `latitude?: number | null` e `longitude?: number | null` ao `ParsedOrder`

### 2. `src/lib/autoRouterEngine.ts`
- Step 1 agora usa coordenadas reais (`order.latitude`/`order.longitude`) quando disponíveis, sobrescrevendo as estimativas por hash
- Nova função `nearestNeighborWithinCity(orders, startLat, startLng)` com bônus de mesma rua (×0.15) e bairro (×0.30)
- Fallback automático para sort por CEP quando não há coordenadas reais
- Substituído `sortWithinCity` + `streetGroupSweep` por `nearestNeighborWithinCity` em todos os pontos de sequenciamento
- Cidade âncora: ponto de partida = CD
- Cidades fill: ponto de partida = última posição do bloco anterior

### 3. `src/pages/NewRoute.tsx`
- Geocodificação automática via Nominatim (com cache) executada após upload e antes do `autoComposeRoute`
- Progress bar visível na etapa de validação (`GeocodingProgress`)
- Coordenadas reais injetadas nos `ParsedOrder` antes da composição

### O que NÃO mudou
- Territórios e atribuição cidade→caminhão
- Agrupamento por cidade dentro do caminhão
- Priority neighborhoods e insertion rules
- Rebalanceamento e fallback distribution
