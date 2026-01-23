-- Create geocoding cache table
CREATE TABLE public.geocoding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_hash TEXT UNIQUE NOT NULL,
  original_address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  display_name TEXT,
  confidence TEXT DEFAULT 'nominatim',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cache (shared resource)
CREATE POLICY "Authenticated users can view geocoding cache"
ON public.geocoding_cache
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert into cache
CREATE POLICY "Authenticated users can insert geocoding cache"
ON public.geocoding_cache
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add geocoding columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS geocoding_status TEXT DEFAULT 'pending';