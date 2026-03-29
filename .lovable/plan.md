

# Fix: Ícones sobrepostos no KPI Card

## Problema

No card, o ícone (`shrink-0`) e o título compartilham a mesma linha via `flex items-start justify-between`. Em telas onde o título é longo (ex: "Peso Movimentado", "Cidades Atendidas"), o texto não tem espaço suficiente e o ícone acaba visualmente sobrepondo as letras porque o `gap-4` não é suficiente e o layout `flex-1` do texto compete com o ícone posicionado no canto.

## Solução

Mover o ícone para dentro do bloco do título (ao lado do texto do título) em vez de posicionar como elemento separado no canto superior direito. Isso garante que o ícone fique alinhado com o título sem sobreposição.

Alternativa mais simples: reduzir o tamanho do ícone no mobile e garantir que o texto tenha `pr` (padding-right) suficiente para não colidir.

**Abordagem escolhida**: Colocar o ícone na mesma linha do título com `flex items-center gap-2`, removendo o posicionamento absoluto/separado. O layout muda de:

```text
ANTES:
[Título.................. [Ícone]]
[Valor grande                   ]

DEPOIS:
[Ícone] [Título]
[Valor grande                   ]
```

## Mudança

| Arquivo | O que muda |
|---|---|
| `src/components/dashboard/FuturisticStatsCard.tsx` | Mover o ícone para dentro da div do título, lado a lado. Remover o flex justify-between do container principal. |

