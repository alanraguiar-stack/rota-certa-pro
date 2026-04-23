

# Adicionar botão "Limpar Todas" no pop-up de Vendas Despriorizadas

## Problema

No acesso da Caroline (e qualquer operador), ao iniciar uma nova rota aparece o pop-up **"Vendas Despriorizadas Disponíveis"** listando vendas que ficaram para trás de roteirizações anteriores. Algumas dessas vendas **já foram entregues hoje em outra rota** (lançadas manualmente em outro fluxo), mas continuam aparecendo no pop-up porque permanecem com status `deprioritized` na tabela `pending_orders`.

Hoje, as únicas saídas do diálogo são:
- **Ignorar** → fecha o pop-up, mas as vendas voltam a aparecer na próxima rota
- **Incluir Selecionada(s)** → adiciona à rota atual

Falta uma forma de **descartar definitivamente** as vendas que já não são mais relevantes.

## Solução

Adicionar um terceiro botão no `DeprioritizedOrdersDialog`: **"Limpar todas"** (ou as selecionadas, se houver seleção), que marca as vendas escolhidas como `cancelled` em `pending_orders`. Essas vendas deixam de aparecer em qualquer pop-up futuro, mas ficam preservadas no histórico do banco (não são deletadas).

### Comportamento do novo botão

- **Sem seleção** → botão diz **"Limpar todas (N)"** e remove todas as N vendas do pop-up
- **Com seleção** → botão diz **"Limpar selecionadas (X)"** e remove apenas as marcadas
- Mostra um `confirm()` nativo para evitar clique acidental: *"Remover X venda(s) do backlog? Elas não aparecerão mais em rotas futuras."*
- Após confirmar, chama `cancelPending(ids)` (já existe no `usePendingOrders`), fecha o diálogo e dispara um toast de sucesso

### Fluxo

```text
Pop-up "Vendas Despriorizadas"
├─ [Ignorar]                 → fecha (vendas voltam na próxima)
├─ [Limpar todas/seleção]    → cancela no banco (NOVO)
└─ [Incluir Selecionadas]    → adiciona à rota atual
```

## Arquivos editados

- `src/components/route/DeprioritizedOrdersDialog.tsx`
  - Adicionar prop `onClear: (ids: string[]) => Promise<void> | void`
  - Adicionar botão **"Limpar"** no `DialogFooter` (variant `ghost` com cor de aviso)
  - Texto dinâmico baseado em `selectedIds.size`
  - `confirm()` antes de executar
  - Limpar `selectedIds` e fechar o diálogo após sucesso

- `src/pages/NewRoute.tsx`
  - Já importa `cancelPending` indiretamente via `usePendingOrders` — adicionar à desestruturação
  - Implementar `handleDeprioritizedClear(ids)` que chama `cancelPending(ids)`, atualiza `deprioritizedOrders` removendo os limpos e mantém o diálogo aberto se ainda restar algum, ou fecha se a lista ficou vazia
  - Passar `onClear={handleDeprioritizedClear}` para o `DeprioritizedOrdersDialog`

## Resultado

A Caroline (e qualquer operador) poderá, no pop-up de vendas despriorizadas, **eliminar de uma vez** as vendas que já foram entregues por outro caminho, sem precisar incluí-las na rota nem conviver com o pop-up cheio toda vez. As vendas ficam com status `cancelled` no banco — preservadas para auditoria, mas invisíveis nos próximos planejamentos.

