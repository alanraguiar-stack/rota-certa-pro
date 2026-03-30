
CREATE TABLE public.truck_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  anchor_city text NOT NULL DEFAULT '',
  fill_cities text[] NOT NULL DEFAULT '{}',
  max_deliveries integer NOT NULL DEFAULT 25,
  priority integer NOT NULL DEFAULT 50,
  is_support boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, truck_id)
);

ALTER TABLE public.truck_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own truck territories"
ON public.truck_territories FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own truck territories"
ON public.truck_territories FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own truck territories"
ON public.truck_territories FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own truck territories"
ON public.truck_territories FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
