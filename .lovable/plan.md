

# Auto-selecionar Caminhoes Ancora com Base nas Cidades dos Pedidos

## Problema

Quando os pedidos contem entregas em Osasco, o caminhao CYR (ancora de Osasco) deveria vir automaticamente selecionado na etapa de frota. O mesmo vale para EUR (Barueri), FKD (Carapicuiba), etc. Atualmente, a recomendacao de frota e puramente baseada em peso/capacidade, ignorando as regras de ancora territorial.

## Solucao

Modificar a logica de recomendacao de frota para detectar as cidades presentes nos pedidos e forcar a inclusao dos caminhoes ancora correspondentes.

### Arquivo 1: `src/components/route/IntelligentFleetPanel.tsx`

- Adicionar prop `orders: ParsedOrder[]` na interface do componente
- Passar `orders` para `analyzeFleetRequirements`

### Arquivo 2: `src/lib/routeIntelligence.ts`

- Alterar `analyzeFleetRequirements` para receber um parametro opcional `orders: ParsedOrder[]`
- Extrair as cidades presentes nos pedidos (normalizadas)
- Para cada cidade encontrada, verificar se existe um caminhao ancora (`ANCHOR_RULES`) correspondente na frota disponivel
- Se existir, forcar sua inclusao na lista `recommendedTrucks` ANTES do algoritmo de bin-packing por peso
- Adicionar raciocinio explicativo: "Pedidos em Osasco detectados -> CYR-9829 incluido obrigatoriamente"

### Arquivo 3: `src/pages/NewRoute.tsx`

- Passar `orders` como prop para `IntelligentFleetPanel`

## Logica Detalhada

```text
1. Extrair cidades unicas dos pedidos (order.city normalizado)
2. Para cada ANCHOR_RULE:
   - Se anchorCity esta nas cidades dos pedidos
   - E existe um caminhao na frota com platePrefix correspondente
   - Adicionar esse caminhao como "obrigatorio" nos recommendedTrucks
3. Depois, preencher capacidade restante com bin-packing normal
4. No reasoning, explicar: "Osasco detectado nos pedidos -> CYR selecionado automaticamente"
```

## Resultado

- Se ha entregas em Osasco, CYR vem pre-selecionado
- Se ha entregas em Barueri, EUR vem pre-selecionado
- Se ha entregas em Carapicuiba, FKD vem pre-selecionado
- EEF entra se necessario por capacidade ou se suas cidades proprias estao presentes
- O usuario ainda pode desmarcar manualmente se quiser

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/routeIntelligence.ts` | `analyzeFleetRequirements` recebe `orders`, detecta cidades, forca caminhoes ancora |
| `src/components/route/IntelligentFleetPanel.tsx` | Nova prop `orders`, passa para `analyzeFleetRequirements` |
| `src/pages/NewRoute.tsx` | Passa `orders` para `IntelligentFleetPanel` |
