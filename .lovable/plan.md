

# Corrigir Unidade de Medida no Romaneio de Carga

## Problema
Produtos como "AGUA MINERAL CRISTAL CLASSIC S/G PET 510ML FD12UN" aparecem como KG no romaneio, quando deveriam ser FARDO. Isso acontece por 3 razões encadeadas:

1. **`getUnitForProduct` não tem fallback inteligente** — se o produto não está no banco `product_units`, retorna `'kg'` direto, sem tentar inferir pelo nome.
2. **`inferUnitFromName` usa regex muito restritivo** — `\bFD\b` exige word boundary, mas "FD12UN" não tem boundary entre FD e 12. Mesma falha para "CX12", "FD6UN", etc.
3. **Categorias comuns não são detectadas** — água mineral, suco, cerveja, energético, etc. deveriam ser fardo/caixa automaticamente.

## Correções

### 1. `src/hooks/useProductUnits.ts` — `inferUnitFromName`
Tornar os regex mais flexíveis para padrões concatenados do ERP:
- `FD\d*` → fardo (cobre FD, FD12UN, FD6)
- `CX\d*` → caixa
- `PCT\d*` → pacote
- Adicionar categorias de bebidas: água mineral, suco, cerveja, energético → fardo
- Manter `\bUN\b` por último (baixa prioridade) para não conflitar com "FD12**UN**"

### 2. `src/hooks/useProductUnits.ts` — `getUnitForProduct`
Adicionar fallback para `inferUnitFromName` quando não encontrar no banco:
```
if (exact) return exact;
// partial match...
return inferUnitFromName(productName); // em vez de 'kg'
```

### 3. `src/lib/advParser.ts` — Parser de itens
Quando a coluna `unidade` do ADV estiver vazia, usar `inferUnitFromName(descricao)` para decidir se o item é peso ou volume, em vez de assumir sempre peso.

## Arquivos
| Arquivo | Mudança |
|---|---|
| `src/hooks/useProductUnits.ts` | Regex flexível em `inferUnitFromName` + fallback em `getUnitForProduct` |
| `src/lib/advParser.ts` | Usar `inferUnitFromName` quando coluna unidade vazia |

