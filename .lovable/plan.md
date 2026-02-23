

# Motor de Aprendizado com Base Historica do Analista

## Visao Geral

O sistema ja importa e armazena padroes historicos na tabela `route_history_patterns`, mas o motor de roteirizacao (`autoRouterEngine.ts` e `distribution.ts`) **ignora completamente** esses dados. Este plano cria um modulo de inteligencia que extrai padroes das bases historicas e os injeta no processo de composicao automatica.

## Arquitetura

```text
route_history_patterns (DB)
        |
        v
 [historyPatternEngine.ts]  <-- NOVO modulo
   - Extrai padroes de cidade-caminhao
   - Calcula co-ocorrencia de cidades
   - Identifica preferencias de agrupamento
        |
        v
 [autoRouterEngine.ts]  <-- MODIFICADO
   - Recebe padroes como parametro opcional
   - Usa padroes para influenciar clustering
   - Gera explicacoes de decisao
        |
        v
 [NewRoute.tsx]  <-- MODIFICADO
   - Busca padroes do DB antes de roteirizar
   - Passa padroes ao motor
   - Exibe explicacoes ao usuario
```

## Detalhamento Tecnico

### 1. Novo arquivo: `src/lib/historyPatternEngine.ts`

Motor de extracao de padroes a partir dos dados historicos. Funcoes principais:

**`extractCityPatterns(patterns: HistoryRow[])`** - Analisa todos os registros e gera:
- **Mapa de co-ocorrencia**: quais cidades aparecem juntas no mesmo caminhao (ex: "Cotia + Embu = 85% das vezes")
- **Mapa de exclusao**: quais cidades raramente se misturam (ex: "Barueri + Osasco = apenas 5%")
- **Caminhoes por cidade**: quantos caminhoes cada cidade costuma usar (ex: "Osasco = 2 caminhoes em 70% dos casos")
- **Cidades dedicadas**: cidades que quase sempre tem caminhao exclusivo (ex: "Barueri = dedicado em 90%")
- **Ordem de prioridade**: quais cidades sao atribuidas primeiro

**`findSimilarScenario(currentCities, currentWeight, patterns)`** - Compara o cenario atual com cenarios historicos e retorna o mais similar, com score de similaridade.

**`generateRoutingHints(patterns, currentOrders)`** - Retorna sugestoes concretas:
```typescript
interface RoutingHint {
  type: 'dedicate_truck' | 'combine_cities' | 'split_city' | 'priority_order';
  cities: string[];
  confidence: number; // 0-100, baseado em frequencia historica
  reasoning: string;  // Ex: "Em 85% das rotas anteriores, Cotia e Embu ficaram juntas"
}
```

### 2. Modificacao: `src/lib/autoRouterEngine.ts`

**Funcao `autoComposeRoute`** - Adicionar parametro opcional `historyHints`:

```typescript
export function autoComposeRoute(
  orders: ParsedOrder[],
  availableTrucks: Truck[],
  config: Partial<AutoRouterConfig> = {},
  historyHints?: RoutingHint[]  // NOVO
): AutoRouterResult
```

**Funcao `clusterOrdersByCity`** - Modificar a logica de clustering para:

1. **Antes de atribuir cidades grandes**: verificar se o historico sugere cidade dedicada. Se sim e a confianca > 70%, reservar um cluster exclusivo.
2. **Na camada 3.5 (complemento com vizinhas)**: priorizar combinacoes que aparecem no historico. Se "Cotia + Embu" tem 85% de co-ocorrencia, priorizar Embu como complemento de Cotia sobre outras vizinhas.
3. **Na camada 4 (orfas)**: usar o historico para decidir em qual caminhao colocar as orfas (preferir combinacoes historicas).

A logica matematica (capacidade, peso) continua sendo respeitada como limite rigido. O historico apenas influencia a **preferencia** de agrupamento.

**Novo campo no `AutoRouterResult`**:
```typescript
export interface AutoRouterResult {
  // ... campos existentes
  reasoning: string[];  // NOVO - explicacoes das decisoes
}
```

### 3. Modificacao: `src/pages/NewRoute.tsx`

**Ao carregar pedidos** (`handleAutoDataReady`):
1. Buscar padroes do DB (`route_history_patterns`) para o usuario atual
2. Extrair hints via `generateRoutingHints()`
3. Passar hints para `autoComposeRoute()`

**Na UI** (`AutoCompositionView`):
- Exibir as explicacoes de decisao (campo `reasoning`) como cards informativos
- Exemplo: "Esta composicao segue o padrao observado em 80% das rotas anteriores para Barueri"

### 4. Novo hook: `src/hooks/useHistoryPatterns.ts`

Hook para buscar e cachear padroes historicos:
```typescript
export function useHistoryPatterns() {
  // Busca route_history_patterns do usuario
  // Extrai padroes via historyPatternEngine
  // Retorna { hints, isLoading, patternsCount }
}
```

### 5. Aprendizado continuo

**Quando o usuario ajusta manualmente uma rota** (ja existe o fluxo de edicao em `TruckRouteEditor.tsx`):
- Ao confirmar a rota final, salvar a composicao como novo registro em `route_history_patterns`
- Isso acontece automaticamente no fluxo de criacao de rota existente (`handleCreateRoute`)

Nao e necessaria nova tabela -- a tabela `route_history_patterns` ja possui todos os campos necessarios (truck_label, city, sequence_order, client_name, address).

### 6. Limites de seguranca

O motor de padroes respeita limites rigidos:
- Confianca minima de 60% para aplicar um padrao
- Capacidade fisica do caminhao nunca e violada
- Se o cenario atual diverge muito do historico (< 40% similaridade), ignora padroes e usa logica pura
- Padroes com menos de 3 ocorrencias sao ignorados (evita aprender de dados insuficientes)

## Resumo de arquivos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/lib/historyPatternEngine.ts` | CRIAR | Motor de extracao de padroes |
| `src/hooks/useHistoryPatterns.ts` | CRIAR | Hook para buscar padroes do DB |
| `src/lib/autoRouterEngine.ts` | MODIFICAR | Receber e aplicar hints historicos |
| `src/pages/NewRoute.tsx` | MODIFICAR | Integrar padroes no fluxo |
| `src/components/route/AutoCompositionView.tsx` | MODIFICAR | Exibir explicacoes de decisao |

Nenhuma mudanca de schema no banco de dados -- usa a tabela `route_history_patterns` existente.

