-- Fix driver_assignments UPDATE policy to prevent drivers from changing ownership
DROP POLICY IF EXISTS "Drivers can update own assignments" ON public.driver_assignments;

CREATE POLICY "Drivers can update own assignments" ON public.driver_assignments
  FOR UPDATE TO authenticated
  USING (auth.uid() = driver_user_id)
  WITH CHECK (auth.uid() = driver_user_id);