

# Plano: Implementar Correções de Segurança (3 Fases)

## Fase 1 — Correções Críticas

### 1. Rate Limiting no `driver-login` e `driver-lookup`

Criar tabela `login_attempts` via migração:

```sql
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempt_type text NOT NULL DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, created_at);

-- Auto-cleanup de registros com mais de 1 hora
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Permitir que Edge Functions (service_role) insiram/leiam
CREATE POLICY "Service role full access" ON login_attempts FOR ALL USING (true) WITH CHECK (true);
```

Nas Edge Functions `driver-login` e `driver-lookup`:
- Antes de processar, contar tentativas do IP nos últimos 5 minutos
- Se >= 5 tentativas, retornar `429 Too Many Requests`
- Após cada tentativa (sucesso ou falha), inserir registro
- IP obtido via `req.headers.get('x-forwarded-for')` ou `x-real-ip`

### 2. Access Codes mais fortes (`create-test-driver`)

Substituir `generateAccessCode()`:

```typescript
function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/0/1
  const values = new Uint8Array(8);
  crypto.getRandomValues(values);
  const code = Array.from(values).map(v => chars[v % chars.length]).join('');
  return `RC-${code}`;
}
```

Formato: `RC-A7K2M9X4` (~1.1 trilhão de combinações vs 9000 antes).

### 3. Sanitizar mensagens de erro (4 Edge Functions)

Em todos os catches de `driver-login`, `driver-lookup`, `create-test-driver`, `optimize-route`:
- Trocar `err.message` por `"Erro interno do servidor"`
- Manter `console.error(err)` para debug server-side

### 4. Fallback seguro de role (`useUserRole.ts`)

Trocar `setRole('operacional')` por `setRole(null)` nos catches (linhas 37 e 43).

### 5. Bloquear acesso com role null (`AppLayout.tsx`)

Importar `useUserRole` e, quando `role === null && !roleLoading`, mostrar tela de "Acesso não autorizado" em vez de renderizar o conteúdo.

## Fase 2 — Melhorias

### 6. `driver-lookup` retorna nome parcial

Mascarar nome completo: `"João Silva"` → `"J. Silva"`. Retornar apenas inicial + sobrenome.

### 7. `robots.txt` atualizado

Adicionar:
```
Disallow: /motorista/
Disallow: /configuracoes
Disallow: /driver/
```

## Fase 3 — Hardening

### 8. Logger condicional (não incluído nesta implementação)

Criar wrapper `debugLog()` — baixa prioridade, documentar para próximo ciclo.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Criar tabela `login_attempts` |
| `supabase/functions/driver-login/index.ts` | Rate limiting + sanitizar erro |
| `supabase/functions/driver-lookup/index.ts` | Rate limiting + nome parcial + sanitizar erro |
| `supabase/functions/create-test-driver/index.ts` | Access code forte + sanitizar erro |
| `supabase/functions/optimize-route/index.ts` | Sanitizar erro |
| `src/hooks/useUserRole.ts` | Fallback `null` em vez de `operacional` |
| `src/components/layout/AppLayout.tsx` | Bloquear acesso quando role é null |
| `public/robots.txt` | Disallow rotas sensíveis |

