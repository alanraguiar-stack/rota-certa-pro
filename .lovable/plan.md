

# Plano: Painel de KPIs para Analista

## Objetivo

Criar uma seção de KPIs no dashboard principal (`Index.tsx`) com 5 metricas operacionais calculadas a partir dos dados existentes nas tabelas `routes`, `orders`, `route_trucks` e `delivery_executions`.

## Metricas Propostas

| # | KPI | Calculo | Fonte |
|---|---|---|---|
| 1 | **Pedidos no Periodo** | Total de pedidos (hoje / semana / mes) com comparativo vs periodo anterior | `routes.total_orders` |
| 2 | **Peso Total Movimentado** | Soma de `total_weight_kg` no periodo, com trend % | `routes.total_weight_kg` |
| 3 | **Taxa de Ocupacao Media** | Media de `(rt.total_weight_kg / truck.capacity_kg) * 100` por caminhao | `route_trucks` + `trucks` |
| 4 | **Entregas Concluidas** | Contagem de `delivery_executions` com status `entregue` vs total | `delivery_executions` |
| 5 | **Cidades Atendidas** | Distinct cities extraidas dos pedidos no periodo | `orders.city` |

## Implementacao

### 1. Hook `useKpiMetrics.ts`
- Consulta `routes` do ultimo mes com `total_orders`, `total_weight_kg`, `created_at`
- Consulta `route_trucks` com join em `trucks` para calcular ocupacao
- Consulta `delivery_executions` para taxa de conclusao
- Consulta `orders.city` distinct para cidades atendidas
- Calcula trends comparando periodo atual vs anterior (semana atual vs anterior)
- Filtro por periodo: hoje, 7 dias, 30 dias (selecionavel)

### 2. Componente `KpiDashboard.tsx`
- Grid de 5 cards usando o `FuturisticStatsCard` ja existente
- Seletor de periodo (Hoje / 7 dias / 30 dias) no header
- Progress bar na ocupacao media
- Cada card com trend indicator (seta verde/vermelha + %)

### 3. Integracao no `Index.tsx`
- Inserir o `KpiDashboard` entre o header e a secao de "Rotas Recentes"
- Substituir os 4 `StatsCard` atuais pelo novo painel (para nao duplicar)

## O que NAO muda
- Nenhuma tabela nova necessaria (todos os dados ja existem)
- Nenhuma migration
- RLS policies existentes ja cobrem os SELECTs necessarios

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useKpiMetrics.ts` | Novo — queries + calculos |
| `src/components/dashboard/KpiDashboard.tsx` | Novo — grid de 5 KPIs com filtro de periodo |
| `src/pages/Index.tsx` | Trocar stats cards antigos pelo KpiDashboard |

