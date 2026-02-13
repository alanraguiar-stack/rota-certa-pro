
-- Create table for historical route patterns (learning from analyst)
CREATE TABLE public.route_history_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  truck_label TEXT NOT NULL,
  route_date DATE,
  sequence_order INTEGER,
  sale_number TEXT,
  client_name TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.route_history_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own history patterns"
  ON public.route_history_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history patterns"
  ON public.route_history_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history patterns"
  ON public.route_history_patterns FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups by city patterns
CREATE INDEX idx_route_history_city ON public.route_history_patterns (user_id, city, truck_label);
CREATE INDEX idx_route_history_date ON public.route_history_patterns (user_id, route_date);
