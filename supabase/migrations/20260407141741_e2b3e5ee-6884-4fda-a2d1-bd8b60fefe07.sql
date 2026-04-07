-- Fix 1: Remove overly permissive policy on login_attempts
DROP POLICY IF EXISTS "Service role full access" ON public.login_attempts;

-- Fix 2: Make delivery-proofs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'delivery-proofs';