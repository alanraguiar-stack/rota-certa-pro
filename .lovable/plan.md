
# Plano: Correção Definitiva do Cálculo do Peso Total - Coluna G

## Problema Identificado

O sistema está exibindo **2.8t** quando o peso total correto é **13.048,56 kg**.

### Análise do Arquivo Excel

O arquivo `Relatório_de_Vendas_-_MB-2.xlsx` tem a seguinte estrutura de headers:

| Índice | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|--------|-------|---------|-------|-------|-------|------------|---------|----------|----------|-----------|------------|
| Header | Venda | Cliente | (vazio) | Total | Ordem | **Peso Bruto** | Cep Ent. | End. Ent. | Endereço | Bairro Ent. | Cidade Ent. |

A soma correta da coluna G (Peso Bruto) é **13.048,56 kg** (confirmado na última linha do Excel).

### Causa Raiz Provável

1. **Coluna 4 (Ordem) está vazia nos dados mas presente no header** - O parser pode estar mapeando a coluna errada
2. **Header com caracteres invisíveis** - O header "Peso Bruto" pode ter espaços extras ou caracteres especiais
3. **A função `findExactOrPattern` pode estar falhando** - O índice retornado pode não ser o 5

## Solução Definitiva

### Abordagem: Mapeamento Direto por Índice com Fallback

Em vez de confiar apenas na busca por nome do header, adicionar lógica que:
1. Primeiro, tenta encontrar pelo nome
2. Se falhar, usa a **posição conhecida da coluna G (índice 5)**
3. Adiciona logs detalhados mostrando o valor raw de cada célula

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/advParser.ts` | Editar | Corrigir `parseItinerarioExcel` com fallback para índice fixo e logs detalhados |

## Mudanças Técnicas

### 1. Função `parseItinerarioExcel` - Correção Completa

```typescript
export function parseItinerarioExcel(rows: unknown[][]): ItinerarioRecord[] {
  // ... código existente para encontrar headerRowIdx ...
  
  const headerRow = rows[headerRowIdx].map(c => {
    const raw = String(c ?? '');
    const normalized = normalizeText(raw).toLowerCase().trim();
    return normalized;
  });
  
  // DEBUG: Mostrar todos os headers com índice
  console.log('[Itinerary Excel] HEADERS COMPLETOS:');
  headerRow.forEach((h, idx) => {
    console.log(`  [${idx}] = "${h}"`);
  });
  
  // Mapear colunas - com fallback para índices conhecidos do formato MB
  let pesoBrutoIdx = findExactOrPattern(headerRow, ['peso bruto'], [/peso\s*bruto/i]);
  
  // FALLBACK CRÍTICO: Se não encontrou "peso bruto" mas encontrou "cliente", 
  // usar índice 5 (coluna G do formato MB padrão)
  if (pesoBrutoIdx === -1) {
    console.warn('[Itinerary Excel] ATENÇÃO: Header "Peso Bruto" não encontrado por nome');
    console.warn('[Itinerary Excel] Tentando fallback para índice 5 (coluna G)...');
    
    // Verificar se índice 5 existe e parece ser peso (header ou dados numéricos)
    if (headerRow.length > 5) {
      const col5Header = headerRow[5];
      const col5FirstData = rows[headerRowIdx + 1]?.[5];
      
      console.log('[Itinerary Excel] Coluna 5 - Header:', col5Header);
      console.log('[Itinerary Excel] Coluna 5 - Primeiro dado:', col5FirstData);
      
      // Se o primeiro dado parece ser número, usar índice 5
      if (typeof col5FirstData === 'number' || /^[\d.,]+$/.test(String(col5FirstData ?? ''))) {
        pesoBrutoIdx = 5;
        console.log('[Itinerary Excel] Usando índice 5 como Peso Bruto (fallback)');
      }
    }
  }
  
  console.log('[Itinerary Excel] Peso Bruto mapeado para índice:', pesoBrutoIdx);
  
  // ... resto do código ...
  
  // Ao processar cada linha, LOGAR os primeiros 10 pesos para debug
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    // ...
    
    const pesoRaw = pesoBrutoIdx !== -1 ? row[pesoBrutoIdx] : 0;
    const weight = parseExcelWeight(pesoRaw as string | number | null | undefined);
    
    // Log detalhado para primeiras 10 linhas
    if (rowsProcessed <= 10) {
      console.log(`[Peso] Linha ${i}: raw="${pesoRaw}" (tipo=${typeof pesoRaw}) -> converted=${weight}kg`);
    }
    
    // ...
  }
}
```

### 2. Melhorar `findExactOrPattern` para ser mais robusto

```typescript
function findExactOrPattern(headers: string[], exactMatches: string[], patterns: RegExp[]): number {
  // Primeiro: correspondência exata com normalização agressiva
  for (const exact of exactMatches) {
    const normalizedExact = exact.toLowerCase().trim().replace(/\s+/g, ' ');
    
    for (let i = 0; i < headers.length; i++) {
      const normalizedHeader = headers[i].replace(/\s+/g, ' ').trim();
      
      if (normalizedHeader === normalizedExact) {
        console.log(`[findExactOrPattern] Match exato: "${normalizedHeader}" no índice ${i}`);
        return i;
      }
    }
  }
  
  // Segundo: correspondência por padrão regex
  for (let i = 0; i < headers.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(headers[i])) {
        console.log(`[findExactOrPattern] Match regex: "${headers[i]}" no índice ${i}`);
        return i;
      }
    }
  }
  
  return -1;
}
```

### 3. Adicionar Validação Pós-Parsing

Após o parsing, verificar se o peso total faz sentido:

```typescript
// Final do parseItinerarioExcel
const calculatedTotalWeight = records.reduce((sum, r) => sum + r.weight_kg, 0);

console.log('=====================================');
console.log('VALIDAÇÃO FINAL DO PESO:');
console.log(`  Registros: ${records.length}`);
console.log(`  Peso Total: ${calculatedTotalWeight.toFixed(2)} kg`);
console.log(`  Peso Total: ${(calculatedTotalWeight / 1000).toFixed(2)} t`);
console.log(`  Peso Médio: ${(calculatedTotalWeight / records.length).toFixed(2)} kg/registro`);
console.log('=====================================');

// ALERTA CRÍTICO se peso parecer errado
if (records.length > 50 && calculatedTotalWeight < 1000) {
  console.error('❌ ERRO CRÍTICO: Peso total MUITO baixo!');
  console.error('   Isso indica que a coluna Peso Bruto não foi mapeada corretamente.');
  console.error('   Verificar índice da coluna pesoBruto:', pesoBrutoIdx);
}
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Peso Total | 2.8t | **13,05t** |
| Pedidos | 72 | 72 |
| Peso Médio | 39kg | ~181kg |
| Caminhões | 1-2 | **4** |

## Teste de Validação

Após a correção, fazer upload do arquivo `Relatório_de_Vendas_-_MB-2.xlsx` e verificar:
1. Console deve mostrar: `PESO TOTAL CALCULADO: 13048.56 kg`
2. UI deve exibir: `Peso Total: 13.0t`
3. Recomendação de frota: `4 caminhões`
