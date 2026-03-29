-- Fix 1: Drop the driver self-read policy on driver_access_codes (drivers don't need to read their own password hashes)
DROP POLICY IF EXISTS "Drivers can view own access code" ON public.driver_access_codes;

-- Fix 2: Tighten delivery-proofs storage policies with path-based ownership
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own delivery proofs" ON storage.objects;

-- SELECT: Admins can view all; drivers/route owners can view files in their own folder
CREATE POLICY "Admins can view all delivery proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-proofs'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Users can view own delivery proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'delivery-proofs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT: Users can only upload to their own folder
CREATE POLICY "Users can upload own delivery proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: Users can only update files in their own folder
CREATE POLICY "Users can update own delivery proofs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'delivery-proofs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );