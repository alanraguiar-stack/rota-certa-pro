
# Plano: Menu Lateral Fixo e Simples

## Objetivo

Substituir o sidebar complexo (com hover, collapse, tooltips) por um menu lateral fixo, sempre expandido, sem comportamentos dinâmicos.

## O Que Vamos Fazer

### Simplificação Completa

1. **Remover toda a lógica de hover/collapse**
   - Sem `isHovering`, sem `handleMouseEnter/Leave`
   - Sem dependência do `SidebarProvider` state

2. **Menu sempre visível com largura fixa**
   - Largura de ~240px (padrão de sidebars)
   - Ícones + nomes sempre visíveis
   - Sem animações de expansão

3. **Remover o SidebarTrigger do header**
   - Não precisa de botão para expandir/colapsar
   - Header fica mais limpo

## Arquivos a Modificar

### 1. `src/components/layout/AppSidebar.tsx`

**Remover:**
- Estado `isHovering` e `useState`
- Funções `handleMouseEnter`, `handleMouseLeave`
- Variável `showExpanded` (tudo sempre visível)
- Tooltips (não são mais necessários)
- `useSidebar` hook
- Eventos `onMouseEnter/onMouseLeave` no Sidebar

**Simplificar:**
- Sidebar com `collapsible="none"` ou remover prop
- Todos os itens sempre mostram ícone + texto

### 2. `src/components/layout/AppLayout.tsx`

**Remover:**
- `SidebarTrigger` do header (não precisa mais)
- Pode manter `SidebarProvider` ou substituir por div simples

**Simplificar:**
- Layout flexbox simples: sidebar + conteúdo

## Estrutura Final

```
+------------------+--------------------------------+
|                  |  Header (sem botão menu)       |
|   MENU FIXO      +--------------------------------+
|   - Dashboard    |                                |
|   - Roteirização |       Conteúdo Principal       |
|   - Frota        |                                |
|   - Histórico    |                                |
|   -------------- |                                |
|   - Configurações|                                |
|   - Ajuda        |                                |
|   -------------- |                                |
|   [User Info]    |                                |
|   [Sair]         |                                |
+------------------+--------------------------------+
```

## Vantagens

- Zero bugs de hover/estado
- Código muito mais simples (~50% menos linhas)
- Sempre funciona, sem comportamento inesperado
- Mais fácil de manter e estilizar

## Resultado Esperado

- Menu lateral sempre visível com ~240px de largura
- Ícones e nomes sempre mostrados
- Item ativo destacado (Dashboard quando em `/`)
- Funciona perfeitamente sem lógica complexa
