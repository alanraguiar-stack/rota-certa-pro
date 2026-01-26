

# Plano: Cruzar Dados dos Dois PDFs pelo Número da Venda

## Entendimento do Problema

Você tem **dois PDFs complementares**:

| Arquivo | Contém | Não Contém |
|---------|--------|------------|
| `venda.23.01.26.pdf` | Nº Venda, Cliente, **End. Ent.**, Bairro, Cidade, CEP, Peso | Itens detalhados |
| `RELATÓRIO_DE_VENDAS_-_23.01.26.pdf` | Nº Venda, Cliente, **Itens + Quantidades** | Endereços |

A **chave de cruzamento** é o **Número da Venda** (ex: `276017`, `275949`).

## Solução Proposta

### Fluxo de Processamento

```text
┌──────────────────────────────────────────────────────────────────┐
│  Upload: venda.23.01.26.pdf (Itinerário)                         │
│  → Extrai: Venda, Cliente, End. Ent., Bairro, Cidade, CEP, Peso  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  Upload: RELATÓRIO_DE_VENDAS.pdf (Detalhamento)                  │
│  → Extrai: Venda, Cliente, Itens (Produto + Qtde/Peso)           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  CRUZAMENTO pelo Número da Venda                                 │
│  → Pedido completo: Cliente + Endereço + Itens + Peso            │
└──────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/advParser.ts` | Criar parser para `venda.*.pdf` (formato Itinerário) |
| `src/lib/orderParser.ts` | Adicionar função de cruzamento de dados |
| `src/components/route/DualFileUpload.tsx` | Integrar cruzamento no fluxo de upload |

## Detalhes Técnicos

### 1. Novo Parser: Itinerário de Vendas (`venda.*.pdf`)

Este PDF tem formato tabular com colunas:
- **Venda**: ID do pedido
- **Cliente**: Nome do cliente
- **End. Ent.**: Endereço de entrega
- **Bairro Ent.**: Bairro
- **Cidade Ent.**: Cidade
- **Cep Ent.**: CEP
- **Peso Bruto**: Peso total

```typescript
// Novo tipo para dados do itinerário
interface ItinerarioRecord {
  venda_id: string;
  client_name: string;
  address: string;      // End. Ent. + Número
  neighborhood: string; // Bairro Ent.
  city: string;         // Cidade Ent.
  cep: string;          // Cep Ent.
  weight_kg: number;    // Peso Bruto
}

// Função para parsear o PDF de itinerário
async function parseItinerarioPDF(file: File): Promise<ItinerarioRecord[]>
```

### 2. Função de Cruzamento de Dados

```typescript
/**
 * Cruza dados do Itinerário (endereços) com o Relatório ADV (itens)
 */
function mergeItinerarioWithADV(
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

### 3. Mapeamento de Colunas do PDF Itinerário

O parser genérico precisa reconhecer estas colunas:

| Coluna no PDF | Campo no Sistema |
|---------------|------------------|
| `Venda` | `pedido_id` |
| `Cliente` | `client_name` |
| `End. Ent.` | `address` (rua + número) |
| `Bairro Ent.` | parte do endereço |
| `Cidade Ent.` | cidade |
| `Cep Ent.` ou `Cep` | CEP |
| `Peso Bruto` | `weight_kg` |

### 4. Atualização do Fluxo de Upload

O componente `DualFileUpload` já suporta dois arquivos. Precisamos:

1. Detectar qual PDF é o Itinerário (tem "Vendas_Itinerario" ou "End. Ent.")
2. Detectar qual PDF é o Relatório ADV (tem "Vendas detalhadas por Cliente")
3. Processar cada um com seu parser específico
4. Cruzar os dados pelo número da venda

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

## Passos de Implementação

1. **Criar parser para Itinerário**: Extrair endereços do `venda.*.pdf`
2. **Atualizar mapeamento de colunas**: Reconhecer "End. Ent.", "Bairro Ent.", etc.
3. **Implementar função de cruzamento**: Unir dados pelo número da venda
4. **Integrar no DualFileUpload**: Detectar e processar automaticamente os dois formatos
5. **Tratar casos sem correspondência**: Alertar sobre vendas que não cruzaram

## Tratamento de Erros

- **Venda no ADV sem endereço no Itinerário**: Marcar como inválido, solicitar correção manual
- **Venda no Itinerário sem detalhes no ADV**: Usar apenas dados do itinerário (peso bruto)
- **Cliente com nomes diferentes**: Priorizar match por número da venda (mais confiável)

