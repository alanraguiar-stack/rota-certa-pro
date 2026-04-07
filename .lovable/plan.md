

# Plano: Restringir políticas da tabela `user_roles` ao role `authenticated`

## Problema
As políticas INSERT, UPDATE e DELETE da tabela `user_roles` usam `TO {public}`, o que inclui usuários não autenticados. Mesmo com `has_role()` verificando admin, o role `public` é mais permissivo do que necessário.

## Solução
Recriar as políticas de INSERT, UPDATE e DELETE com `TO authenticated` em vez de `TO public`, eliminando qualquer possibilidade de acesso não autenticado.

## Migration SQL

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Recreate with authenticated role only
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
```

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Recriar políticas INSERT/UPDATE/DELETE com `TO authenticated` |

Após a migration, o finding será deletado do security manager.

