
# Plano: Parser Inteligente para Relatórios ADV

## Problema Identificado

Os seus PDFs têm formato **hierárquico ADV** que é completamente diferente de uma tabela simples:

```text
# Cliente: ANGELA ALVES MADEIRA BARBOSA
   Venda Nº: 276017    NFe Nº: 50756    Data: 23/01/2026
   | Código | Descrição                    | Qtde. | Unitário | Total |
   | 1090   | MUSSARELA - ESPLANADA - 4 KG | 12,81 | 32,99    | 422,60|
```

O parser atual espera uma estrutura de tabela com headers na primeira linha (Cliente | Endereço | Peso), mas os relatórios ADV organizam por **seções de cliente**.

## Solução Proposta

Criar um **parser especializado para formato ADV** que:
1. Detecta automaticamente se o PDF é no formato ADV
2. Extrai dados da estrutura hierárquica (Cliente → Venda → Itens)
3. Usa a coluna `Qtde.` como peso em kg dos produtos

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/pdfParser.ts` | Adicionar função de extração de texto bruto |
| `src/lib/orderParser.ts` | Adicionar parser ADV com detecção automática |
| `src/lib/itemDetailParser.ts` | Adicionar parser ADV para itens detalhados |

## Mudanças Técnicas

### 1. Extração de Texto Bruto (`src/lib/pdfParser.ts`)

Nova função para extrair texto linha a linha, preservando a estrutura:

```typescript
export async function extractRawTextFromPDF(file: File): Promise<string[]> {
  // Retorna array de linhas de texto na ordem do documento
  // Isso permite processar o PDF de forma sequencial
}
```

### 2. Parser ADV (`src/lib/orderParser.ts`)

Nova função que detecta e processa o formato ADV:

```typescript
async function parseADVSalesReport(file: File): Promise<ParseResult | null> {
  const lines = await extractRawTextFromPDF(file);
  
  // Detectar formato ADV: buscar "Vendas detalhadas" ou "Cliente:"
  const isADVFormat = lines.some(line => 
    /vendas\s*detalhadas/i.test(line) || /^#?\s*cliente\s*:/i.test(line)
  );
  
  if (!isADVFormat) return null;
  
  // Processar estrutura hierárquica:
  // 1. Encontrar blocos de cliente (linhas com "Cliente:")
  // 2. Para cada cliente, encontrar vendas (linhas com "Venda Nº:")
  // 3. Para cada venda, extrair itens da tabela
  
  // Padrões de extração:
  const clientPattern = /cliente\s*:\s*(.+?)(?:\s+\d{11}|\s*$)/i;
  const vendaPattern = /venda\s*n[º°]?\s*:\s*(\d+)/i;
  const itemPattern = /^\s*(\d+)\s+(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$/;
}
```

### 3. Detecção Automática de Formato

Modificar `parseSalesPDF` para tentar primeiro o parser ADV:

```typescript
export async function parseSalesPDF(file: File): Promise<ParseResult> {
  // Tentar parser ADV primeiro
  const advResult = await parseADVSalesReport(file);
  if (advResult && advResult.validRows > 0) {
    return advResult;
  }
  
  // Fallback: parser genérico
  return parseGenericPDF(file);
}
```

## Fluxo de Dados Extraídos

Do PDF `RELATÓRIO_DE_VENDAS_-_23.01.26.pdf`:

| Campo Extraído | Mapeamento no Sistema |
|----------------|----------------------|
| `Cliente: NOME` | `client_name` |
| `Venda Nº: 276017` | `pedido_id` |
| `Descrição` (tabela) | `product_name` em `items[]` |
| `Qtde.` (tabela) | `weight_kg` (peso do produto) |

Exemplo de resultado:
```typescript
{
  pedido_id: "276017",
  client_name: "ANGELA ALVES MADEIRA BARBOSA",
  items: [
    { product_name: "MUSSARELA - ESPLANADA - 4 KG", weight_kg: 12.81, quantity: 1 }
  ],
  weight_kg: 12.81,  // soma dos itens
  address: ""        // precisa ser preenchido separadamente
}
```

## Questão Crítica: Endereços

O relatório ADV **NÃO contém endereços de entrega**. Para resolver:

### Opção A: Cruzar com segundo arquivo
Se o PDF `venda.23.01.26.pdf` tiver os endereços, cruzar pelo nome do cliente

### Opção B: Base de cadastro
Solicitar upload de uma base de clientes com endereços que será cruzada

### Opção C: Inserção manual
Após carregar os pedidos, permitir inserir/editar endereços antes de roteirizar

## Passos de Implementação

1. **Adicionar extração de texto bruto** em `pdfParser.ts`
2. **Implementar parser ADV** em `orderParser.ts`
3. **Integrar detecção automática** no fluxo existente
4. **Adicionar tratamento para endereços faltantes**
5. **Testar com os dois PDFs fornecidos**

## Resultado Esperado

Após a implementação:
1. Fazer upload do PDF `RELATÓRIO_DE_VENDAS`
2. Sistema detecta automaticamente o formato ADV
3. Extrai todos os clientes, vendas e itens
4. Apresenta os dados extraídos com opção de inserir endereços
5. Continua o fluxo de roteirização normalmente
