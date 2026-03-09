

# Reduzir seleção excessiva de caminhões + Remover regra CYR fixa

## Problemas Identificados

1. **CYR fixo em Osasco**: Não existe mais no código — já foi substituído por `TRC1Z00`. As referências "CYR" restantes são apenas texto de exemplo no `RouteHistoryImporter.tsx` (placeholder de input), não afetam a lógica.

2. **Seleção excessiva de caminhões**: Dois problemas combinados:
   - `assignTrucksToTerritories` atribui um caminhão ao território **Apoio** sempre (pois `isSupport: true` pula a verificação de cidade), mesmo quando não há pedidos em cidades exclusivas de apoio.
   - `analyzeFleetRequirements` seleciona todos os âncoras E depois continua adicionando caminhões para cobrir peso restante, duplicando a seleção.
   - O `useEffect` do `IntelligentFleetPanel` força inclusão de âncoras mesmo quando já estão na recomendação, causando loop de re-seleção.

## Mudanças

### 1. `src/lib/routeIntelligence.ts` — `analyzeFleetRequirements`

- Após selecionar âncoras, **não adicionar caminhões extras** se a capacidade dos âncoras já cobre o peso com margem. Atualmente isso já é feito (linhas 176-193), mas o cálculo `remainingWeight` está subtraindo da `totalWeightWithMargin` (peso + 10%), quando os caminhões âncora geralmente têm capacidade de sobra.
- Incluir o caminhão de **Apoio** na recomendação **somente se** existirem pedidos em cidades exclusivas de apoio (SP, Taboão, Santana de Parnaíba, Pirapora) que não são cobertas por nenhum território âncora.

### 2. `src/lib/anchorRules.ts` — `assignTrucksToTerritories`

- Para o território de apoio (`isSupport: true`), verificar se existem cidades nos pedidos que pertencem ao `allowedFillCities` do apoio e que **não são cobertas** por nenhum outro território. Só atribuir caminhão de apoio se houver pedidos "órfãos".

### 3. `src/components/route/IntelligentFleetPanel.tsx` — Simplificar useEffect

- Remover o Caso 2 (forçar âncoras) — a recomendação já inclui os âncoras corretos. O useEffect duplo estava causando expansão infinita da seleção.

### 4. `src/components/route/RouteHistoryImporter.tsx` — Atualizar placeholder

- Mudar placeholder "CYR" para texto genérico (cosmético).

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Apoio só recebe caminhão se houver pedidos órfãos |
| `src/lib/routeIntelligence.ts` | Não adicionar extras além dos âncoras quando capacidade é suficiente |
| `src/components/route/IntelligentFleetPanel.tsx` | Remover useEffect que força âncoras (redundante) |
| `src/components/route/RouteHistoryImporter.tsx` | Placeholder "CYR" → genérico |

