
# Plano: Corrigir Romaneio de Carga Vazio

## Problema Identificado

O Romaneio de Carga está mostrando apenas "Produto não especificado" porque os **itens dos pedidos não estão sendo salvos** na tabela `order_items` do banco de dados.

## Causa Raiz

O código em `RouteDetails.tsx` (linha 110-116) **não inclui o campo `items`** ao passar os pedidos para a função `addOrders`:

```typescript
// CÓDIGO ATUAL (linha 110-116)
addOrders.mutate(
  pendingOrders.map((o) => ({
    client_name: o.client_name,
    address: o.address,
    weight_kg: o.weight_kg,
    product_description: o.product_description,
    // ❌ FALTA: items: o.items
  })),
```

## Fluxo do Bug

```text
┌────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Parser (ADV)      │ --> │  NewRoute.tsx    │ --> │ RouteDetails.tsx│
│  items: [...]  ✓   │     │  items: [...]  ✓ │     │  items: ???  ✗  │
└────────────────────┘     └──────────────────┘     └─────────────────┘
                                                            │
                                                            v
                                                    ┌───────────────┐
                                                    │ useRoutes.ts  │
                                                    │ addOrders()   │
                                                    │ items: []  ✗  │
                                                    └───────────────┘
                                                            │
                                                            v
                                                    ┌───────────────┐
                                                    │ order_items   │
                                                    │ (vazio)  ✗    │
                                                    └───────────────┘
```

## Solução

Adicionar o campo `items` no mapeamento dos pedidos em `RouteDetails.tsx`.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/pages/RouteDetails.tsx` | Editar | Incluir `items: o.items` no objeto passado para `addOrders` |

## Mudança Técnica

**Arquivo:** `src/pages/RouteDetails.tsx`
**Linhas:** 110-116

```typescript
// ANTES
addOrders.mutate(
  pendingOrders.map((o) => ({
    client_name: o.client_name,
    address: o.address,
    weight_kg: o.weight_kg,
    product_description: o.product_description,
  })),

// DEPOIS
addOrders.mutate(
  pendingOrders.map((o) => ({
    client_name: o.client_name,
    address: o.address,
    weight_kg: o.weight_kg,
    product_description: o.product_description,
    items: o.items, // ← ADICIONAR ESTA LINHA
  })),
```

## Verificação Pós-Correção

Após aplicar a correção:

1. Os dados importados via arquivo terão os itens salvos na tabela `order_items`
2. O Romaneio de Carga mostrará a lista consolidada de produtos (ex: Mussarela 50kg, Presunto 30kg)
3. Cada caminhão terá seu próprio romaneio com os produtos específicos atribuídos a ele

## Nota sobre Dados Existentes

A rota atual (`9754c302-f823-44b0-b945-cf29a0341692`) **não será corrigida automaticamente** porque os pedidos já foram criados sem os itens. Para testar a correção, será necessário criar uma nova rota com novos dados importados.

## Resultado Esperado

Após a correção, o Romaneio de Carga exibirá:

| # | Produto | Peso Total |
|---|---------|------------|
| 1 | Mussarela | 120kg |
| 2 | Presunto | 80kg |
| 3 | Mortadela | 45kg |
| **TOTAL** | | **245kg** |

Em vez de:

| # | Produto | Peso Total |
|---|---------|------------|
| 1 | Produto não especificado | 245kg |
| **TOTAL** | | **245kg** |
