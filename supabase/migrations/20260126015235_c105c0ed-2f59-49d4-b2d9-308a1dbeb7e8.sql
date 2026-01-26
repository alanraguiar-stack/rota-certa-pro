-- Insert admin role for user alanraguiar@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('265bcbd5-f82e-42c5-9d22-93289af823b4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;