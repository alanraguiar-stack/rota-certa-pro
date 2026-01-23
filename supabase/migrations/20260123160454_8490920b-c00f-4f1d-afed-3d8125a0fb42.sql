-- Add product_description column to orders table
ALTER TABLE public.orders 
ADD COLUMN product_description text;

-- Add loading confirmation fields to routes table
ALTER TABLE public.routes 
ADD COLUMN loading_confirmed_at timestamp with time zone,
ADD COLUMN loading_confirmed_by text;

-- Update status check - now routes can have these statuses:
-- 'draft' - initial, orders added
-- 'trucks_assigned' - trucks selected but not distributed
-- 'loading' - carga distribuída, aguardando confirmação de carregamento
-- 'loading_confirmed' - carregamento confirmado, pronto para roteirizar
-- 'distributed' - roteirização concluída

COMMENT ON COLUMN public.orders.product_description IS 'Description of the product being delivered (e.g., Mussarela, Mortadela)';
COMMENT ON COLUMN public.routes.loading_confirmed_at IS 'Timestamp when loading manifest was confirmed';
COMMENT ON COLUMN public.routes.loading_confirmed_by IS 'Name of person who confirmed the loading';