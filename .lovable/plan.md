

# Implementar Romaneio de Carga conforme especificação do documento

## Resumo

O documento define regras precisas para parsing do CSV de vendas detalhadas e compilação do romaneio. Vou implementar essas regras exatamente como especificadas, e resolver definitivamente o problema de perda de itens usando `sessionStorage` em vez de `navigate(state)`.

## Problema atual

Os itens são perdidos durante a navegação entre NewRoute e RouteDetails porque o React Router serializa o state via `structuredClone`, que falha silenciosamente com payloads grandes. Resultado: `order_items` sempre vazio no banco, romaneio sempre vazio.

## Mudanças planejadas

### 1. Novo parser CSV conforme especificação exata do documento
**Arquivo:** `src/lib/advParser.ts`

Adicionar função `parseVendasCSV(text: string)` que segue as regras do documento:
- Separador `;`, encoding latin1
- `partes[0] === "Cliente :"` → captura `partes[2]` como cliente
- `partes[0] === "Venda Nº:"` → captura `partes[4]` como número da venda  
- `partes[0]` numérico → extrai item com:
  - `partes[0]` = código do produto
  - `partes[4]` = descrição
  - `partes[13]` = unidade (KG, FD, CX, UN, SC, PC)
  - `partes[16]` = quantidade (formato BR: `1.234,56`)

Adicionar função `compilarRomaneio(items, vendasSelecionadas)` que:
- Agrupa por **código do produto** (não descrição)
- Soma quantidades
- Ordena alfabeticamente pela descrição

### 2. Transferência de dados via sessionStorage (corrige perda de itens)
**Arquivos:** `src/pages/NewRoute.tsx`, `src/pages/RouteDetails.tsx`

- **NewRoute.tsx**: Antes de `navigate()`, salvar os pedidos com itens em `sessionStorage.setItem('pendingOrdersWithItems', JSON.stringify(ordersForState))`. Remover `pendingOrders` do state do navigate.
- **RouteDetails.tsx**: Ler de `sessionStorage` em vez de `location.state`. Após leitura, limpar o sessionStorage.

### 3. Consolidação do romaneio por código do produto
**Arquivo:** `src/components/route/LoadingManifest.tsx`

Alterar `consolidateProducts` para agrupar por código do produto (quando disponível via `order_items`) em vez de por nome normalizado. Adicionar colunas UN e Qtde separadas no layout do PDF conforme o documento:

```
# | Produto | UN | Qtde
```

### 4. Regras de exibição de quantidade
**Arquivo:** `src/components/route/LoadingManifest.tsx`

- KG → 2 casas decimais sempre (ex: `59,67 KG`)
- UN, FD, CX, SC, PC → inteiro sem decimal

### 5. Adicionar código do produto ao order_items
**Migration SQL:**
```sql
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_code text;
```

**Arquivo:** `src/hooks/useRoutes.ts` — salvar `product_code` no insert de items.

### 6. Cabeçalho do PDF com lista de pedidos
**Arquivo:** `src/components/route/LoadingManifest.tsx`

Adicionar ao cabeçalho do PDF: `Pedidos: [lista dos pedido_ids incluídos naquele caminhão]`

### 7. Seção de conferência no PDF
Já existe, mas ajustar layout para corresponder exatamente ao documento:
- Separador + Assinatura
- Conferente + Assinatura  
- Data + Hora

## Arquivos a editar
- Nova migration SQL (coluna `product_code`)
- `src/lib/advParser.ts` — novo parser CSV com índices fixos
- `src/pages/NewRoute.tsx` — sessionStorage
- `src/pages/RouteDetails.tsx` — ler de sessionStorage
- `src/hooks/useRoutes.ts` — salvar `product_code`
- `src/components/route/LoadingManifest.tsx` — consolidação por código, formato do PDF, regras de exibição

## Resultado esperado
- Parser CSV segue exatamente a especificação (índices fixos, encoding latin1)
- Itens nunca mais perdidos na transferência entre páginas (sessionStorage = 5MB)
- Romaneio agrupa por código do produto, soma quantidades, exibe unidade correta
- PDF com layout: `# | Produto | UN | Qtde`
- Cabeçalho com lista de pedidos incluídos
- Conferência de carga com campos de assinatura

