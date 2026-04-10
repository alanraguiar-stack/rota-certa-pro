

# Ajustar sequência do TRC1Z00 (Osasco) para padrão circular

## Problema
O TRC1Z00 atualmente começa por KM 18 e Quitaúna, mas a rota real pela Castelo Branco passa primeiro por Portal D'Oeste, Vila Menk, Rochdale e Presidente Altino. O resultado é cruzamento de rotas em vez de um fluxo circular limpo.

## Mudanças

### 1. `src/lib/anchorRules.ts` — Reordenar earlyNeighborhoods do território Osasco

Trocar a sequência de entrada para refletir o fluxo circular pela Castelo Branco:

```
earlyNeighborhoods: [
  { neighborhood: 'portal d\'oeste', city: 'osasco' },
  { neighborhood: 'vila menk', city: 'osasco' },
  { neighborhood: 'rochdale', city: 'osasco' },
  { neighborhood: 'presidente altino', city: 'osasco' },
]
```

KM 18 e Quitaúna deixam de ser "early" e passam a ser sequenciados naturalmente pelo nearest-neighbor dentro do bloco principal de Osasco.

### 2. `src/lib/anchorRules.ts` — Adicionar bairros ao mapa de adjacência

Adicionar Portal D'Oeste e Vila Menk ao `NEIGHBORHOOD_NEIGHBORS` com suas vizinhanças reais:

- `portal d'oeste` → vizinhos: vila menk, rochdale, km 18
- `vila menk` → vizinhos: portal d'oeste, rochdale, bonfim

Atualizar entrada de `rochdale` para incluir `portal d'oeste` e `vila menk` como vizinhos.

### 3. Manter lateNeighborhoods e neighborhoodFills inalterados

Vila Yara continua no final. Jaguaré/Rio Pequeno/Parque Imperial continuam como fills de SP após Osasco.

## Resultado esperado
O caminhão TRC1Z00 desce pela Castelo Branco fazendo: Portal D'Oeste → Vila Menk → Rochdale → Presidente Altino → centro de Osasco → bairros sul → Vila Yara (saída) — formando o círculo sem cruzamentos.

## Arquivos
- `src/lib/anchorRules.ts`

