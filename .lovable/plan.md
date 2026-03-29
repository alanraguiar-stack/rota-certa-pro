

# Fix: Remover Exposição de Senhas via RLS

## Problema

A política `Anon can read access codes for login` permite que qualquer pessoa não autenticada leia TODAS as linhas de `driver_access_codes`, incluindo `driver_password` em texto simples.

## Causa

O `DriverAccess.tsx` faz uma query client-side para buscar o nome do motorista a partir do `access_code` — por isso a política anon existe. Porém isso é desnecessário porque o login já passa pela edge function `driver-login`.

## Solução

1. **Remover a política RLS anon** via migration:
```sql
DROP POLICY "Anon can read access codes for login" ON public.driver_access_codes;
```

2. **Mover a busca do nome do motorista para a edge function `driver-login`**: Retornar `fullName` na resposta da edge function (que já usa service role key e já faz o lookup do `user_id`). Adicionar uma rota ou campo que retorne o nome sem precisar de senha (apenas com `accessCode`).

3. **Alternativa mais simples**: Criar uma nova edge function `driver-lookup` que recebe apenas o `accessCode`, valida que existe, e retorna apenas o `full_name` — sem expor senha ou user_id.

4. **Atualizar `DriverAccess.tsx`**: Substituir a query direta ao `driver_access_codes` por uma chamada à edge function `driver-lookup`.

| Arquivo | Mudança |
|---|---|
| Migration SQL | `DROP POLICY "Anon can read access codes for login"` |
| `supabase/functions/driver-lookup/index.ts` | Nova edge function: recebe `accessCode`, retorna `full_name` |
| `src/pages/DriverAccess.tsx` | Trocar query client-side por `supabase.functions.invoke('driver-lookup')` |

