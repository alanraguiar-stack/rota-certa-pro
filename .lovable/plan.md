

# Corrigir acesso da Caroline Santos Mendes

## Causa raiz

A Caroline tem **dois papéis** simultâneos na tabela `user_roles`: `admin` e `operacional`. O hook `useUserRole` usa `.single()` no Supabase — quando encontra mais de uma linha, lança erro e define `role = null`. O `AppLayout` então exibe a tela "Acesso não autorizado".

Esse bug pode acontecer com qualquer usuário que receba mais de um papel (provavelmente causado pelo `upsert` no `updateUserRole` com `onConflict: 'user_id,role'`, que não substitui papéis diferentes — apenas evita duplicar o mesmo papel).

## Correção em 2 partes

### 1. Banco — limpar duplicata da Caroline
Remover o papel `operacional` da Caroline, mantendo `admin`:

```sql
DELETE FROM user_roles 
WHERE user_id = '24aba505-cf01-4edd-bcb8-25d02206d2c9' 
  AND role = 'operacional';
```

### 2. Código — blindar contra papéis múltiplos no futuro

**`src/hooks/useUserRole.ts`** — trocar `.single()` por busca ordenada que pega o papel de maior privilégio quando houver mais de um:
- Buscar todos os papéis do usuário (sem `.single()`)
- Aplicar prioridade: `admin` > `operacional` > `motorista`
- Retornar o de maior privilégio

**`updateUserRole`** — antes de inserir o novo papel, deletar quaisquer papéis existentes do usuário, garantindo um único papel por usuário:
```ts
await supabase.from('user_roles').delete().eq('user_id', userId);
await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
```

## Resultado

- Caroline volta a acessar como admin imediatamente
- Sistema fica imune a esse tipo de bloqueio caso outro usuário acabe com papéis duplicados
- Atualizações de papel passam a substituir, não acumular

## Arquivos

- Migração SQL — limpar papel duplicado da Caroline
- `src/hooks/useUserRole.ts` — busca tolerante a múltiplos papéis + `updateUserRole` com delete-then-insert

