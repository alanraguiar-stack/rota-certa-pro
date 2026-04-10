

# Plano: Mover Santana de Parnaíba para Barueri + Resumo por cidade

## Mudança 1: Território — Santana de Parnaíba → Barueri

Atualmente Santana de Parnaíba é um território âncora separado (Agrupamento 4). Vou:

- **Remover** o território "santana" como agrupamento independente
- **Adicionar** `santana de parnaiba`, `pirapora do bom jesus` e `cajamar` como `allowedFillCities` do território Barueri

Assim, as vendas de Santana de Parnaíba serão automaticamente alocadas no caminhão de Barueri.

**Arquivo**: `src/lib/anchorRules.ts`

## Mudança 2: Métrica de vendas por cidade (todos os caminhões)

Adicionar um card simples na etapa `loading_manifest` (Etapa 3) do `RouteDetails.tsx` que mostra:

```
Resumo por Cidade
Osasco        21
Carapicuíba   10
Barueri        8
...
```

Conta o total de pedidos por cidade somando todos os caminhões. Exibido como uma lista compacta logo acima ou abaixo do editor de rotas.

**Arquivo**: `src/pages/RouteDetails.tsx` (adicionar bloco inline, sem componente separado)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Remover território "santana", adicionar fill cities ao Barueri |
| `src/pages/RouteDetails.tsx` | Adicionar card de resumo vendas por cidade |

