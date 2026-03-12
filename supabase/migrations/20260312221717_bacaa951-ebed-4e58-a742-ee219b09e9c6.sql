
-- Table for driver access codes
CREATE TABLE public.driver_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  driver_password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_access_codes ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage access codes"
  ON public.driver_access_codes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Drivers can read their own code
CREATE POLICY "Drivers can view own access code"
  ON public.driver_access_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow anon select for login by code (edge function will handle auth)
CREATE POLICY "Anon can read access codes for login"
  ON public.driver_access_codes
  FOR SELECT
  TO anon
  USING (true);
