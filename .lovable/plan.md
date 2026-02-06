
# Plano: Corrigir Destaque Persistente no Menu da Sidebar

## Problema Identificado

Quando o usuário passa o mouse sobre a sidebar e depois move para fora, os ícones/itens do menu permanecem visualmente "marcados" (com destaque). Isso acontece por dois motivos:

1. **Estado do Tooltip**: O componente `Tooltip` do Radix UI adiciona `data-state="open"` ao trigger quando está visível. Os estilos do `SidebarMenuButton` incluem `data-[state=open]:hover:bg-sidebar-accent` que pode manter o destaque
2. **Background fixo nos ícones**: Cada ícone tem `bg-sidebar-accent/50` aplicado permanentemente, criando confusão visual sobre qual está ativo

## Solução

### 1. Remover Background Fixo dos Ícones

Modificar os containers dos ícones em `AppSidebar.tsx` para não terem fundo por padrão, apenas no hover:

**Antes:**
```tsx
<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent/50 transition-colors group-hover:bg-sidebar-accent">
```

**Depois:**
```tsx
<div className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors group-hover:bg-sidebar-accent/50">
```

### 2. Simplificar Estrutura do Menu

Remover a estrutura aninhada de Tooltip dentro de SidebarMenuButton, usando a prop `tooltip` nativa do SidebarMenuButton quando disponível.

### 3. Garantir que Estilos de Hover Resetem Corretamente

Adicionar transições CSS mais explícitas e garantir que o estado visual dependa apenas de `:hover` e da rota ativa (via `activeClassName`).

## Arquivos a Modificar

### `src/components/layout/AppSidebar.tsx`

1. Remover `bg-sidebar-accent/50` dos containers de ícone (manter apenas no hover)
2. Simplificar a estrutura do Tooltip para evitar estados persistentes
3. Remover classes redundantes de hover no NavLink

## Detalhes Técnicos

### Mudanças nos Itens do Menu Principal (mainMenuItems)

```tsx
// Container do ícone - remover background fixo
<div className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors group-hover:bg-sidebar-accent/60">
  <item.icon className="h-5 w-5 shrink-0" />
</div>
```

### Mudanças nos Itens Secundários

Aplicar a mesma lógica para manter consistência visual.

### Mudanças no Botão de Ajuda

Aplicar a mesma lógica.

### Mudanças no Botão Sair

Manter o estilo atual pois já está correto (sem background fixo).

## Resultado Esperado

- Ícones aparecem sem fundo quando não estão sendo "hovered"
- Ao passar o mouse, o fundo aparece suavemente
- Ao tirar o mouse, o fundo desaparece imediatamente
- Apenas o item da rota ativa permanece destacado (Dashboard quando em `/`)
