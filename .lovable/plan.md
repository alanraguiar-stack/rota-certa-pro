

# Plano: Substituir Drag-and-Drop Nativo por @dnd-kit

## Problema
O drag-and-drop atual usa a API nativa do HTML5 (`draggable`, `onDragStart`, `onDragOver`, `onDrop`), que é notoriamente problemática:
- Sem feedback visual real durante o arraste (mostra uma "imagem fantasma" feia)
- Difícil acertar a zona de drop em listas longas com scroll
- Não funciona em mobile/touch
- O handle pequeno (GripVertical) exige precisão de clique

## Solução: @dnd-kit
Biblioteca moderna e leve para React, com suporte nativo a:
- **Sortable lists** com animação suave
- **Touch support** (mobile)
- **Overlay visual** que acompanha o cursor durante o arraste
- **Keyboard accessibility** (reordenar com teclado)
- **Scroll automático** quando arrasta para bordas do container

## Mudanças

### 1. Instalar @dnd-kit
```
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. Refatorar `TruckTabContent` (componente interno do TruckRouteEditor)
- Envolver a lista de orders com `DndContext` + `SortableContext`
- Cada `OrderCard` vira um `useSortable` item
- Adicionar `DragOverlay` para mostrar o card sendo arrastado com visual limpo
- Remover toda a lógica manual de `draggedOrderId`, `dropTargetIndex`, `onDragStart/Over/Drop/End`

### 3. Refatorar `OrderCard`
- Remover props `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`, `isDragTarget`
- Usar `useSortable()` internamente para listeners e transform
- O handle (GripVertical + número) vira o `activator` do sortable
- Card inteiro recebe animação de deslocamento suave

### 4. Manter botões ↑↓ como alternativa
Os botões de subir/descer continuam funcionando como fallback.

## Resultado esperado
- Arraste fluido com animação de deslocamento dos outros cards
- Overlay visual mostrando o card sendo movido
- Funciona em touch/mobile
- Handle maior e mais fácil de agarrar

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Substituir drag nativo por @dnd-kit sortable |

