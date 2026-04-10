

# Plano: Redesign do card "Resumo por Cidade"

## Problema
O layout atual usa grid com colunas de texto pequeno e números alinhados à direita, dificultando a leitura rápida. O usuário quer algo mais visual e intuitivo.

## Proposta

Redesenhar o card com layout de **badges/chips** compactos, onde cada cidade é um chip com o número em destaque:

```text
┌─────────────────────────────────────────────────┐
│ 📍 Resumo por Cidade (46 vendas)                │
│                                                 │
│  ┌──────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ Osasco   [16]│ │ Cotia   [6]│ │Carap.  [6]│  │
│  └──────────────┘ └────────────┘ └───────────┘  │
│  ┌──────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ Embu      [4]│ │S.Parnaíba[4]│ │Jandira [2]│  │
│  └──────────────┘ └────────────┘ └───────────┘  │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

Cada chip terá:
- Nome da cidade capitalizado à esquerda
- Número em badge circular/bold à direita
- Fundo sutil (`bg-muted/50`) com borda leve
- Cidades com mais entregas ganham destaque visual (badge `bg-primary` para top 3, `bg-muted` para as demais)
- Layout `flex flex-wrap gap-2` para fluir naturalmente

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | Linhas 776-783: trocar grid por flex-wrap com chips estilizados |

