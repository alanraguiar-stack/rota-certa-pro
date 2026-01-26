

# Plano: Suportar Formato de Itinerário de Vendas em Excel

## Problema Identificado

O arquivo `vendas.xlsx` está no formato de **Itinerário de Vendas** com as seguintes colunas:

| Coluna no Excel | Significado |
|----------------|-------------|
| `Venda` | ID do pedido |
| `Cliente` | Nome do cliente |
| `End. Ent.` | Endereço de entrega (rua + número) |
| `Bairro Ent.` | Bairro de entrega |
| `Cidade Ent.` | Cidade de entrega |
| `Cep Ent.` | CEP de entrega |
| `Peso Bruto` | Peso em kg |

O parser atual não reconhece estas colunas porque:
1. `COLUMN_PATTERNS.address` procura por `/endere[çc]o/i` mas não `/end\.?\s*ent/i`
2. `COLUMN_PATTERNS.bairro` procura por `/bairro/i` mas não reconhece `Bairro Ent.`
3. Similar para cidade, CEP e outros campos

## Solução

Atualizar o `COLUMN_PATTERNS` no arquivo `orderParser.ts` para reconhecer as colunas do formato de Itinerário de Vendas, permitindo que arquivos Excel neste formato sejam importados corretamente.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/orderParser.ts` | Atualizar COLUMN_PATTERNS para reconhecer formato Itinerário |

## Mudanças Técnicas

### 1. Atualizar `COLUMN_PATTERNS` (linhas 69-102)

Adicionar padrões para reconhecer as colunas do formato de Itinerário:

```typescript
const COLUMN_PATTERNS = {
  pedidoId: [
    /pedido.?id/i, /pedido/i, /order.?id/i, /id.?pedido/i, /numero.?pedido/i,
    /^venda$/i, /n[º°]?\s*venda/i  // NOVO: formato itinerário
  ],
  clientName: [
    /cliente/i, /nome/i, /customer/i, /name/i, /razao/i, /fantasia/i, 
    /destinat[áa]rio/i, /empresa/i, /company/i
  ],
  rua: [
    /^rua$/i, /logradouro/i, /street/i,
    /end\.?\s*ent\.?/i, /endereco\s*ent/i  // NOVO: End. Ent.
  ],
  numero: [
    /^n[uú]mero$/i, /^num$/i, /^n[º°]?$/i, /number/i
    // O número já vem junto no End. Ent., então não precisa de coluna separada
  ],
  bairro: [
    /bairro/i, /neighborhood/i, /distrito/i,
    /bairro\.?\s*ent\.?/i  // NOVO: Bairro Ent.
  ],
  cidade: [
    /cidade/i, /city/i, /munic[íi]pio/i,
    /cidade\.?\s*ent\.?/i  // NOVO: Cidade Ent.
  ],
  estado: [
    /^estado$/i, /^uf$/i, /state/i,
    /uf\.?\s*ent\.?/i  // NOVO: UF Ent.
  ],
  address: [
    /endere[çc]o/i, /address/i, /local/i, /destino/i, /location/i,
    /end\.?\s*ent\.?/i  // NOVO: formato itinerário
  ],
  weight: [
    /peso/i, /weight/i, /kg/i, /kilos?/i, /massa/i, /carga/i,
    /peso\s*bruto/i, /peso\s*l[íi]q/i  // NOVO: Peso Bruto / Peso Liq.
  ],
  cep: [
    /^cep$/i, /cep\.?\s*ent\.?/i  // NOVO: CEP Ent.
  ],
  product: [
    /produto/i, /product/i, /item/i, /descri[çc][ãa]o/i, /description/i,
    /mercadoria/i, /material/i, /artigo/i
  ],
};
```

### 2. Atualizar lógica de construção de endereço

Modificar a função `buildAddressFromStructured` para incluir o CEP quando disponível, e tratar o caso onde `End. Ent.` já contém rua + número combinados.

### 3. Atualizar detecção de formato itinerário

Adicionar uma verificação para o formato de Itinerário quando detectando colunas, permitindo que o sistema reconheça automaticamente este formato e construa o endereço corretamente.

## Mapeamento de Colunas

| Coluna no Excel | Campo no Sistema |
|----------------|------------------|
| `Venda` | `pedido_id` |
| `Cliente` | `client_name` |
| `End. Ent.` | `rua` (contém rua + número) |
| `Bairro Ent.` | `bairro` |
| `Cidade Ent.` | `cidade` |
| `Cep Ent.` | `cep` (novo campo) |
| `UF Ent.` | `estado` |
| `Peso Bruto` | `weight_kg` |

## Endereço Final Construído

O endereço final será montado assim:
```
R. FILOMENA FONGARO, 36, VILA FANTON, SAO PAULO - SP, 05201-160
```

## Passos de Implementação

1. **Atualizar COLUMN_PATTERNS**: Adicionar padrões para formato Itinerário
2. **Adicionar campo CEP ao ColumnMapping**: Interface atualizada
3. **Atualizar buildAddressFromStructured**: Incluir CEP na construção do endereço
4. **Atualizar detectStructuredMapping**: Reconhecer colunas do itinerário
5. **Testar com arquivo vendas.xlsx**: Verificar importação correta

## Resultado Esperado

Após a implementação:
1. Upload do arquivo `vendas.xlsx`
2. Sistema detecta automaticamente o formato de Itinerário
3. Mapeia colunas: Venda → pedido_id, Cliente → client_name, End. Ent. → address, etc.
4. Constrói endereço completo: `rua, número, bairro, cidade - estado, cep`
5. Importa todos os pedidos com sucesso

