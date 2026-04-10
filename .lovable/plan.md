

# Plano: Corrigir Detecção de Header com Encoding Corrompido

## Problema Raiz

O CSV exportado pelo ADV usa encoding Latin-1/Windows-1252. Quando lido como UTF-8, caracteres acentuados viram `\ufffd` (replacement character). Exemplo: `Descrição` → `Descri��o`.

O parser `parseADVDetailExcel` usa regex `/descri[çc][ãa]o/i` para detectar o header da tabela de itens, mas esse regex **não casa** com `Descri\ufffd\ufffdo`. Resultado: `itemColumnMap` nunca é criado → **zero itens extraídos** → romaneio de carga vazio.

O mesmo problema afeta a detecção individual de colunas (`descricao: cells.findIndex(...)`).

## Solução

Normalizar o texto removendo caracteres `\ufffd` e acentos antes de testar os regexes de header. Aplicar em 3 pontos no `parseADVDetailExcel`:

### Arquivo: `src/lib/advParser.ts`

**1. Criar helper de normalização para matching (reutilizar `removeAccents` ou inline)**
```
function normalizeForMatch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\ufffd/g, '').toLowerCase();
}
```

**2. Linha ~1321 — Detecção do header de itens**
Antes de testar o regex, normalizar `rowText`:
```
const normalizedRowText = normalizeForMatch(rowText);
if (/descri.?[ao]/i.test(normalizedRowText) && /qtde\.?|quantidade/i.test(normalizedRowText))
```

**3. Linha ~1326 — Mapeamento de colunas**
Normalizar cada célula antes do `findIndex`:
```
const cells = row.map(c => normalizeForMatch(String(c ?? '')));
itemColumnMap = {
  descricao: cells.findIndex(c => /descri.?[ao]/.test(c)),
  qtde: cells.findIndex(c => /qtde\.?|quantidade/.test(c)),
};
```

**4. Também proteger o regex de `Cliente :` (linha ~1272) e `Venda Nº` (linha ~1306)**
Aplicar `normalizeForMatch` no `rowText` usado para esses matchings, garantindo que encoding corrompido não bloqueie nenhuma detecção.

## Impacto

Com essa correção, o fluxo normal (upload de 2 relatórios) vai:
1. Detectar corretamente o header `Código / Descrição / UN / Qtde.` mesmo com encoding corrompido
2. Mapear colunas de descrição e quantidade
3. Extrair todos os itens de cada venda
4. Cruzar com o itinerário via `mergeItinerarioWithADV`
5. Persistir em `order_items` via `addOrders`
6. Romaneio de carga mostra produtos consolidados

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/advParser.ts` | Adicionar `normalizeForMatch` e usá-lo nos 3 pontos de detecção em `parseADVDetailExcel` |

