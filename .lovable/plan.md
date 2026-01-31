
# Plano: Corrigir Parser Excel MB Definitivo

## Problema Raiz Identificado

O arquivo `Relatório_de_Vendas_-_MB-2.xlsx` possui a estrutura correta com headers na primeira linha:

```
Venda | Cliente | (vazio) | Total | Ordem | Peso Bruto | Cep Ent. | End. Ent. | Endereço | Bairro Ent. | Cidade Ent. | ...
```

**Mapeamento do Usuário (de-para):**
| Campo | Coluna Excel | Índice | Nome Header |
|-------|--------------|--------|-------------|
| Cliente | C | 1 | `Cliente` |
| Peso | G | 5 | `Peso Bruto` |
| Endereço | I | 7 | `End. Ent.` |
| Bairro | K | 9 | `Bairro Ent.` |
| Cidade | - | 10 | `Cidade Ent.` |
| CEP | - | 6 | `Cep Ent.` |

**Problema:** A função `isItinerarioExcelFormat()` em `src/lib/advParser.ts` está testando os headers mas está falhando porque:
1. Pode haver uma coluna vazia entre os headers
2. O fallback cai no parser genérico que exige template "Cliente, Peso_kg, Endereço" no formato padronizado

**Mensagem de Erro:** "Colunas faltando: Cliente, Peso_kg, Endereço (Rua, Número, Bairro, Cidade, Estado). Baixe o template modelo para ver o formato correto."

## Solução: Parser Dedicado para Formato MB

Criar lógica específica para o formato MB que **não exige template**, mapeando colunas fixas pelo nome do header exato.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/advParser.ts` | Editar | Melhorar `isItinerarioExcelFormat` e `parseItinerarioExcel` para aceitar formato MB |
| `src/components/route/DualFileUpload.tsx` | Editar | Remover fallback para parser genérico quando for formato MB |

## Mudanças Técnicas Detalhadas

### 1. advParser.ts - Melhorar Detecção de Formato

```typescript
/**
 * Detecta se Excel é formato de Relatório de Vendas MB
 * Headers esperados: Cliente, Peso Bruto, End. Ent., Bairro Ent., Cidade Ent.
 */
export function isItinerarioExcelFormat(headers: string[]): boolean {
  const headerText = headers.map(h => String(h ?? '').toLowerCase()).join(' ');
  
  // Padrões do formato MB específico
  const requiredPatterns = [
    /cliente/i,           // Obrigatório: Cliente
    /peso\s*bruto/i,      // Obrigatório: Peso Bruto
  ];
  
  const addressPatterns = [
    /end\.?\s*ent\.?/i,   // End. Ent.
    /bairro\.?\s*ent\.?/i,// Bairro Ent.
    /cidade\.?\s*ent\.?/i,// Cidade Ent.
  ];
  
  // Precisa ter Cliente + Peso Bruto + pelo menos 1 endereço
  const hasRequired = requiredPatterns.every(p => p.test(headerText));
  const addressCount = addressPatterns.filter(p => p.test(headerText)).length;
  
  console.log('[Itinerary Excel] Detection:', { 
    hasRequired, 
    addressCount,
    headers: headers.slice(0, 12).join(', ')
  });
  
  return hasRequired && addressCount >= 1;
}
```

### 2. advParser.ts - Melhorar Mapeamento de Colunas

```typescript
export function parseItinerarioExcel(rows: unknown[][]): ItinerarioRecord[] {
  if (rows.length < 2) return [];
  
  // Encontrar header row - procurar em até 10 primeiras linhas
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowText = rows[i].map(c => String(c ?? '').toLowerCase()).join(' ');
    if (/cliente/i.test(rowText) && (/peso\s*bruto/i.test(rowText) || /end\.?\s*ent\.?/i.test(rowText))) {
      headerRowIdx = i;
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    console.log('[Itinerary Excel] Header row not found');
    return [];
  }
  
  const headerRow = rows[headerRowIdx].map(c => String(c ?? '').toLowerCase().trim());
  
  // Mapear colunas usando correspondência EXATA primeiro, depois regex
  const columnMap = {
    venda: findExactOrPattern(headerRow, ['venda'], [/^venda$/i]),
    cliente: findExactOrPattern(headerRow, ['cliente'], [/^cliente$/i]),
    pesoBruto: findExactOrPattern(headerRow, ['peso bruto'], [/peso\s*bruto/i]),
    endEnt: findExactOrPattern(headerRow, ['end. ent.', 'end ent'], [/end\.?\s*ent\.?/i]),
    bairroEnt: findExactOrPattern(headerRow, ['bairro ent.', 'bairro ent'], [/bairro\.?\s*ent\.?/i]),
    cidadeEnt: findExactOrPattern(headerRow, ['cidade ent.', 'cidade ent'], [/cidade\.?\s*ent\.?/i]),
    cepEnt: findExactOrPattern(headerRow, ['cep ent.', 'cep ent'], [/cep\.?\s*ent\.?/i]),
  };
  
  // Aceitar se tiver Cliente + Peso OU Cliente + Endereço
  if (columnMap.cliente === -1) {
    console.log('[Itinerary Excel] Missing Cliente column');
    return [];
  }
  
  if (columnMap.pesoBruto === -1 && columnMap.endEnt === -1) {
    console.log('[Itinerary Excel] Missing both Peso Bruto and End. Ent.');
    return [];
  }
  
  // ... resto da lógica de parsing
}

