
CREATE TABLE public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_units_user ON product_units(user_id);

ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product units"
  ON product_units FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product units"
  ON product_units FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product units"
  ON product_units FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product units"
  ON product_units FOR DELETE
  USING (auth.uid() = user_id);
