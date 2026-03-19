
CREATE TABLE public.pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 0,
  pedido_id text,
  product_description text,
  original_upload_date date NOT NULL DEFAULT CURRENT_DATE,
  target_day_of_week integer,
  status text NOT NULL DEFAULT 'pending',
  routed_at timestamptz,
  route_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending orders"
ON public.pending_orders FOR SELECT
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending orders"
ON public.pending_orders FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending orders"
ON public.pending_orders FOR UPDATE
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending orders"
ON public.pending_orders FOR DELETE
TO public
USING (auth.uid() = user_id);
