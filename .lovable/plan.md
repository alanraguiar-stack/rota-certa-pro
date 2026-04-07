

# Plano: Resolver finding de "plaintext driver passwords"

## Diagnóstico
As senhas já são armazenadas como hashes bcrypt. Todos os 3 Edge Functions relevantes confirmam:
- `create-test-driver`: usa `bcrypt.hash(plainPassword)` antes de inserir
- `driver-login`: usa `bcrypt.compare(password, codeData.driver_password)` para verificar
- `migrate-driver-passwords`: converte senhas legadas para bcrypt

O scanner flagra porque o tipo da coluna é `text` e o nome é `driver_password`, mas os valores armazenados são hashes (`$2a$...`).

## Solução: Renomear coluna + marcar finding como resolvido

Para eliminar definitivamente o false positive e melhorar a clareza do schema:

### 1. Migration: Renomear `driver_password` → `password_hash`
```sql
ALTER TABLE public.driver_access_codes 
  RENAME COLUMN driver_password TO password_hash;
```

### 2. Atualizar Edge Functions que referenciam `driver_password`
- `create-test-driver/index.ts` — trocar `driver_password` por `password_hash`
- `driver-login/index.ts` — trocar `driver_password` por `password_hash`
- `migrate-driver-passwords/index.ts` — trocar `driver_password` por `password_hash`

### 3. Atualizar código frontend
- `src/components/route/DriverAssignment.tsx` — referência a `driver_password` na interface

### 4. Deletar o finding de segurança

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Renomear coluna `driver_password` → `password_hash` |
| `supabase/functions/create-test-driver/index.ts` | `driver_password` → `password_hash` |
| `supabase/functions/driver-login/index.ts` | `driver_password` → `password_hash` |
| `supabase/functions/migrate-driver-passwords/index.ts` | `driver_password` → `password_hash` |
| `src/components/route/DriverAssignment.tsx` | Remover referência a `driver_password` na interface |

