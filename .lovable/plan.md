

# Plano: 3 Correções no Motor de Roteirização

## Correção 1: earlyNeighborhoods respeitado após priority
**Status**: Já implementado corretamente no código (linhas 1141-1169 de `autoRouterEngine.ts`). O fluxo atual é: priority → early → anchor → remaining. **Nenhuma mudança necessária.**

## Correção 2: Mínimo de consolidação de 8 → 4
**Arquivo**: `src/lib/autoRouterEngine.ts`, linha 632

Alterar `const MIN_DELIVERIES = 8;` para `const MIN_DELIVERIES = 4;`

Isso evita que territórios pequenos (Santana de Parnaíba, Caieiras) sejam dissolvidos e misturados no caminhão de apoio.

## Correção 3: neighborhoodFills de SP depois da cidade âncora

O sequenciamento já coloca a cidade âncora primeiro (linhas 1249-1252), seguida das demais cidades por nearest-neighbor. Porém, os pedidos de `neighborhoodFills` (bairros de SP como Parque Imperial, Jaguaré) são adicionados ao array `assignedOrders` **antes** dos pedidos de `allowedFillCities` durante a alocação (step 4d antes de 4e). Na hora do sequenciamento, eles são classificados como cidade "sao paulo" e entram no pool de `remainingCityEntries`.

O problema é que o nearest-neighbor inter-cidades (linha 1256-1278) pode escolher SP como próxima cidade **antes** de terminar os pedidos da cidade âncora, caso algum bairro de SP esteja geograficamente mais próximo do último ponto.

**Solução**: No `optimizeDeliverySequence`, sequenciar os `neighborhoodFills` logo **após** a cidade âncora (e antes das fill cities genéricas), garantindo continuidade geográfica.

**Arquivo**: `src/lib/autoRouterEngine.ts`

Entre o bloco da cidade âncora (linha 1252) e o loop de remaining cities (linha 1256), inserir lógica para:
1. Identificar cidades que vêm dos `neighborhoodFills` do território
2. Sequenciá-las imediatamente após a âncora
3. Removê-las do pool de `remainingCityEntries`

```text
Fluxo final:
  Priority neighborhoods (Jardim Mutinga)
  → Early neighborhoods (KM 18, Quitaúna)
  → Cidade âncora Osasco (Bonfim → I.A.P.I. → Umuarama → ...)
  → NeighborhoodFills SP (Parque Imperial → Jaguaré → Rio Pequeno)
  → Fill cities (Carapicuíba, Jandira, etc.)
  → Late neighborhoods (Vila Yara)
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Linha 632: `MIN_DELIVERIES = 8` → `4` |
| `src/lib/autoRouterEngine.ts` | Linhas ~1252-1256: Inserir sequenciamento de neighborhoodFills entre âncora e remaining cities |

