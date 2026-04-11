
-- Drop the existing check constraint on weight_kg and replace with >= 0
DO $$
BEGIN
  -- Try to drop named constraint first
  ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_weight_kg_check;
  
  -- Also try common auto-generated names
  ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS check_weight_kg;
  ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_weight_kg_check1;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Find and drop any remaining check constraints on weight_kg
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'order_items'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%weight_kg%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Add the new constraint allowing zero
ALTER TABLE public.order_items ADD CONSTRAINT order_items_weight_kg_check CHECK (weight_kg >= 0);
