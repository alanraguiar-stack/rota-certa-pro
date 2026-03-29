

# Plano: Responsividade do Dashboard (Mobile + Tablet)

## Problemas Identificados

1. **Sidebar fixa `w-60`** — no mobile ocupa 240px e não colapsa, comprimindo o conteúdo
2. **Container `p-8 md:p-10`** — padding excessivo no mobile
3. **KPI grid `sm:grid-cols-2 lg:grid-cols-5`** — 5 colunas com cards largos funciona, mas o valor `text-4xl` e o ícone `h-14 w-14` ficam grandes demais no mobile
4. **Rotas recentes** — layout de cada item com data ao lado não cabe em telas estreitas
5. **Bottom cards `lg:grid-cols-4`** — comprime demais em tablet

## Mudanças

### 1. `AppSidebar.tsx` — Sidebar responsiva
- No mobile (`< md`): sidebar vira um **drawer/sheet** acionado por botão hamburger
- No desktop: sidebar fixa como está
- Adicionar botão hamburger no header mobile

### 2. `AppLayout.tsx` — Padding e header mobile
- Reduzir padding: `p-4 sm:p-6 md:p-10`
- Adicionar header mobile com hamburger + logo quando sidebar está escondida

### 3. `FuturisticStatsCard.tsx` — Escalar para mobile
- Valor: `text-2xl sm:text-4xl`
- Ícone container: `h-10 w-10 sm:h-14 sm:w-14`
- Padding: `p-4 sm:p-5`

### 4. `KpiDashboard.tsx` — Grid mobile
- Skeleton e grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` (já é assim, ok)
- Period selector: botões menores no mobile `px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm`

### 5. `Index.tsx` — Rotas recentes e bottom cards
- Route items: empilhar nome/badge em cima e data embaixo no mobile (`flex-col sm:flex-row`)
- Reduzir `space-y-8` para `space-y-6` no mobile
- Header h1: `text-2xl sm:text-3xl`

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/layout/AppSidebar.tsx` | Drawer mobile com Sheet |
| `src/components/layout/AppLayout.tsx` | Header mobile + padding responsivo |
| `src/components/dashboard/FuturisticStatsCard.tsx` | Tamanhos responsivos |
| `src/components/dashboard/KpiDashboard.tsx` | Period selector menor no mobile |
| `src/pages/Index.tsx` | Layout responsivo para rotas e cards |

