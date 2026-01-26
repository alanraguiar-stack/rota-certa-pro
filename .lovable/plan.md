
# Plano: Corrigir Constraint de Status da Tabela Routes

## Problema Identificado

O erro **"new row for relation 'routes' violates check constraint 'routes_status_check'"** ocorre porque:

1. A tabela `routes` foi criada com uma constraint que só permite 3 valores:
   ```sql
   CHECK (status IN ('draft', 'planned', 'completed'))
   ```

2. O código atual tenta usar novos status que não estão permitidos:
   - `'trucks_assigned'` - quando caminhões são atribuídos
   - `'loading'` - quando carga é distribuída
   - `'loading_confirmed'` - quando carregamento é confirmado
   - `'distributed'` - quando roteirização é concluída

3. A migração `20260123160454` apenas adicionou um **comentário** sobre os novos status, mas **não atualizou a constraint**

## Solução

Criar uma nova migração que:
1. Remove a constraint antiga
2. Cria uma nova constraint com todos os status necessários

## Alteração no Banco de Dados

| Tabela | Tipo | Descrição |
|--------|------|-----------|
| `routes` | ALTER CONSTRAINT | Atualizar a constraint `routes_status_check` para incluir novos valores de status |

### Migração SQL

```sql
-- Remover a constraint antiga
ALTER TABLE public.routes 
DROP CONSTRAINT IF EXISTS routes_status_check;

-- Criar nova constraint com todos os status necessários
ALTER TABLE public.routes 
ADD CONSTRAINT routes_status_check 
CHECK (status IN (
  'draft',              -- Rascunho inicial
  'planned',            -- Planejado (legado)
  'trucks_assigned',    -- Caminhões selecionados
  'loading',            -- Carga distribuída, aguardando confirmação
  'loading_confirmed',  -- Carregamento confirmado
  'distributed',        -- Roteirização concluída
  'completed'           -- Finalizado
));
```

## Mapa de Status do Fluxo

```text
┌─────────────┐    ┌──────────────────┐    ┌───────────┐
│   draft     │ -> │ trucks_assigned  │ -> │  loading  │
└─────────────┘    └──────────────────┘    └───────────┘
                                                  │
                                                  v
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  completed  │ <- │   distributed    │ <- │ loading_confirmed │
└─────────────┘    └──────────────────┘    └───────────────────┘
```

## Resultado Esperado

1. A distribuição de carga funcionará sem erro
2. O fluxo de status `draft -> trucks_assigned -> loading -> loading_confirmed -> distributed -> completed` será permitido
3. Manutenção da compatibilidade com status antigos (`planned`, `completed`)
