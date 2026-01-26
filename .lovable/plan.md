

# Plano: Cruzar Dados dos Dois PDFs pelo Número da Venda

## Entendimento do Problema

Você tem **dois PDFs complementares** que precisam ser cruzados:

| Arquivo | Contém | Campos Principais |
|---------|--------|-------------------|
| `venda.23.01.26.pdf` | Itinerário de Vendas | Venda, Cliente, **End. Ent.**, Bairro Ent., Cidade Ent., Cep Ent., Peso Bruto |
| `RELATÓRIO_DE_VENDAS_-_23.01.26.pdf` | Relatório ADV | Venda Nº, Cliente, **Itens detalhados** (Produto + Qtde) |

**Chave de cruzamento**: Número da Venda (ex: `276017`, `275949`)

## Fluxo de Processamento

```text
Upload: venda.23.01.26.pdf (Itinerário)
  -> Extrai: Venda, Cliente, End. Ent., Bairro, Cidade, CEP, Peso
            |
            v
Upload: RELATÓRIO_DE_VENDAS.pdf (Detalhamento ADV)
  -> Extrai: Venda Nº, Cliente, Itens (Produto + Peso)
            |
            v
CRUZAMENTO pelo Número da Venda
  -> Pedido completo: Cliente + Endereço + Itens + Peso
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/advParser.ts` | Adicionar parser para formato Itinerário + função de cruzamento |
| `src/lib/orderParser.ts` | Atualizar mapeamento de colunas para reconhecer "End. Ent.", "Bairro Ent.", etc. |
| `src/components/route/DualFileUpload.tsx` | Integrar detecção automática e cruzamento no fluxo |

## Detalhes Técnicos

### 1. Novo Tipo: Registro de Itinerário

```typescript
interface ItinerarioRecord {
  venda_id: string;
  client_name: string;
  address: string;      // End. Ent.
  neighborhood: string; // Bairro Ent.
  city: string;         // Cidade Ent.
  cep: string;          // Cep Ent.
  weight_kg: number;    // Peso Bruto
}
```

### 2. Parser para Itinerário (`src/lib/advParser.ts`)

Detectar formato Itinerário pelo header "Vendas_Itinerario" ou colunas "End. Ent.", "Bairro Ent.":

```typescript
export function isItinerarioFormat(headers: string[]): boolean {
  const text = headers.join(' ').toLowerCase();
  return /end\.\s*ent|bairro\s*ent|vendas.?itinerario/i.test(text);
}

export async function parseItinerarioPDF(file: File): Promise<ItinerarioRecord[]> {
  // 1. Extrair texto tabular do PDF
  // 2. Mapear colunas: Venda, Cliente, End. Ent., Bairro Ent., Cidade Ent., Cep, Peso Bruto
  // 3. Construir endereço completo: "R. BARUARE, 261, JARDIM ADELFIORE, SAO PAULO, 05223-090"
}
```

### 3. Mapeamento de Colunas do Itinerário

| Coluna no PDF | Campo no Sistema |
|---------------|------------------|
| `Venda` | `venda_id` |
| `Cliente` | `client_name` |
| `End. Ent.` | `address` (rua + número) |
| `Bairro Ent.` | `neighborhood` |
| `Cidade Ent.` | `city` |
| `Cep Ent.` ou `Cep` | `cep` |
| `Peso Bruto` | `weight_kg` |

### 4. Função de Cruzamento

```typescript
export function mergeItinerarioWithADV(
  itinerario: ItinerarioRecord[],
  advOrders: ParsedOrder[]
): ParsedOrder[] {
  return advOrders.map(order => {
    // Buscar endereço pelo número da venda
    const enderecoData = itinerario.find(
      it => it.venda_id === order.pedido_id
    );
    
    if (enderecoData) {
      // Construir endereço completo
      const fullAddress = [
        enderecoData.address,
        enderecoData.neighborhood,
        enderecoData.city,
        enderecoData.cep
      ].filter(Boolean).join(', ');
      
      return {
        ...order,
        address: fullAddress,
        isValid: true,
      };
    }
    
    return order; // Mantém sem endereço se não encontrar
  });
}
```

### 5. Atualização do Fluxo de Upload (`DualFileUpload.tsx`)

O componente será atualizado para:

1. **Detectar automaticamente o tipo de cada PDF**:
   - Se contém "Vendas_Itinerario" ou "End. Ent." -> Arquivo de Itinerário (endereços)
   - Se contém "Vendas detalhadas" ou "Cliente:" hierárquico -> Relatório ADV (itens)

2. **Aceitar os arquivos em qualquer ordem** (não importa qual é carregado primeiro)

3. **Cruzar automaticamente os dados quando ambos estiverem prontos**

4. **Mostrar resumo do cruzamento**:
   - Quantas vendas cruzaram com sucesso
   - Quantas vendas ficaram sem endereço
   - Quantas vendas ficaram sem itens detalhados

### 6. Atualização do orderParser.ts

Adicionar padrões para reconhecer as colunas do formato Itinerário:

```typescript
const COLUMN_PATTERNS = {
  // ... padrões existentes ...
  endEnt: [/end\.?\s*ent\.?/i, /endereco\s*ent/i],
  bairroEnt: [/bairro\.?\s*ent\.?/i],
  cidadeEnt: [/cidade\.?\s*ent\.?/i],
  cepEnt: [/cep\.?\s*ent\.?/i, /^cep$/i],
  pesoBruto: [/peso\s*bruto/i, /peso/i],
  venda: [/^venda$/i, /n[º°]?\s*venda/i],
};
```

## Exemplo de Resultado Final

Após o cruzamento:

```typescript
{
  pedido_id: "276016",
  client_name: "MARIA JANE ALBINO PEREIRA BARBOSA",
  address: "R. BARUARE, 261, JARDIM ADELFIORE, SAO PAULO, 05223-090",
  weight_kg: 12.81,
  items: [
    { product_name: "MUSSARELA - ESPLANADA - 4 KG", weight_kg: 12.81, quantity: 1 }
  ],
  isValid: true
}
```

## Tratamento de Casos Especiais

| Situação | Ação |
|----------|------|
| Venda no ADV sem endereço no Itinerário | Marcar como inválido, solicitar correção manual |
| Venda no Itinerário sem detalhes no ADV | Usar apenas dados do itinerário (peso bruto, sem itens) |
| Apenas 1 arquivo carregado | Processar normalmente, informar que dados podem estar incompletos |
| Cliente com nomes diferentes | Priorizar match pelo número da venda (mais confiável) |

## Passos de Implementação

1. **Adicionar parser de Itinerário** em `advParser.ts`
   - Detectar formato pelo header
   - Mapear colunas específicas (End. Ent., Bairro Ent., etc.)
   - Construir endereço completo

2. **Implementar função de cruzamento** em `advParser.ts`
   - Unir dados pelo número da venda
   - Preservar itens do ADV + endereço do Itinerário

3. **Atualizar DualFileUpload.tsx**
   - Detectar automaticamente o tipo de arquivo
   - Aceitar arquivos em qualquer ordem
   - Cruzar quando ambos estiverem disponíveis

4. **Atualizar orderParser.ts**
   - Adicionar padrões de colunas do Itinerário
   - Integrar detecção automática de formato

## Resultado Esperado

1. Fazer upload de qualquer um dos dois PDFs
2. Sistema detecta automaticamente o formato
3. Fazer upload do segundo PDF
4. Sistema cruza os dados pelo número da venda
5. Resultado: pedidos completos com endereço + itens detalhados
6. Continuar fluxo de roteirização normalmente

