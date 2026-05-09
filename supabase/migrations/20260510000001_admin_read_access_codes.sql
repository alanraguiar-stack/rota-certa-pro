-- Permite que admins leiam todos os códigos de acesso dos motoristas
-- Necessário para a aba de Gerenciamento de Usuários nas Configurações

CREATE POLICY "Admins can view all access codes"
ON public.driver_access_codes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
