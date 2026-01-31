
# Plano: Correção Definitiva do Cálculo do Peso Total

## Problema Identificado

O sistema está exibindo peso errado (ex: 2.8t quando deveria ser ~13t). Baseado na análise do código e imagens do usuário, identifiquei **múltiplas causas potenciais**:

### Causa 1: Mapeamento de Coluna "Peso Bruto" Falha Silenciosamente

A função `findExactOrPattern` pode não encontrar o header "Peso Bruto" devido a:
- Caracteres invisíveis (espaços UTF-8 especiais, BOM, etc.)
- Colunas vazias que deslocam os índices
- Headers com acentos ou formatação diferente

**Evidência**: O fallback para índice 5 existe, mas pode não estar funcionando porque o header **foi encontrado com índice errado** (não chegou ao fallback).

### Causa 2: A Função `parseExcelWeight` Pode Estar Retornando 0

Se o valor raw da célula vier em formato inesperado (objeto Date, fórmula, etc.), a função retorna 0.

### Causa 3: Validação de `isValid` Filtra Pedidos do Peso Total

Na página NewRoute.tsx (linhas 46-47):
```typescript
const validOrders = orders.filter((o) => o.isValid);
const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
```

Se pedidos são marcados como inválidos (ex: sem endereço), eles **não são contados no peso total**, mesmo tendo peso válido.

## Solução Proposta

### Etapa 1: Forçar Leitura da Coluna G Pelo Índice (Não Pelo Nome)

Para o formato MB específico, **ignorar a busca por nome** e usar diretamente o índice 5 (Coluna G) se o formato MB for detectado.

```typescript
// Em parseItinerarioExcel - FORÇAR índice 5 para formato MB
if (isMBFormat) {
  // Formato MB padrão: Coluna G = Peso Bruto = índice 5 (1-indexed: coluna 6)
  // Mas como array é 0-indexed e há coluna vazia no índice 2, 
  // o índice real pode ser diferente
  
  // ESTRATÉGIA: Logar TODAS as colunas e seus valores da primeira linha de dados
  // para identificar visualmente onde está o peso
}
```

### Etapa 2: Adicionar Debug Máximo Temporário

Adicionar logs que mostram:
1. Cada célula da linha de header com índice
2. Cada célula da primeira linha de dados com índice
3. O valor raw e convertido de cada peso

### Etapa 3: Calcular Peso Total de TODOS os Pedidos (Não Apenas Válidos)

Em `WeightValidation.tsx` e `NewRoute.tsx`, mostrar também o peso total de TODOS os pedidos, não só os válidos:

```typescript
const allOrdersWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
const validOrdersWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
```

### Etapa 4: Estratégia de Fallback Mais Agressiva

