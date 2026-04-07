

# Plano: Restaurar visual decorativo da Landing Page

## Contexto
A landing page original tinha fundo escuro com mesh gradient, cards glass, animações float, gradientes de texto, glow effects e SVGs animados. O redesign Apple removeu todas essas classes CSS globais e reescreveu a landing page em estilo flat/clean. O usuário quer o visual rico de volta, mas **apenas na landing page** — o resto do app mantém o estilo Apple.

## Estratégia
Ao invés de restaurar as classes CSS globais (o que afetaria o app inteiro), vou usar **estilos inline/scoped** diretamente no `LandingPage.tsx`, usando Tailwind arbitrary values e CSS-in-JSX.

## Mudanças

### 1. `src/pages/LandingPage.tsx` — Reescrever visual completo

**Hero Section:**
- Fundo escuro (navy/slate `bg-slate-900`) com mesh gradient via CSS radial-gradient inline
- Texto branco com título usando gradient text (via `bg-clip-text text-transparent bg-gradient-to-r`)
- Orbs decorativos animados (divs com blur e gradiente) posicionados absolute
- SVG animado de rotas (linhas tracejadas com animação dash)
- Ícones flutuantes (Truck, Package, MapPin) com animação float
- CTA com gradiente laranja/coral

**Cards das seções:**
- Efeito glass: `bg-white/5 backdrop-blur-xl border border-white/10` nas seções escuras
- `bg-card` normal nas seções claras, mas com hover scale/shadow
- Hover lift: `hover:-translate-y-1 hover:shadow-lg transition-all`

**Seção "O Problema":**
- Fundo com gradiente sutil escuro (`bg-gradient-to-b from-slate-900 to-slate-800`)

**Seção "Como Funciona":**
- Step icons com glow/shadow colorido
- Linha conectora com gradiente

**Seção "Diferencial" e "CTA Final":**
- Fundo gradiente (navy → azul) com overlay pattern
- Texto branco com destaques em accent

**Footer:**
- Fundo escuro (`bg-slate-900`) com texto claro

**Animações (definidas via `<style>` JSX no componente):**
- `@keyframes float` — movimento suave para cima e para baixo
- `@keyframes dash` — animação das linhas SVG
- `@keyframes shimmer` — brilho sutil em elementos destaque

### 2. Nenhuma mudança em `src/index.css` ou `tailwind.config.ts`
Todas as classes decorativas ficam scoped dentro do componente LandingPage, sem afetar o resto do app.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/LandingPage.tsx` | Reescrever com visual rico: gradientes, glass cards, animações, fundo escuro, SVG animado |

## Resultado esperado
Landing page com visual impactante e colorido (estilo original), enquanto Dashboard, Frota, Rotas e demais páginas mantêm o estilo Apple clean.

