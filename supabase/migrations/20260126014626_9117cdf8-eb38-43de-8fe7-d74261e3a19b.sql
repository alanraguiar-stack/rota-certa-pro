-- Add detailed vehicle information columns to trucks table
ALTER TABLE public.trucks
ADD COLUMN IF NOT EXISTS marca TEXT,
ADD COLUMN IF NOT EXISTS ano INTEGER,
ADD COLUMN IF NOT EXISTS renavam TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Add unique constraint on plate (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trucks_plate_unique'
  ) THEN
    ALTER TABLE public.trucks ADD CONSTRAINT trucks_plate_unique UNIQUE (plate);
  END IF;
END $$;

-- Create index for plate lookups
CREATE INDEX IF NOT EXISTS idx_trucks_plate ON public.trucks(plate);

-- Create index for renavam lookups
CREATE INDEX IF NOT EXISTS idx_trucks_renavam ON public.trucks(renavam);