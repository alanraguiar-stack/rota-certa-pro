

# Plano: Remover Pré-Seleção de Caminhões no Upload

## Problema

Na linha 202-205 de `NewRoute.tsx`, após o `autoComposeRoute`, os caminhões usados na composição são automaticamente selecionados via `setSelectedTruckIds(usedTruckIds)`. Isso faz com que ao chegar no step de frota, os caminhões já apareçam marcados.

## Mudança

### `src/pages/NewRoute.tsx`

Remover as linhas 202-205 que fazem `setSelectedTruckIds(usedTruckIds)`. O `autoResult` continua sendo calculado (pode ser útil internamente), mas a seleção visual fica vazia para escolha manual.

