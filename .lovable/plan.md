

# Plano: Geocodificação Real + Nearest-Neighbor por Cidade

## Contexto

A mudança de sequenciamento (nearest-neighbor) **não afeta** a divisão de cidades/territórios nem o agrupamento por caminhão. Ela atua apenas na ordenação DENTRO de cada bloco de cidade já atribuído.

Porém, aplicar nearest-neighbor com coordenadas falsas (hash) seria contraproducente. O plano correto é em duas etapas.

## Etapa 1: Forçar geocodificação antes do sequenciamento

### `src/pages/NewRoute.tsx` / fluxo de criação de rota

- Após importar pedidos e antes de rodar `autoComposeRoute`, verificar quantos pedidos têm `geocoding_status != 'success'`
- Se houver pedidos sem coordenadas reais, rodar `geocodeOrders` automaticamente (já existe o hook `useGeocoding`)
- Mostrar progresso da geocodificação no wizard (componente `GeocodingProgress` já existe)
- Só prosseguir para distribuição após geocodificação concluída

### `src/lib/autoRouterEngine.ts`

- No `optimizeDeliverySequence`, checar se o pedido tem `latitude/longitude` reais (não estimados)
- Se sim: usar coordenadas reais no nearest-neighbor
- Se não: manter fallback por CEP sort (comportamento atual)

## Etapa 2: Nearest-neighbor dentro de cada cidade

### `src/lib/autoRouterEngine.ts`

Nova função `nearestNeighborWithinCity(orders, startLat, startLng)`:
- Nearest-neighbor puro com bônus de mesma rua (×0.15) e mesmo bairro (×0.30)
- Usado no `optimizeDeliverySequence` para CADA bloco de cidade
- Cidade âncora: ponto de partida = CD
- Cidades fill: ponto de partida = última posição do bloco anterior

### O que NÃO muda

| Componente | Status |
|---|---|
| Territórios e atribuição cidade→caminhão | Intacto |
| Agrupamento por cidade dentro do caminhão | Intacto |
| Ordem dos blocos de cidade (âncora → fills) | Intacto |
| Priority neighborhoods e insertion rules | Intacto |
| Rebalanceamento entre caminhões | Intacto |
| Fallback distribution (Step 5d.5) | Intacto |

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | `nearestNeighborWithinCity` + integração no `optimizeDeliverySequence` |
| `src/pages/NewRoute.tsx` | Forçar geocodificação antes de roteirizar |

