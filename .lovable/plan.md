
# Plano: Corrigir Cálculo do Peso Total do Relatório MB

## Problema Identificado

O sistema está exibindo **2.8t** quando o peso total correto deveria ser **13.048,56 kg**. A análise do arquivo Excel revela que:

### Estrutura Real do Excel (descoberta)

| Índice | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | ... |
|--------|------|--------|-------|--------|-------|-----------|---------|----------|-----|
| Header | Venda | Cliente | (vazio) | Total | Ordem | **Peso Bruto** | Cep Ent. | End. Ent. | ... |

O problema está no mapeamento de colunas do `parseItinerarioExcel`:
- A coluna "Peso Bruto" está no **índice 5** (coluna F do Excel, ou coluna G se contando de 1)
- O parser atual pode estar mapeando errado devido a colunas vazias no header

### Causa Raiz

Na função `parseItinerarioExcel` em `src/lib/advParser.ts`, o mapeamento usa `findExactOrPattern` que procura por texto nos headers. O problema pode ser:

1. **Headers com espaços/normalização incorreta** - O header "Peso Bruto" pode não estar sendo encontrado corretamente
2. **Índice errado** - O sistema pode estar lendo a coluna "Total" (índice 3) em vez de "Peso Bruto" (índice 5)
3. **Conversão numérica falha** - A função `parseExcelWeight` pode não estar convertendo corretamente valores como `224.55` ou `1.060,25`

## Solução

### 1. Adicionar Debug Detalhado e Corrigir Mapeamento

Modificar `parseItinerarioExcel` para:
1. Log detalhado de cada header e índice encontrado
2. Garantir que a coluna "Peso Bruto" seja encontrada corretamente
3. Corrigir o regex para aceitar variações do header

### 2. Corrigir Função `findExactOrPattern`

```typescript
// Problema: headers podem ter espaços extras ou diferenças de case
// Solução: normalizar antes de comparar
const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
```

### 3. Validar e Logar Pesos Extraídos

Adicionar validação que soma os pesos durante o parsing e compara com esperado.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/advParser.ts` | Editar | Corrigir mapeamento de coluna "Peso Bruto" e adicionar logs de debug |
| `src/components/route/DualFileUpload.tsx` | Editar | Adicionar validação e log do peso total após parsing |

## Mudanças Técnicas Detalhadas

### 1. advParser.ts - Corrigir `parseItinerarioExcel`

```typescript
export function parseItinerarioExcel(rows: unknown[][]): ItinerarioRecord[] {
  // ... existing code to find header row ...
  
  const headerRow = rows[headerRowIdx].map(c => {
    const val = String(c ?? '').toLowerCase().trim();
    console.log('[Debug Header]', headerRow.indexOf(val), '=', val);
    return val;
  });
  
  // Melhorar mapeamento - procurar pelo índice exato
  const columnMap = {
    venda: headerRow.findIndex(h => h === 'venda' || /^venda$/i.test(h)),
    cliente: headerRow.findIndex(h => h === 'cliente' || /^cliente$/i.test(h)),
    pesoBruto: headerRow.findIndex(h => 
      h === 'peso bruto' || 
      h === 'pesobruto' ||
      /peso\s*bruto/i.test(h)
    ),
    endEnt: headerRow.findIndex(h => 
      /end\.?\s*ent\.?/i.test(h)
    ),
    bairroEnt: headerRow.findIndex(h => 
      /bairro\.?\s*ent\.?/i.test(h)
    ),
    cidadeEnt: headerRow.findIndex(h => 
      /cidade\.?\s*ent\.?/i.test(h)
    ),
    cepEnt: headerRow.findIndex(h => 
      /cep\.?\s*ent\.?/i.test(h)
    ),
  };
  
  // LOG CRÍTICO: mostrar qual coluna foi mapeada para peso
  console.log('[Peso Bruto] Column index:', columnMap.pesoBruto, 
              '- Header value:', headerRow[columnMap.pesoBruto]);
  
  // ... rest of parsing ...
  
  // Ao final, mostrar peso total calculado
  const totalWeight = records.reduce((sum, r) => sum + r.weight_kg, 0);
  console.log('[Itinerary Excel] PESO TOTAL CALCULADO:', totalWeight.toFixed(2), 'kg');
}
```

### 2. Corrigir `parseExcelWeight` para valores numéricos diretos

O Excel pode retornar o peso já como número (não string). A função precisa tratar isso:

```typescript
function parseExcelWeight(value: string | number): number {
  // Se já é número, retornar diretamente
  if (typeof value === 'number' && !isNaN(value)) {
    console.log('[parseExcelWeight] Number:', value);
    return value;
  }
  
  let str = String(value).trim();
  if (!str) return 0;
  
  // Log para debug
  console.log('[parseExcelWeight] String:', str);
  
  // ... existing conversion logic ...
}
```

### 3. Validação no DualFileUpload

Adicionar log do peso total após o parsing:

```typescript
if (itinerarioRecords.length > 0) {
  const totalWeight = itinerarioRecords.reduce((sum, r) => sum + r.weight_kg, 0);
  console.log('[DualFileUpload] Peso total dos itinerários:', totalWeight.toFixed(2), 'kg');
  
  // Alertar se peso parecer muito baixo
  if (totalWeight < 1000 && itinerarioRecords.length > 10) {
    console.warn('[DualFileUpload] ATENÇÃO: Peso total muito baixo para', 
                 itinerarioRecords.length, 'registros');
  }
  
  // ... rest of code ...
}
```

## Diagrama do Fluxo de Debug

```
Upload Excel
     │
     ▼
┌─────────────────────────────────┐
│ Encontrar Header Row            │
│ LOG: Header index + valores     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Mapear Coluna "Peso Bruto"      │
│ LOG: Índice = X, Valor = Y      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Para cada linha:                │
│  - Extrair peso da coluna X     │
│  - LOG: Peso raw = "224.55"     │
│  - Converter com parseExcelWeight│
│  - LOG: Peso converted = 224.55 │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Somar todos os pesos            │
│ LOG: PESO TOTAL = 13048.56 kg   │
└─────────────────────────────────┘
```

## Validação Final

Após as correções, o sistema deve:

1. Mostrar nos logs qual coluna foi identificada como "Peso Bruto"
2. Mostrar o valor raw de cada peso antes de converter
3. Calcular e exibir o peso total correto: **13.048,56 kg**
4. Exibir na interface "13,05 t" em vez de "2.8t"

## Resultado Esperado

| Métrica | Antes (Errado) | Depois (Correto) |
|---------|----------------|------------------|
| Peso Total | 2.8t | 13,05t |
| Pedidos | ? | 68 |
| Caminhões Necessários | ? | 4 |
