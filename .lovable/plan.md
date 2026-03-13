

# Melhorar tabela de Gerenciamento de Usuários

## Mudança

Atualizar a tabela de usuários em `src/pages/Settings.tsx` para mostrar colunas claras de **Senha** e **Link Rápido** para motoristas, além do nome e permissão já existentes.

### Colunas da tabela:
| Nome | Senha | Link Rápido | Permissão | Status | Ações |
|------|-------|-------------|-----------|--------|-------|

- **Senha**: mostra a senha armazenada em `driver_access_codes` para motoristas (com botão copiar). Para outros usuários, mostra "—".
- **Link Rápido**: mostra o link `/motorista/acesso/RC-XXXX` com botão copiar. Para não-motoristas, mostra "—".
- Mover o código de acesso que hoje aparece embaixo do nome para a coluna de Link Rápido.

### Formulário de criação
Já tem nome e senha — manter como está, apenas garantir que a senha seja obrigatória (não opcional).

### Arquivo: `src/pages/Settings.tsx`
- Adicionar colunas `Senha` e `Link Rápido` no `TableHeader`
- No `TableBody`, para cada usuário com `accessCodes[u.user_id]`, mostrar senha e link nas colunas corretas
- Tornar senha obrigatória na validação do `handleCreateDriver`

