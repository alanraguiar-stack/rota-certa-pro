

# Aceitar CSV no Detalhe das Vendas

## Problema

O lado direito ("Detalhe das Vendas") so aceita arquivos `.xlsx`, `.xls` e `.pdf`. O usuario precisa carregar um CSV com formato hierarquico ADV (separado por ponto-e-virgula), que contem a mesma estrutura: `Cliente:`, `Venda N:`, `Codigo/Descricao/Qtde./Unitario/Total`.

## Solucao

Adicionar suporte a CSV no fluxo de upload. Como a biblioteca XLSX ja sabe ler CSV, basta:

1. Expandir a deteccao de tipo de arquivo para incluir `.csv`
2. Tratar CSV como planilha (ler com XLSX e reutilizar os parsers existentes)
3. Atualizar o `accept` dos inputs de upload

### Arquivo 1: `src/lib/pdfParser.ts`

Alterar `isExcelFile` para tambem aceitar `.csv`:

```typescript
export function isExcelFile(file: File): boolean {
  return /\.(xlsx?|csv)$/i.test(file.name) || ...
}
```

### Arquivo 2: `src/components/route/DualFileUpload.tsx`

Duas mudancas:

1. Alterar os dois `accept` de `".xlsx,.xls,.pdf"` para `".xlsx,.xls,.pdf,.csv"`
2. No `processFile`, quando o arquivo for CSV, ler com `XLSX.read(text, { type: 'string' })` para que o separador `;` seja interpretado corretamente -- ou ler como ArrayBuffer (ja funciona com XLSX para CSV)

Na verdade, `XLSX.read` com `type: 'array'` ja le CSV corretamente quando o arquivo tem extensao `.csv`. A unica mudanca necessaria e garantir que o CSV entre no bloco `isExcelFile`, que ja faz `XLSX.read` e testa `isADVExcelFormat` / `isItinerarioExcelFormat`.

### Arquivo 3: `src/lib/advParser.ts`

Ajustar `isADVExcelFormat` para lidar com CSV semicolon: quando o XLSX le um CSV separado por `;`, cada celula pode conter o conteudo completo da linha em vez de estar separada. Adicionar um fallback que, se as primeiras linhas tiverem poucas colunas mas o texto contiver `Cliente :` e `Venda N`, ainda detecte como ADV.

Ajustar `parseADVDetailExcel` para funcionar com linhas CSV onde os separadores `;` ficam em celulas separadas (ou como texto concatenado dependendo de como XLSX interpreta o `;`).

Como o CSV usa `;` como separador e XLSX pode nao detectar automaticamente, adicionar tratamento especial: se o arquivo for `.csv`, ler o conteudo como texto, fazer split manual por `;`, e converter para o array de arrays que `isADVExcelFormat` e `parseADVDetailExcel` esperam.

## Resumo de Mudancas

| Arquivo | Acao |
|---------|------|
| `src/lib/pdfParser.ts` | Adicionar `.csv` em `isExcelFile` |
| `src/components/route/DualFileUpload.tsx` | Aceitar `.csv` no input, adicionar bloco de parsing CSV com split por `;` antes do fluxo Excel |
| `src/lib/advParser.ts` | Nenhuma mudanca necessaria -- os parsers ja funcionam com array de arrays |

