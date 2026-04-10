ALTER TABLE public.orders ADD COLUMN pedido_id text;
CREATE INDEX idx_orders_pedido_id ON public.orders(pedido_id);