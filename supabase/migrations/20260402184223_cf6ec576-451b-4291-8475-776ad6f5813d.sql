
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempt_type text NOT NULL DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, created_at);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Service role has full access (Edge Functions use service_role key)
CREATE POLICY "Service role full access" ON login_attempts FOR ALL USING (true) WITH CHECK (true);

-- Auto-cleanup function for old attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '1 hour';
$$;
