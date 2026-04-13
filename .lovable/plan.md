

# Melhorias: Layout, Gestão de Usuários, Cópia de Endereço + Aprendizado

## 1. Layout "Frota confirmada" (NewRoute.tsx)

O card verde em `src/pages/NewRoute.tsx` (linhas 466-481) está compacto demais. Ajustes:
- Aumentar padding interno
- Ícone maior (h-12 w-12)
- Tipografia mais espaçada
- Texto secundário com margem maior

## 2. Gestão de Usuários (Settings.tsx)

Atualmente a criação de motorista é inline. Mudanças:
- **Botão "Criar Usuário"** que abre um `Dialog` (popup)
- No popup: nome, email, senha, e **seletor de categoria** (Admin / Operacional / Motorista)
- Ao criar motorista, continua usando a edge function `create-test-driver`; para admin/operacional, criar via `supabase.auth.signUp` + inserir role
- **Botão "Excluir"** visível apenas para usuários **inativos** (desativados), com confirmação
- Excluir: deletar `user_roles`, `profiles`, `driver_access_codes` do user (não é possível deletar de `auth.users` pelo client, mas limpar as tabelas públicas efetivamente remove o acesso)

## 3. Cópia rápida de endereço (TruckRouteEditor.tsx)

No card de cada entrega (linhas 192-195 do `TruckRouteEditor.tsx`), após o endereço, adicionar um ícone pequeno de cópia (`Copy` do Lucide, `h-3 w-3`) que copia o endereço para a clipboard com um toast discreto.

```text
📍 Rua Exemplo, 123 - Bairro, Cidade - SP  [📋]
```

## 4. Confirmação sobre aprendizado

O sistema já captura automaticamente snapshots das alterações manuais (conforme o motor `HistoryGuidedRouter`). Isso já está funcionando — nenhuma mudança de código necessária. Apenas confirmar ao usuário na resposta.

## Arquivos

- `src/pages/NewRoute.tsx` — melhorar layout do card "Frota confirmada"
- `src/pages/Settings.tsx` — popup de criação de usuário com categoria, botão excluir para inativos
- `src/components/route/TruckRouteEditor.tsx` — ícone de cópia ao lado do endereço
- `src/hooks/useUserRole.ts` — adicionar método `deleteUser`

