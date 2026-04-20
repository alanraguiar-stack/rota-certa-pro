
# Ajustar a função principal do ADV CSV para usar a coluna M na quantidade vendida

## Problema

Hoje o caminho principal do CSV (`parseVendasCSV` em `src/lib/advParser.ts`) ainda usa índice fixo antigo para quantidade:

```ts
const qtyRaw = (partes[16] ?? '0').trim();
```

Ou seja:
- a função principal continua lendo a coluna antiga
- o fallback dinâmico só entra quando **0 itens** são extraídos
- como o arquivo atual ainda extrai itens, ele passa pelo parser principal e o romaneio sai com quantidade errada

## Correção

## 1) Ajustar o parser principal `parseVendasCSV`
Trocar a leitura fixa da quantidade para priorizar a **coluna M** do layout atual.

### Regra nova
- usar **`partes[12]`** como fonte principal da quantidade vendida
- manter fallback legado para layouts antigos, usando `partes[16]` somente se a coluna M vier vazia/inválida

### Estratégia
Criar uma pequena resolução centralizada de quantidade no parser principal:

- `qtyFromM = parseBRNumber(partes[12])`
- `qtyFromLegacy = parseBRNumber(partes[16])`

Aplicação:
- se `qtyFromM > 0`, usar `qtyFromM`
- senão, usar `qtyFromLegacy`

Assim:
- o formato atual passa a usar a coluna M
- arquivos antigos continuam compatíveis

## 2) Preservar compatibilidade com unidade
No mesmo bloco do item:
- manter leitura da unidade quando existir no layout antigo
- se a unidade vier vazia ou inconsistente no formato novo, continuar usando `inferUnitFromProductName(productName)`

Isso evita quebrar o romaneio:
- itens `KG` continuam indo por peso
- itens volumétricos (`UN`, `FD`, `CX`, `SC`, `PC`) continuam indo por quantidade

## 3) Alinhar o fallback dinâmico com a mesma regra
Em `parseVendasCSVDynamic`, consolidar a mesma prioridade:
- preferir a célula equivalente à coluna M quando o layout atual for detectado
- manter o fallback legado apenas como segurança

Isso evita divergência entre:
- parser principal
- parser dinâmico

## 4) Atualizar documentação inline
Corrigir o comentário da função `parseVendasCSV` para refletir o layout real atual:
- descrição
- unidade
- quantidade vendida na coluna M

Isso reduz regressões futuras.

## Resultado esperado

Depois da correção:
- o **romaneio de carga** passa a refletir a **quantidade vendida da coluna M**
- o caminho principal do CSV deixa de depender da coluna antiga
- arquivos antigos seguem funcionando via fallback
- o cálculo deixa de inflar ou deslocar quantidades por causa da leitura errada

## Arquivo

- `src/lib/advParser.ts`

## Detalhes técnicos

```text
Layout atual desejado:
- Código:      partes[0]
- Descrição:   coluna já mapeada do formato atual
- Quantidade:  partes[12]   <- coluna M
- Legado:      partes[16]   <- fallback apenas se M estiver vazia/inválida
```

Ajuste principal:
```ts
const qtyPrimary = parseBRNumber((partes[12] ?? '').trim());
const qtyLegacy = parseBRNumber((partes[16] ?? '').trim());
const quantity = qtyPrimary > 0 ? qtyPrimary : qtyLegacy;
```
