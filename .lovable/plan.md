
# Plano: Importar Planilha de Unidades de Medida e Ajustar Mapeamento

## Problema Identificado

A planilha enviada tem as colunas invertidas em relacao ao que o sistema espera:
- **Coluna 1 (A):** Abreviacao da unidade (UN, FD, KG, CX, PC, SC, DP)
- **Coluna 2 (B):** Nome do produto

O sistema atual espera Coluna 1 = Produto e Coluna 2 = Unidade. Alem disso, a planilha usa abreviacoes (FD, UN, CX, etc.) que precisam ser traduzidas para os nomes completos do sistema.

## Mudancas Necessarias

### 1. Adicionar mapeamento de abreviacoes no importador

**Arquivo:** `src/components/route/ProductUnitsImporter.tsx`

Adicionar um dicionario de traducao de abreviacoes:

```text
UN  -> unidade
CX  -> caixa
FD  -> fardo
KG  -> kg
PC  -> peca
SC  -> saco
DP  -> display
```

Adicionar deteccao automatica da ordem das colunas: se a primeira coluna contem valores curtos (2-3 caracteres) que correspondem a abreviacoes conhecidas, o sistema entende que a ordem e "Unidade | Produto" e inverte automaticamente.

### 2. Expandir lista de unidades validas

**Arquivo:** `src/hooks/useProductUnits.ts`

Adicionar novas unidades a lista `VALID_UNITS`:
- `peca` (PC)
- `saco` (SC)
- `display` (DP)

Lista final: `['kg', 'g', 'fardo', 'unidade', 'caixa', 'pacote', 'litro', 'garrafa', 'peca', 'saco', 'display']`

### 3. Atualizar logica de consolidacao no Romaneio

**Arquivo:** `src/components/route/LoadingManifest.tsx`

A funcao `isWeightUnit` ja verifica apenas `kg` e `g`. As novas unidades (peca, saco, display) serao automaticamente tratadas como quantidade, sem mudancas adicionais necessarias.

## Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/route/ProductUnitsImporter.tsx` | Adicionar mapeamento de abreviacoes e deteccao automatica de colunas |
| `src/hooks/useProductUnits.ts` | Expandir VALID_UNITS com peca, saco, display |

## Resultado Esperado

Ao fazer upload da planilha fornecida, o sistema ira:
1. Detectar que a coluna A contem abreviacoes e inverter automaticamente
2. Traduzir FD para "fardo", UN para "unidade", etc.
3. Exibir o preview com 364 produtos mapeados corretamente
4. Ao confirmar, salvar no banco e usar no Romaneio de Carga para compilar corretamente (ex: 150kg de mussarela, 40 fardos de Tubaina)
