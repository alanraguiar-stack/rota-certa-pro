
# Plano: Remover scroll interno da lista de entregas

## Problema
A lista de entregas no `TruckRouteEditor` tem `max-h-[500px] overflow-y-auto`, criando um scroll interno que limita a visualização. O usuário quer ver a rota inteira na página, usando o scroll natural da página.

## Mudança
Remover `max-h-[500px] overflow-y-auto` da div que envolve a lista de `OrderCard` (linha 534), deixando apenas `space-y-2`.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Linha 534: remover `max-h-[500px] overflow-y-auto` |
