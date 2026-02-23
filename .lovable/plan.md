
# Suportar formato "Entregas" no Importador de Roteiro do Analista

## Problema

O arquivo `Entregas23_02_2026_FKD.xls` nao e reconhecido pelo importador porque:

1. **Truck label errado**: `extractTruckLabel` usa regex `^([A-Z]{2,5})` que captura "ENTRE" do inicio do nome. O truck real e "FKD", localizado no final do nome antes da extensao.
2. **Data nao detectada**: `extractRouteDate` procura datas com pontos (ex: `23.02.26`), mas o nome usa underscores (`23_02_2026`).
3. **Colunas deslocadas**: O XML usa `MergeAcross="1"` na coluna "Venda" (ocupa 2 colunas), o que pode deslocar os indices das colunas seguintes quando o XLSX faz o parse.

## Correcoes

### Arquivo: `src/components/route/RouteHistoryImporter.tsx`

#### 1. Atualizar `extractTruckLabel` (linhas 45-48)

Adicionar deteccao do padrao "Entregas" - quando o nome comeca com "Entregas", extrair o truck do final (apos o ultimo underscore):

```typescript
const extractTruckLabel = (filename: string): string => {
  const baseName = filename.replace(/\.[^.]+$/, ''); // remover extensao
  
  // Padrao "Entregas{data}_{TRUCK}" - ex: Entregas23_02_2026_FKD
  const entregasMatch = baseName.match(/^Entregas\d.*_([A-Z]{2,5})$/i);
  if (entregasMatch) return entregasMatch[1].toUpperCase();
  
  // Padrao original: inicio do nome (ex: CYR01.02.25)
  const match = baseName.match(/^([A-Z]{2,5})/i);
  return match ? match[1].toUpperCase() : 'UNKNOWN';
};
```

#### 2. Atualizar `extractRouteDate` (linhas 50-64)

Adicionar deteccao de datas com underscores e formato completo (DD_MM_YYYY):

```typescript
const extractRouteDate = (filename: string): string | null => {
  // Padrao DD_MM_YYYY (ex: 23_02_2026)
  const matchFull = filename.match(/(\d{2})_(\d{2})_(\d{4})/);
  if (matchFull) {
    const [, dd, mm, yyyy] = matchFull;
    return `${yyyy}-${mm}-${dd}`;
  }
  
  // Padrao DD.MM.YY (existente)
  const match3 = filename.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (match3) { /* ... manter logica existente ... */ }
  
  // Padrao DD.MM (existente)
  const match2 = filename.match(/(\d{2})\.(\d{2})/);
  if (match2) { /* ... manter logica existente ... */ }
  
  return null;
};
```

#### 3. Tornar deteccao de colunas mais flexivel em `mapRowsToHistoryImport` (linhas 109-120)

Atualmente usa `headers.indexOf('ordem')` que e exato. Adicionar busca parcial para lidar com possiveis espacos ou variacoes causadas por MergeAcross:

```typescript
const findCol = (keywords: string[]) => 
  headers.findIndex(h => keywords.some(kw => h.includes(kw)));

const colIdx = {
  ordem: findCol(['ordem']),
  venda: findCol(['venda']),
  cliente: findCol(['cliente']),
  fantasia: findCol(['fantasia']),
  cep: findCol(['cep']),
  endereco: findCol(['endere']),
  numero: findCol(['númer', 'numer']),
  bairro: findCol(['bairro']),
  cidade: findCol(['cidade']),
  uf: findCol(['uf']),
};
```

#### 4. Filtrar linhas vazias de separacao

O XML gera linhas de separacao vazias (Height="0.73") entre cada registro. A logica atual ja ignora linhas sem cliente e sem venda (`if (!cliente && !venda) continue;`), entao isso ja esta coberto.

## Resumo

| Mudanca | Motivo |
|---------|--------|
| `extractTruckLabel`: detectar padrao "Entregas..._{TRUCK}" | Extrair "FKD" corretamente do final do nome |
| `extractRouteDate`: aceitar underscores e formato YYYY completo | Detectar data "23_02_2026" do nome do arquivo |
| `mapRowsToHistoryImport`: busca parcial de headers | Lidar com variacoes de colunas causadas por MergeAcross |

Nenhuma mudanca na UI ou no fluxo de importacao -- apenas o parsing fica mais robusto para aceitar este novo formato de arquivo.
