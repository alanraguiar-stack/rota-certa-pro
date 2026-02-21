

# Corrigir Distribuicao e Roteamento: Logica de Vizinhanca entre Cidades

## Problema Central

Analisando os roteiros historicos do seu analista, identifiquei dois problemas no sistema atual:

### 1. Distribuicao (qual pedido vai para qual caminhao)
O sistema distribui cidades entre caminhoes apenas por **balanceamento de peso**. Resultado: um caminhao pode receber Osasco + Caieiras (distantes), enquanto o ideal seria Osasco + Carapicuiba (vizinhas).

### 2. Sequenciamento (ordem das entregas)
O sistema agrupa **rigidamente** por nome de cidade. Mas o analista pensa em **continuidade geografica**: se um bairro de Sao Paulo (Jd D'Abril) fica na divisa com Osasco, ele coloca esse endereco no meio da rota de Osasco, nao separado em um bloco "Sao Paulo".

## O que o Analista Faz (aprendido dos documentos)

**Caminhao EEF (18/02):**
```text
Barueri (CD)       → vizinha ao CD
Santana de Parnaiba → vizinha ao norte
Sao Paulo (zona oeste) → continua ao norte/nordeste
Caieiras           → continuidade norte
```
Rota linear: CD → norte → nordeste. Sem retornos.

**Caminhao CYR (19/02):**
```text
Osasco (Padroeira, Conceicao) → proximo ao CD
Sao Paulo (Jd D'Abril, Jd Ester) → DIVISA com Osasco
Osasco (Adalgisa → Rochdale → Portal D'Oeste) → continua Osasco
Barueri (Parque Imperial, Jd Mutinga) → volta ao CD
```
O analista **nao separa rigidamente por cidade**. Ele insere bairros de SP no meio de Osasco porque sao vizinhos geograficamente.

## Solucao: Mapa de Adjacencia de Cidades + Roteamento por Proximidade Real

### Mudanca 1: Mapa de Vizinhanca entre Cidades

Criar um grafo de adjacencia que define quais cidades sao vizinhas. Isso permite ao sistema:
- Ao distribuir pedidos para caminhoes, manter cidades vizinhas juntas
- Ao tracar rotas, conectar cidades formando um caminho continuo

```text
Barueri ←→ Osasco ←→ Sao Paulo (zona oeste)
Barueri ←→ Carapicuiba ←→ Jandira ←→ Itapevi
Barueri ←→ Santana de Parnaiba ←→ Cajamar ←→ Caieiras
Barueri ←→ Cotia ←→ Vargem Grande Paulista
```

### Mudanca 2: Distribuicao por Regiao Geografica (nao por peso)

Em vez de jogar cidades para o caminhao com menos peso, o sistema vai:
1. Identificar "regioes" de cidades vizinhas
2. Atribuir uma regiao inteira a um caminhao
3. So dividir uma regiao se exceder a capacidade

Exemplo: Osasco + Carapicuiba + SP zona oeste = uma regiao para um caminhao.

### Mudanca 3: Sequenciamento por Proximidade Real (nao por nome de cidade)

Em vez de "todas as entregas de Osasco, depois todas de SP", o sistema vai:
1. Partir do CD (Barueri)
2. Ir para o endereco mais proximo do ultimo ponto
3. Se o proximo endereco mais proximo for de outra cidade vizinha, ir para la
4. Continuar ate completar todas as entregas

Isso replica o comportamento do analista de inserir bairros de SP no meio de Osasco quando sao geograficamente proximos.

## Detalhes Tecnicos

### Arquivo 1: `src/lib/geocoding.ts`

Adicionar mapa de adjacencia de cidades:

```text
CITY_NEIGHBORS = {
  'barueri': ['osasco', 'carapicuiba', 'jandira', 'santana de parnaiba', 'cotia'],
  'osasco': ['barueri', 'carapicuiba', 'sao paulo', 'taboao da serra'],
  'carapicuiba': ['barueri', 'osasco', 'jandira', 'cotia'],
  ...
}
```

Adicionar funcao `areCitiesNeighbors(cityA, cityB)` e `getNeighborCities(city)`.

### Arquivo 2: `src/lib/distribution.ts`

Reescrever `clusterByCityProximity`:
- Construir grafo de cidades presentes nos pedidos
- Usar BFS/DFS a partir do CD para criar "regioes" de cidades conectadas
- Distribuir regioes para caminhoes por capacidade
- Se uma regiao excede a capacidade de um caminhao, dividir no ponto mais distante

### Arquivo 3: `src/lib/routing.ts`

Alterar `optimizeDeliveryOrder`:
- Remover o agrupamento rigido por nome de cidade
- Usar nearest-neighbor puro com bonus forte para:
  - Mesmo bairro: 70% desconto na distancia
  - Mesma rua: 85% desconto
  - Mesma cidade: 30% desconto
  - Cidade vizinha: 15% desconto
- Isso permite que o algoritmo "cruze" a fronteira entre cidades vizinhas quando faz sentido geografico

### Arquivo 4: `src/lib/autoRouterEngine.ts`

Atualizar `clusterOrdersByCity` para usar a mesma logica de regioes vizinhas do `distribution.ts`.

## Resultado Esperado

Para o caminhao CYR com pedidos de Osasco + Barueri + SP:

```text
 1. Osasco - Padroeira (proximo ao CD)
 2. Osasco - Padroeira
 3. Osasco - Conceicao
 4. Sao Paulo - Jd D'Abril (divisa com Osasco - vizinho!)
 5. Sao Paulo - Jd Ester (proximo ao anterior)
 6. Osasco - Adalgisa (volta pela proximidade)
 7. Osasco - Vila Yara
 8. Osasco - Pres. Altino
 9. Osasco - Rochdale
10. Osasco - Rochdale
...
20. Barueri - Pq Imperial (volta ao CD)
```

Exatamente como o analista faria.

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/geocoding.ts` | Adicionar `CITY_NEIGHBORS`, `areCitiesNeighbors()`, `getNeighborCities()` |
| `src/lib/distribution.ts` | Reescrever clustering para usar regioes de cidades vizinhas |
| `src/lib/routing.ts` | Remover agrupamento rigido por cidade, usar nearest-neighbor com bonus de vizinhanca |
| `src/lib/autoRouterEngine.ts` | Atualizar clustering para usar mesma logica de regioes |

