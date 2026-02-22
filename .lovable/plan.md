
# Ajuste da Roteirizacao: Logica Territorial em Camadas com Complemento de Cidades Vizinhas

## O que ja esta implementado e funciona

- Mapa de coordenadas de ~35 cidades (`CITY_COORDINATES`)
- Grafo de adjacencia (`CITY_NEIGHBORS`) com ~30 cidades mapeadas
- Nearest-neighbor com bonus de proximidade (rua 85%, bairro 70%, cidade 30%, vizinha 15%)
- BFS para construir regioes conectadas (`buildCityRegions`)

## Gaps identificados vs. o raciocinio em camadas

| Camada | Status Atual | O que falta |
|--------|-------------|-------------|
| 1. Leitura do territorio | Agrupa por regiao (BFS), nao por cidade individual | Precisa primeiro mapear por cidade, gerar resumo de volume |
| 2. Volume por cidade | Peso somado por regiao inteira | Calcular peso por cidade individual para saber quantos caminhoes cada cidade precisa |
| 3. Caminhao = cidade principal | Joga regiao no caminhao mais leve | Cada caminhao deve ter uma cidade principal atribuida |
| **3.5 Complemento com vizinhas** | **BFS junta TUDO que e conectado numa regiao unica** | **Se o caminhao tem sobra de capacidade, adicionar pedidos de cidades vizinhas que facam sentido geografico - com limite e criterio** |
| 4. Inicio da rota | "Mais proximo do CD" e global | Deve ser relativo a cidade principal do caminhao |
| 5. Rota dentro da cidade | Nearest-neighbor com bonus - OK | Manter, ja funciona bem |
| 6. Modelos de rota | 5 estrategias com nomes tecnicos | Simplificar para 3 modelos claros |

## A logica de complemento com cidades vizinhas (Camada 3.5)

Este e o ponto que o usuario pediu para adicionar. O raciocinio e:

1. Cada caminhao recebe uma **cidade principal** (camada 3)
2. Depois de atribuir a cidade principal, verificar: **sobra capacidade?**
3. Se sim, olhar para as **cidades vizinhas** (do grafo `CITY_NEIGHBORS`) que:
   - Tenham pedidos que ainda nao foram atribuidos a nenhum caminhao
   - Tenham volume pequeno demais para justificar um caminhao proprio (< 30% da capacidade)
   - Sejam geograficamente adjacentes a cidade principal
4. Adicionar esses pedidos ao caminhao, respeitando a capacidade maxima
5. Isso so acontece de forma **complementar** - nunca misturar cidades grandes (cada uma com volume para 1+ caminhao)

Exemplo pratico:
- Caminhao A: cidade principal = Barueri (2.500 kg), capacidade = 4.000 kg
- Sobra: 1.500 kg
- Cidades vizinhas com volume baixo: Santana de Parnaiba (800 kg), Alphaville (400 kg)
- Sistema adiciona Santana de Parnaiba + Alphaville ao caminhao A
- Resultado: Barueri + Santana de Parnaiba + Alphaville = 3.700 kg (92% ocupacao)

Outro exemplo (nao deve misturar):
- Osasco tem 6.000 kg (precisa de 2 caminhoes proprios)
- Nao entra como "complemento" de ninguem

## Plano de implementacao

### Arquivo 1: `src/types/index.ts`

Simplificar `RoutingStrategy` de 5 para 3 modelos:

| Atual | Novo | Comportamento |
|-------|------|--------------|
| `economy`, `speed`, `start_near` | `padrao` | Iniciar pela entrega mais proxima do CD dentro da cidade do caminhao |
| `end_near_cd`, `start_far` | `finalizacao_proxima` | Iniciar pela mais distante, voltar ao CD |
| (novo) | `finalizacao_distante` | Iniciar perto do CD, terminar na mais distante |

Atualizar `ROUTING_STRATEGIES` e `WIZARD_STEPS` com nomes claros em portugues.

### Arquivo 2: `src/lib/distribution.ts`

Reescrever `distributeOrders` com logica em camadas:

**Camada 1 - Leitura do territorio:**
- Agrupar pedidos por cidade individual
- Gerar mapa: `{ cidade -> pedidos[], pesoTotal }`

