
# Bloquear acesso do motorista à página de Configurações

O motorista consegue acessar `/configuracoes` diretamente (mesmo sem o link no menu). A página Settings precisa verificar o role e redirecionar motoristas.

## Correção

**Arquivo:** `src/pages/Settings.tsx`

No componente `Settings`, usar `useUserRole()` para verificar se o usuário é motorista. Se `isMotorista === true`, renderizar `<Navigate to="/motorista" replace />` em vez do conteúdo da página.

Isso garante que mesmo acessando a URL diretamente, o motorista será redirecionado para seu dashboard.
