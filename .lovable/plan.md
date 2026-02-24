

# Reestruturacao do Motor de Roteirizacao - Logica Territorial Rigida

## Problema Atual

O motor atual tem dois defeitos graves:

1. **`assignClustersToTrucks`** usa bin-packing generico: ao atribuir clusters a caminhoes, ele escolhe "o caminhao com mais espaco", quebrando a integridade territorial. Um cluster de Barueri pode ser dividido entre 2 caminhoes junto com pedidos de Osasco.

2. **Complemento de vizinhas sem restricao**: na camada 3.5, cidades pequenas sao adicionadas sem verificar se o peso total cabe no caminhao, causando misturas indevidas.

3. **Sem validacao de bloqueio**: nao existe verificacao antes de confirmar se a composicao respeita os padroes historicos.

## Solucao

Reescrever as funcoes criticas para impor logica territorial rigida: **uma cidade por caminhao, esgotando volume antes de passar para a proxima**.

### Arquivo 1: `src/lib/autoRouterEngine.ts`

**Reescrever `clusterOrdersByCity`** - Nova logica:

```text
1. Agrupar TODOS os pedidos por cidade
2. Ordenar cidades por volume (maior primeiro)
3. Para cada cidade (em ordem):
   a. Se o volume cabe em 1 caminhao -> 1 cluster exclusivo
   b. Se precisa de N caminhoes -> dividir em N clusters (mesma cidade)
   c. Marcar como alocada
4. Sobra controlada (SOMENTE se historico permitir):
   a. Para cada cluster com espaco sobrando
   b. Verificar se historico tem combinacao permitida
   c. Se sim E cabe no peso -> adicionar cidade pequena
   d. Se nao -> deixar o espaco vazio (melhor vazio que misturado)
5. Orfas SEM historico -> cluster proprio (mesmo que sub-utilizado)
```

**Reescrever `assignClustersToTrucks`** - Nova logica:

```text
Em vez de bin-packing generico:
1. Cada cluster ja representa 1 caminhao logico
2. Mapear cluster[0] -> truck[0], cluster[1] -> truck[1]...
3. Ordenar: cluster mais pesado -> caminhao com mais capacidade
4. Respeitar capacidade como limite rigido
5. NUNCA mover pedidos entre clusters para "otimizar"
```

**Adicionar `validateComposition`** - Nova funcao:

```typescript
function validateComposition(
  compositions: TruckComposition[],
  historyHints?: RoutingHint[]
): { valid: boolean; violations: string[] }
```

Verifica:
- Quantas cidades distintas em cada caminhao
- Se a mistura e historicamente permitida
- Se ainda existem cidades nao alocadas
- Gera lista de violacoes para exibir ao usuario

### Arquivo 2: `src/lib/historyPatternEngine.ts`

**Adicionar `getCityExclusionMap`** - Retorna pares de cidades que NUNCA devem ficar juntas (co-ocorrencia < 10% no historico):

```typescript
export function getCityExclusionMap(
  patterns: ExtractedPatterns
): Map<string, Set<string>>
```

**Adicionar `isValidCityCombination`** - Verificacao rapida:

```typescript
export function isValidCityCombination(
  cities: string[],
  patterns: ExtractedPatterns
): { valid: boolean; reason: string }
```

### Arquivo 3: `src/components/route/AutoCompositionView.tsx`

**Adicionar exibicao de cidades por caminhao**: Cada card de caminhao mostra as cidades que contem, com destaque visual se houver mistura fora do padrao.

**Adicionar validacao visual**: Se a composicao tiver violacoes, exibir alerta vermelho e bloquear o botao "Confirmar e Criar Rota" com mensagem:

```
"Rota incoerente com padrao operacional historico"
```

### Arquivo 4: `src/pages/NewRoute.tsx`

**Integrar validacao**: Antes de permitir `handleCreateRoute`, executar `validateComposition`. Se houver violacoes, bloquear e mostrar as razoes.

## Regras Rigidas Implementadas

| Regra | Implementacao |
|-------|--------------|
| Uma cidade por caminhao | Cluster exclusivo por cidade |
| Esgotar volume antes de passar | Cidade so "libera" quando todos pedidos alocados |
| Mistura so com historico | `isValidCityCombination` antes de complementar |
| Bloqueio de rota ruim | `validateComposition` impede confirmacao |
| Explicacao da decisao | Campo `reasoning` em cada cluster |

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/autoRouterEngine.ts` | Reescrever `clusterOrdersByCity` e `assignClustersToTrucks`, adicionar `validateComposition` |
| `src/lib/historyPatternEngine.ts` | Adicionar `getCityExclusionMap` e `isValidCityCombination` |
| `src/components/route/AutoCompositionView.tsx` | Exibir cidades por caminhao, bloquear confirmacao se houver violacoes |
| `src/pages/NewRoute.tsx` | Integrar validacao antes de criar rota |

