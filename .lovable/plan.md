
# Plano: Corrigir Sidebar para Colapsar Corretamente ao Remover o Mouse

## Problema Identificado

Quando o usuário move o mouse para fora da sidebar, os nomes dos itens (Dashboard, Roteirização, etc.) continuam aparecendo em vez de sumir. Isso acontece por causa de um problema na lógica de estados:

1. A sidebar começa colapsada (`defaultOpen={false}`)
2. Ao passar o mouse, `setOpen(true)` muda o `state` para `'expanded'`
3. Isso faz `isCollapsed = false`
4. O `handleMouseLeave` verifica `if (isHovering)`, mas há uma condição de corrida onde o estado pode não atualizar corretamente

## Causa Raiz

A lógica atual mistura dois conceitos:
- **Estado do Sidebar** (controlado pelo `SidebarProvider`): `open/collapsed`
- **Estado local de hover** (`isHovering`)

Quando `setOpen(true)` é chamado, o `state` muda para `'expanded'`, e a variável `showExpanded` depende de `!isCollapsed`, que agora é `true`. Mas quando o mouse sai, há um delay ou o estado não reseta corretamente.

## Solução

Simplificar a lógica para usar APENAS o estado local de hover para controlar a exibição, sem depender do `state` do sidebar:

1. Remover a dependência de `isCollapsed` do cálculo de `showExpanded`
2. Usar apenas `isHovering` como fonte de verdade para expansão visual
3. Manter o sidebar sempre no modo `icon` (colapsado) e controlar visualmente via CSS

## Arquivos a Modificar

### `src/components/layout/AppSidebar.tsx`

1. Simplificar a lógica de hover para não depender do `state` do sidebar
2. Usar apenas `isHovering` para controlar `showExpanded`
3. Remover chamadas a `setOpen()` que causam efeitos colaterais

```tsx
// Antes - problemático
const handleMouseEnter = () => {
  if (isCollapsed) {
    setIsHovering(true);
    setOpen(true);  // Isso muda o state global
  }
};

const handleMouseLeave = () => {
  if (isHovering) {
    setIsHovering(false);
    setOpen(false);
  }
};

const showExpanded = !isCollapsed || isHovering;  // Depende de isCollapsed
```

```tsx
// Depois - simplificado
const handleMouseEnter = () => {
  setIsHovering(true);
};

const handleMouseLeave = () => {
  setIsHovering(false);
};

// Sempre mostrar expandido quando hovering, independente do state global
const showExpanded = isHovering;
```

## Detalhes Técnicos

### Mudanças Específicas

1. **Remover lógica condicional no handleMouseEnter/Leave**
   - Não verificar `isCollapsed` - sempre reagir ao hover
   - Não chamar `setOpen()` - deixar o sidebar gerenciar seu próprio estado

2. **Simplificar `showExpanded`**
   - Usar apenas `isHovering` como fonte de verdade
   - Quando hover = true → mostrar nomes
   - Quando hover = false → esconder nomes

3. **Manter compatibilidade com SidebarTrigger**
   - O botão de menu no header ainda deve funcionar para expandir/colapsar manualmente
   - Adicionar lógica para respeitar quando o usuário clica no trigger

### Lógica Final Proposta

```tsx
const { state } = useSidebar();
const [isHovering, setIsHovering] = useState(false);

// Se o sidebar foi manualmente expandido (via trigger), mostrar
// Se não, mostrar apenas durante hover
const isManuallyExpanded = state === 'expanded';
const showExpanded = isManuallyExpanded || isHovering;

const handleMouseEnter = () => {
  if (!isManuallyExpanded) {
    setIsHovering(true);
  }
};

const handleMouseLeave = () => {
  if (!isManuallyExpanded) {
    setIsHovering(false);
  }
};
```

Isso garante que:
- Hover funciona para expandir temporariamente
- Quando mouse sai, colapsa imediatamente
- Se usuário clicar no trigger, sidebar fica expandida até clicar novamente

## Resultado Esperado

- Passar mouse sobre sidebar → nomes aparecem
- Tirar mouse → nomes desaparecem imediatamente
- Clicar no botão de menu → sidebar expande/colapsa permanentemente
- Dashboard (rota ativa) permanece destacada
