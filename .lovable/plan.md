
# Plano: Adaptar Parsers para Arquivos Excel MB

## Problema Identificado

O sistema está gerando erros ao processar os arquivos Excel do usuário porque:

1. **Relatório de Vendas**: O parser não está reconhecendo corretamente todas as colunas do formato específico (ex: linhas vazias entre os dados, formato do "Peso Bruto" com ponto como separador de milhares)
2. **Detalhe das Vendas**: O parser de Excel não está tratando o formato hierárquico (Cliente → Venda → Itens) que está presente no arquivo Excel

## Análise dos Arquivos do Usuário

### Relatório de Vendas MB (Excel)
| Coluna | Exemplo | Uso |
|--------|---------|-----|
| `Venda` | 276584 | ID do pedido (para cruzamento) |
| `Cliente` | RANIERY JOSE DA SILVA | Nome do cliente |
| `Peso Bruto` | 224.55 | Peso total da entrega em kg |
| `End. Ent.` | HERBERT LAAS, 73 | Endereço + número |
| `Bairro Ent.` | PARQUE TAIPAS | Bairro |
| `Cidade Ent.` | SAO PAULO | Cidade |
| `Cep Ent.` | 02988-100 | CEP |

**Observações:**
- Linhas vazias entre os registros
- Peso usa ponto como decimal (224.55)
- Coluna `End. Ent.` já inclui o número

### Detalhe das Vendas MB (Excel)
Formato hierárquico com seções:
```
Cliente: A P SOARES DA SILVA MERCADO E PADARIA
Venda Nº: 276598  NFe Nº: 51088
  Código | Descrição | Qtde. | Unitário | Total
  5677   | REFRIGERANTE TUBAINA - 2 LT | 20 | 26.85 | 537.00
```

**Observações:**
- `Qtde.` representa o peso em kg (não quantidade de unidades)
- Estrutura hierárquica em Excel, não tabular puro

## Solução

### Parte 1: Melhorar Parser do Relatório de Vendas (orderParser.ts)

1. Adicionar suporte a linhas vazias entre registros
2. Melhorar detecção da coluna `Peso Bruto`
3. Garantir que colunas com sufixo `Ent.` sejam priorizadas

### Parte 2: Criar Parser de Detalhe de Vendas em Excel (advParser.ts)

1. Adicionar função `parseADVExcel()` para processar o formato hierárquico em Excel
2. Detectar linhas de `Cliente:`, `Venda Nº:` e itens
3. Extrair `Qtde.` como peso em kg

### Parte 3: Atualizar DualFileUpload para Excel

1. Detectar automaticamente se Excel é "Relatório Geral" ou "Detalhe"
2. Aplicar o parser correto baseado no conteúdo

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/lib/orderParser.ts` | Editar | Melhorar tolerância a linhas vazias e formatação de peso |
| `src/lib/advParser.ts` | Editar | Adicionar `parseADVDetailExcel()` para Excel hierárquico |
| `src/components/route/DualFileUpload.tsx` | Editar | Integrar detecção automática de tipo para Excel |

## Mudanças Técnicas Detalhadas

### 1. orderParser.ts - Melhorar Detecção de Colunas

```typescript
// Atualizar COLUMN_PATTERNS.weight para priorizar "Peso Bruto"
weight: [
  /^peso\s*bruto$/i,  // Exata: "Peso Bruto" (máxima prioridade)
  /peso\s*bruto/i,    // Contém: "Peso Bruto"
  /peso/i, /weight/i, /kg/i,
],

// Melhorar parseWeight para lidar com formato brasileiro
function parseWeight(value: unknown): number | null {
  // Detectar formato: 1.234,56 (BR) vs 1,234.56 (US)
  // Se tem ponto antes de vírgula, é formato BR
  // Se tem vírgula seguida de 3 dígitos, vírgula é separador de milhares
}
```

### 2. advParser.ts - Novo Parser para Excel ADV

```typescript
/**
 * Detecta se Excel é formato de Detalhe das Vendas ADV
 */
export function isADVExcelFormat(rows: unknown[][]): boolean {
  const text = rows.map(r => r.join(' ')).join('\n');
  
  return (
    /cliente\s*:/i.test(text) &&
    /venda\s*n[º°]?\s*:/i.test(text) &&
    /qtde\.?/i.test(text)
  );
}

/**
 * Parser para Detalhe das Vendas em Excel
 */
export function parseADVDetailExcel(rows: unknown[][]): ParsedOrder[] {
  // Processar linha por linha
  // Detectar "Cliente:" para novo cliente
  // Detectar "Venda Nº:" para nova venda
  // Coletar itens até próximo cliente/venda
}
```

### 3. DualFileUpload.tsx - Integrar Detecção

```typescript
// Em processFile(), adicionar detecção para Excel
if (isExcelFile(file)) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  
  // Verificar se é formato ADV (Detalhe das Vendas)
  if (isADVExcelFormat(rows)) {
    const advOrders = parseADVDetailExcel(rows);
    // Retornar como tipo 'adv' para cruzamento
  }
  
  // Verificar se é formato Itinerário (Relatório Geral)
  if (detectItineraryFormat(headers)) {
    // Processar como itinerário
  }
}
```

## Fluxo de Cruzamento

```text
┌─────────────────────────┐    ┌─────────────────────────┐
│ Relatório_de_Vendas.xlsx│    │ Detalhe_das_Vendas.xlsx │
│ ────────────────────────│    │ ────────────────────────│
│ Venda: 276584           │    │ Venda Nº: 276584        │
│ Cliente: RANIERY        │    │ Item: Mortadela 10kg    │
│ End. Ent.: HERBERT...   │    │ Item: Mussarela 20kg    │
│ Peso Bruto: 224.55      │    │                         │
└────────────┬────────────┘    └────────────┬────────────┘
             │                              │
             │ Detectado como               │ Detectado como
             │ "itinerário"                 │ "adv"
             │                              │
             └──────────┬───────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │ Cruzamento por Venda│
              │ ────────────────────│
              │ Venda: 276584       │
              │ Cliente: RANIERY    │
              │ Endereço: HERBERT...│
              │ Peso: 224.55kg      │
              │ Itens:              │
              │  - Mortadela 10kg   │
              │  - Mussarela 20kg   │
              └─────────────────────┘
```

## Resultado Esperado

1. Upload do "Relatório_de_Vendas_MB.xlsx" → Detectado automaticamente como fonte de endereços
2. Upload do "Detalhe_das_Vendas_MB.xlsx" → Detectado automaticamente como fonte de itens
3. Cruzamento automático pelo número da Venda
4. Romaneio de Carga com itens consolidados (ex: Mortadela 50kg, Mussarela 120kg)
5. Romaneio de Entrega com ordem de paradas e peso por cliente

## Tratamento de Casos Especiais

| Caso | Comportamento |
|------|---------------|
| Linhas vazias no Excel | Ignorar linhas completamente vazias |
| Cliente com múltiplas vendas | Agrupar por endereço (mesmo cliente, mesmo local = 1 entrega) |
| Venda sem match no cruzamento | Marcar como inválida com aviso |
| Peso com formato BR (1.234,56) | Converter automaticamente |
| Peso como decimal simples (224.55) | Aceitar diretamente |
