-- Remove any overly permissive policies
DROP POLICY IF EXISTS "Service role full access" ON public.login_attempts;
DROP POLICY IF EXISTS "Allow service role" ON public.login_attempts;

-- Ensure RLS is enabled
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner
ALTER TABLE public.login_attempts FORCE ROW LEVEL SECURITY;