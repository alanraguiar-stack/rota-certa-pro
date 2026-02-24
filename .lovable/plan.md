

# Fix CSV Encoding for Correct Venda ID Matching

## Problem

When the CSV "Detalhe das Vendas" is read with `file.text()`, the character `º` in `Venda Nº:` and `NFe Nº:` becomes `\ufffd` (replacement character) because the file is encoded in Windows-1252, not UTF-8. This causes:

1. `isADVExcelFormat` may fail to detect the ADV format (regex `venda\s*n[º°]?\s*:\s*` doesn't match `Venda N\ufffd:`)
2. `parseADVDetailExcel` can't extract the Venda ID from the broken text
3. Without correct Venda IDs, the merge between "Vendas do Dia" (column B) and "Detalhe das Vendas" fails

## Solution

One change in one file:

### `src/components/route/DualFileUpload.tsx`

In the CSV reading block (lines 140-146), replace `file.text()` with the existing `decodeFileContent()` from `@/lib/encoding.ts`, which already handles Windows-1252 and ISO-8859-1 fallback:

```text
Before:  const text = await file.text();
After:   const text = await decodeFileContent(file);
```

This ensures `Venda Nº:` is correctly decoded, the regex matches, `278351` is extracted as the `pedido_id`, and the merge with column B of "Vendas do Dia" works via `normalizeVendaId`.

## Why This Works

The existing `decodeFileContent` in `encoding.ts` already:
- Tries UTF-8 first
- Detects `\ufffd` as encoding issue
- Falls back to ISO-8859-1 then Windows-1252
- Returns correctly decoded text with proper `º` character

Once the text is correct, the existing flow works:
1. CSV split by `;` produces cells like `["Venda Nº:", "", "", "", "", "278351", "NFe Nº:", ...]`
2. `parseADVDetailExcel` joins with space: `"Venda Nº:     278351 NFe Nº:  52112"`
3. Regex `venda\s*n[º°]?\s*:\s*(\d+)` captures `278351`
4. `mergeItinerarioWithADV` matches this with column B via `normalizeVendaId`

| Arquivo | Mudanca |
|---------|---------|
| `src/components/route/DualFileUpload.tsx` | Import `decodeFileContent`, usar no lugar de `file.text()` no bloco CSV |

