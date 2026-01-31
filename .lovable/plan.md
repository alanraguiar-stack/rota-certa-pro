
# Plano: Correção Definitiva do Cálculo do Peso Bruto

## Análise do Problema

### Estrutura Real do Arquivo Excel MB

Analisando o arquivo `Relatório_de_Vendas_-_MB-3.xlsx`:

| Índice | Coluna Excel | Header     | Exemplo de Dados | Formato   |
|--------|--------------|------------|------------------|-----------|
| 0      | A            | Venda      | 276584           | Número    |
| 1      | B            | Cliente    | RANIERY JOSE...  | Texto     |
| 2      | C            | **(vazio)**| ""               | Vazio     |
| 3      | D            | Total      | 483,30           | R$ (BR)   |
| 4      | E            | Ordem      | ""               | Vazio     |
| **5**  | **F**        | **Peso Bruto** | **224.55**   | **kg (US)**|
| 6      | G            | Cep Ent.   | 02988-100        | CEP       |
| 7      | H            | End. Ent.  | HERBERT LAAS...  | Endereço  |
| 8      | I            | Endereço   | (nome da rua)    | Texto     |
| 9      | J            | Bairro Ent.| PARQUE TAIPAS    | Bairro    |
| 10     | K            | Cidade Ent.| SAO PAULO        | Cidade    |

**Peso Total Correto**: 13.048,56 kg (última linha do arquivo)

### Problemas Identificados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Coluna C (índice 2) vazia | Desloca índices se parser pular vazios |
| 2 | Coluna E (índice 4) vazia | Idem acima |
| 3 | Coluna "Total" (índice 3) usa formato BR (1.234,56) | Pode ser confundida com peso |
| 4 | Coluna "Peso Bruto" (índice 5) usa formato US (123.45) | É o peso correto! |
| 5 | Heurística de "maior soma" pode selecionar "Total" (R$) em vez de "Peso Bruto" (kg) | Causa raiz provável! |

### Causa Raiz Provável

A heurística de NÍVEL 4 (encontrar coluna numérica com maior soma) está **selecionando a coluna "Total" (valores em R$)** porque os valores monetários são maiores que os pesos em kg:

- Total da venda 276584: R$ 483,30 → parseado como 483.30
- Peso Bruto da venda 276584: 224.55 kg → parseado como 224.55

**Soma de "Total" > Soma de "Peso Bruto"**, então a heurística erra!

## Solução Proposta

### Mudanças no Arquivo `src/lib/advParser.ts`

1. **Forçar uso do índice 5 para formato MB** quando o header "Peso Bruto" é reconhecido (mesmo com caracteres estranhos)

2. **Ignorar colunas que parecem valores monetários** na heurística (valores > 100 em formato BR podem ser R$)

3. **Validar que a coluna encontrada tem valores realistas de peso** (entre 1 e 2000 kg por pedido)

4. **Adicionar log de DEBUG mais detalhado** mostrando os valores RAW lidos de cada coluna candidata

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/advParser.ts` | Editar | Corrigir lógica de detecção da coluna Peso Bruto |

## Mudanças Técnicas

### 1. Melhorar Detecção por Nome do Header

Adicionar normalização mais agressiva que remove TODOS os caracteres não-alfanuméricos antes de comparar:

```typescript
// Normalização super agressiva para encontrar "peso bruto"
const superNormalize = (s: string) => 
  s.toLowerCase()
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '') // Remove acentos
   .replace(/[^a-z0-9]/g, '');      // Remove tudo que não é letra/número

