

# Remover fundo azul do ícone do Waze

## Solução

Criar um SVG do fantasminha do Waze (sem fundo azul) e salvar em `public/icons/waze.svg`. Atualizar o `DeliveryCard.tsx` para referenciar o SVG no lugar do PNG.

O SVG será o fantasminha branco com olhos azuis e boca, contorno cinza, sem fundo colorido — limpo e leve.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `public/icons/waze.svg` | Novo SVG do fantasminha sem fundo |
| `src/components/driver/DeliveryCard.tsx` | Trocar `/icons/waze.png` por `/icons/waze.svg` |

