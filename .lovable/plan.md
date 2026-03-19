

# Calendário de Entregas por Cidade — com Toggle de Ativação

## Resumo

Implementar a configuração de dias da semana por cidade em Configurações, com um **switch master ON/OFF** que controla se o filtro é aplicado na roteirização. Começa desligado (OFF) — a funcionalidade fica pronta mas inativa até o usuário ativar.

## UX

Nova aba **"Calendário"** em Configurações com:

1. **Switch master** no topo: "Filtrar cidades por dia da semana" (OFF por padrão)
   - OFF: grade visível mas com opacidade reduzida + badge "Inativo" — roteirização ignora o calendário
   - ON: grade ativa — roteirização filtra cidades conforme configuração

2. **Grade cidade × dia** com checkboxes (Seg–Sáb)
   - Cidades extraídas dos territórios existentes (`TERRITORY_RULES`)
   - Coluna de "amanhã" destacada visualmente
   - Ações: Marcar Todos / Limpar Todos / Salvar

3. **Preview**: "Amanhã (Terça) — entregas em: Barueri, Osasco, Cotia"

## Mudanças Técnicas

### 1. Migração SQL — tabela `city_delivery_schedule`

```sql
CREATE TABLE city_delivery_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  city_name text NOT NULL,
  day_of_week integer NOT NULL, -- 0=Dom, 1=Seg, ..., 6=Sáb
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, city_name, day_of_week)
);
ALTER TABLE city_delivery_schedule ENABLE ROW LEVEL SECURITY;
-- RLS: user CRUD own records
```

O toggle ON/OFF será salvo na tabela existente `app_settings` com `setting_key = 'city_schedule_enabled'` e `setting_value = 'true'/'false'`.

### 2. Novo hook `src/hooks/useCitySchedule.ts`

- `schedule`: mapa `{ [city]: Set<dayOfWeek> }`
- `isEnabled`: boolean (lido de `app_settings`)
- `toggleEnabled()`: alterna ON/OFF
- `saveSchedule(schedule)`: delete all + insert batch
- `getCitiesForDate(date)`: retorna cidades ativas para um dia (ou todas se disabled)

### 3. Nova aba em `src/pages/Settings.tsx`

- Aba "Calendário" com ícone `CalendarDays`
- Switch master no CardHeader
- Grade de checkboxes com destaque na coluna de amanhã
- Botões de ação em lote + salvar

### 4. Integração com roteirização

**`src/lib/autoRouterEngine.ts`**: `autoComposeRoute` recebe parâmetro opcional `allowedCities?: Set<string>`. Se fornecido, pedidos de cidades fora do set vão para `unassignedOrders`.

**`src/pages/NewRoute.tsx`**: ao criar rota, consulta `useCitySchedule`. Se enabled, passa `getCitiesForDate(amanhã)` ao engine. Se disabled, não filtra nada.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Criar `city_delivery_schedule` + RLS |
| `src/hooks/useCitySchedule.ts` | Novo hook |
| `src/pages/Settings.tsx` | Nova aba "Calendário" |
| `src/lib/autoRouterEngine.ts` | Parâmetro `allowedCities` opcional |
| `src/pages/NewRoute.tsx` | Consultar schedule e passar ao engine |

