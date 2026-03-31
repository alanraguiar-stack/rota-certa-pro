

# Plano Consolidado: Reestruturação em 3 Etapas + Transição Fluida entre Cidades

## Resumo

Dois ajustes combinados no motor de roteirização (`autoRouterEngine.ts`):

1. **Reestruturação em 3 etapas claras** — separar organização, sequenciamento e alocação
2. **Transição fluida entre cidades** — a próxima cidade é escolhida pela proximidade do último ponto, não por distância média ao CD

## O que muda na prática

```text
FLUXO ATUAL (entrelaçado):
  Agrupa por cidade → Aloca nos caminhões → Sequencia depois

FLUXO NOVO (linear):
  ETAPA 1: Agrupa por cidade (caixas)
  ETAPA 2: Sequencia cada caixa internamente (bairro → rua → proximidade)
  ETAPA 3: Aloca nos caminhões respeitando peso/capacidade
           Se não cabe → remove do FINAL da lista (mais distantes)
           → redireciona para apoio ou outro caminhão
  VALIDAÇÃO: Bloqueia se pedido ficou sem caminhão ou peso excedido
```

```text
TRANSIÇÃO ENTRE CIDADES (atual vs novo):

ATUAL:  Cidades ordenadas por distância média ao CD
        → Salto geográfico possível entre última entrega de A e primeira de B

NOVO:   Após sequenciar cidade A, pegar coordenadas da ÚLTIMA entrega
        → Escolher próxima cidade = a que tem entrega mais próxima desse ponto
        → Sequenciar cidade B começando pelo ponto mais próximo da saída de A
```

## Mudanças técnicas

### Arquivo: `src/lib/autoRouterEngine.ts`

**1. Função `autoComposeRoute` — reestruturar em 3 etapas:**

- **Etapa 1** (já existe, linhas 217-228): Agrupar por cidade — mantém como está
- **Etapa 2** (NOVO — antes da alocação): Para cada cidade, sequenciar internamente usando `nearestNeighborWithinCity` + `streetGroupSweep`. Resultado: `Map<cidade, pedidos_ordenados[]>`
- **Etapa 3** (refatorar linhas 256-581): Alocar pedidos já sequenciados nos caminhões. Quando exceder peso/capacidade, remover do **final** da lista (são os mais distantes do CD). Excedentes vão para apoio
- **Validação final**: Se restarem pedidos não alocados → `validation.valid = false` com mensagem bloqueante

**2. Função `optimizeDeliverySequence` (linhas 1054-1230) — transição fluida:**

Substituir o sort estático de cidades (linhas 1108-1113) por seleção dinâmica:

```text
1. Cidade âncora = primeira (sem mudança)
2. Sequenciar cidade âncora do CD
3. Pegar coordenadas da ÚLTIMA entrega
4. Entre cidades restantes: escolher a que tem pedido mais PRÓXIMO desse ponto
5. Sequenciar essa cidade começando desse ponto (nearestNeighborWithinCity já aceita fromLat/fromLng)
6. Repetir até acabar as cidades
```

O código nas linhas 1174-1179 já faz o passo 5 (usar `fromLat/fromLng` da última entrega). O que falta é o passo 4 — escolher a próxima cidade dinamicamente em vez de usar sort por `avgDist`.

### O que NÃO muda
- Interfaces (`AutoRouterResult`, `TruckComposition`) — idênticas
- `nearestNeighborWithinCity`, `streetGroupSweep` — intactos
- `mergeItemsIntoOrders`, `recommendTrucks`, `getRoutingSummary` — intactos
- `PlateOverride`, regras de território — mantidos
- Nenhum outro arquivo é afetado

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Reordenar fluxo (sequenciar ANTES de alocar) + nearest-neighbor inter-cidades em `optimizeDeliverySequence` |

