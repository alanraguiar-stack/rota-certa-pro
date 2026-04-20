

# Corrigir parser ADV CSV preservando funcionamento atual

## Garantia

A correção será **aditiva e não-destrutiva**: o parser atual continua tentando primeiro com a lógica antiga (que funciona para arquivos em formato anterior). Só quando ela falhar (0 itens extraídos) é que o novo modo dinâmico entra em ação. Assim, o romaneio que já funcionava continua funcionando, e o arquivo `VENDAS_DETALHADAS_20.04.csv` passa a funcionar também.

## Mudança em `src/lib/advParser.ts`

### Estratégia: detecção dinâmica como fallback

1. **Manter** a função `parseVendasCSV` atual intacta como caminho primário
2. **Adicionar** uma segunda passagem dinâmica caso a primeira retorne 0 vendas válidas:
   - Detectar `Cliente:` no `partes[0]` → pegar primeiro campo não-vazio depois (cobre `[2]`, `[3]`, `[4]`)
   - Detectar `Venda Nº:` no `partes[0]` → pegar primeiro número ≥4 dígitos depois (cobre `[4]`, `[5]`, `[6]`)
   - Detectar linha de cabeçalho com `Código`, `Descrição`, `Qtde` → mapear índices reais de cada coluna
   - Para cada linha de item subsequente: extrair código (`[0]`), descrição (índice mapeado), quantidade (índice mapeado), unitário e total
3. **Inferir unidade** pelo nome do produto via `inferUnitFromName()` (já existe em `useProductUnits.ts`), pois o novo formato não traz coluna de unidade. Default = `KG`.

### Resultado esperado

- Arquivos no formato antigo: **continuam funcionando exatamente como antes** (caminho primário)
- Arquivo `VENDAS_DETALHADAS_20.04.csv` e variantes: **passam a funcionar** via fallback dinâmico
- Aprendizado automático de produtos (`bulkAddNewProducts`) continua ativo no fluxo do romaneio

## Arquivo

- `src/lib/advParser.ts` — adicionar fallback dinâmico em `parseVendasCSV` sem alterar o caminho principal

