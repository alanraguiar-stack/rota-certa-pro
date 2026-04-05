

# Plano: Aprendizado Contínuo em Toda Alteração Manual

## Problema Atual
O sistema só salva padrões no banco em dois momentos: ao bloquear caminhão e ao confirmar rotas. O usuário quer que **cada reordenamento ou movimentação** gere aprendizado imediato.

## Solução

### 1. Salvar snapshot do caminhão após cada alteração manual
Após cada `handleReorderInTruck` e `handleOrderMoveToTruck`, salvar automaticamente o snapshot completo do(s) caminhão(ões) afetado(s) em `route_history_patterns`, com `was_manually_moved = true` para o pedido movido.

Para evitar duplicatas no banco (múltiplas edições na mesma sessão), a lógica será: **deletar patterns existentes para aquele truck_label + route_date antes de inserir os novos**. Assim cada snapshot sobrescreve o anterior, mantendo sempre o estado mais recente.

### 2. Debounce para não sobrecarregar o banco
Usar debounce de 2 segundos — se o usuário fizer 5 movimentações rápidas, só o snapshot final é salvo. Isso evita escritas excessivas durante drag-and-drop rápido.

### 3. Remover duplicação do handleLockTruck
O `handleLockTruck` não precisa mais salvar snapshot separadamente, pois o aprendizado contínuo já cobre isso.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | Criar função `savetruckSnapshot` com debounce; chamar após reorder e move; remover snapshot do handleLockTruck |

