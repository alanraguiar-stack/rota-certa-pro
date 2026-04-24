# Corrigir o romaneio para respeitar quantidade real da tabela e unidade correta dos itens de peso

## O que a revisão mostrou

- No print, o item **LINGUIÇA TOSCANA CG SADIA PC 5KG - CX 15KG BRF** apareceu como **UN = CX** e **Qtde = 25**, mas no banco ele está salvo exatamente assim:
  - `quantity = 25`
  - `unit = CAIXA`
  - `weight_kg = 0`
- Ou seja, o erro não está só na tela do romaneio: **o item já foi importado como volumétrico**, então a consolidação apenas reproduziu o dado salvo.
- A causa principal é a hierarquia atual de unidade:
  - o parser ADV aceita `CAIXA/CX` quando isso aparece no layout
  - a inferência também ainda trata marcadores como `CX 15KG` como sinal forte de `caixa`
  - no romaneio, quando `item.unit !== 'kg'`, esse valor salvo ganha da revisão por categoria
- Também há cadastros salvos contraditórios no banco para a mesma conta, por exemplo:
  - `APRESUNTADO FRIELLA ...` com `caixa` e também com `kg`
  - `CAFE DU MINEIRO ...` com `kg`, embora a regra desejada seja `fardo`
  - várias linguiças com `caixa`, embora devam ser `kg`

## Objetivo

Fazer o romaneio obedecer a lógica operacional correta:
- itens de proteína/frios como **linguiça, salsicha, bisteca, apresuntado** devem sair por **KG**, mesmo quando o nome trouxer embalagem logística (`CX 15KG`, `CX 10KG`, etc.)
- a coluna **Qtde** do romaneio deve refletir o valor correto para a unidade final escolhida
- a revisão de unidades precisa impedir que cadastro automático ou abreviação fraca sobrescrevam uma regra mais forte de negócio

## Plano de correção

### 1) Endurecer a prioridade de unidade para categorias de peso
Ajustar a inferência em ambos os pontos espelhados:
- `src/hooks/useProductUnits.ts` → `inferUnitFromName`
- `src/lib/advParser.ts` → `inferUnitFromProductName`

Nova prioridade prática para produtos de peso:
1. regras explícitas de categoria crítica de peso (`LINGUIÇA`, `SALSICHA`, `BISTECA`, `APRESUNTADO`, e equivalentes)  
2. regras específicas já direcionadas (`CAFÉ`, `FARINHA`, `MOLHO DE TOMATE`, `KETCHUP PREDILECTA`, `MAIONESE HELLMANNS`)  
3. só depois marcadores de embalagem como `CX`, `FD`, `PCT`, `UN`

Isso evita que `CX 15KG` force `caixa` num produto que operacionalmente deve ser por quilo.

### 2) Corrigir a resolução final no romaneio
Ajustar a função `resolveUnit` em:
- `src/components/route/LoadingManifest.tsx`
- `src/components/route/TruckManifestCards.tsx`

Mudança:
- a resolução final deve reconhecer quando o `item.unit` salvo veio de uma inferência ruim ou cadastro antigo conflitante
- para categorias críticas de peso, a regra de negócio deve prevalecer sobre `CX/UN` herdado automaticamente
- manter cadastro manual como prioridade só quando ele for realmente consistente com a regra do produto

### 3) Corrigir a importação ADV para não persistir unidade errada nesses casos
Ajustar:
- `src/lib/advParser.ts`
- `src/pages/RouteDetails.tsx`

Mudança:
- se o item for de categoria crítica de peso, o parser deve gravar:
  - `unit = KG`
  - `weight_kg = quantidade`
  - `quantity = 1`
- não permitir que um `CAIXA/CX` textual do layout vença a regra de produto quando o nome claramente indica item por peso

Assim, a quantidade da tabela passa a ser interpretada do jeito certo para o romaneio de carga.

### 4) Revisão completa da régua de unidade já direcionada
Consolidar e reaplicar as regras já definidas:
- qualquer **CAFÉ** → `fardo`
- qualquer **FARINHA** → `fardo`
- qualquer **MOLHO DE TOMATE** → `pacote`
- qualquer **SALSICHA** → `kg`
- qualquer **LINGUIÇA** → `kg`
- qualquer **BISTECA** → `kg`
- qualquer **APRESUNTADO** → `kg`
- **KETCHUP PREDILECTA** → `unidade`
- **MAIONESE HELLMANNS** → `unidade`

Também vou normalizar variações com e sem acento para evitar divergência entre `LINGUIÇA` e `LINGUICA`.

### 5) Evitar que o auto-cadastro continue “poluindo” a base com unidade errada
Revisar o auto-cadastro em:
- `src/hooks/useProductUnits.ts`
- pontos que usam `bulkAddNewProducts`

Ajuste:
- novos produtos dessas categorias devem nascer já com a unidade correta
- a regra não pode mais salvar `caixa` para linguiça/apresuntado/bisteca só porque o nome contém `CX`

### 6) Reparação do cenário atual
Depois da correção de código, para a rota atual será necessário:
- reimportar o arquivo de detalhamento dessa rota
- reconstruir os `order_items` com `unit`, `quantity` e `weight_kg` corretos
- regenerar o romaneio

Importante:
- os itens já salvos errados no banco **não se corrigem sozinhos apenas mudando a tela**
- a correção de código evita novos erros, mas para esse romaneio atual será preciso reimportação

## Resultado esperado

No seu exemplo do print:
- `LINGUIÇA TOSCANA CG SADIA PC 5KG - CX 15KG BRF`
- deve deixar de aparecer como `CX / 25`
- e passar a ser tratado como item por **KG**, usando a quantidade da tabela como massa do item no romaneio

Além disso, o sistema ficará consistente para os demais produtos dirigidos, sem voltar a errar por causa de `CX`, `UN` ou cadastros conflitantes antigos.

## Arquivos a ajustar

- `src/hooks/useProductUnits.ts`
- `src/lib/advParser.ts`
- `src/components/route/LoadingManifest.tsx`
- `src/components/route/TruckManifestCards.tsx`
- `src/pages/RouteDetails.tsx`

## Detalhes técnicos

```text
Achado objetivo desta revisão:
- rota atual: 98c6f705-fe13-4840-90b7-8275c7d9ad39
- item encontrado no banco:
  product_name = LINGUIÇA TOSCANA CG SADIA PC 5KG - CX 15KG BRF
  quantity     = 25
  unit         = CAIXA
  weight_kg    = 0

Conclusão:
- o romaneio está exibindo corretamente o que foi salvo
- o problema real é a interpretação/persistência da unidade e da quantidade
- também existem cadastros salvos contraditórios em product_units que precisam deixar de prevalecer sobre regras fortes de produto
```