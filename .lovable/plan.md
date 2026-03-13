

# Corrigir cards em branco no dashboard do motorista

## Problema raiz

Os cards de entrega aparecem sem nome do cliente e sem endereço porque o motorista **não tem permissão RLS** para ler a tabela `orders`. A policy atual exige `routes.user_id = auth.uid()` — o motorista não é dono da rota, então o join `order:orders(...)` retorna `null`.

Mesmo problema com `order_assignments` (usada para buscar `delivery_sequence`) — também restrita ao dono da rota.

## Solução

### 1. Migração SQL — Permitir motoristas lerem seus pedidos

Adicionar policies SELECT em `orders` e `order_assignments` para motoristas:

```sql
-- Motoristas podem ver orders das suas entregas
CREATE POLICY "Drivers can view assigned orders"
  ON public.orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.delivery_executions de
    JOIN public.driver_assignments da ON da.id = de.driver_assignment_id
    WHERE de.order_id = orders.id
    AND da.driver_user_id = auth.uid()
  ));

-- Motoristas podem ver order_assignments das suas rotas
CREATE POLICY "Drivers can view order_assignments"
  ON public.order_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.driver_assignments da
    WHERE da.route_truck_id = order_assignments.route_truck_id
    AND da.driver_user_id = auth.uid()
  ));
```

### 2. DeliveryCard — Mostrar informações úteis

O card já renderiza `client_name`, `address` e `weight_kg` — só estavam null por RLS. Com a correção, os dados aparecerão. Adicionalmente, mostrar o peso (`weight_kg`) e descrição do produto no card para dar mais contexto ao motorista.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Policies SELECT em orders e order_assignments para motoristas |
| `src/components/driver/DeliveryCard.tsx` | Adicionar peso e descrição do produto ao card |

