

# Fix: Landing Page Ilegível (Texto Branco em Fundo Branco)

## Causa

O redesign Apple removeu as classes CSS decorativas (`bg-mesh-gradient`, `glass-card`, `hover-lift`, `text-gradient`, `shadow-glow`, `animate-float`, `btn-cta`) do `index.css`, mas a Landing Page ainda usa todas elas. O hero usa `text-white` esperando um fundo escuro que não existe mais.

## Solução

Reescrever o visual da Landing Page seguindo a mesma linguagem Apple do resto do app: fundo claro, texto escuro, um accent azul, sem gradientes pesados.

### Mudanças em `src/pages/LandingPage.tsx`

1. **Hero**: Remover `bg-mesh-gradient`, `AnimatedRoutes`, floating icons e gradient orbs. Fundo limpo (`bg-background`). Texto em `text-foreground` (escuro) em vez de `text-white`. Título com destaque em `text-primary` em vez de `text-gradient`. Botão CTA usa classe `default` (azul) em vez de `btn-cta`.

2. **Seção "Para quem"**: Trocar `glass-card hover-lift` por `border bg-card rounded-2xl shadow-soft`.

3. **Seção "Benefícios"**: Mesmo ajuste — cards com `border bg-card` em vez de `glass-card`.

4. **Seção "Como funciona"**: Remover `shadow-glow` do icon wrapper. Usar `bg-primary` simples.

5. **Seção "Features"**: Substituir classes dinâmicas `text-${col.color}` por valores concretos (`text-primary`, `text-success`, etc.) para que o Tailwind compile corretamente.

6. **Seção "Planos"**: Trocar `shadow-elevated` por `shadow-soft`. `border-accent` → `border-primary`.

7. **Footer**: Remover `bg-mesh-gradient`. Usar `bg-muted` com texto `text-foreground`.

8. **Remover componentes mortos**: `AnimatedRoutes` SVG (não mais utilizado).

| Arquivo | Mudança |
|---|---|
| `src/pages/LandingPage.tsx` | Substituir todas as classes removidas por equivalentes Apple-clean; corrigir cores de texto |

