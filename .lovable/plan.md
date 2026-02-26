

# Corrigir Distribuicao de Carga: Usar Motor de Ancora na Distribuicao

## Problema Raiz

A distribuicao de carga nos caminhoes (`distributeLoad`) usa a funcao `distributeOrders` de `src/lib/distribution.ts`, que e uma logica generica baseada em peso e proximidade. Ela **NAO** usa as regras de caminhoes ancora definidas em `anchorRules.ts`. O motor correto (`autoComposeRoute` de `autoRouterEngine.ts`) so roda durante o planejamento no wizard (`NewRoute.tsx`), mas quando o usuario clica "Distribuir Cargas nos Caminhoes" na pagina da rota, a distribuicao generica sobrescreve tudo, misturando cidades aleatoriamente.

Alem disso, o campo `city` do pedido nao e salvo no banco de dados (a tabela `orders` nao tem coluna `city`), entao quando os pedidos sao carregados de volta do banco, a cidade se perde e o sistema depende do parser de endereco (impreciso).

## Plano de Correcao

### 1. Adicionar coluna `city` na tabela `orders`

Criar migracao SQL:
```sql
ALTER TABLE public.orders ADD COLUMN city text;
```

Isso permite que a cidade seja persistida no banco e usada na distribuicao.

### 2. Salvar `city` ao criar pedidos

**Arquivo:** `src/hooks/useRoutes.ts`

Na mutacao `addOrders` (linha 233), o tipo do parametro de entrada ja recebe os dados do `ParsedOrder`. Precisamos:
- Adicionar `city?: string` ao tipo de entrada
- Incluir `city: o.city || null` no objeto `ordersToInsert`

**Arquivo:** `src/pages/RouteDetails.tsx`

Onde `addOrders` e chamado com `pendingOrders`, garantir que o campo `city` seja passado.

**Arquivo:** `src/types/index.ts`

Adicionar `city?: string | null` na interface `Order`.

### 3. Substituir `distributeOrders` por `autoComposeRoute` na distribuicao de carga

**Arquivo:** `src/hooks/useRoutes.ts`

Na mutacao `distributeLoadMutation` (linha 388):
- Importar `autoComposeRoute` de `autoRouterEngine`
- Importar `findAnchorRule` de `anchorRules`
- Converter os `Order` do banco para `ParsedOrder` (incluindo o campo `city` agora disponivel)
- Chamar `autoComposeRoute` em vez de `distributeOrders`
- Mapear os resultados (`compositions`) para criar as `order_assignments` no banco
- Isso garante que as regras de ancora (EUR->Barueri, CYR->Osasco, FKD->Carapicuiba, EEF->apoio) sejam respeitadas

### 4. Incluir `city` na leitura do banco (helper `toOrder`)

**Arquivo:** `src/hooks/useRoutes.ts`

Na funcao `toOrder` (linha 10), adicionar `city: obj.city != null ? String(obj.city) : null`.

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar coluna `city` na tabela `orders` |
| `src/types/index.ts` | Adicionar `city` na interface `Order` |
| `src/hooks/useRoutes.ts` | Salvar `city` em `addOrders`; ler `city` em `toOrder`; substituir `distributeOrders` por `autoComposeRoute` em `distributeLoadMutation` |
| `src/pages/RouteDetails.tsx` | Passar campo `city` ao chamar `addOrders` |

## Resultado Esperado

Ao clicar "Distribuir Cargas nos Caminhoes", o sistema usara as regras de ancora:
- CYR recebe SOMENTE Osasco (+ excecoes Jaguare/Parque Imperial)
- EUR recebe SOMENTE Barueri (+ encaixes Jandira, Itapevi, Cotia, VGP)
- FKD recebe SOMENTE Carapicuiba (+ excecoes Metalurgicos, Vila do Conde)
- EEF recebe demais cidades + excedentes
