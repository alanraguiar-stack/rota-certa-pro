

# Plano: Limite Global de 25, Usuarios Fake, Revisao do Fluxo Motorista e Realtime

## 1. Limite de 25 entregas para TODOS os caminhoes (incluindo nao-ancora)

**Problema:** O `autoRouterEngine.ts` aplica `maxDeliveries` apenas para caminhoes ancora (via `anchorRules`). Caminhoes nao-ancora (Step 5c, linhas 372-403) nao tem nenhum limite de entregas — aceitam tudo que couber no peso.

**Correcao:** `src/lib/autoRouterEngine.ts` — No loop de caminhoes nao-ancora (Step 5c), adicionar verificacao `assignedOrders.length >= 25` como condicao de parada. Tambem aplicar o `max_deliveries` do banco se estiver preenchido no truck.

Tambem garantir que `src/lib/distribution.ts` (funcao legada) respeite o limite.

## 2. Criar usuarios fake para teste de atribuicao de motorista

**Arquivo:** `src/pages/Settings.tsx`

Adicionar um botao na aba de Gestao de Usuarios (admin) para "Criar Motorista de Teste". Ao clicar:
- Chama `supabase.auth.signUp` com email fake (ex: `motorista_teste_1@rotacerta.test`) e senha padrao
- Cria profile com nome "Motorista Teste 1"
- Atribui role `motorista` na tabela `user_roles`
- Isso permite testar a atribuicao de rota e visualizar pela otica do motorista fazendo login com esse usuario

O admin precisara saber o email/senha para logar como motorista em outra aba. Exibiremos essa informacao na tela.

**Nota:** Sera necessario habilitar auto-confirm apenas para esses usuarios de teste, OU usar a service role key via edge function para criar o usuario ja confirmado.

**Abordagem:** Criar uma edge function `create-test-driver` que usa a service role key para criar o usuario via `supabase.auth.admin.createUser({ email, password, email_confirm: true })`, insere o profile e o role. O frontend chama essa edge function.

## 3. Revisar fluxo completo do motorista

O fluxo atual:
1. **Receber rota:** `DriverDashboard` busca `driver_assignments` com join em `route_trucks/trucks/routes` — OK
2. **Iniciar roteiro:** Marca status `em_andamento` e abre Google Maps com todas as paradas pendentes — OK
3. **Ticar entrega:** Clica na entrega pendente → `DeliveryConfirmation` com assinatura + foto + observacoes — OK
4. **Google Maps paradas:** Usa `buildGoogleMapsUrl` com enderecos das entregas pendentes — OK, mas preciso verificar se a ordem respeita `delivery_sequence`

**Problemas identificados:**
- As entregas no `fetchDeliveries` sao ordenadas por `created_at` e nao por `delivery_sequence` da `order_assignments`. Isso pode colocar as paradas fora da ordem planejada no Google Maps.
- Apos confirmar entrega, o sistema navega para a proxima parada individual mas deveria reabrir o Maps com TODAS as paradas restantes (nao apenas a proxima).

**Correcoes:**
- `src/hooks/useDriverRoutes.ts`: Alterar `fetchDeliveries` para fazer join com `order_assignments` e ordenar por `delivery_sequence`
- `src/pages/DeliveryConfirmation.tsx`: Apos confirmar, reabrir Google Maps com todas as paradas pendentes restantes (nao apenas a proxima)

## 4. Realtime — Admin ve entregas sendo ticadas em tempo real

**Abordagem:**
- Habilitar realtime na tabela `delivery_executions` via migracao SQL
- No `ExecutionTracker.tsx`, adicionar um canal realtime que escuta `postgres_changes` na tabela `delivery_executions`. Quando um motorista tica uma entrega (UPDATE de status), o admin ve a atualizacao automaticamente sem precisar clicar "Atualizar"

**Migracao SQL:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_executions;
```

**Arquivo:** `src/components/route/ExecutionTracker.tsx` — Adicionar `useEffect` com `supabase.channel('executions').on('postgres_changes', ...)` que chama `fetchData()` quando detecta mudanca.

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/autoRouterEngine.ts` | Limite de 25 entregas para caminhoes nao-ancora |
| `src/pages/Settings.tsx` | Botao "Criar Motorista de Teste" (chama edge function) |
| `supabase/functions/create-test-driver/index.ts` | Edge function para criar usuario fake confirmado |
| `src/hooks/useDriverRoutes.ts` | Ordenar deliveries por `delivery_sequence` |
| `src/pages/DeliveryConfirmation.tsx` | Reabrir Maps com todas paradas restantes |
| `src/components/route/ExecutionTracker.tsx` | Subscription realtime para atualizacao automatica |
| Migracao SQL | Habilitar realtime na tabela `delivery_executions` |

