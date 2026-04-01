

# Plano: Reforçar Transição Suave Entre Cidades

## Problema

O fallback nearest-neighbor em `routing.ts` aplica apenas 30% de desconto para mesma cidade (`×0.70`), o que é insuficiente — se uma entrega de outra cidade estiver geograficamente perto, o algoritmo salta para lá antes de terminar a cidade atual, quebrando a continuidade.

Quando o ORS está ativo, ele lida bem com isso (distâncias reais de direção). Mas no fallback, o problema persiste.

## Mudança

### `src/lib/routing.ts` — `nearestNeighborWithProximityBonuses`

Reforçar os bônus para garantir que o algoritmo **esgote** todas as entregas da cidade atual antes de trocar:

| Relação | Atual | Novo |
|---|---|---|
| Mesma rua | ×0.15 | ×0.10 |
| Mesmo bairro | ×0.30 | ×0.20 |
| **Mesma cidade** | **×0.70** | **×0.35** |
| Cidade vizinha | ×0.85 | ×0.80 |

O desconto de 65% para mesma cidade torna praticamente impossível o algoritmo pular para outra cidade enquanto houver entregas pendentes na cidade atual. Apenas quando a distância real for mais de 3× maior é que ele consideraria trocar — o que quase nunca acontece dentro de um município.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/routing.ts` | Ajustar 4 multiplicadores no `nearestNeighborWithProximityBonuses` |

