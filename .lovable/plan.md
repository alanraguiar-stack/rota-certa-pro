

# Redesign Visual Apple-Inspired — Apenas Layout e CSS

## Filosofia

Inspiração Apple: **clareza, espaço, tipografia como protagonista, cores neutras com acentos mínimos, superfícies limpas sem bordas pesadas**. Menos decoração, mais respiração. Eliminar gradientes excessivos, glow effects, e animações chamativas. Manter a estrutura funcional intacta.

## Princípios de Mudança

1. **Remover ruído visual** — gradients backgrounds, glow effects, grid patterns, accent bars laterais, floating labels
2. **Tipografia limpa** — SF Pro / Inter com hierarquia clara via peso e tamanho, não via cor
3. **Superfícies** — cards sem sombras pesadas, bordas sutis (`border-border/50`), sem `shadow-elevated`
4. **Espaço negativo** — padding generoso, menos densidade de informação por card
5. **Cores** — paleta neutra (cinza quente) com um único accent (azul Apple `210 100% 50%`), sem teal/coral/orange
6. **Animações** — transições suaves de 200ms, sem float/pulse/shimmer/glow

## Mudanças por Arquivo

### 1. `src/index.css` — Paleta de cores Apple

Substituir as CSS variables por uma paleta neutra Apple-like:
- **Primary**: azul Apple (`210 100% 50%`) em vez de navy
- **Background**: branco puro / cinza ultra-leve (`0 0% 98%`)
- **Cards**: branco com borda sutil, sem sombra pesada
- **Accent**: mesmo azul primary (Apple usa uma cor só)
- **Remover**: variáveis `--cta`, `--gradient-*`, `--glow-*`
- **Remover**: utilitários `.glass`, `.glass-dark`, `.glow-*`, `.bg-mesh-gradient`, `.bg-hero-gradient`, `.animate-float`, `.animate-shimmer`, etc.
- **Sidebar**: fundo cinza claro (`220 10% 96%`) em vez de navy escuro

### 2. `tailwind.config.ts` — Simplificar

- Remover sombras customizadas (`glow`, `glow-cta`, `glow-accent`)
- Remover animações excessivas (`float`, `shimmer`, `glow-pulse`)
- Manter apenas: `fade-in`, `slide-up`, `accordion-*`

### 3. `src/components/layout/AppSidebar.tsx` — Sidebar Apple

- Fundo claro (`bg-muted/50`) em vez de escuro
- Ícones monocromáticos sem wrappers com bg
- Logo simplificado: texto + ícone sem gradientes/blur
- Items de menu: hover com `bg-muted` sutil, sem chevron animado
- Active state: `font-semibold text-primary` com pill background sutil

### 4. `src/components/layout/AppLayout.tsx` — Layout limpo

- Remover `animate-fade-in` do container
- Padding mais generoso (`p-8 md:p-10`)

### 5. `src/pages/Index.tsx` — Dashboard Apple

- **Hero**: remover o bloco gradiente navy inteiro. Substituir por header simples: título grande + data + botão "Nova Rota" azul plano
- **StatsCard**: simplificar — remover accent bar, hover gradient, icon wrapper grande. Manter: valor grande + label + ícone pequeno inline
- **RouteVisualization**: remover SVG animado. Substituir por um card limpo com placeholder minimal
- **Recent Routes**: cards com hover sutil, sem status indicator bar animada
- **Quick Actions**: cards flat sem hover-translate

### 6. `src/pages/Auth.tsx` — Login Apple

- Remover AnimatedTruck, AnimatedRoutes, SVG backgrounds
- Fundo branco limpo ou cinza muito claro
- Card de login centralizado, sem sombras pesadas
- Logo simples no topo

### 7. `src/pages/Fleet.tsx`, `History.tsx`, `Settings.tsx`, `NewRoute.tsx`

- Aplicar mesma linguagem: remover sombras `shadow-elevated`, substituir por `shadow-sm` ou `border`
- Headers de página: título grande (text-3xl font-semibold) + subtítulo em muted, sem ícones em wrappers decorativos
- Botões: estilo flat (`bg-primary rounded-lg`), sem gradients

### 8. `src/components/ui/button.tsx` — Botão Apple

- Border radius mais suave (`rounded-xl`)
- Remover variante implícita de gradient (CTA orange)

## Resultado Esperado

Interface limpa, arejada, profissional. Parece um app Apple (Stocks, Health, Reminders): fundo claro, tipografia forte, uma cor de destaque, zero decoração desnecessária. Toda a funcionalidade permanece intacta — muda apenas a camada visual.

## Arquivos afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/index.css` | Reescrever paleta + remover utilitários decorativos |
| `tailwind.config.ts` | Simplificar sombras e animações |
| `src/components/layout/AppSidebar.tsx` | Sidebar clara e minimal |
| `src/components/layout/AppLayout.tsx` | Layout mais limpo |
| `src/pages/Index.tsx` | Dashboard sem hero gradient, cards flat |
| `src/pages/Auth.tsx` | Login limpo sem animações |
| `src/pages/Fleet.tsx` | Cards e headers simplificados |
| `src/pages/History.tsx` | Lista limpa |
| `src/pages/Settings.tsx` | Tabs e cards flat |
| `src/pages/NewRoute.tsx` | Wizard limpo |
| `src/components/ui/button.tsx` | Border radius Apple |

