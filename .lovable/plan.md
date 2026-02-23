

# Correcao: Aceitar CSV/Excel com header em linhas posteriores

## Problema

O arquivo "Vendas do Dia" do usuario tem esta estrutura:
- Linha 1: "Vendas_Itinerario" (titulo)
- Linhas 2-5: metadados ou vazias
- **Linha 6**: Header real ("Venda", "Cliente", "Peso Bruto", "End. Ent.", etc.)
- Linha 7+: dados

O sistema verifica **apenas a linha 0** para detectar o formato Itinerario (linha 192 de `DualFileUpload.tsx`):

```text
const firstRowHeaders = rawRows[0]?.map(...) || [];
if (isItinerarioExcelFormat(firstRowHeaders))
```

Como a linha 0 contem apenas "Vendas_Itinerario", a deteccao falha e o arquivo e rejeitado.

## Correcoes

### Arquivo 1: `src/components/route/DualFileUpload.tsx` (linha 192-193)

Substituir a verificacao de apenas a linha 0 por um loop que varre as primeiras 10 linhas:

```typescript
// Procurar header Itinerário nas primeiras 10 linhas
let itinerarioDetected = false;
for (let i = 0; i < Math.min(10, rawRows.length); i++) {
  const rowHeaders = rawRows[i]?.map(c => String(c ?? '')) || [];
  if (isItinerarioExcelFormat(rowHeaders)) {
    itinerarioDetected = true;
    break;
  }
}
if (itinerarioDetected) {
```

Isso alinha a deteccao com o comportamento interno do `parseItinerarioExcel`, que ja sabe localizar o header em qualquer posicao nas primeiras linhas.

### Arquivo 2: `src/lib/spreadsheet/intelligentReader.ts` (funcao `classifyRows`, linhas 114-126)

O Motor Inteligente (fallback) tambem precisa de correcao: ele marca a primeira linha nao-vazia com qualquer keyword como header. A linha "Vendas_Itinerario" contem "venda" e e falsamente marcada como header.

Adicionar validacao de que a linha candidata a header deve ter **pelo menos 3 celulas nao-vazias**:

```typescript
if (!headerFound && !isEmpty && !isTotalization && !isObservation) {
  // Exigir minimo de 3 celulas com conteudo para ser header
  const nonEmptyCells = cells.filter(c => c !== null && String(c).trim() !== '').length;
  if (nonEmptyCells >= 3) {
    const hasHeaderWords = cells.some(cell => {
      if (cell === null || typeof cell === 'number') return false;
      const norm = superNormalize(cell);
      return ['cliente', 'peso', 'endereco', 'venda', 'pedido', 'produto'].some(kw => norm.includes(kw));
    });

    if (hasHeaderWords) {
      isHeader = true;
      headerFound = true;
      headerRowIndex = i;
    }
  }
}
```

## Resumo

| Arquivo | O que muda | Por que |
|---------|-----------|---------|
| `DualFileUpload.tsx` | Varrer 10 linhas em vez de so a linha 0 | Detectar header do Itinerario mesmo quando ha titulo/metadados antes |
| `intelligentReader.ts` | Exigir >= 3 celulas nao-vazias para header | Evitar que titulos de relatorio sejam confundidos com headers de colunas |

Nenhuma logica de parsing muda -- apenas a **deteccao** do formato e do header fica mais robusta.