Se o peso total calculado for menor que 1000kg para mais de 20 pedidos, **iterar por todas as colunas numéricas** e usar a coluna com maior soma como peso.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/advParser.ts` | Editar | Adicionar debug máximo e estratégia de detecção automática de coluna de peso |
| `src/components/route/WeightValidation.tsx` | Editar | Mostrar peso de todos os pedidos, não só válidos |
| `src/pages/NewRoute.tsx` | Editar | Usar peso total de todos os pedidos para validação |

## Mudanças Técnicas Detalhadas

### 1. advParser.ts - Debug Máximo e Auto-Detecção de Coluna de Peso

```typescript
export function parseItinerarioExcel(rows: unknown[][]): ItinerarioRecord[] {
  // ... código existente para encontrar headerRowIdx ...
  
  const headerRow = rows[headerRowIdx].map(c => normalizeText(String(c ?? '')).toLowerCase().trim());
  const firstDataRow = rows[headerRowIdx + 1];
  
  // ========= DEBUG MÁXIMO: MOSTRAR TODA A ESTRUTURA =========
  console.log('========== ANÁLISE COMPLETA DO EXCEL ==========');
  console.log('Header Row Index:', headerRowIdx);
  console.log('');
  console.log('HEADERS (com índice):');
  headerRow.forEach((h, idx) => {
    console.log(`  [${idx}] "${h}" | Dado correspondente: "${firstDataRow?.[idx]}" (${typeof firstDataRow?.[idx]})`);
  });
  console.log('');
  
  // ========= ESTRATÉGIA DE AUTO-DETECÇÃO DE COLUNA DE PESO =========
  // 1. Tentar encontrar pelo nome "peso bruto"
  let pesoBrutoIdx = findExactOrPattern(headerRow, ['peso bruto'], [/peso\s*bruto/i]);
  
  // 2. Se não encontrou, procurar coluna com header contendo "peso"
  if (pesoBrutoIdx === -1) {
    pesoBrutoIdx = headerRow.findIndex(h => h.includes('peso'));
    if (pesoBrutoIdx !== -1) {
      console.log('[Auto-Detect] Encontrou coluna com "peso" no índice:', pesoBrutoIdx);
    }
  }
  
  // 3. Se ainda não encontrou, usar ÍNDICE 5 como fallback para formato MB
  if (pesoBrutoIdx === -1 && headerRow.length > 5) {
    // Verificar se dados no índice 5 são numéricos
    const sampleValues = [];
    for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 5, rows.length); i++) {
      const val = rows[i]?.[5];
      sampleValues.push(val);
    }
    
    const numericCount = sampleValues.filter(v => 
      typeof v === 'number' || /^[\d.,]+$/.test(String(v ?? '').trim())
    ).length;
    
    if (numericCount >= 2) {
      pesoBrutoIdx = 5;
      console.log('[Fallback] Usando índice 5 (MB padrão) - Valores encontrados:', sampleValues);
    }
  }
  
  // 4. ÚLTIMO RECURSO: Detectar coluna numérica com maior soma
  if (pesoBrutoIdx === -1) {
    console.warn('[ÚLTIMO RECURSO] Procurando coluna numérica com maior soma...');
    
    let maxSum = 0;
    let maxSumIdx = -1;
    
    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      let colSum = 0;
      let numericCount = 0;
      
      for (let rowIdx = headerRowIdx + 1; rowIdx < Math.min(rows.length, headerRowIdx + 50); rowIdx++) {
        const val = rows[rowIdx]?.[colIdx];
        if (typeof val === 'number' && val > 0) {
          colSum += val;
          numericCount++;
        } else if (typeof val === 'string') {
          const num = parseFloat(val.replace(',', '.'));
          if (!isNaN(num) && num > 0 && num < 10000) { // Limite razoável para peso individual
            colSum += num;
            numericCount++;
          }
        }
      }
      
      // Se mais de 50% das linhas têm valores numéricos e a soma é maior
      if (numericCount > 10 && colSum > maxSum) {
        maxSum = colSum;
        maxSumIdx = colIdx;
      }
    }
    
    if (maxSumIdx !== -1) {
      pesoBrutoIdx = maxSumIdx;
      console.log('[ÚLTIMO RECURSO] Coluna', maxSumIdx, 'selecionada com soma:', maxSum.toFixed(2));
    }
  }
  
  console.log('');
  console.log('🎯 COLUNA DE PESO FINAL: índice', pesoBrutoIdx);
  console.log('================================================');
  
  // ... resto do código de processamento ...
}
```

### 2. WeightValidation.tsx - Mostrar Peso de Todos os Pedidos

```typescript
export function WeightValidation({ orders, trucks }: WeightValidationProps) {
  // Peso de TODOS os pedidos (independente de isValid)
  const allOrdersWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
  
  // Pedidos válidos (para capacidade)
  const validOrders = orders.filter((o) => o.isValid);
  const validWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
  
  // Se houver diferença significativa, alertar
  const hasMismatch = Math.abs(allOrdersWeight - validWeight) > 100;
  
  // Usar peso total de TODOS os pedidos para cálculos
  const totalWeight = allOrdersWeight; // <-- MUDANÇA CRÍTICA
  
  // ... resto do código ...
  
  // Adicionar card de alerta se houver diferença
  {hasMismatch && (
    <Card className="border-warning/50 bg-warning/5">
      <CardContent className="py-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <p className="font-medium text-warning">Alguns pedidos não têm endereço</p>
            <p className="text-sm text-muted-foreground">
              {orders.length - validOrders.length} pedidos sem endereço ({formatWeight(allOrdersWeight - validWeight)}).
              Corrija os endereços para incluí-los na rota.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )}
}
```

### 3. NewRoute.tsx - Usar Peso Total Correto

```typescript
// Linha 46-47: MUDAR para usar todos os pedidos
const allOrders = orders;
const validOrders = orders.filter((o) => o.isValid);

// Usar peso de TODOS os pedidos para validação de frota
const totalWeight = allOrders.reduce((sum, o) => sum + o.weight_kg, 0);

// Para a rota final, ainda usar só os válidos (que têm endereço)
const routeWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
```

## Resultado Esperado

Após as correções:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Peso Total Exibido | 2.8t (errado) | **13.05t** (correto) |
| Console Log | Sem detalhes | Debug completo mostrando cada coluna |
| Detecção de Coluna | Falha silenciosa | Auto-detecção com múltiplos fallbacks |
| Alertas | Nenhum | Aviso quando pedidos sem endereço não são contados |

## Teste de Validação

1. Fazer upload do arquivo MB
2. Verificar no console que aparece: `🎯 COLUNA DE PESO FINAL: índice 5` (ou o índice correto)
3. Verificar que o peso total exibido é ~13t
4. Se alguns pedidos não tiverem endereço, aparecer aviso amarelo
