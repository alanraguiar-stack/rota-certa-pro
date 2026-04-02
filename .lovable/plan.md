
# Plano: Melhorar Sequenciamento da Rota de Osasco

## Problemas Identificados

1. **KM 18 e Quitaúna não são priorizados** — O Osasco começa por Jardim Mutinga/Imperial (Barueri), depois vai para a cidade âncora sem considerar que KM 18 e Quitaúna ficam na "entrada" de Osasco e fazem sentido como primeiros bairros da cidade âncora.

2. **Quitaúna ausente do mapa de adjacência** — O bairro Quitaúna não existe em `NEIGHBORHOOD_NEIGHBORS`, então o sequenciamento não sabe que ele é vizinho de KM 18, Rochdale, etc.

3. **Falta de adjacências completas em Osasco** — Vários bairros de Osasco têm adjacências incompletas ou ausentes (Cidade das Flores, Helena Maria, Munhoz Junior, etc.), causando saltos entre bairros distantes.

## Correções

### 1. `src/lib/anchorRules.ts` — Expandir adjacência de bairros de Osasco

Adicionar Quitaúna e completar adjacências:

```
'quitauna': ['km 18', 'rochdale', 'cidade das flores', 'munhoz junior'],
'cidade das flores': ['quitauna', 'km 18', 'jardim das flores'],
'munhoz junior': ['quitauna', 'helena maria', 'centro'],
'helena maria': ['munhoz junior', 'bela vista', 'rochdale'],
'bela vista': ['helena maria', 'rochdale'],
```

Atualizar adjacências existentes para incluir Quitaúna:
- `km 18`: adicionar `'quitauna'`
- `rochdale`: adicionar `'quitauna'`

### 2. `src/lib/anchorRules.ts` — Configurar bairros iniciais na rota de Osasco

Adicionar `earlyNeighborhoods` (novo campo) ao território de Osasco para indicar que KM 18 e Quitaúna devem ser os primeiros bairros de Osasco a serem sequenciados:

```typescript
// No território osasco:
earlyNeighborhoods: [
  { neighborhood: 'km 18', city: 'osasco' },
  { neighborhood: 'quitauna', city: 'osasco' },
],
```

### 3. `src/lib/anchorRules.ts` — Adicionar campo `earlyNeighborhoods` à interface

Novo campo opcional `earlyNeighborhoods` em `TerritoryRule` — bairros da cidade âncora que devem ser sequenciados primeiro (antes dos demais bairros da âncora).

### 4. `src/lib/autoRouterEngine.ts` — Implementar lógica de `earlyNeighborhoods`

No `optimizeDeliverySequence`, após separar `priorityNeighborhoods` (Barueri), separar também `earlyNeighborhoods` (KM 18, Quitaúna) dos demais bairros da âncora. A sequência final fica:

```text
1. Priority neighborhoods (Jardim Mutinga, Imperial — Barueri)
2. Early neighborhoods (KM 18, Quitaúna — Osasco)
3. Demais bairros de Osasco (nearest-neighbor com adjacência)
4. Fill cities (Carapicuíba, bairros SP)
5. Late neighborhoods (Vila Yara)
```

Isso garante que o caminhão entre em Osasco pelo KM 18/Quitaúna e siga fluindo pela adjacência dos bairros.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Adicionar `earlyNeighborhoods` à interface + ao território Osasco + expandir `NEIGHBORHOOD_NEIGHBORS` com Quitaúna e bairros faltantes |
| `src/lib/autoRouterEngine.ts` | Separar e sequenciar `earlyNeighborhoods` entre priority e regulares |
