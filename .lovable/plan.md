

# Plano: Mostrar Endereço Completo nos Cards de Entrega

## Problema
O endereço está com `truncate` (CSS `text-overflow: ellipsis`), cortando o texto em uma única linha. Em endereços longos, informações importantes como cidade e CEP ficam ocultas.

## Correção

**Arquivo:** `src/components/route/TruckRouteEditor.tsx`

1. **Remover `truncate` do parágrafo de endereço** (linha 174) — permitir que o texto quebre em múltiplas linhas naturalmente.
2. **Manter `truncate` no nome do cliente** (linha 169) — nomes de clientes longos podem continuar truncados pois são menos críticos.
3. Trocar layout do header do card de `flex items-center justify-between` para permitir que o endereço ocupe o espaço necessário com `break-words`.

Resultado: o endereço será exibido por completo, podendo ocupar 2 linhas quando necessário, sem cortar informações.

