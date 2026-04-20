

# Adicionar regras específicas de unidade por categoria/marca de produto

## Onde

Duas funções espelhadas precisam receber as mesmas regras (uma para auto-cadastro de produtos, outra para o romaneio):

- `src/hooks/useProductUnits.ts` → `inferUnitFromName` (retorna minúsculas: `kg`, `fardo`, `pacote`, `unidade`)
- `src/lib/advParser.ts` → `inferUnitFromProductName` (retorna abreviações maiúsculas: `KG`, `FD`, `PCT`, `UN`)

## Regras a adicionar (na ordem, antes das regras genéricas)

| Padrão no nome (UPPER) | Unidade |
|---|---|
| `CAFE` ou `CAFÉ` (qualquer café) | `fardo` / `FD` |
| `FARINHA` (qualquer farinha) | `fardo` / `FD` |
| `MOLHO DE TOMATE` | `pacote` / `PCT` |
| `SALSICHA` | `kg` / `KG` |
| `BISTECA` | `kg` / `KG` |
| `APRESUNTADO` (cobre "APRESUNTADO FRIELLA") | `kg` / `KG` |
| `KETCHUP` (cobre "KETCHUP PREDILECTA") | `unidade` / `UN` |
| `MAIONESE` (cobre "MAIONESE HELLMANNS") | `unidade` / `UN` |

Notas:
- Usar `CAFE|CAFÉ` para tolerar acento.
- "Qualquer café/farinha/salsicha/bisteca/maionese/ketchup" = match por substring case-insensitive na descrição.
- Essas regras vencem o default `KG` e também a regra antiga de bebidas (que retornava `FD`), pois hoje "CAFÉ" não estava coberto.

## Ordem de avaliação (importa)

1. **Regras específicas novas** (lista acima) — ganham primeiro
2. Categoria de bebidas existente (`REFRIGERANTE|AGUA MINERAL|SUCO|...`) → `FD`
3. Abreviações explícitas no nome (`FD`, `CX`, `PCT`, `SC`, `DP`, `GF`, `LT`, `PC`, `UN`, `KG`)
4. Default `KG`

Isso garante, por exemplo, que "KETCHUP PREDILECTA UN" continue `UN`, e que "CAFÉ PILÃO 500G" não seja inferido como `KG` por causa do "G".

## Compatibilidade

- Produtos já cadastrados manualmente em `product_units` continuam tendo prioridade — `getUnitForProduct` consulta o banco antes de chamar `inferUnitFromName`. Ou seja, as novas regras só atuam em produtos novos / não cadastrados.
- Para produtos antigos cadastrados com unidade errada, o usuário pode corrigir manualmente em **Configurações → Produtos** (já existe `addUnit` / `deleteUnit`), ou re-importar a planilha.

## Arquivos editados

- `src/hooks/useProductUnits.ts` — adicionar bloco de regras específicas no topo de `inferUnitFromName`
- `src/lib/advParser.ts` — adicionar o mesmo bloco (em maiúsculas/abreviações) no topo de `inferUnitFromProductName`

## Resultado esperado

Ao importar um ADV novo (sem cadastro prévio dos produtos), o romaneio passará a mostrar:

- APRESUNTADO FRIELLA → **KG**
- CAFE DU MINEIRO EX. FORTE → **FD**
- CAFE PILAO TRADICIONAL → **FD**
- CAFE SABOR DA ROÇA → **FD**
- FARINHA DE TRIGO XYZ → **FD**
- MOLHO DE TOMATE QUERO → **PCT**
- SALSICHA SADIA → **KG**
- BISTECA SUÍNA → **KG**
- KETCHUP PREDILECTA → **UN**
- MAIONESE HELLMANNS → **UN**

