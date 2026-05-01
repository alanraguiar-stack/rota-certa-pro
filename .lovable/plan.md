## Movimentação em massa de vendas entre caminhões

Adicionar um modo de seleção múltipla no editor manual de rotas (`TruckRouteEditor`) que permite escolher várias entregas de um caminhão e transferi-las de uma só vez para outro, com seleção inteligente por cidade/bairro e validação de capacidade.

### Como vai funcionar (visão do usuário)

1. **Botão "Selecionar"** no cabeçalho de cada caminhão (ao lado de "Confirmar Rota") ativa o modo de seleção daquele caminhão.
2. Ao ativar, cada entrega ganha um **checkbox** à esquerda e os controles individuais (setas ↑↓, número de posição, botão "Mover para") ficam **ocultos** para evitar poluição visual.
3. Uma **barra de ações fixa no rodapé do caminhão** aparece mostrando:
   - Quantas entregas selecionadas + peso total selecionado.
   - Botões: **Selecionar tudo**, **Limpar seleção**, **Selecionar mesma cidade** (abre menu listando as cidades presentes; clicar marca todas as vendas daquela cidade), **Selecionar mesmo bairro** (mesma lógica).
   - Dropdown **"Mover para..."** listando os outros caminhões. Cada opção mostra placa + peso/ocupação resultante. Caminhões que **não comportam** o lote (peso > capacidade ou entregas > `max_deliveries`) ficam desabilitados com aviso "não cabe (Xkg / Y entregas)".
   - Botão **Cancelar** sai do modo seleção.
4. Ao confirmar a movimentação:
   - Atualização otimista: as vendas somem do caminhão de origem e aparecem no destino imediatamente.
   - As chamadas ao backend são feitas **sequencialmente** (uma `onOrderMove` por venda) para não criar conflitos de reindexação.
   - Toast de sucesso com resumo: "5 entregas movidas para ABC-1234".
   - Em caso de erro no meio do processo: rollback do estado local + toast de erro listando quais ficaram pendentes.
5. **Caminhões confirmados (locked)** não permitem ativar seleção nem aparecem como destino.

### Seleção inteligente

- **Por cidade**: agrupa as vendas pela cidade normalizada (lowercase + sem acentos) e oferece um item por cidade no menu (ex.: "Barueri (8)", "Cotia (3)").
- **Por bairro**: extraído via regex do `address` (substring após "Bairro:" ou penúltimo segmento antes da cidade) — fallback silencioso se não detectado.
- **Inverter seleção** e **Limpar** sempre disponíveis.

### Validação de capacidade do destino

Antes de habilitar cada destino no dropdown:
```
pesoSelecionado = soma de weight_kg das vendas marcadas
caberPeso     = (destino.totalWeight + pesoSelecionado) <= destino.capacity_kg
caberEntregas = (destino.orders.length + selecionadas) <= (destino.max_deliveries ?? 25)
podeMover     = caberPeso && caberEntregas && !destino.isLocked
```

### Mudanças técnicas

Arquivo único: `src/components/route/TruckRouteEditor.tsx`

- **Novos estados** dentro de `TruckTab`:
  - `selectionMode: boolean`
  - `selectedIds: Set<string>`
- **Novo componente** `BulkActionBar` (rodapé sticky do caminhão) com os botões e o dropdown de destino.
- **Ajuste no `OrderCard`**: aceita props opcionais `selectionMode`, `isSelected`, `onToggleSelect`. Quando `selectionMode` é true, renderiza `Checkbox` no canto esquerdo e oculta `MoveToTruck`/setas/input de posição.
- **Novo handler** `handleBulkMove(toTruckId)`:
  1. Snapshot de `localOrders` para rollback.
  2. Remove otimisticamente os `selectedIds` do `localOrders`.
  3. `for (const id of selectedIds) await onOrderMove(id, fromTruckId, toTruckId, 999);`
  4. Em sucesso: limpa seleção, sai do modo, toast resumo. Em falha: restaura snapshot e mostra toast com IDs falhos.
- **Helpers de agrupamento**: `groupByCity(orders)` e `groupByNeighborhood(orders)` usando `normalizeText`.
- O modo seleção é **automaticamente desligado** quando o caminhão é confirmado (lock) ou quando `localOrders` muda externamente de forma significativa.

### Fora do escopo

- Drag-and-drop entre caminhões (continua via dropdown).
- Mover entre caminhões já confirmados.
- Persistir o modo seleção entre navegações.
