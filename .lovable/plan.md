

# Plano: Remover Recomendações de Frota — Manter Apenas Seleção Manual

## Mudança

No componente `FleetRecommendation.tsx`, remover toda a seção de "Recomendações Inteligentes" (cards com sugestões automáticas de combinação de caminhões) e manter apenas a seleção manual com checkboxes.

## Arquivo: `src/components/route/FleetRecommendation.tsx`

- Remover as funções de cálculo: `calculateFleetRecommendations`, `findEfficientCombination`, `findBalancedCombination`, `findDeliveryOptimizedCombination` (linhas 27-156)
- Remover o state `recommendations` e o `useMemo` (linhas 178-180)
- Remover o bloco JSX de recomendações (linhas 199-243) — os cards com "Recomendado", "Opção 2", etc.
- Remover `handleApplyRecommendation` (linhas 196-198)
- Remover imports não utilizados: `Sparkles`, `Progress`, `Badge`, `FleetRecommendation as FleetRecommendationType`
- Manter: seleção manual com checkboxes, resumo de capacidade, botão de confirmar
- A lista de caminhões começa expandida por padrão (`showAllTrucks` default `true`)

