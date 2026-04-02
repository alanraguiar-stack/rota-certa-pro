

# Plano: Ajustes de Agrupamento Territorial e Transição entre Bairros

## Resumo

Corrigir as regras de território em `anchorRules.ts` e adicionar lógica de adjacência por bairro para transições mais inteligentes no sequenciamento.

## Problemas identificados

1. **Osasco não inclui Parque Imperial e Santa Maria** — Parque Imperial está como `neighborhoodException` (limite de 2), e Santa Maria está alocada no território de Embu como `neighborhoodFill`. Precisam migrar para Osasco.
2. **Cotia Centro deveria ser prioritário** — Não há lógica para priorizar bairros dentro da mesma cidade âncora. O sequenciamento nearest-neighbor começa do CD sem considerar "Centro primeiro".
3. **Agrupamentos errados** — Os territórios atuais não refletem os 5 agrupamentos operacionais definidos pelo usuário.
4. **Santa Maria no caminhão de Cotia** — Está como `neighborhoodFill` de Embu, mas Embu faz parte do agrupamento de Cotia. O correto é que Santa Maria vá para Osasco.
5. **Mutinga existe em Osasco e Barueri** — O código atual exclui `jardim mutinga` de Barueri e joga para Osasco via `priorityNeighborhoods`, mas não diferencia Mutinga de Osasco (que deveria ficar no próprio Osasco).
6. **Sem adjacência de bairros** — O sequenciamento usa apenas proximidade geográfica por coordenadas estimadas, sem mapa de vizinhança entre bairros para guiar transições.

## Mudanças

### 1. `src/lib/anchorRules.ts` — Reestruturar territórios

Reescrever `TERRITORY_RULES` para refletir os 5 agrupamentos:

| ID | Âncora | Fill Cities | Obs |
|---|---|---|---|
| `barueri` | Barueri | Jandira, Itapevi | Agrupamento 1 |
| `cotia` | Cotia | Vargem Grande, Embu, Embu das Artes, Taboão da Serra | Agrupamento 2 |
| `osasco` | Osasco | — | Agrupamento 3. Bairros extras: Parque Imperial (SP), Jaguaré (SP), Rio Pequeno (SP), Santa Maria (Osasco). Vila Yara vai pro final via `insertAfterNeighborhood` |
| `santana` | Santana de Parnaíba | Pirapora, Cajamar | Agrupamento 4 |
| `caieiras` | Caieiras | — | Agrupamento 5. Bairro extra: Perus (SP) |
| `apoio` | — | São Paulo (restante) | Apoio/excedentes |

Mudanças específicas:
- **Remover** território `carapicuiba` (agora Carapicuíba fica como fill de outro ou entra via adjacência)
- **Remover** território `jandira` (agora fill de `barueri`)
- **Remover** território `embu` (agora fill de `cotia`)
- **Osasco**: Adicionar `santa maria` e `rio pequeno` como `neighborhoodFills` de Osasco. Mover `parque imperial` de exception (limite 2) para `neighborhoodFill` (sem limite rígido). Adicionar Vila Yara como bairro de sequenciamento tardio.
- **Mutinga**: Manter exclusão de `jardim mutinga` de Barueri → Osasco. Adicionar nota que `mutinga` em Osasco fica no próprio Osasco naturalmente.
- **Cotia**: Adicionar `priorityNeighborhoods` para Centro de Cotia (bairros "centro", "centro de cotia") para que sejam sequenciados primeiro.
- **Caieiras**: Novo território com `perus` (SP) como `neighborhoodFill`.

### 2. `src/lib/anchorRules.ts` — Adicionar mapa de bairros vizinhos

Criar `NEIGHBORHOOD_NEIGHBORS` — um mapa de adjacência entre bairros dentro da mesma cidade ou entre cidades vizinhas. Usado pelo sequenciamento para dar bônus de proximidade na transição.

```typescript
export const NEIGHBORHOOD_NEIGHBORS: Record<string, string[]> = {
  // Osasco
  'vila yara': ['jaguare', 'rio pequeno', 'presidente altino'],
  'rochdale': ['jaguare', 'km 18'],
  'presidente altino': ['vila yara', 'centro'],
  // Barueri
  'jardim mutinga': ['jd silveira', 'parque viana'],
  'alphaville': ['tambore', 'centro'],
  // ... expandir conforme necessário
};
```

### 3. `src/lib/autoRouterEngine.ts` — Sequenciamento com prioridade Centro e Vila Yara no final

Na função `optimizeDeliverySequence`:
- Quando o território tem `priorityNeighborhoods` internos (centro de Cotia), sequenciar esses bairros primeiro dentro do bloco da cidade âncora.
- Quando o território indica bairros de "final de rota" (Vila Yara em Osasco), colocá-los no final do bloco.

Adicionar campo `lateNeighborhoods` ao `TerritoryRule`:
```typescript
lateNeighborhoods?: { neighborhood: string; city: string }[];
```

### 4. `src/lib/autoRouterEngine.ts` + `src/lib/routing.ts` — Bônus de bairro vizinho no sequenciamento

Na função `nearestNeighborWithinCity` e `nearestNeighborWithProximityBonuses`:
- Importar `NEIGHBORHOOD_NEIGHBORS`
- Adicionar bônus de ~40% (`×0.60`) quando o bairro candidato é vizinho do bairro atual (consultando o mapa)
- Isso fica entre o bônus de "mesmo bairro" (×0.30) e "mesma cidade" (×0.70)

### 5. `src/lib/geocoding.ts` — Atualizar `CITY_NEIGHBORS`

- Adicionar Carapicuíba como vizinha de Cotia (se não estiver)
- Verificar que Perus (bairro de SP) tem adjacência correta com Caieiras

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Reestruturar territórios + adicionar `NEIGHBORHOOD_NEIGHBORS` + campo `lateNeighborhoods` |
| `src/lib/autoRouterEngine.ts` | Lógica de bairros prioritários/tardios no sequenciamento + bônus de bairro vizinho |
| `src/lib/routing.ts` | Bônus de bairro vizinho no nearest-neighbor |
| `src/lib/geocoding.ts` | Atualizar adjacência de cidades se necessário |

