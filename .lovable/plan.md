

# Vincular itens do ADV ao romaneio via `pedido_id` determinístico

## Problema raiz
O romaneio sai vazio porque os `order_items` não estão sendo vinculados corretamente aos pedidos da rota. Hoje o vínculo usa apenas `client_name + weight_kg`, que falha quando há diferenças mínimas de encoding ou peso. A tabela `orders` não guarda o `pedido_id` (número da venda do ADV), então não há como fazer match exato.

## O que o CSV contém
O arquivo "Vendas Detalhadas" tem a estrutura hierárquica do ADV:
- `Cliente:` → nome do cliente
- `Venda Nº:` → ID da venda (ex: 281600)
- Tabela de itens: Código, Descrição, UN, Qtde, Unitário, Total

O parser `parseADVDetailExcel` já extrai tudo isso corretamente (pedido_id, items com product_name, quantity, weight_kg, unit). O problema está na persistência e no matching.

## Mudanças

### 1. Migration: adicionar `pedido_id` na tabela `orders`
```sql
ALTER TABLE public.orders ADD COLUMN pedido_id text;
CREATE INDEX idx_orders_pedido_id ON public.orders(pedido_id);
```

### 2. `src/types/index.ts` — adicionar `pedido_id` ao tipo `Order`
```typescript
export interface Order {
  // ... existing fields
  pedido_id?: string | null;
}
```

### 3. `src/hooks/useRoutes.ts` — `toOrder()` incluir `pedido_id`
Adicionar `pedido_id` ao helper de conversão.

### 4. `src/hooks/useRoutes.ts` — `addOrders()` persistir `pedido_id`
- Aceitar `pedido_id` no input do mutation
- Inserir na tabela `orders` junto com os demais campos
- Usar `pedido_id` como chave primária de matching para vincular `order_items` (fallback: name+weight)

### 5. `src/hooks/useRoutes.ts` — `reimportItems()` usar `pedido_id`
- Se o `order` já tem `pedido_id`, procurar no ADV por esse ID primeiro
- Fallback: client_name + weight (como hoje)
- Isso torna o match determinístico e resistente a encoding

### 6. `src/components/route/LoadingManifest.tsx` — corrigir texto de aviso
A linha 251 ainda diz "listando pedidos individuais por cliente/peso" mas o romaneio já não faz isso. Trocar por:
> "Detalhamento de produtos nao importado. Reimporte o arquivo ADV para gerar o romaneio."

### 7. Propagar `pedido_id` no fluxo de importação
No componente que chama `addOrders` durante a criação da rota, garantir que o `pedido_id` do `ParsedOrder` seja passado para o mutation.

## Arquivos
- Nova migration SQL
- `src/types/index.ts`
- `src/hooks/useRoutes.ts` (toOrder, addOrders, reimportItems)
- `src/components/route/LoadingManifest.tsx` (texto do aviso)

## Resultado esperado
- `pedido_id` salvo em cada pedido desde a criação da rota
- Match por ID exato no reimport — itens sempre vinculados
- Romaneio de carga nunca mais vazio quando o ADV foi importado junto
- Aviso correto quando falta detalhamento