// "Peso Bruto" -> "pesobruto"
// "Peso  Bruto" -> "pesobruto"  
// "Peso\u00A0Bruto" -> "pesobruto"
```

### 2. Priorizar Índice 5 para Formato MB

Quando detectar formato MB (has Cliente + End. Ent.), forçar verificação do índice 5 ANTES da heurística de maior soma:

```typescript
// PRIORIDADE: Para formato MB, índice 5 é a coluna Peso Bruto
if (columnMap.pesoBruto === -1 && isMBFormat) {
  // Verificar se índice 5 contém valores numéricos plausíveis de peso
  const col5Values = [];
  for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 10, rows.length); i++) {
    const val = parseExcelWeight(rows[i]?.[5]);
    if (val > 0) col5Values.push(val);
  }
  
  // Se maioria dos valores está entre 1 e 1500 kg, é provavelmente peso
  const avgCol5 = col5Values.reduce((a,b) => a+b, 0) / col5Values.length;
  if (avgCol5 > 1 && avgCol5 < 1500 && col5Values.length >= 5) {
    columnMap.pesoBruto = 5;
    console.log('[MB Format] Forçando índice 5 como Peso Bruto - média:', avgCol5.toFixed(2));
  }
}
```

### 3. Excluir Coluna "Total" da Heurística

A coluna "Total" contém valores monetários (R$) que são maiores que pesos. Excluir colunas cujo header contenha "total", "valor", "preco", "r$":

```typescript
// Na heurística de maior soma, pular colunas que parecem ser valores monetários
const monetaryHeaders = ['total', 'valor', 'preco', 'preço', 'r$', 'reais'];
if (monetaryHeaders.some(m => headerRow[colIdx]?.includes(m))) {
  console.log('[Heurística] Pulando coluna', colIdx, 'por ser valor monetário');
  continue;
}
```

### 4. Validar Peso Médio Após Parsing

Após calcular o peso total, verificar se a média por pedido faz sentido:

```typescript
const avgWeight = calculatedTotalWeight / records.length;

// Peso médio esperado: 50-500 kg por entrega de alimentos
if (avgWeight < 10 || avgWeight > 2000) {
  console.error('⚠️ PESO MÉDIO SUSPEITO:', avgWeight.toFixed(2), 'kg');
  console.error('   Isso pode indicar coluna errada ou formato de número incorreto');
}
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Coluna Selecionada | 3 (Total - R$) | **5 (Peso Bruto - kg)** |
| Peso Total | ~60.000 (errado) ou ~2.800 (errado) | **13.048,56 kg** |
| Peso Médio | ~800 (se Total) ou ~40 (se errado) | **~181 kg/pedido** |
| Caminhões Sugeridos | 1-2 (errado) | **4 caminhões** |

## Formato Ideal da Planilha

Para garantir reconhecimento correto, a planilha deve seguir este formato:

| Coluna | Nome no Header | Formato dos Dados | Obrigatório |
|--------|----------------|-------------------|-------------|
| A | Venda | Número inteiro | ✅ Sim |
| B | Cliente | Texto | ✅ Sim |
| C-E | (qualquer) | - | Opcional |
| **F** | **Peso Bruto** | Número decimal (ex: 224.55 ou 224,55) | ✅ Sim |
| G | Cep Ent. | 00000-000 | Recomendado |
| H | End. Ent. | Texto com número | ✅ Sim |
| I | Endereço | Texto (nome da rua) | Opcional |
| J | Bairro Ent. | Texto | Recomendado |
| K | Cidade Ent. | Texto | Recomendado |

**Regras para a coluna Peso Bruto**:
- Header deve conter as palavras "Peso" e "Bruto" (pode ter espaços extras)
- Valores podem estar em formato BR (224,55) ou US (224.55)
- Valores devem ser apenas números, sem unidade "kg"
- Valores esperados: entre 1 e 2000 kg por linha

## Teste de Validação

Após a correção:

1. Fazer upload do arquivo `Relatório_de_Vendas_-_MB-3.xlsx`
2. Verificar no console:
   - `🎯 Peso Bruto: índice 5`
   - `PESO TOTAL: 13048.56 kg`
3. Verificar na UI:
   - Peso Total: **13.0t**
   - 72 pedidos
   - Recomendação de 4 caminhões
