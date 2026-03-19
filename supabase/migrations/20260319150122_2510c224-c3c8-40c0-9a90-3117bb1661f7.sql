
CREATE TABLE public.city_delivery_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  city_name text NOT NULL,
  day_of_week integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, city_name, day_of_week)
);

ALTER TABLE public.city_delivery_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule" ON public.city_delivery_schedule
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule" ON public.city_delivery_schedule
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule" ON public.city_delivery_schedule
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule" ON public.city_delivery_schedule
  FOR DELETE USING (auth.uid() = user_id);
