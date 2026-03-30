

# Plano: 6 Ajustes Operacionais + UX

## Resumo dos Problemas e Soluções

| # | Problema | Solução |
|---|---|---|
| 1 | FIO0R12 deve ficar só com Barueri (Parque Viana), Jandira, Itapevi — max 11 entregas, max 450kg | Adicionar sistema de "overrides por rota" no `autoRouterEngine.ts` que permite injetar regras temporárias antes da composição |
| 2 | Pedidos não atribuídos continuam aparecendo | Reforçar fallback final: se ainda sobrar pedido, alocar no caminhão com mais espaço de peso ignorando TODOS os limites |
| 3 | TRC1Z00 deve ter o maior número de entregas | Após composição, se TRC1Z00 não é o líder em entregas, transferir pedidos de cities vizinhas do caminhão líder para TRC1Z00 |
| 4 | FKD mistura muitas cidades | Limitar caminhões sem território (non-territory) a no máximo 3 cidades; ao atingir o limite, rejeitar pedidos de cidades novas e forçar para outro caminhão |
| 5 | Sequenciamento cidade→bairro→rua fraco | Melhorar `optimizeDeliverySequence`: após o nearest-neighbor, aplicar `streetGroupSweep` que atualmente só roda no fallback CEP sort — aplicar SEMPRE |
| 6 | Não consigo copiar endereço — drag bloqueia seleção | Mover `draggable` e `cursor-grab` apenas para o ícone `GripVertical`, liberando o restante do card para seleção de texto |

---

## Mudança 1: Override temporário para FIO0R12

**Arquivo: `src/lib/autoRouterEngine.ts`**

Adicionar parâmetro opcional `plateOverrides` na função `autoComposeRoute`:

```typescript
interface PlateOverride {
  plate: string;
  allowedCities: string[];
  allowedNeighborhoods?: string[]; // se vazio, aceita todos da cidade
  maxDeliveries: number;
  maxWeightKg: number;
}
```

Antes do Step 4 (alocação por território), verificar se o caminhão atual tem um override. Se sim, substituir os parâmetros de `maxDel`, `capacity`, e filtrar pedidos apenas pelas cidades/bairros permitidos no override.

**Arquivo: `src/hooks/useRoutes.ts`** (distributeLoad mutation)

Passar o override do FIO0R12 como parâmetro:
```typescript
const overrides: PlateOverride[] = [{
  plate: 'FIO0R12',
  allowedCities: ['barueri', 'jandira', 'itapevi'],
  allowedNeighborhoods: ['parque viana'],
  maxDeliveries: 11,
  maxWeightKg: 450,
}];
const result = autoComposeRoute(parsedOrders, trucks, { strategy: 'padrao' }, undefined, undefined, undefined, overrides);
```

**Decisão**: O usuário confirmou que é só para esta rota. Vamos hardcodar o override no `useRoutes.ts` por enquanto e adicionar comentário indicando que futuramente pode ser configurável.

---

## Mudança 2: Eliminar pedidos não atribuídos

**Arquivo: `src/lib/autoRouterEngine.ts`** (~linha 643-696)

No Step 5d.6 (forced second pass), o fallback atual ainda respeita peso (`remainingWeight < orphan.weight_kg`). Adicionar uma **terceira passagem** que ignora até o limite de peso — aloca no caminhão com mais capacidade restante mesmo que ultrapasse levemente.

```typescript
// Step 5d.7: Last resort — force into any truck, warn about overweight
const lastResort = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
if (lastResort.length > 0) {
  for (const orphan of lastResort) {
    // Find truck with most remaining weight capacity
    const sorted = [...compositions].sort((a, b) => 
      (Number(b.truck.capacity_kg) - b.totalWeight) - (Number(a.truck.capacity_kg) - a.totalWeight)
    );
    const target = sorted[0];
    if (target) {
      target.orders.push(orphan);
      target.totalWeight += orphan.weight_kg;
      assignedOrderKeys.add(orderKey(orphan));
      warnings.push(`⚠️ ${orphan.client_name} forçado em ${target.truck.plate} (pode exceder capacidade)`);
    }
  }
}
```

