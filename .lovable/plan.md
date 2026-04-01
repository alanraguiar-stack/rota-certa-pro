

# Plano: Remover Auto-Seleção e Badges de Recomendação

## Problema

O `useEffect` nas linhas 99-112 do `IntelligentFleetPanel.tsx` aplica automaticamente a recomendação quando nenhum caminhão está selecionado. Além disso, os badges "Recomendado" e o destaque visual (`ring-2`) aparecem nos caminhões sugeridos.

## Mudanças

### `src/components/route/IntelligentFleetPanel.tsx`

1. **Remover o `useEffect` de auto-aplicação** (linhas 99-112) — o `hasAutoApplied` ref e o efeito que chama `onSelectionChange` automaticamente
2. **Remover o badge "Recomendado"** (linhas 352-359) — o `Badge` com ícone `Sparkles`
3. **Remover o destaque visual de recomendado** (linha 348) — o `ring-2 ring-primary/30` condicional
4. **Remover a variável `isRecommended`** (linha 338) — não será mais usada

Todos os caminhões ficam com aparência uniforme, sem pré-seleção nem sugestão visual. O operador escolhe manualmente.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/IntelligentFleetPanel.tsx` | Remover auto-seleção, badges e destaque de recomendação |

