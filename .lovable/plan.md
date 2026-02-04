
# Plano: Corrigir Cruzamento de Dados entre Relatório Geral e Detalhe das Vendas

## Problema Identificado

O sistema está processando o arquivo "Detalhe das Vendas MB.xlsx" incorretamente:
- **Atual:** O Motor Inteligente trata cada linha como um pedido separado → 171 "pedidos"
- **Correto:** O parser hierárquico ADV deveria agrupar linhas por número da venda → 73 pedidos com 171 itens

O cruzamento falha porque:
- O Relatório Geral tem 73 registros com `venda_id` correto (ex: "276017")
- O Detalhe está gerando IDs como `"CLIENTE::linha"` em vez do número da venda
- A função `mergeItinerarioWithADV` não consegue encontrar correspondência

## Solução em 4 Partes

### 1. Priorizar Parser Hierárquico para Detalhe das Vendas

Modificar `DualFileUpload.tsx` para detectar o formato ADV ANTES de usar o Motor Inteligente:

```typescript
// Se detectar padrões hierárquicos (Cliente:, Venda Nº:), usar parseADVDetailExcel
if (isADVExcelFormat(rows)) {
  const advOrders = parseADVDetailExcel(rows);
  // Isso agrupa itens por venda = 73 pedidos, não 171
}
```

### 2. Melhorar Detecção de Formato ADV

O arquivo "Detalhe das Vendas MB.xlsx" pode ter um formato ligeiramente diferente. Atualizar `isADVExcelFormat()` para detectar padrões adicionais como:
- Linhas com "Produto" ou "Descrição"
- Estrutura hierárquica com linhas de cliente/venda intercaladas

### 3. Implementar Cruzamento por Nome do Cliente (Fallback)

Atualizar `mergeItinerarioWithADV()` para:
1. **Primeira tentativa:** Cruzar por `venda_id`/`pedido_id`
2. **Segunda tentativa:** Cruzar por nome do cliente (normalizado)

```typescript
// Criar mapa adicional por nome do cliente
const clienteMap = new Map<string, ItinerarioRecord>();
for (const record of itinerario) {
  const normalizedName = normalizeClientName(record.client_name);
  clienteMap.set(normalizedName, record);
}

// No cruzamento, tentar por ID primeiro, depois por nome
let enderecoData = itinerarioMap.get(order.pedido_id);
if (!enderecoData) {
  enderecoData = clienteMap.get(normalizeClientName(order.client_name));
}
```

### 4. Corrigir Labels na UI

Atualizar `getFileSummary()` para mostrar terminologia correta:
- Relatório Geral: "73 vendas" (vendas = pedidos com endereço)
- Detalhe das Vendas: "171 itens em 73 pedidos" (itens ≠ pedidos)

## Arquivos a Modificar

1. **`src/components/route/DualFileUpload.tsx`**
   - Adicionar detecção de formato ADV antes do Motor Inteligente
   - Corrigir labels de exibição ("itens" vs "pedidos")
   - Calcular e exibir número correto de pedidos únicos

2. **`src/lib/advParser.ts`**
   - Melhorar `isADVExcelFormat()` para detectar mais padrões
   - Melhorar `parseADVDetailExcel()` para extrair `pedido_id` corretamente
   - Atualizar `mergeItinerarioWithADV()` com fallback por nome do cliente
   - Adicionar normalização de nomes para comparação

3. **`src/lib/spreadsheet/intelligentReader.ts`**
   - Adicionar detecção de formato hierárquico para evitar processamento incorreto
   - Redirecionar para parser ADV quando detectar padrões de Cliente:/Venda Nº:

## Detalhes Técnicos

### Normalização de Nome para Cruzamento

```typescript
function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')            // Espaços únicos
    .trim();
}
```

### Estrutura Esperada Após Correção

```text
Relatório Geral:
  - 73 registros com venda_id + endereço + peso

Detalhe das Vendas:
  - 73 pedidos (agrupados por venda_id)
  - Cada pedido contém N itens
  - Total: 171 itens

Cruzamento:
  - Match por venda_id → 73 pedidos cruzados
  - Fallback por cliente → captura casos onde ID não bate
```

## Resultado Esperado

Após as correções:
- ✅ "73 vendas | 13,05 t" no Relatório Geral
- ✅ "73 pedidos | 171 itens" no Detalhe das Vendas
- ✅ "Cruzamento concluído: 73 pedidos cruzados com sucesso"
- ✅ Peso total mantido (~13 toneladas)
