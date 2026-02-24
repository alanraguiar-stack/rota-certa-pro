

# Reestruturacao: Logica Territorial por Volume de Cidade

## Problema Atual

O motor atual usa "corredores regionais" com Jaccard similarity, o que causa dois problemas graves:

1. **Force merge (linhas 571-584)**: quando ha mais clusters que caminhoes, forca a uniao de clusters incompativeis, gerando caminhoes com 5-9 cidades misturadas
2. **Corredores sao muito permissivos**: o Jaccard threshold (0.35) permite misturas amplas demais, e a logica de "corredor" trata multiplas cidades como um bloco unico

O usuario quer uma logica mais simples e deterministica: **cidade como unidade primaria, volume como criterio, encaixe inteligente so com vizinhas**.

## Nova Logica (5 Etapas)

```text
ETAPA 1: Agrupar pedidos por cidade, normalizar nomes
ETAPA 2: Ordenar cidades por volume (pedidos + peso)
ETAPA 3: Alocar caminhoes exclusivos por cidade (maior volume primeiro)
         - Se cidade precisa de N caminhoes, dividir em N blocos
ETAPA 4: Encaixe inteligente - cidades pequenas vao para caminhoes com sobra
         - SO se forem vizinhas geograficamente
         - SO se houver co-ocorrencia historica
         - Nunca intercalar na sequencia
ETAPA 5: Sequenciamento interno por cidade > CEP > bairro > rua
         - Todas entregas da mesma cidade em bloco continuo
         - PROIBIDO alternar cidades na sequencia
```

## Arquivos a Modificar

### 1. `src/lib/autoRouterEngine.ts` - Reescrever clustering e sequenciamento

**Reescrever `buildCorridorClusters` -> `buildCityFirstClusters`**

Nova logica:

- Agrupar todos pedidos por cidade
- Ordenar cidades por: quantidade de pedidos (desc), peso total (desc)
- Para cada cidade em ordem:
  - Calcular quantos caminhoes precisa (peso / capacidade)
  - Criar cluster(s) exclusivo(s) para essa cidade
  - Dividir pedidos por proximidade ao CD se precisar de multiplos caminhoes
- Apos todas as cidades principais alocadas:
  - Para cada cluster com sobra de capacidade (>15% livre):
    - Buscar cidades pequenas NAO alocadas
    - Verificar se a cidade pequena e vizinha (usando `areCitiesNeighbors`)
    - Verificar co-ocorrencia historica (se disponivel)
    - Se ambos ok E cabe no peso: encaixar
    - Senao: deixar como cluster proprio (sub-utilizado)
- **Remover completamente o force merge** (linhas 571-584)
- Se sobram mais clusters que caminhoes E nao ha merge compativel: marcar como nao atribuidos com aviso

**Reescrever `optimizeDeliverySequence`**

Nova logica de sequenciamento:

- Primeiro: agrupar pedidos por cidade (bloco continuo por cidade)
- Ordenar cidades dentro do caminhao: a mais proxima do CD primeiro (ou mais distante, conforme estrategia)
- Dentro de cada bloco de cidade: ordenar por CEP (5 primeiros digitos), depois por bairro, depois por rua
- **Validacao**: verificar que nao ha alternancia de cidades na sequencia final

**Atualizar `validateComposition`**

Adicionar verificacao de:
- Alternancia de cidades na sequencia de entregas
- Mais de 2 cidades nao-vizinhas no mesmo caminhao (sem historico)

### 2. `src/lib/historyPatternEngine.ts` - Simplificar validacao

**Manter `isValidCityCombination`** mas simplificar:
- Se as cidades sao vizinhas: permitir
- Se tem co-ocorrencia historica > 0: permitir
- Caso contrario: bloquear

**Manter `getCityExclusionMap`** sem alteracao (ja funciona corretamente)

### 3. `src/components/route/AutoCompositionView.tsx` - Feedback territorial

- Exibir cidade principal do caminhao em destaque
- Se houver cidade complementar, mostrar como "complemento" com badge diferente
- Alertas de validacao: "Alternancia de cidades na sequencia" e "Mistura sem coerencia territorial"
- Bloquear confirmacao se houver violacao

### 4. `src/pages/NewRoute.tsx` - Sem mudanca estrutural

- Manter integracao existente com `extractedPatterns`
- A validacao ja e chamada via `autoComposeRoute`

## Regras Implementadas

| Regra | Como |
|-------|------|
| Cidade como entidade primaria | Clusters exclusivos por cidade |
| Volume como prioridade | Cidades ordenadas por qtd pedidos + peso |
| Encaixe so com vizinhas | `areCitiesNeighbors` + historico |
| Sequencia sem alternancia | Blocos continuos por cidade, CEP interno |
| Bloqueio de rota ruim | Validacao automatica pre-confirmacao |
| Sem force merge | Pedidos ficam nao atribuidos se nao couberem |

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/autoRouterEngine.ts` | Reescrever clustering (cidade-primeiro), sequenciamento (cidade>CEP>bairro), remover force merge |
| `src/lib/historyPatternEngine.ts` | Simplificar validacao de combinacao |
| `src/components/route/AutoCompositionView.tsx` | Feedback visual territorial, bloquear alternancia |

