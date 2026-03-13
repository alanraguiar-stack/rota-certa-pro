

# Corrigir persistência de motoristas + senha customizável

## Problema raiz: RLS bloqueia visibilidade

A tabela `profiles` tem RLS `auth.uid() = user_id` para SELECT. O admin só consegue ver **seu próprio** perfil. Quando `getAllUsers()` consulta profiles, retorna apenas 1 registro. Os motoristas existem no banco mas são invisíveis para o admin.

Mesmo problema na `user_roles`: a policy SELECT é `has_role(auth.uid(), 'admin')` — isso funciona. Mas profiles não tem policy para admin.

## Correções

### 1. Migração SQL — Admin pode ver todos os profiles
Adicionar policy SELECT em `profiles` para admins:
```sql
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

### 2. `src/pages/Settings.tsx` — Campo de senha customizável
- Adicionar estado `newDriverPassword` com input de senha no formulário de criação
- Enviar `driverPassword` no body da edge function
- Validação mínima: 6 caracteres

### 3. `supabase/functions/create-test-driver/index.ts` — Aceitar senha customizada
- Receber `driverPassword` do body (opcional, fallback para senha gerada)
- Usar essa senha no `createUser` e no `driver_access_codes`

### 4. Lista de motoristas com link de acesso
- Na tabela de usuários, mostrar o link de acesso ao lado de cada motorista (buscar da tabela `driver_access_codes`)
- Permitir copiar o link diretamente da lista

## Arquivos

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Policy admin SELECT em profiles |
| `src/pages/Settings.tsx` | Campo senha, exibir links de acesso na lista |
| `supabase/functions/create-test-driver/index.ts` | Aceitar senha customizada |

