

# Plano: Corrigir Todas as Vulnerabilidades de Segurança (1 Error + 4 Warnings)

## Resumo Rápido

| # | Severidade | Problema | Status |
|---|---|---|---|
| 1 | ERROR | Senhas expostas via RLS anon | **Já corrigido** — a migration `20260329201451` já removeu a política. O scan está desatualizado. |
| 2 | WARN | Perfil sem DELETE (GDPR) | Precisa de migration |
| 3 | WARN | Senhas em texto simples | Precisa de bcrypt nas edge functions |
| 4 | WARN | Leaked password protection desabilitado | Configuração no Cloud |
| 5 | WARN | Vulnerabilidade no pacote xlsx | Atualizar dependência |

---

## Fix 1: ERROR — Anon RLS (Já Resolvido)

A política `"Anon can read access codes for login"` já foi removida na migration `20260329201451`. A tabela `driver_access_codes` agora só tem políticas para `admin` e `motorista autenticado`. O scan precisa ser re-executado para refletir a correção.

**Ação**: Nenhuma. Apenas re-rodar o scan.

---

## Fix 2: WARN — Política DELETE no profiles (GDPR)

Migration SQL:
```sql
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);
```

Isso permite que usuários exerçam direito de exclusão de dados. Motoristas (gerenciados por admin) não conseguem deletar porque o admin controla a conta — mas o mecanismo fica disponível.

---

## Fix 3: WARN — Senhas em Texto Simples → bcrypt

Duas edge functions precisam de alteração:

### `create-test-driver/index.ts`
- Importar bcrypt: `import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'`
- Antes de salvar em `driver_access_codes`, hashear a senha:
  ```typescript
  const hashedPassword = await bcrypt.hash(password)
  // Salvar hashedPassword na coluna driver_password
  ```
- Continuar usando a senha original para criar o user no Auth (o Auth tem seu próprio hash interno)
- Retornar a senha original na response (para o admin copiar e dar ao motorista)

### `driver-login/index.ts`
- Importar bcrypt
- Substituir comparação de string por:
  ```typescript
  const valid = await bcrypt.compare(password, codeData.driver_password)
  if (!valid) return 401
  ```
- Para o `signInWithPassword`, usar a senha fornecida pelo usuário (não o hash)

### `DriverAssignment.tsx`
- O componente mostra `accessInfo.driver_password` para o admin copiar. Após o hash, esse campo terá o hash (inútil para o admin).
- Solução: Não exibir a senha armazenada. Ao invés disso, mostrar apenas na criação do motorista (quando a senha original é retornada pela edge function). Remover a exibição de senha do painel de atribuição ou adicionar um botão "Resetar senha" que gera nova senha via edge function.

### Migração de senhas existentes
- Criar edge function `migrate-driver-passwords` que lê todas as senhas plaintext, hasheia com bcrypt, e atualiza. Executar uma vez e deletar.

---

## Fix 4: WARN — Leaked Password Protection (HIBP)

Usar a ferramenta `configure_auth` para habilitar o HIBP check. Isso bloqueia senhas que apareceram em vazamentos conhecidos.

---

## Fix 5: WARN — Vulnerabilidade no xlsx

O pacote `xlsx@^0.18.5` tem vulnerabilidades de Prototype Pollution e ReDoS. Substituir por `xlsx` versão mais recente ou usar alternativa segura como `read-excel-file` ou `exceljs`. Verificar uso no código e trocar se necessário.

---

## Ordem de Execução

1. Migration DELETE policy (profiles) — rápido, sem impacto
2. Habilitar HIBP — configuração
3. Atualizar bcrypt nas edge functions (create-test-driver + driver-login)
4. Criar edge function de migração de senhas existentes
5. Ajustar DriverAssignment.tsx para não exibir hash
6. Atualizar/substituir xlsx

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | DELETE policy em profiles |
| `supabase/functions/create-test-driver/index.ts` | bcrypt hash na criação |
| `supabase/functions/driver-login/index.ts` | bcrypt compare no login |
| `supabase/functions/migrate-driver-passwords/index.ts` | Nova — migração única |
| `src/components/route/DriverAssignment.tsx` | Remover exibição de senha hasheada |
| `package.json` | Atualizar/substituir xlsx |
| Auth config | Habilitar HIBP |

