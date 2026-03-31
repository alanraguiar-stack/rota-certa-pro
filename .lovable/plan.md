

# Plano: Pente Fino na Identificação e Distribuição de Pedidos

## Problemas Identificados

Analisei todo o fluxo desde o parsing até a alocação final e encontrei **6 pontos de fricção** que podem causar pedidos perdidos ou não distribuídos:

### 1. NewRoute.tsx não passa `plateOverrides` nem `customTerritoryRules`
A chamada na linha 200 do `NewRoute.tsx` não envia os overrides de placa nem as regras customizadas do banco. Apenas o `useRoutes.ts` (distributeLoad) faz isso. Resultado: na preview inicial do wizard, o motor usa regras padrão do `anchorRules.ts` — se essas não cobrem todas as cidades dos pedidos, sobram órfãos.

### 2. Cidade "desconhecida" — pedidos sem campo `city` preenchido
Na linha 219 do engine: `normalizeCityName(order.city || order.geocoded.city || 'desconhecida')`. Se o endereço não foi parseado corretamente pelo `parseAddress`, a cidade fica como `'desconhecida'`. Nenhum território tem essa cidade como âncora ou fill — o pedido só será salvo nos fallbacks (5d.5/5d.6/5d.7) e pode ficar fora se todos os caminhões estiverem cheios.

### 3. Overflow da cidade âncora marca como `assignedOrderKeys` mas vai para `overflowOrders`
Na linha 331: quando um pedido excede o peso/entregas do caminhão âncora, ele é adicionado ao `overflowOrders` **E** marcado no `assignedOrderKeys`. Isso impede que outro território (fill city) pegue esse pedido. O overflow só vai para o caminhão de apoio (Step 5b). Se não houver apoio ou o apoio estiver cheio, o pedido some.

### 4. Pedidos de cidades que não são âncora nem fill de nenhum território
Se uma cidade aparece nos pedidos mas não existe em nenhuma regra de território (nem âncora, nem fill, nem no apoio), esses pedidos só são pegos no Step 5c (non-territory trucks). Se não houver caminhões extra, vão para fallback. Isso é frágil.

### 5. `maxOccupancyPercent` de 95% reduz capacidade efetiva
Linha 282: `capacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100)`. Isso descarta 5% da capacidade, podendo causar overflow desnecessário. Nos fallbacks forçados (5d.6) esse mesmo teto é aplicado, impedindo alocação mesmo quando o peso real ainda caberia.

### 6. `distributeLoad` usa `latitude`/`longitude` do DB mas não propaga para o `city`
Na linha 406-418 do `useRoutes.ts`, ao construir `parsedOrders`, o campo `city` vem de `(o as any).city` — funciona se o campo existe no DB. Mas se o pedido foi importado sem cidade, fica `undefined`, e o motor vai usar `parseAddress` para extrair a cidade do endereço, que pode falhar em formatos não-padrão.

## Solução

### Arquivo: `src/lib/autoRouterEngine.ts`

1. **Overflow não deve marcar `assignedOrderKeys`** — remover linha 331 (`assignedOrderKeys.add(key)` dentro do overflow). Isso permite que o pedido seja captado por outro território que tenha aquela cidade como fill.

2. **Último recurso sem limite de peso** — no Step 5d.7 (linha 750), garantir que TODOS os pedidos restantes sejam forçados para algum caminhão, mesmo ultrapassando o peso. Adicionar warning mas NUNCA deixar de fora.

3. **Cidade "desconhecida" — fallback inteligente** — quando `city` é vazia ou "desconhecida", tentar extrair do endereço usando regex mais robusto (buscar por nomes de cidades conhecidas no `CITY_COORDINATES`). Se não achar, atribuir ao caminhão de apoio diretamente.

4. **Remover `maxOccupancyPercent` dos fallbacks forçados** — nos Steps 5d.6 e 5d.7, usar 100% da capacidade do caminhão em vez de 95%.

### Arquivo: `src/pages/NewRoute.tsx`

5. **Passar `plateOverrides` e `customTerritoryRules`** na chamada do `autoComposeRoute` (linha 200), buscando do banco da mesma forma que o `distributeLoad` faz. Isso garante consistência entre a preview e a distribuição final.

### Arquivo: `src/hooks/useRoutes.ts`

6. **Fallback de `city`** — ao construir `parsedOrders` (linha 406), se `city` está vazio, extrair do endereço usando `parseAddress` e popular o campo antes de enviar ao motor.

## O que NÃO muda
- Interfaces de resultado (AutoRouterResult, TruckComposition)
- Lógica de território e sequenciamento
- Validação bloqueante (mantida)
- UI dos componentes

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Fix overflow marking, fallback sem limite de peso, cidade desconhecida → lookup inteligente, remover teto 95% dos fallbacks |
| `src/pages/NewRoute.tsx` | Passar plateOverrides + customTerritoryRules na chamada do autoComposeRoute |
| `src/hooks/useRoutes.ts` | Fallback de city vazio usando parseAddress |

