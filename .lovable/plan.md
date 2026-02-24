
# Reestruturacao do Motor: Corredores Regionais do Analista

## Diagnostico

Analisei todas as 302 entregas historicas em 5 datas diferentes (10/02, 16/02, 18/02, 19/02, 23/02) e o resultado da rota atual.

### O que o analista FAZ (dados reais do banco):

O analista **sempre mistura cidades** - todo caminhao tem 2 a 7 cidades. Porem, ele segue **corredores regionais fixos**:

```text
CORREDOR OSASCO (CYR):
  Osasco (nucleo) + Sao Paulo (zona oeste) + Barueri (poucas)
  Aparece em 5/5 rotas historicas

CORREDOR CARAPICUIBA (FKD/EKH):
  Carapicuiba (nucleo) + Jandira + Osasco (fronteira) + Barueri (poucas)
  Aparece em 3/5 rotas

CORREDOR OESTE (OUTRO/ROTEI):
  Jandira + Itapevi + Cotia + Vargem Grande Paulista + Barueri
  Aparece em 2/5 rotas

CORREDOR NORTE (EEF):
  Santana de Parnaiba + Cajamar + Caieiras + Sao Paulo (Perus) + Barueri
  Aparece em 3/5 rotas

CORREDOR SUL (EFF):
  Embu + Taboao da Serra + Pirapora + Santana de Parnaiba + Barueri
  Aparece em 1/5 rotas
```

Barueri aparece em TODOS os caminhoes porque e a cidade do CD -- sempre tem 1-6 entregas de passagem.

### O que o sistema faz ERRADO:

A rota atual (c7c5a9ff) tem o caminhao DHS-4318 com: Cotia, Sao Paulo, Jandira, Carapicuiba, Itapevi, Osasco, Embu, Santana de Parnaiba, Barueri = **9 cidades misturadas sem logica regional**.

O motor atual impoe "uma cidade por caminhao" que e o OPOSTO do que o analista faz. E quando precisa consolidar (por falta de caminhoes), mistura aleatoriamente.

## Solucao

Substituir a logica "uma cidade por caminhao" por **corredores regionais** extraidos diretamente do historico do analista.

### Arquivo 1: `src/lib/historyPatternEngine.ts`

**Adicionar `extractRegionalCorridors`** - Nova funcao principal:

Analisa o historico e identifica corredores recorrentes:
- Agrupa por truck_label + route_date
- Para cada caminhao em cada rota, registra o conjunto de cidades
- Identifica quais conjuntos de cidades se repetem
- Extrai a **cidade nucleo** (mais entregas) e as **cidades satelite**
- Retorna templates de corredor com score de confianca

```typescript
interface RegionalCorridor {
  id: string;                    // ex: "osasco-core"
  coreCity: string;              // ex: "osasco"
  satelliteCities: string[];     // ex: ["sao paulo", "barueri", "carapicuiba"]
  frequency: number;             // quantas vezes apareceu
  avgDeliveries: number;         // media de entregas por corredor
  confidence: number;            // 0-100
}
```

**Adicionar `matchOrdersToCorridor`** - Dado um conjunto de pedidos, encontra qual corredor historico melhor se encaixa:
- Calcula Jaccard similarity entre cidades do pedido e cidades do corredor
- Retorna o corredor mais similar com score

### Arquivo 2: `src/lib/autoRouterEngine.ts`

**Reescrever `buildTerritorialClusters`** completamente:

Nova logica em 5 passos:

1. **Agrupar pedidos por cidade** (manter)
2. **Buscar corredores historicos** via `extractRegionalCorridors`
3. **Para cada corredor disponivel**: puxar TODAS as entregas das cidades daquele corredor ate encher a capacidade do caminhao
4. **Pedidos restantes**: tentar encaixar em corredores com espaco OU criar corredor novo baseado em proximidade geografica
5. **Barueri como hub**: entregas de Barueri sao distribuidas proporcionalmente entre os caminhoes (nunca um caminhao so de Barueri)

A regra de "uma cidade por caminhao" e REMOVIDA.
A regra de validacao com `isValidCityCombination` e AJUSTADA para validar por corredor (permitir misturas que o analista faz).

**Remover logica de "dedicated cities"** que impede misturas validas.

### Arquivo 3: `src/lib/historyPatternEngine.ts`

**Ajustar `isValidCityCombination`**: Em vez de rejeitar qualquer mistura sem co-ocorrencia, verificar se as cidades formam um corredor historico valido. Cidades que aparecem juntas em pelo menos 1 rota historica sao permitidas.

**Ajustar `getCityExclusionMap`**: So excluir pares que NUNCA apareceram juntos E que estao em corredores opostos (ex: Caieiras nunca aparece com Cotia).

### Arquivo 4: `src/components/route/AutoCompositionView.tsx`

**Atualizar validacao visual**: Mostrar o nome do corredor regional em cada card de caminhao (ex: "Corredor Osasco", "Corredor Oeste") em vez de apenas listar cidades. Manter o bloqueio de confirmacao apenas para misturas que nao existem em NENHUM corredor historico.

### Arquivo 5: `src/pages/NewRoute.tsx`

Passar os corredores extraidos para o motor de composicao.

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/historyPatternEngine.ts` | Adicionar `extractRegionalCorridors`, `matchOrdersToCorridor`; ajustar validacao |
| `src/lib/autoRouterEngine.ts` | Reescrever `buildTerritorialClusters` com logica de corredores regionais |
| `src/components/route/AutoCompositionView.tsx` | Exibir nome do corredor e ajustar validacao |
| `src/pages/NewRoute.tsx` | Integrar corredores no fluxo |

Nenhuma mudanca de schema no banco de dados.
