

# Preencher campo `city` nos pedidos para ativar auto-selecao de caminhoes ancora

## Problema

A coluna L ("Cidade Ent.") do relatorio de vendas ja e lida corretamente pelo parser (linha 1125 do `advParser.ts`), e o campo `city` ja existe na interface `ParsedOrder` (linha 202 do `types/index.ts`). Porem, nenhum dos tres caminhos de conversao copia esse valor para o campo `city` do pedido final. Resultado: `order.city` e sempre `undefined`, e o motor de recomendacao de frota nao consegue detectar as cidades para selecionar CYR, EUR, FKD automaticamente.

## Correcoes (3 pontos)

### 1. `src/lib/advParser.ts` - funcao `mergeItinerarioWithADV` (linha 610)

Adicionar `city: enderecoData.city || undefined` no objeto retornado quando ha match entre itinerario e ADV.

### 2. `src/lib/advParser.ts` - funcao `createOrdersFromItinerario` (linha 660)

Adicionar `city: record.city || undefined` no objeto retornado para cada registro do itinerario.

### 3. `src/lib/spreadsheet/intelligentReader.ts` - funcao `convertToLegacyFormat` (linha 480)

Adicionar `city: order.address_parts?.city || undefined` no objeto retornado para cada pedido convertido.

## Resultado

Com essas 3 linhas adicionadas, o campo `city` sera preenchido com o valor da coluna "Cidade Ent." (ex: "OSASCO", "SAO PAULO", "CARAPICUIBA"). O motor em `routeIntelligence.ts` ja normaliza e compara esse campo com as regras ancora, entao o CYR sera automaticamente recomendado quando houver vendas em Osasco.

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/advParser.ts` | Adicionar `city` em `mergeItinerarioWithADV` (linha 610) e `createOrdersFromItinerario` (linha 660) |
| `src/lib/spreadsheet/intelligentReader.ts` | Adicionar `city` em `convertToLegacyFormat` (linha 480) |

