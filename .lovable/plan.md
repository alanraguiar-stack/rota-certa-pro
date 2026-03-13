

# Otimizar DeliveryCard para mobile-first

## Problemas identificados

1. **Texto de produtos transbordando** — a descrição do produto usa `truncate` (uma linha) mas o conteúdo é muito longo e não quebra visualmente bem em telas pequenas
2. **Layout não otimizado para celular** — padding e gaps podem ser reduzidos para aproveitar melhor a tela
3. **Ordem das entregas** — já está respeitando `delivery_sequence` via sort no `fetchDeliveries`, mas o `index` passado ao card é o índice do array (correto desde que o array venha ordenado)

## Mudanças no `DeliveryCard.tsx`

- Descrição do produto: limitar a `line-clamp-1` com `break-all` para não transbordar horizontalmente
- Separar peso e produtos em linhas distintas — peso em destaque (`font-semibold`), produtos abaixo com truncamento
- Reduzir padding do card (`p-3` em vez de `p-4`)
- Nome do cliente: manter `truncate` mas com `text-sm` para caber melhor
- Endereço: `line-clamp-2` já existe, manter
- Botões de ação rápida: manter na lateral, reduzir para `h-8 w-8`

## Mudanças no `DriverDashboard.tsx`

- Reduzir `space-y-2` para `space-y-1.5` na lista de entregas para visual mais compacto
- Padding lateral `px-3` em vez de `p-4` para melhor uso da tela mobile

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/driver/DeliveryCard.tsx` | Layout mobile-first, truncamento correto dos textos |
| `src/pages/DriverDashboard.tsx` | Espaçamentos mobile-friendly |

