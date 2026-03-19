

# Backlog de Pedidos — Cidades Fora do Calendário

## Problema

Quando o calendário de entregas está ativo e o relatório de vendas contém cidades sem entrega no dia seguinte, esses pedidos são descartados (`filteredOutOrders`). O usuário precisa lembrar manualmente de incluí-los no dia correto — propenso a erro e perda de vendas.

## Solução

Criar um **backlog de pedidos pendentes** que armazena automaticamente os pedidos filtrados pelo calendário e os re-injeta na roteirização quando o dia da cidade chegar.

## Fluxo

```text
Upload vendas (dia D)
    │
    ├── Pedidos de cidades com entrega em D+1 → roteirização normal
    │
    └── Pedidos de cidades SEM entrega em D+1 → backlog (banco)
                                                    │
                                        Próximo upload (dia D+N)
                                                    │
                                        Sistema puxa backlog de cidades
                                        com entrega em D+N+1 e JUNTA
                                        com os pedidos novos do arquivo
```

## Mudanças Técnicas

### 1. Nova tabela `pending_orders`

```sql
CREATE TABLE pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 0,
  pedido_id text,
  product_description text,
  original_upload_date date NOT NULL DEFAULT CURRENT_DATE,
  target_day_of_week integer, -- dia em que essa cidade tem entrega (0-6)
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'routed' | 'cancelled'
  routed_at timestamptz,
  route_id uuid,
  created_at timestamptz DEFAULT now()
);
-- RLS: user CRUD own records
```

### 2. Hook `usePendingOrders.ts`

- `savePendingOrders(orders, targetDate)` — persiste pedidos filtrados com a cidade e o dia-alvo
- `getPendingOrdersForDate(date)` — busca pedidos pendentes cujas cidades têm entrega nesse dia (cruza com `city_delivery_schedule`)
- `markAsRouted(orderIds, routeId)` — marca como roterizados ao criar a rota
- `cancelPending(orderIds)` — permite cancelar manualmente

### 3. Integração no wizard (`NewRoute.tsx`)

Ao processar o upload:
1. Calcular `allowedCities` para amanhã (já existe)
2. Pedidos filtrados → salvar em `pending_orders` automaticamente
3. Buscar pedidos pendentes de uploads anteriores cujas cidades SÃO permitidas amanhã
4. Juntar pedidos do backlog com pedidos novos do arquivo antes de roteirizar
5. Exibir card informativo: "X pedidos recuperados do backlog" + "Y pedidos guardados para dias futuros"

### 4. UI no wizard — Card de Backlog

No passo de **validação** (step 2), mostrar:
- **Pedidos recuperados**: lista de pedidos do backlog que entram na rota de amanhã (com data original do upload)
- **Pedidos guardados**: lista de pedidos que ficaram para outro dia (com indicação do próximo dia de entrega)
- Botão para cancelar pedidos do backlog se não forem mais necessários

### 5. Tela de gestão do backlog (em Configurações ou menu lateral)

Página simples para visualizar/gerenciar todos os pedidos pendentes:
- Filtro por cidade, status, data de upload
- Ações: cancelar, forçar inclusão na próxima rota

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Criar `pending_orders` + RLS |
| `src/hooks/usePendingOrders.ts` | Novo hook CRUD |
| `src/pages/NewRoute.tsx` | Salvar filtrados + recuperar backlog + UI informativa |
| `src/hooks/useCitySchedule.ts` | Helper para próximo dia de entrega de uma cidade |
| `src/components/route/PendingOrdersCard.tsx` | Card visual no wizard |

### Regras de negócio

- Pedidos no backlog são **por usuário** (RLS)
- Ao criar a rota, pedidos do backlog usados são marcados `status = 'routed'` com o `route_id`
- Pedidos pendentes há mais de 7 dias geram warning visual
- Se o calendário for desativado (toggle OFF), backlog para de acumular e todos os pedidos vão direto para roteirização

