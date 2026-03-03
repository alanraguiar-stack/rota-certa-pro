

# Correcoes de Distribuicao, Romaneio e Downloads

## 1. Padronizar limite de entregas em 25

**Arquivo:** `src/lib/anchorRules.ts`
- CYR: 24 → 25
- FKD: 24 → 25
- EEF: 99 → 25 (padronizar)

## 2. Unidades de medida no romaneio de carga

O problema e que `TruckManifestCards.tsx` e `SideBySideManifests.tsx` usam `consolidateProducts` que NAO consulta `getUnitForProduct`. O `TruckManifestCards` ja usa `getUnitForProduct` na exibicao e no PDF, mas o `SideBySideManifests` nao usa.

Porem o problema real e que produtos como "Tubaina" estao com unit_type = 'kg' na tabela `product_units`. Isso depende dos dados importados pelo usuario. O sistema ja consulta a tabela corretamente — se Tubaina aparece como 'kg', e porque esta cadastrada assim.

**Acao:** Garantir que `SideBySideManifests` tambem use `useProductUnits` e passe `getUnitForProduct` para o PDF de carga (atualmente nao passa). E no `LoadingManifest.tsx` (que ja usa), garantir consistencia.

**Arquivos:**
- `src/components/route/SideBySideManifests.tsx`: Importar `useProductUnits`, passar `getUnitForProduct` para `generateLoadingPDF` e exibicao.

## 3. Limite minimo de 15 entregas — evitar caminhoes com poucas entregas

**Arquivo:** `src/lib/autoRouterEngine.ts`

Apos a alocacao dos caminhoes ancora (Step 5), adicionar um passo de **consolidacao**: se um caminhao ancora (nao-apoio) tiver menos de 15 entregas, transferir seus pedidos para o caminhao de apoio (EEF) e remover o caminhao da composicao. Isso evita enviar um caminhao com poucas entregas.

Logica:
```text
const MIN_DELIVERIES = 15;
for each non-support composition:
  if orders.length < MIN_DELIVERIES:
    move all orders to support truck
    clear this composition
    add warning
```

## 4. Romaneio de carga em ordem alfabetica

**Arquivos:** `TruckManifestCards.tsx`, `SideBySideManifests.tsx`, `LoadingManifest.tsx`

Alterar o `.sort()` de `consolidateProducts` de ordenar por peso (`b.totalWeight - a.totalWeight`) para ordem alfabetica (`a.product.localeCompare(b.product)`).

## 5. Separar botao "Baixar Todos" em dois: Carga e Entrega

**Arquivo:** `src/components/route/TruckManifestCards.tsx`

Substituir o botao unico `Baixar Todos (N PDFs)` por dois botoes:
- "Baixar Romaneios de Carga" — baixa somente os PDFs de carga
- "Baixar Romaneios de Entrega" — baixa somente os PDFs de entrega

## Resumo de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/anchorRules.ts` | maxDeliveries → 25 para todos |
| `src/lib/autoRouterEngine.ts` | Consolidacao de caminhoes com < 15 entregas |
| `src/components/route/TruckManifestCards.tsx` | Sort alfabetico, separar botoes download |
| `src/components/route/SideBySideManifests.tsx` | Sort alfabetico, integrar useProductUnits |
| `src/components/route/LoadingManifest.tsx` | Sort alfabetico |

