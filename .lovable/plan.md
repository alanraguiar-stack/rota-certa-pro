

# Regra fixa TRC1Z00 → Osasco + Exceções de bairro + Sequenciamento Jaguaré após Rochdale

## Mudanças

### 1. Novo campo `fixedPlate` no TerritoryRule (`src/lib/anchorRules.ts`)

Adicionar campo opcional `fixedPlate?: string` na interface `TerritoryRule`. Quando preenchido, o motor reserva esse caminhão específico para o território, ignorando a seleção automática.

**Território Osasco atualizado:**
- `fixedPlate: 'TRC1Z00'`
- Adicionar bairro `imperial` (Barueri) aos `priorityNeighborhoods` (junto com Jardim Mutinga)
- Adicionar exceção de bairro `jaguare` (São Paulo) com `insertAfterNeighborhood: 'rochdale'` — Jaguaré entra logo após Rochdale na sequência
- Remover `jaguare` dos `neighborhoodExceptions` simples e colocá-lo com a regra de inserção posicional

**Território Barueri:** Adicionar `imperial` aos `excludedNeighborhoods` (reservado para Osasco).

### 2. `assignTrucksToTerritories` (`src/lib/anchorRules.ts`)

Alterar a lógica para primeiro atribuir territórios com `fixedPlate` ao caminhão correspondente, marcando-o como usado antes da seleção automática dos demais.

### 3. Sequenciamento com `insertAfterNeighborhood` no nível de exceção (`src/lib/autoRouterEngine.ts`)

A lógica de `insertAfterNeighborhood` já existe em `optimizeDeliverySequence` (linhas 728-770), mas apenas para orders dentro do mesmo city group. O Jaguaré (São Paulo) e Rochdale (Osasco) estão em city groups diferentes. 

**Solução:** Após montar a sequência final (linha 779), aplicar um passo extra que busca exceções com `insertAfterNeighborhood` e reposiciona os pedidos do bairro de exceção logo após a última ocorrência do bairro alvo, independente da cidade.

### Resumo de Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/anchorRules.ts` | Campo `fixedPlate` na interface + TRC1Z00 fixo em Osasco + imperial em priorityNeighborhoods + imperial excluído de Barueri + jaguare com insertAfter rochdale |
| `src/lib/autoRouterEngine.ts` | assignTrucksToTerritories respeita fixedPlate + passo pós-sequenciamento para insertAfterNeighborhood cross-city |

