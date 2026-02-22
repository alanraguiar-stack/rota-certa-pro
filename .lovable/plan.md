

# Corrigir cor do botao "Ver demonstracao"

## Problema
Os botoes "Ver demonstracao" usam `text-white` com `border-white/20`, o que os torna invisiveis em fundos claros. Ha 2 instancias no arquivo `src/pages/LandingPage.tsx`.

## Correcao

### Arquivo: `src/pages/LandingPage.tsx`

**Linha 157 (Hero Section):**
Trocar `text-white` por `text-foreground` e ajustar a borda para usar a cor do tema:
- De: `border-white/20 text-white hover:bg-white/10`
- Para: `border-accent/40 text-accent hover:bg-accent/10`

**Linha 400 (CTA Final):**
Mesma correcao:
- De: `border-white/30 text-white hover:bg-white/15`
- Para: `border-accent/40 text-accent hover:bg-accent/10`

Isso garante que o texto do botao fique visivel em qualquer fundo, usando a cor accent (teal) do design system.

