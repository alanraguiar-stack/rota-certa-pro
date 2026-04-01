

# Plano: Integrar OpenRouteService Optimization Endpoint

## Visão Geral

Usar o endpoint de **otimização** do OpenRouteService (ORS) para reordenar as entregas de cada caminhão com base em distâncias reais de direção — substituindo o nearest-neighbor atual que usa linha reta. **Não faz geocodificação** — usa as coordenadas estimadas que já existem.

## Como funciona

1. Após a distribuição dos pedidos nos caminhões, o sistema envia **1 request por caminhão** ao ORS
2. O ORS resolve o TSP (melhor sequência) usando a malha viária real
3. O sistema reordena as entregas conforme a resposta
4. Fallback: se o ORS falhar (rate limit, timeout), mantém a sequência do nearest-neighbor atual

## Arquitetura

```text
Frontend (useRoutes.ts)
    │
    ▼
Edge Function: optimize-route
    │  Recebe: coordenadas dos pontos + CD
    │  Envia: 1 chamada ao ORS /v2/optimization
    │  Retorna: sequência otimizada
    │
    ▼
ORS API (https://api.openrouteservice.org/optimization)
```

## Mudanças

### 1. Configurar API Key do ORS
- O usuário precisa criar uma conta gratuita em openrouteservice.org e gerar uma API key
- A key será armazenada como secret via `add_secret`

### 2. Nova Edge Function: `supabase/functions/optimize-route/index.ts`
- Recebe: array de `{ id, lat, lng }` (jobs) + coordenadas do CD (start/end do vehicle)
- Monta o payload ORS:
  ```typescript
  {
    jobs: deliveries.map((d, i) => ({
      id: i,
      location: [d.lng, d.lat],  // ORS usa [lng, lat]
      service: 300  // 5min por parada
    })),
    vehicles: [{
      id: 0,
      profile: "driving-car",
      start: [cdLng, cdLat],
      end: [cdLng, cdLat]
    }]
  }
  ```
- Retorna a sequência otimizada (array de IDs na ordem ideal)
- Trata erros 429/500 retornando `null` para que o frontend use fallback

### 3. Nova lib: `src/lib/orsOptimizer.ts`
- Função `optimizeWithORS(deliveries, cdCoords)` que:
  - Chama a edge function via `supabase.functions.invoke`
  - Recebe a sequência otimizada
  - Retorna `null` se falhar (fallback para nearest-neighbor)

### 4. Atualizar `src/lib/routing.ts` — função `optimizeDeliveryOrder`
- Após o nearest-neighbor atual, tenta chamar o ORS para reordenar
- Se o ORS retornar resultado, reordena; senão mantém o resultado atual
- Como a chamada é async, a função precisa virar `async`

### 5. Atualizar `src/hooks/useRoutes.ts`
- Ajustar as chamadas a `optimizeDeliveryOrder` para `await` (já está em contexto async)

### 6. Atualizar `src/components/route/ManifestViewer.tsx`
- Ajustar `useMemo` → `useEffect` + state para lidar com a natureza async

## Limites do Free Tier
- 500 requests/dia de optimization
- Até 150 jobs por request
- Suficiente para o uso (poucos caminhões por rota, ~20-30 entregas cada)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/optimize-route/index.ts` | Nova edge function — proxy para ORS |
| `src/lib/orsOptimizer.ts` | Novo — client para chamar a edge function |
| `src/lib/routing.ts` | `optimizeDeliveryOrder` vira async, tenta ORS com fallback |
| `src/hooks/useRoutes.ts` | Adicionar `await` nas chamadas |
| `src/components/route/ManifestViewer.tsx` | Ajustar para async |

