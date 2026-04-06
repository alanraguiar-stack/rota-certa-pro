

# Plano: Substituir drag-and-drop por botões simples de reordenamento

## Problema
O @dnd-kit está colocando itens no lugar errado durante o arraste. Em listas longas com scroll, a detecção de colisão frequentemente erra a posição final.

## Solução: Remover drag-and-drop completamente
Manter apenas os **botões ↑↓** que já existem e funcionam perfeitamente, e adicionar um **campo numérico de posição** para saltos grandes (ex: mover item 15 para posição 3).

### Mudanças concretas

1. **Remover @dnd-kit** do `TruckTab` — sem `DndContext`, `SortableContext`, `DragOverlay`, `useSortable`
2. **Remover `SortableOrderCard`** — usar `OrderCardContent` diretamente
3. **Remover drag handle** (GripVertical) — não tem mais arraste
4. **Adicionar campo de posição editável** — ao lado do número da sequência, clicar nele abre um input numérico onde o usuário digita a nova posição e o item se move instantaneamente
5. **Manter botões ↑↓** como estão — já funcionam corretamente

### UX do campo de posição
- O número da sequência (círculo azul "1", "2", etc.) vira clicável
- Ao clicar, abre um mini-input numérico no lugar
- Digitar novo número + Enter = mover para aquela posição
- Escape ou blur = cancelar

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Remover toda lógica @dnd-kit; adicionar input de posição editável no OrderCardContent |

