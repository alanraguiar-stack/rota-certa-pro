

# Plano: Garantir 100% de Distribuição + Recomendação Inteligente de Frota

## Mudança 1: Margem de +3 pedidos no fallback (autoRouterEngine.ts)

Na linha 598, o fallback atual bloqueia pedidos quando `remainingSlots <= 0`. A mudança:

```
// ANTES
if (remainingWeight < orphan.weight_kg || remainingSlots <= 0) continue;

// DEPOIS  
if (remainingWeight < orphan.weight_kg) continue;
if (remainingSlots <= -3) continue; // permite até 3 extras por caminhão
```

Adicionalmente, após o loop de fallback (linha 636-639), adicionar uma **segunda passagem forçada** para quaisquer pedidos que ainda sobrarem — ignorando limite de entregas completamente, respeitando apenas peso:

```typescript
const stillOrphaned = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
for (const orphan of stillOrphaned) {
  // Encontrar caminhão com melhor afinidade de cidade + peso disponível
  // Alocar mesmo acima do limite, gerar warning
}
```

Isso garante que **zero pedidos** fiquem sem caminhão, desde que haja capacidade de peso.

## Mudança 2: Recomendação inteligente considerando volume de pedidos (routeIntelligence.ts)

A função `analyzeFleetRequirements` hoje usa apenas **peso** para recomendar frota. Adicionar lógica de **entregas por caminhão**:

```typescript
// Após calcular caminhões por peso, verificar por volume de entregas
const maxDeliveriesPerTruck = 28; // 25 + margem de 3
const trucksByDeliveryCount = Math.ceil(totalOrders / maxDeliveriesPerTruck);

// Usar o MAIOR entre os dois critérios
const minimumTrucks = Math.max(trucksByWeight, trucksByDeliveryCount);
```

Raciocínio adicionado ao reasoning:
- "102 pedidos ÷ 28 entregas/caminhão = 4 caminhões (por volume)"
- "8.500kg ÷ 3.000kg/caminhão = 3 caminhões (por peso)"
- "Critério dominante: volume → 4 caminhões"

Se o número de caminhões por volume for maior que por peso, o sistema avisa: "A quantidade de entregas exige mais caminhões do que o peso sozinho."

## Mudança 3: Conciliar peso e volume no IntelligentFleetPanel

No painel de frota, mostrar ambos os critérios (peso e volume) para o analista entender:
- Card adicional mostrando "Entregas/caminhão" ao lado de "Peso/caminhão"
- Se o critério dominante for volume, destacar visualmente

## O que NÃO muda

- Divisão de territórios e agrupamento por cidade
- Sequenciamento (nearest-neighbor)
- Regras de âncora e prioridade de bairros

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Margem de +3 no fallback + segunda passagem forçada |
| `src/lib/routeIntelligence.ts` | Adicionar critério de volume na recomendação de frota |
| `src/components/route/IntelligentFleetPanel.tsx` | Mostrar critério dominante (peso vs volume) |

