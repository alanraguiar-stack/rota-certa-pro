

# Garantir que caminhoes ancora sejam SELECIONADOS (nao apenas recomendados)

## Problema

O `useEffect` atual em `IntelligentFleetPanel.tsx` so auto-seleciona os caminhoes recomendados quando `selectedTruckIds.length === 0`. Se o algoritmo de peso ja selecionou alguns caminhoes antes do campo `city` estar disponivel, os caminhoes ancora (como CYR) aparecem apenas com o badge "Recomendado" mas nao ficam marcados com o checkbox.

## Solucao

Modificar o `useEffect` no `IntelligentFleetPanel.tsx` para garantir que os caminhoes ancora estejam SEMPRE incluidos na selecao, mesmo que ja existam outros caminhoes selecionados.

### Arquivo: `src/components/route/IntelligentFleetPanel.tsx` (linhas 70-79)

Substituir a logica atual do useEffect por:

```text
useEffect:
  1. Se nenhum caminhao selecionado e ha recomendados -> selecionar todos os recomendados (comportamento atual)
  2. Se ja ha caminhoes selecionados -> verificar se todos os caminhoes ancora obrigatorios estao incluidos
     - Extrair cidades dos pedidos (orders)
     - Para cada ANCHOR_RULE com cidade presente nos pedidos, verificar se o caminhao correspondente esta em selectedTruckIds
     - Se algum ancora estiver faltando, adiciona-lo a selecao existente
```

A logica usara as `ANCHOR_RULES` diretamente para detectar quais caminhoes sao obrigatorios com base nas cidades dos pedidos, e forcara sua inclusao na selecao.

### Mudanca especifica

No `useEffect` (linhas 70-79), adicionar um segundo bloco condicional:

- Se `selectedTruckIds.length > 0` e `orders` tem cidades que correspondem a regras ancora, verificar se os caminhoes ancora correspondentes estao em `selectedTruckIds`
- Se nao estiverem, chamar `onSelectionChange` com a uniao de `selectedTruckIds` + IDs dos caminhoes ancora faltantes

Isso garante que o CYR apareca ja com checkbox marcado (selecionado) sempre que houver vendas em Osasco.

| Arquivo | Mudanca |
|---------|---------|
| `src/components/route/IntelligentFleetPanel.tsx` | Expandir useEffect para forcar inclusao de caminhoes ancora na selecao |