**Camada 2 - Volume por cidade:**
- Calcular quantos caminhoes cada cidade precisa: `ceil(peso_cidade / capacidade_media_frota)`
- Classificar cidade como "grande" (precisa de 1+ caminhao) ou "pequena" (< 30% capacidade)

**Camada 3 - Atribuicao cidade-caminhao:**
- Ordenar cidades por peso (maior primeiro)
- Cidades grandes: atribuir N caminhoes, dividir pedidos por proximidade interna
- Cidades pequenas: marcar como "disponivel para complemento"

**Camada 3.5 - Complemento com vizinhas:**
- Para cada caminhao com sobra de capacidade:
  - Buscar cidades vizinhas (via `CITY_NEIGHBORS`) que estejam marcadas como "disponivel"
  - Ordenar por proximidade geografica ao centro da cidade principal
  - Adicionar pedidos ate preencher a capacidade ou esgotar vizinhas disponiveis
  - Marcar cidade como "atribuida" ao ser adicionada

**Camada 4 - Pedidos orfaos:**
- Cidades pequenas que nao foram absorvidas por nenhum vizinho
- Agrupar entre si por adjacencia e atribuir ao caminhao com mais espaco

### Arquivo 3: `src/lib/routing.ts`

- `optimizeDeliveryOrder`: adicionar parametro opcional `primaryCity` para contexto do caminhao
- No modelo `padrao`: "mais proximo do CD" filtrado pela cidade principal do caminhao
- No modelo `finalizacao_proxima`: iniciar pela mais distante do CD dentro das cidades do caminhao
- Manter nearest-neighbor com bonus de proximidade (ja funciona bem)

### Arquivo 4: `src/lib/autoRouterEngine.ts`

- Alinhar `clusterOrdersByCity` com a mesma logica de camadas do `distribution.ts`
- Usar a mesma logica de complemento com vizinhas

### Arquivo 5: `src/components/route/RoutingStrategySelector.tsx`

- Atualizar para mostrar os 3 novos modelos com nomes e descricoes em portugues
- Icones: Compass (Padrao), Home (Finalizacao proxima ao CD), ArrowUpRight (Finalizacao distante)
- Manter layout existente de cards selecionaveis

## Fluxo completo do algoritmo

```text
ENTRADA: Pedidos + Frota

CAMADA 1 - TERRITORIO
  Agrupar pedidos por cidade
  Resultado: { barueri: [p1,p2], osasco: [p3,p4,p5,...], ... }

CAMADA 2 - VOLUME
  barueri: 2.500 kg (1 caminhao, cidade pequena)
  osasco: 6.000 kg (2 caminhoes, cidade grande)
  santana: 800 kg (0 caminhoes, disponivel para complemento)
  carapicuiba: 1.200 kg (0 caminhoes, disponivel para complemento)

CAMADA 3 - ATRIBUICAO
  Caminhao 1 -> Osasco bloco A (3.200 kg)
  Caminhao 2 -> Osasco bloco B (2.800 kg)
  Caminhao 3 -> Barueri (2.500 kg)

CAMADA 3.5 - COMPLEMENTO VIZINHAS
  Caminhao 2 (Osasco, sobra 1.200 kg):
    -> Carapicuiba e vizinha de Osasco e cabe? Sim -> adicionar
  Caminhao 3 (Barueri, sobra 1.500 kg):
    -> Santana de Parnaiba e vizinha e cabe? Sim -> adicionar

CAMADA 4 - ORFAOS
  (nenhum neste exemplo)

RESULTADO FINAL:
  Caminhao 1: Osasco A (3.200 kg)
  Caminhao 2: Osasco B + Carapicuiba (4.000 kg)
  Caminhao 3: Barueri + Santana (3.300 kg)
```

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/types/index.ts` | Simplificar RoutingStrategy de 5 para 3 modelos |
| `src/lib/distribution.ts` | Reescrever com logica em camadas + complemento de vizinhas |
| `src/lib/routing.ts` | Adicionar contexto de cidade principal ao sequenciamento |
| `src/lib/autoRouterEngine.ts` | Alinhar com mesma logica de camadas |
| `src/components/route/RoutingStrategySelector.tsx` | Atualizar opcoes para 3 modelos |