function findExactOrPattern(headers: string[], exactMatches: string[], patterns: RegExp[]): number {
  // Primeiro: correspondência exata
  for (const exact of exactMatches) {
    const idx = headers.indexOf(exact);
    if (idx !== -1) return idx;
  }
  
  // Segundo: correspondência por padrão
  for (let i = 0; i < headers.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(headers[i])) return i;
    }
  }
  
  return -1;
}
```

### 3. DualFileUpload.tsx - Melhorar Fluxo de Detecção

```typescript
// Modificar processFile() para não cair no parser genérico quando detectar formato MB

if (isExcelFile(file)) {
  // Ler Excel
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Encontrar header row (pode não ser a primeira linha)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowText = rows[i].map(c => String(c ?? '').toLowerCase()).join(' ');
    if (/cliente/i.test(rowText) && /peso/i.test(rowText)) {
      headerRowIdx = i;
      break;
    }
  }
  
  const headers = rows[headerRowIdx].map(c => String(c ?? ''));
  
  // Verificar se é formato MB (Itinerário)
  if (isItinerarioExcelFormat(headers)) {
    const records = parseItinerarioExcel(rows);
    if (records.length > 0) {
      // Sucesso - retornar como itinerário
      return { type: 'itinerario', data: records };
    }
    
    // Se parseItinerarioExcel retornou vazio, mostrar erro específico
    setUploadState({
      file,
      status: 'error',
      message: 'Formato reconhecido mas sem dados válidos. Verifique se as linhas têm Cliente e Peso.',
      data: null,
    });
    return null;
  }
  
  // NÃO cair no parser genérico - mostrar erro claro
  setUploadState({
    file,
    status: 'error',
    message: 'Formato não reconhecido. A planilha deve ter colunas: Cliente, Peso Bruto, End. Ent., Bairro Ent.',
    data: null,
  });
  return null;
}
```

### 4. Remover Dependência de Template

O sistema não deve mais exigir template padrão. Aceitar qualquer planilha que tenha:
- Coluna `Cliente` (obrigatória)
- Coluna `Peso Bruto` ou similar (obrigatória)  
- Coluna `End. Ent.` ou similar (obrigatória para geocodificação)
- Colunas `Bairro Ent.`, `Cidade Ent.`, `Cep Ent.` (opcionais, melhoram geocodificação)

## Diagrama do Fluxo Corrigido

```
Upload Excel
     │
     ▼
┌─────────────────────────┐
│ Encontrar Header Row    │
│ (procurar "Cliente" +   │
│  "Peso" nas primeiras   │
│  10 linhas)             │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ isItinerarioExcelFormat │
│ Headers: Cliente +      │
│ Peso Bruto + End.Ent.?  │
└────────────┬────────────┘
             │
        ┌────┴────┐
        │         │
       SIM       NÃO
        │         │
        ▼         ▼
┌───────────┐  ┌─────────────────┐
│ Parse MB  │  │ Erro: "Formato  │
│ Format    │  │ não reconhecido"│
└─────┬─────┘  └─────────────────┘
      │
      ▼
┌───────────────────────────┐
│ Extrair registros:        │
│ - Venda (ID)              │
│ - Cliente                 │
│ - Peso Bruto              │
│ - End. Ent. + Bairro +    │
│   Cidade + CEP            │
└───────────────────────────┘
```

## Resultado Esperado

1. Upload do arquivo `Relatório_de_Vendas_-_MB.xlsx` funciona sem erros
2. Sistema reconhece automaticamente o formato MB pelos headers
3. Dados extraídos corretamente:
   - Cliente da coluna C
   - Peso da coluna G (Peso Bruto)
   - Endereço da coluna I (End. Ent.)
   - Bairro da coluna K (Bairro Ent.)
   - Cidade e CEP das respectivas colunas
4. Não aparece mais mensagem de "template modelo"
5. Funciona para qualquer planilha do sistema MB sem adaptação
