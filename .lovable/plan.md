

# Plano: Corrigir Logout e Redirecionamento para Página de Login

## Resumo do Problema
O botão "Sair" não está redirecionando para a página de login porque:
1. A função `signOut` não faz navegação explícita
2. Quando a sessão já está expirada, o logout falha silenciosamente
3. O estado do usuário não é limpo adequadamente em todos os cenários

## Solução

### 1. Melhorar a Função signOut no AuthContext
Modificar `src/contexts/AuthContext.tsx` para:
- Limpar manualmente o estado do usuário e sessão após logout
- Usar scope: 'local' para garantir limpeza mesmo se o servidor não responder
- Tratar erros silenciosamente (o importante é limpar o estado local)

```typescript
const signOut = async () => {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.error('Erro no logout:', error);
  } finally {
    // Garante limpeza do estado mesmo se houver erro
    setUser(null);
    setSession(null);
  }
};
```

### 2. Adicionar Navegação Programática no AppSidebar
Modificar `src/components/layout/AppSidebar.tsx` para:
- Importar `useNavigate` do react-router-dom
- Navegar para `/login` após chamar signOut

```typescript
import { useNavigate } from 'react-router-dom';

// No componente:
const navigate = useNavigate();

const handleSignOut = async () => {
  await signOut();
  navigate('/login', { replace: true });
};
```

### 3. Corrigir Warning do AnimatedTruck
Modificar `src/pages/Auth.tsx` para resolver o warning de ref:
- Remover qualquer ref que esteja sendo passada para o componente
- Ou envolver com forwardRef se necessário

## Arquivos a Modificar
1. `src/contexts/AuthContext.tsx` - Melhorar lógica de signOut
2. `src/components/layout/AppSidebar.tsx` - Adicionar navegação após logout
3. `src/pages/Auth.tsx` - Corrigir warning do AnimatedTruck (opcional, não bloqueia)

## Resultado Esperado
- Clicar em "Sair" limpa o estado do usuário
- Navegação automática para `/login`
- Funciona mesmo se a sessão já estiver expirada no servidor

