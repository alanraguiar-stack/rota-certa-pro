

# Pontos de Aprendizado do Sistema — Avaliação e Plano

## Estado Atual

O sistema aprende **apenas sequências de entrega** (cidade, cliente, endereço, ordem) ao confirmar rotas. Isso alimenta corredores regionais e co-ocorrência de cidades. Porém há 6 lacunas importantes.

## Lacuna 1: Bairro nunca é salvo

No snapshot de `RouteDetails.tsx`, o campo `neighborhood` é sempre `null`. Todo o aprendizado de bairro (qual bairro vai com qual) é perdido.

**Correção**: Extrair `neighborhood` do pedido (campo `neighborhood` do `pending_orders`) e salvar no snapshot.

## Lacuna 2: Quantidade de caminhões vs perfil de carga

O `analyzeFleetRequirements` usa regra fixa: peso ÷ capacidade + margem. Não aprende padrões como "8t com entregas em Osasco+Barueri → sempre 3 caminhões".

**Solução**: Nova tabela `fleet_decision_history` que registra:
- `total_weight`, `total_orders`, `city_count`, `trucks_selected` (quantidade), `truck_plates` (array)
- Salvo ao confirmar seleção de frota

Depois, `analyzeFleetRequirements` consulta histórico para recomendar: "Nas últimas 10 rotas com perfil similar (peso 7-9t, 3 cidades), você usou 3 caminhões em 8 vezes."

## Lacuna 3: Movimentação manual entre caminhões

Quando o analista move um pedido do caminhão A para B no `TruckRouteEditor`, isso reflete uma decisão de território que o sistema deveria absorver. Hoje, o snapshot final captura o resultado mas não o "motivo" (qual caminhão original → qual caminhão destino).

**Solução**: Registrar moves no snapshot com campo `was_manually_moved: boolean` no `route_history_patterns`. Pedidos movidos manualmente recebem peso extra no pattern learning.

## Lacuna 4: Regras de território dinâmicas

`anchorRules.ts` é hardcoded. Se o analista consistentemente coloca Itapevi com Barueri (em vez de com Jandira), o sistema não ajusta.

**Solução**: Após acumular N rotas (ex: 5+), o sistema analisa co-ocorrências e sugere ajustes nas regras de território via card informativo: "Nas últimas 8 rotas, Itapevi foi combinada com Barueri 7 vezes. Deseja atualizar a regra?"

Implementação: nova tabela `territory_overrides` que sobrescreve `allowedFillCities` dos `TERRITORY_RULES`, consultada pelo `autoComposeRoute`.

## Lacuna 5: Estratégia de roteirização por perfil

A estratégia (Padrão, Finalização Próxima, Finalização Distante) é escolhida manualmente. Não aprende qual estratégia o analista prefere para cada perfil.

**Solução**: Salvar `routing_strategy` no `fleet_decision_history`. Após 5+ rotas, pré-selecionar a estratégia mais usada.

## Lacuna 6: Estado do bairro no snapshot

O campo `state` (UF) também é sempre `null`. Registrar para diferenciar cidades homônimas.

**Correção simples**: Popular `state` com a UF do pedido no snapshot.

---

## Prioridade de Implementação

| # | O que | Impacto | Complexidade |
|---|---|---|---|
| 1 | Salvar `neighborhood` e `state` no snapshot | Alto — desbloqueia aprendizado de bairro | Baixa |
| 2 | Tabela `fleet_decision_history` + consulta no `analyzeFleetRequirements` | Alto — recomendação de frota baseada em histórico | Média |
| 3 | Flag `was_manually_moved` nos patterns | Médio — dá peso extra a decisões manuais | Baixa |
| 4 | Tabela `territory_overrides` + sugestões automáticas | Alto — territórios aprendem com o analista | Alta |
| 5 | Salvar `routing_strategy` + pré-seleção | Baixo — conforto, não muda resultado | Baixa |

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | Salvar `neighborhood`, `state`, `was_manually_moved` no snapshot |
| `src/lib/routeIntelligence.ts` | Consultar `fleet_decision_history` para recomendações |
| `src/lib/autoRouterEngine.ts` | Consultar `territory_overrides` antes de usar `TERRITORY_RULES` |
| `src/components/route/IntelligentFleetPanel.tsx` | Mostrar insights históricos na seleção de frota |
| `src/components/route/TruckRouteEditor.tsx` | Marcar pedidos movidos manualmente |
| **Migrações** | `fleet_decision_history`, coluna `was_manually_moved` em `route_history_patterns`, `territory_overrides` |

