

# Plano: Corrigir Drag-and-Drop no Editor de Rotas

## Problemas Identificados

### 1. Área de arraste muito pequena
O `draggable` está apenas no ícone de grip (16×16px + 0.5 padding). É muito difícil clicar e segurar com precisão. O HTML5 Drag API em ícones tão pequenos falha frequentemente em navegadores.

### 2. Bug de sequência no drag-and-drop (off-by-one)
Ao arrastar um item **para baixo**, o cálculo envia `newSequence + 1` que resulta em valor fora do range. Exemplo: arrastar do index 0 para o index 3 em 4 itens → envia `newSequence = 5`, mas o máximo deveria ser 4.

### 3. Falta de feedback visual durante o arraste
Não há `setDragImage` nem indicador claro de "onde vai soltar". O `isDragTarget` existe mas sem visual forte.

## Correções

### `src/components/route/TruckRouteEditor.tsx`

**A. Expandir área de arraste**: Tornar toda a lateral esquerda do card (grip + número) como zona draggable, aumentando a área de toque de ~20px para ~60px.

**B. Corrigir cálculo de sequência no `handleDragDrop`**:
```
// ANTES (bugado):
const newSequence = targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;
onReorder(truckData.routeTruckId, draggedOrderId, newSequence + 1);

// DEPOIS (correto — sequências 1-indexed):
const newSequence = targetIndex + 1;
onReorder(truckData.routeTruckId, draggedOrderId, newSequence);
```

**C. Melhorar feedback visual**: Adicionar borda indicadora (drop zone) entre os cards durante o arraste, para mostrar exatamente onde o item será inserido.

**D. Adicionar `e.dataTransfer.setData`**: Necessário para alguns navegadores reconhecerem o drag. Sem isso, o drag pode ser silenciosamente ignorado.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Expandir drag handle, corrigir sequência, melhorar feedback, adicionar setData |

