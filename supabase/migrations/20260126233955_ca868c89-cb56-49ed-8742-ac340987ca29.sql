-- Remover a constraint antiga
ALTER TABLE public.routes 
DROP CONSTRAINT IF EXISTS routes_status_check;

-- Criar nova constraint com todos os status necessários
ALTER TABLE public.routes 
ADD CONSTRAINT routes_status_check 
CHECK (status IN (
  'draft',
  'planned',
  'trucks_assigned',
  'loading',
  'loading_confirmed',
  'distributed',
  'completed'
));