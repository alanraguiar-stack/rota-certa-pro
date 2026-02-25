

# Corrigir Campo `city` em DualPasteData e Atualizar Limite EUR

## Problema Principal

O campo `city` dos pedidos nao esta sendo preenchido quando o usuario usa o metodo de **colagem** (DualPasteData). O parser de colagem extrai a cidade da coluna "Cidade Ent." (variavel `cidade`, linha 201), mas NAO a inclui no objeto de registro retornado (linhas 218-223). Alem disso, a funcao de merge local tambem nao propaga o campo `city` para o `ParsedOrder` final (linhas 387-394).

Sem `city` preenchido, o motor de roteirizacao (`autoRouterEngine.ts`) cai no fallback `order.geocoded.city` (regex de endereco), que e impreciso — resultando em cidades aleatorias nos caminhoes.

O upload de arquivo (`DualFileUpload` via `advParser`) funciona corretamente porque o `advParser.ts` ja seta `city` nos merges (linhas 613, 665).

## Mudanca Secundaria

O usuario solicitou que o caminhao EUR (Barueri) tenha limite de **25 entregas** (nao 22 como esta atualmente).

## Plano de Alteracoes

### 1. `src/components/route/DualPasteData.tsx` — Propagar campo `city`

**1a. Funcao `parseItinerarioData` (linha 218-223):**
Adicionar `city: cidade` ao objeto retornado no `records.push(...)`:
```text
records.push({
  pedido_id: venda,
  client_name: cliente,
  address: address || 'Endereco nao informado',
  weight_kg: peso,
  city: cidade,        // NOVO
  neighborhood: bairro, // NOVO (util para excecoes de bairro)
});
```

**1b. Funcao `mergeItinerarioWithADV` (linhas 387-394):**
Adicionar `city` ao `ParsedOrder` retornado:
```text
merged.push({
  pedido_id: record.pedido_id,
  client_name: record.client_name || advOrder?.client_name || 'Cliente',
  address: record.address,
  city: record.city || undefined,  // NOVO
  weight_kg: advOrder?.weight_kg || record.weight_kg || 0,
  items: advOrder?.items || [],
  isValid: Boolean(record.address && record.address !== 'Endereco nao informado'),
});
```

### 2. `src/lib/anchorRules.ts` — Atualizar limite EUR

Linha 44: Alterar `maxDeliveries: 22` para `maxDeliveries: 25`.

## Resumo

| Arquivo | Mudanca |
|---------|---------|
| `src/components/route/DualPasteData.tsx` | Propagar `city` e `neighborhood` no parser de colagem e na funcao de merge |
| `src/lib/anchorRules.ts` | EUR maxDeliveries: 22 -> 25 |

Estas mudancas garantem que o campo `city` esteja sempre preenchido independentemente do metodo de entrada (upload ou colagem), permitindo ao motor de roteirizacao aplicar corretamente as regras de caminhoes ancora por territorio.
