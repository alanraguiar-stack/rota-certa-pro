

# Plano: Ajustar territórios — Carapicuíba sai de Osasco, Taboão sai de Cotia

## Mudanças no `src/lib/anchorRules.ts`

### 1. Território Osasco (id: `osasco`)
- Remover `carapicuiba` de `allowedFillCities` (fica `[]`)
- Osasco passa a ser território isolado (+ bairros de SP já configurados)

### 2. Território Cotia (id: `cotia`)
- Remover `taboao da serra` de `allowedFillCities`
- Adicionar `carapicuiba` em `allowedFillCities` (Carapicuíba entra antes de Cotia na rota)
- Resultado: `['vargem grande paulista', 'embu', 'embu das artes', 'carapicuiba']`
- Mover os `neighborhoodFills` de Carapicuíba que já existem (vila da oportunidade, etc.) para ficarem consistentes

### 3. Taboão da Serra — novo destino
- Taboão da Serra será movido para o território de Osasco como `allowedFillCities`, já que geograficamente está mais próximo do fluxo de saída de Osasco (Vila Yara → Taboão)
- Osasco `allowedFillCities`: `['taboao da serra']`

### 4. Ajuste no CITY_NEIGHBORS (`src/lib/geocoding.ts`)
- Sem mudanças — as adjacências geográficas continuam corretas, o que muda é a **regra de agrupamento territorial**

## Resumo

| Território | Antes | Depois |
|---|---|---|
| Osasco | fillCities: `[carapicuiba]` | fillCities: `[taboao da serra]` |
| Cotia | fillCities: `[vargem grande, embu, embu das artes, taboao da serra]` | fillCities: `[vargem grande, embu, embu das artes, carapicuiba]` |

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Trocar fillCities de Osasco e Cotia conforme tabela acima |

