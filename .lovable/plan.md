

# Auto-cadastro de Produtos a partir do Detalhe das Vendas

## Objetivo

Quando o ADV (Detalhe das Vendas) é processado, identificar produtos que não existem no banco de dados `product_units` e inseri-los automaticamente, inferindo a unidade de medida a partir do nome do produto.

## Regras de Inferência de Unidade

Analisar o nome do produto (ex: `LINGUIÇA SUINA - NOBRE - 5 KG - CX - 10KG`):

| Padrão no nome | Unidade inferida |
|---|---|
| Contém "REFRIGERANTE" | `fardo` (sempre) |
| Contém "- CX" ou "CX -" | `caixa` |
| Contém "- UN" ou "UN -" | `unidade` |
| Contém "- FD" ou "FD -" | `fardo` |
| Contém "- PCT" ou "PCT -" | `pacote` |
| Contém "- LT" ou "LT -" ou "LITRO" | `litro` |
| Contém "- SC" ou "SC -" | `saco` |
| Contém "- DP" ou "DP -" | `display` |
| Contém "- GF" ou "GF -" | `garrafa` |
| Contém "- PC" ou "PC -" | `peca` |
| Nenhum match | `kg` (padrão) |

Prioridade: refrigerante > abreviações explícitas > kg.

## Mudanças

### 1. `src/hooks/useProductUnits.ts` — nova função `bulkAddNewProducts`

- Recebe `Array<{ product_name: string }>` (lista de produtos do ADV)
- Para cada produto, normaliza o nome e verifica se já existe no `normalizedMap`
- Se não existe, infere a unidade pelo nome usando as regras acima
- Faz um `insert` em batch dos novos produtos
- Retorna `{ added: number, skipped: number }`

### 2. `src/components/route/DualFileUpload.tsx` — chamar auto-cadastro após processar ADV

- Quando `processFile` detecta tipo `adv` e retorna os pedidos, extrair todos os `product_name` dos items
- Chamar `bulkAddNewProducts` com a lista de produtos
- Exibir toast informando quantos produtos novos foram cadastrados

### 3. `src/components/route/DualPasteData.tsx` — mesma lógica para dados colados

- Quando `parseADVData` ou `parseDetailDataWithoutAddress` retorna pedidos, extrair produtos e chamar `bulkAddNewProducts`

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/hooks/useProductUnits.ts` | Função `inferUnitFromName` + `bulkAddNewProducts` |
| `src/components/route/DualFileUpload.tsx` | Chamar auto-cadastro após ADV processado |
| `src/components/route/DualPasteData.tsx` | Chamar auto-cadastro após ADV colado |

