

# Plano: Correções de Bugs + Configuração de Coverage

## Fase 0 — Configuração de Testes

### T0a/T0b/T0c: Instalar coverage e configurar

1. Instalar `@vitest/coverage-v8` como devDependency
2. Adicionar script `"test:coverage": "vitest run --coverage"` ao `package.json`
3. Adicionar bloco `coverage` no `vitest.config.ts` com `provider: 'v8'` e `include: ['src/lib/**']`

## Fase 1 — Correções de Bugs

### BUG-01: `encoding.ts` — `isValidPortugueseText` sempre true

A regex `/^[\s\S]*$/u` aceita literalmente qualquer string. Opção: **remover** a função `isValidPortugueseText` e `testPortugueseCharacters` — são dead code, não são importadas em nenhum outro arquivo.

### BUG-02: `anchorRules.ts` — Map global mutável

O `truckTerritoryMap` já tem `clearTruckTerritories()` chamado no início de `assignTrucksToTerritories`. O risco é em testes onde múltiplas chamadas acumulam state. Correção: adicionar `clearTruckTerritories()` como export para uso em `beforeEach` dos testes (já exportado). **Sem mudança de código** — apenas garantir uso correto nos testes.

### BUG-03: `autoRouterEngine.ts` — `recommendTrucks` é stub

Linha 118: `return [...availableTrucks]` — retorna frota inteira sem filtrar. Verificar se é usado na UI. Se sim, implementar lógica básica (filtrar por peso/capacidade). Se não, marcar como `@deprecated`.

**Decisão**: a função não é chamada na UI (removida na implementação anterior de seleção manual). **Remover** ou adicionar `@deprecated` + `console.warn`.

### BUG-04: `geocoding.ts` — `parseAddress` crash com null/undefined

Linha 201: `address.replace(...)` falha se `address` é `null`/`undefined`. Adicionar guard:

```typescript
export function parseAddress(address: string): GeocodedAddress {
  if (!address) {
    return {
      original: '', normalized: '', street: '', number: '',
      neighborhood: '', city: '', state: '', zipCode: '',
      estimatedLat: -23.5115, estimatedLng: -46.8754,
    };
  }
  // ... resto do código
}
```

### BUG-05: `intelligentReader.ts` — Header detection keywords incompletas

Linha 121: a lista de keywords para detectar headers é `['cliente', 'peso', 'endereco', 'venda', 'pedido', 'produto']`. Faltam variantes como `'kg'`, `'razao'`, `'bairro'`, `'cidade'`, `'cep'`, `'rua'`. Ampliar a lista para cobrir mais formatos de planilha.

### BUG-06: `columnDetector.ts` — Falso positivo monetário

Linha 104: valores > 500 com 2 casas decimais são marcados como monetários, mas pesos de 500+ kg com 2 decimais também existem. Ajustar threshold para > 1000 ou adicionar checagem cruzada: se a coluna já foi detectada como `weight_*` pelo header, não marcar como monetária.

### BUG-07: `orderParser.ts` — `totalRows` conta pedidos, não linhas lidas

Linha 431: `totalRows: orders.length` deveria ser `totalRows: dataRows.length`. O `orders` exclui linhas vazias puladas, então `totalRows` subreporta o total real.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `package.json` | Adicionar `@vitest/coverage-v8` + script `test:coverage` |
| `vitest.config.ts` | Bloco `coverage` com provider v8 |
| `src/lib/encoding.ts` | Remover `isValidPortugueseText` e `testPortugueseCharacters` |
| `src/lib/autoRouterEngine.ts` | Marcar `recommendTrucks` como deprecated com warning |
| `src/lib/geocoding.ts` | Guard para null/undefined em `parseAddress` |
| `src/lib/spreadsheet/intelligentReader.ts` | Ampliar keywords de detecção de header |
| `src/lib/spreadsheet/columnDetector.ts` | Ajustar threshold monetário de 500→1000 |
| `src/lib/orderParser.ts` | Corrigir `totalRows: dataRows.length` |

