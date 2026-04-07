

# Plano: Remover política permissiva da tabela `login_attempts`

## Problema
A tabela `login_attempts` tem (ou teve) uma política `USING (true)` para o role `public`, permitindo que qualquer pessoa (inclusive não autenticada) leia todos os IPs de tentativas de login.

## Solução
Dropar qualquer política permissiva existente na tabela. O service_role (usado pelas Edge Functions) já bypassa RLS automaticamente, então nenhuma política de substituição é necessária.

## Migration SQL

```sql
-- Remove any overly permissive policies
DROP POLICY IF EXISTS "Service role full access" ON public.login_attempts;
DROP POLICY IF EXISTS "Allow service role" ON public.login_attempts;

-- Ensure RLS is enabled (should already be)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owner
ALTER TABLE public.login_attempts FORCE ROW LEVEL SECURITY;
```

Com isso, a tabela fica em modo "default deny" — nenhum client-side pode ler/escrever, e apenas o service_role (Edge Functions) tem acesso.

## Após a migration
Deletar o finding `login_attempts_open_read` do security manager.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Dropar políticas permissivas + FORCE RLS |

