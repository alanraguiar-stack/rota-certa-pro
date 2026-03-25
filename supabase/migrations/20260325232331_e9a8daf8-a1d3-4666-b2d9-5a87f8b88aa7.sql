
-- 1. Add was_manually_moved to route_history_patterns
ALTER TABLE public.route_history_patterns ADD COLUMN IF NOT EXISTS was_manually_moved boolean NOT NULL DEFAULT false;

-- 2. Create fleet_decision_history table
CREATE TABLE public.fleet_decision_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  total_weight numeric NOT NULL,
  total_orders integer NOT NULL,
  city_count integer NOT NULL DEFAULT 0,
  cities text[] NOT NULL DEFAULT '{}',
  trucks_selected integer NOT NULL,
  truck_plates text[] NOT NULL DEFAULT '{}',
  routing_strategy text DEFAULT 'padrao',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_decision_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fleet history" ON public.fleet_decision_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fleet history" ON public.fleet_decision_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Create territory_overrides table
CREATE TABLE public.territory_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  territory_id text NOT NULL,
  override_type text NOT NULL DEFAULT 'fill_city',
  city text NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.territory_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own territory overrides" ON public.territory_overrides
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own territory overrides" ON public.territory_overrides
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own territory overrides" ON public.territory_overrides
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own territory overrides" ON public.territory_overrides
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
