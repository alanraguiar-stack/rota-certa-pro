

# Plano: Reimportar Detalhamento de Itens para Rota Existente

## Problema
A rota foi criada sem o arquivo ADV, resultando em `order_items` vazios. O romaneio mostra "Pedidos para Separação" em vez de produtos consolidados.

## Solução

### 1. Nova mutation em `src/hooks/useRoutes.ts`
Adicionar `reimportItems` que:
- Aceita o arquivo CSV/Excel ADV
- Parseia com `parseADVDetailExcel` (já funciona com CSV `;`)
- Busca os `orders` existentes da rota
- Cruza ADV com orders por **client_name normalizado** (removeAccents + lowercase + trim)
- Para desempate de clientes com múltiplos pedidos, usa o peso total
- Deleta `order_items` antigos (se houver) e insere os novos
- Atualiza `product_description` de cada order

### 2. Botão no `src/components/route/LoadingManifest.tsx`
Quando `ordersLackDetails` é true, mostrar botão "Reimportar Detalhamento" ao lado do aviso amarelo. O botão abre um file input que aceita CSV/Excel.

### 3. Props adicionais no `LoadingManifest`
Adicionar `routeId` e `onItemsReimported` (callback para refetch) como props opcionais.

### 4. Lógica de matching
```text
Para cada order ADV (por venda_id):
  1. Buscar order no banco com client_name normalizado igual
  2. Se múltiplos matches, usar peso mais próximo
  3. Inserir order_items vinculados ao order.id
  4. Atualizar product_description do order
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRoutes.ts` | Nova mutation `reimportItems` |
| `src/components/route/LoadingManifest.tsx` | Botão reimportação + file input + lógica de upload |
| `src/pages/RouteDetails.tsx` | Passar `routeId` e `refetch` ao LoadingManifest |

