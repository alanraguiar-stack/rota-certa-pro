

# Corrigir contagem: Itinerário como lista mestre

## Problema raiz

A lógica atual do `mergeItinerarioWithADV` itera sobre os **pedidos do ADV** (75) e tenta encontrar correspondência no itinerário. Isso causa dois problemas:

1. Se um pedido ADV não faz match por ID, ele tenta por nome de cliente — e pode "roubar" o match de outro pedido, liberando o registro original do itinerário para virar órfão
2. No final, os 75 ADV + os órfãos do itinerário somam mais que 78

## Solução

Inverter a lógica: o **itinerário é a lista mestre** (78 vendas). O merge deve iterar sobre os registros do itinerário e enriquecer com dados do ADV quando houver match por `venda_id`.

### Fluxo correto:
1. Criar mapa do ADV por `venda_id` normalizado
2. Iterar sobre cada registro do itinerário (78)
3. Para cada venda do itinerário, buscar no mapa ADV por `venda_id`
4. Se encontrou: usar itens/produtos do ADV + endereço do itinerário
5. Se não encontrou: criar pedido só com dados do itinerário (sem itens detalhados)
6. Resultado final = exatamente o número de registros do itinerário

### Arquivo: `src/lib/advParser.ts` — reescrever `mergeItinerarioWithADV`

- Inverter a iteração: loop principal sobre `itinerario[]`, não sobre `advOrders[]`
- Criar `advByIdMap = Map<string, ParsedOrder>` com `normalizeVendaId`
- Match primário: `venda_id` (obrigatório nos dois documentos conforme o usuário)
- Match secundário (fallback): nome do cliente normalizado (para casos raros)
- Remover lógica de "orphan orders" — não é mais necessária pois o itinerário É a lista completa
- Logar vendas do ADV que não encontraram correspondência no itinerário (informativo)