Também remover a seção de "Pedidos Não Atribuídos" na UI (`AutoCompositionView.tsx` linhas 445-468) — se o motor garante 100%, não precisa mais exibir. Substituir por uma mensagem de sucesso caso `unassignedOrders.length === 0`.

---

## Mudança 3: TRC1Z00 com mais entregas

**Arquivo: `src/lib/autoRouterEngine.ts`**

Após o `rebalanceInternalTrucks` (Step 5e), adicionar step:

```typescript
// Step 5f: Ensure TRC1Z00 has the most deliveries
const trc = compositions.find(c => c.truck.plate.replace(/[\s-]/g,'').toUpperCase() === 'TRC1Z00');
if (trc) {
  const leader = compositions.reduce((a, b) => a.orders.length > b.orders.length ? a : b);
  if (leader !== trc && leader.orders.length > trc.orders.length) {
    // Transfer neighbor-city orders from leader to TRC1Z00
    // until TRC1Z00 leads or no more compatible orders
  }
}
```

A lógica transfere pedidos de cidades vizinhas de Osasco (cidade âncora do TRC1Z00) do caminhão líder para o TRC1Z00, respeitando capacidade de peso.

---

## Mudança 4: Limitar cidades por caminhão non-territory

**Arquivo: `src/lib/autoRouterEngine.ts`** (~linha 483-539, Step 5c)

Na alocação de non-territory trucks, adicionar limite:

```typescript
const MAX_CITIES_PER_NON_TERRITORY = 3;
// Antes de adicionar pedido:
const orderCity = normalizeCityName(o.city || o.geocoded.city || '');
const currentCities = new Set(assignedOrders.map(a => normalizeCityName(a.city || a.geocoded.city || '')));
if (!currentCities.has(orderCity) && currentCities.size >= MAX_CITIES_PER_NON_TERRITORY) continue;
```

---

## Mudança 5: Melhorar sequenciamento

**Arquivo: `src/lib/autoRouterEngine.ts`** (~linha 1046-1058)

Após o `nearestNeighborWithinCity`, aplicar `streetGroupSweep` SEMPRE (atualmente só roda no fallback CEP):

```typescript
// ANTES (linha ~1055):
nearestNeighborWithinCity(cityOrders, fromLat, fromLng);
result.push(...cityOrders);

// DEPOIS:
nearestNeighborWithinCity(cityOrders, fromLat, fromLng);
streetGroupSweep(cityOrders); // garantir agrupamento por rua
result.push(...cityOrders);
```

Aplicar o mesmo após o anchor city sort (linha ~1049).

---

## Mudança 6: Copiar endereço no card de entrega

**Arquivo: `src/components/route/TruckRouteEditor.tsx`** (~linhas 123-173)

Problema: O card inteiro tem `draggable` e `cursor-grab`, bloqueando a seleção de texto.

Solução: Mover `draggable`, `onDragStart`, `cursor-grab` apenas para o `GripVertical` icon container. O restante do card fica com `select-text` normal.

```tsx
// Remover do div principal:
// draggable={!isLocked}
// cursor-grab active:cursor-grabbing
// onDragStart

// Mover para o grip container:
<div
  draggable={!isLocked}
  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
  className={cn("cursor-grab active:cursor-grabbing", isLocked && "cursor-default")}
>
  <GripVertical className="h-4 w-4 text-muted-foreground" />
</div>
```

O `onDragOver` e `onDrop` continuam no card externo (para receber drops), mas o `draggable` fica só no grip.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Override por placa, fallback forçado total, TRC1Z00 líder, limite 3 cidades non-territory, streetGroupSweep sempre |
| `src/hooks/useRoutes.ts` | Passar override do FIO0R12 no distributeLoad |
| `src/components/route/AutoCompositionView.tsx` | Remover seção de "Pedidos Não Atribuídos" (substituir por confirmação de 100%) |
| `src/components/route/TruckRouteEditor.tsx` | Drag apenas no GripVertical, liberar seleção de texto |

