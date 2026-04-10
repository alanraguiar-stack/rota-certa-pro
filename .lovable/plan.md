

# Plano: Corrigir Persistência de Itens no Fluxo Normal (Upload Duplo)

## Problema Raiz

O código em `useRoutes.ts` na mutation `addOrders` (linha 274) assume que o array retornado por `supabase.insert().select()` mantém a mesma ordem do array de entrada. **Isso não é garantido pelo Supabase/PostgreSQL.** Resultado: os items são mapeados para orders errados ou perdidos.

Além disso, erros de inserção de `order_items` são silenciosamente engolidos (linha 293-296), impedindo diagnóstico.

## Solução

### 1. Corrigir mapeamento de items em `src/hooks/useRoutes.ts` — `addOrders`

Em vez de usar índice posicional (`insertedOrders[index]`), mapear orders inseridos de volta aos originais usando `client_name + weight_kg` como chave composta:

```text
1. Inserir orders no banco → receber insertedOrders
2. Para cada insertedOrder, encontrar o original correspondente
   por client_name normalizado + weight_kg
3. Inserir order_items vinculados ao ID correto
4. Batch de 500 items por vez
5. Reportar erros via toast (não engolir silenciosamente)
```

### 2. Adicionar log de diagnóstico

- Logar quantos items foram preparados para inserção
- Logar resultado da inserção (sucesso/erro)
- Toast de aviso se items falharem

### 3. Garantir que o merge preserve items corretamente

Adicionar log no `handleAutoDataReady` em `NewRoute.tsx` para confirmar que os orders passados via `navigate()` contêm items.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRoutes.ts` | Corrigir mapeamento posicional → por chave; batch insert de items; error reporting |
| `src/pages/NewRoute.tsx` | Adicionar log de diagnóstico dos items antes de navegar |

## Impacto

A partir desta correção, o fluxo normal (upload de 2 arquivos → criar rota) já persistirá os items corretamente, sem necessidade de reimportação.

