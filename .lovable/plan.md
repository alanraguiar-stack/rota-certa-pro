

# Plano: Melhorar Cruzamento de Pedidos e Exibir Falhas

## Investigacao Realizada

Analisei o fluxo completo de cruzamento em `src/lib/advParser.ts`. A funcao `mergeItinerarioWithADV` usa duas estrategias:

1. **Nivel 1 - Por venda_id**: Compara `itinerarioRecord.venda_id` com `advOrder.pedido_id` (correspondencia exata de string)
2. **Nivel 2 - Por nome do cliente**: Normaliza nomes (minusculas, sem acentos, sem pontuacao) e compara

### Possiveis Causas dos 2 Pedidos Nao Cruzados

1. **Formatacao do venda_id**: O itinerario extrai `vendaId` direto da celula (`row[columnMap.venda]?.trim()`), enquanto o ADV extrai via regex (`/venda\s*n[º°]?\s*:\s*(\d+)/i`). Se o itinerario tiver o ID como "0276017" (com zero a esquerda) e o ADV extrair "276017", nao bate.
2. **Nomes de cliente com caracteres especiais**: A normalizacao remove acentos e pontuacao, mas nao trata abreviacoes ou sufixos diferentes (ex: "JOAO DA SILVA LTDA" vs "JOAO DA SILVA - ME").
3. **Clientes duplicados no itinerario**: O mapa por cliente usa "primeiro ganha" - se dois registros tem o mesmo nome normalizado, o segundo e ignorado.

## Solucao em 2 Partes

### Parte 1: Melhorar o Matching (para reduzir falhas)

**Arquivo: `src/lib/advParser.ts`**

1. **Normalizar venda_id antes de comparar**: Remover zeros a esquerda, espacos e caracteres nao numericos de ambos os lados
2. **Adicionar Nivel 3 de matching**: Busca parcial por nome do cliente (contem/comeca com)
3. **Tratar clientes duplicados no mapa**: Se ha multiplos registros com mesmo nome, tentar desambiguar pelo peso

```tsx
// Normalizar venda_id
function normalizeVendaId(id: string): string {
  return id.replace(/\D/g, '').replace(/^0+/, '') || '0';
}

// No merge, usar IDs normalizados
const itinerarioByIdMap = new Map<string, ItinerarioRecord>();
for (const record of itinerario) {
  itinerarioByIdMap.set(normalizeVendaId(record.venda_id), record);
}

// No lookup
let enderecoData = itinerarioByIdMap.get(normalizeVendaId(order.pedido_id || ''));

// NIVEL 3: Busca parcial por nome
if (!enderecoData && order.client_name) {
  const normName = normalizeClientNameForMatch(order.client_name);
  for (const [key, record] of itinerarioByClientMap) {
    if (key.includes(normName) || normName.includes(key)) {
      enderecoData = record;
      matchType = 'partial_client';
      break;
    }
  }
}
```

### Parte 2: Exibir Pedidos Nao Cruzados (se ainda houver)

**Arquivo: `src/components/route/DualFileUpload.tsx`**

Abaixo do card de resumo do cruzamento, listar os pedidos que nao encontraram correspondencia:

```tsx
{mergeSummary && mergeSummary.unmatched > 0 && mergedOrders && (
  <div className="ml-6 mt-2 text-sm text-muted-foreground">
    <strong>Pedidos sem correspondencia:</strong>
    <ul className="list-disc ml-4 mt-1">
      {mergedOrders.filter(o => !o.isValid).map((o, i) => (
        <li key={i}>
          {o.client_name} (Venda: {o.pedido_id})
        </li>
      ))}
    </ul>
  </div>
)}
```

### Parte 3: Adicionar `unmatchedOrders` ao MergeSummary

Salvar a lista de pedidos nao cruzados no estado para facilitar a exibicao:

```tsx
interface MergeSummary {
  total: number;
  matched: number;
  unmatched: number;
  unmatchedOrders: { client_name: string; pedido_id: string }[];
}
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/advParser.ts` | Adicionar `normalizeVendaId`, nivel 3 de matching por nome parcial |
| `src/components/route/DualFileUpload.tsx` | Expandir `MergeSummary`, exibir lista de pedidos nao cruzados |
| `src/components/route/DualPasteData.tsx` | Mesmas mudancas de UI para consistencia |

## Resultado Esperado

- Matching mais robusto que deve resolver a maioria dos casos de "2 pedidos sem correspondencia"
- Se ainda houver falhas, os nomes dos clientes e numeros de venda aparecem abaixo do card de cruzamento para diagnostico rapido

