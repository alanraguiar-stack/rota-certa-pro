

# Plano: Remover Instruções entre Parênteses dos Endereços

## Problema

Endereços frequentemente contêm instruções de entrega entre parênteses, como:
- `Rua das Flores, 123 (fundos), Jardim América...`
- `Av. Brasil, 456 (portão azul), Centro...`

Esse conteúdo **atrapalha sim** o processamento:
- O `parseAddress` em `geocoding.ts` usa regex para extrair rua, bairro e cidade. Parênteses poluem esses campos e quebram o matching
- O `normalizeCityName` não encontra a cidade se houver `(instrução)` grudada no texto
- O hash usado para coordenadas estimadas gera valores diferentes para o mesmo endereço com instruções diferentes

## Solução

Adicionar uma limpeza de parênteses em **dois pontos**:

### 1. `src/lib/geocoding.ts` — função `parseAddress`
No início da função, antes de qualquer processamento, remover conteúdo entre parênteses:

```typescript
export function parseAddress(address: string): GeocodedAddress {
  // Remover instruções entre parênteses (ex: "(fundos)", "(portão azul)")
  const cleanAddress = address.replace(/\s*\([^)]*\)/g, '').trim();
  const normalized = cleanAddress.trim().toLowerCase();
  // ... resto usa cleanAddress em vez de address
```

O campo `original` continua guardando o endereço completo (com parênteses) para exibição.

### 2. `src/lib/spreadsheet/intelligentReader.ts` — construção do endereço
Na montagem do endereço (linha ~292-314), limpar cada parte individualmente antes de juntar, removendo parênteses das partes estruturadas:

```typescript
// Limpar instruções entre parênteses de cada parte
if (addressParts.street) {
  addressParts.street = addressParts.street.replace(/\s*\([^)]*\)/g, '').trim();
}
```

Isso garante que a instrução não vaze para o endereço montado. A instrução original permanece acessível no campo `product_description` ou observações se necessário.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/geocoding.ts` | Strip parênteses no início de `parseAddress` |
| `src/lib/spreadsheet/intelligentReader.ts` | Limpar parênteses das partes do endereço na construção |

