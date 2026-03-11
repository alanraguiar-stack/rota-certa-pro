

# Diferença entre Vendas (78) e Pedidos (73): Diagnóstico e Correção

## Problema

Duas causas combinadas:

### Causa 1: ADV parser descarta vendas sem itens válidos
Em `parseADVDetailExcel` (linha 1292-1306), um item só é incluído se `weight > 0` E `descricao.length > 2`. Se todos os itens de uma venda falham nessas validações, a venda inteira é descartada silenciosamente (condição `currentItems.length > 0` nas linhas 1229, 1256, 1327).

Isso explica por que o ADV mostra 73 em vez de 78 — 5 vendas tiveram itens que não passaram na validação.

### Causa 2: Merge ignora vendas do itinerário sem match no ADV
`mergeItinerarioWithADV` itera apenas sobre `advOrders`. Vendas que existem no itinerário mas não no ADV são completamente perdidas. Mesmo que o ADV parse corretamente 78, se alguma não faz match, ela some.

## Correções

### 1. `src/lib/advParser.ts` — `parseADVDetailExcel`
- Salvar a venda mesmo quando `currentItems` está vazio (com peso 0 e sem itens). Isso garante que toda venda detectada vire um pedido, mesmo que os itens não tenham sido parseados.
- Adicionar log de vendas sem itens para diagnóstico.

### 2. `src/lib/advParser.ts` — `mergeItinerarioWithADV`
- Após iterar os `advOrders`, verificar quais `ItinerarioRecord` não foram usados (`usedItinerarioIds`).
- Adicionar essas vendas órfãs como pedidos extras (com endereço do itinerário, sem itens detalhados).
- Logar quantas vendas foram adicionadas por esse fallback.

### 3. `src/components/route/DualFileUpload.tsx` — Atualizar contagem no merge summary
- Incluir as vendas órfãs do itinerário na contagem total do merge.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/lib/advParser.ts` | ADV parser aceita vendas sem itens + merge inclui vendas órfãs do itinerário |
| `src/components/route/DualFileUpload.tsx` | Nenhuma mudança estrutural (merge summary já reflete o array retornado) |

