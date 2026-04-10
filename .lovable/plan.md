
Objetivo: corrigir de forma urgente o Romaneio de Carga para que ele saia como operação espera: 1 produto por linha, unidade correta, quantidade consolidada por caminhão, sem misturar vários produtos no mesmo registro.

Diagnóstico confirmado
- O PDF anexado não está só “feio”; ele revela uma falha de consolidação.
- A causa principal é que o código atual mistura 3 cenários no mesmo agrupamento:
  1. pedidos com `order_items`
  2. pedidos sem `order_items`, mas com `product_description` concatenado
  3. fallback por cliente/peso
- A função `consolidateProducts` em `src/components/route/LoadingManifest.tsx` trata o cenário parcial de forma errada: quando alguns pedidos estão sem itens detalhados, ela usa `product_description` inteiro como se fosse um único produto. Isso gera exatamente o que apareceu no PDF: vários produtos diferentes em uma única linha.
- Além disso, o parser ADV hoje salva `weight_kg` de itens volumétricos com fallback numérico (`weight_kg: qty`), o que contamina o total em kg e piora a métrica final do romaneio.
- Há também uma inconsistência de componente: existe lógica antiga em `TruckManifestCards.tsx` que consolida por `orderCount`, não por quantidade real do item. Mesmo que não seja o componente principal da tela atual do romaneio de carga, ele precisa ser alinhado para não voltar a gerar documento ruim em outros fluxos.

O que vou corrigir
1. Blindar a consolidação do romaneio
- Refatorar `consolidateProducts` para trabalhar por item real, nunca por `product_description` concatenado.
- Regras:
  - se `order.items` existir, consolidar item a item
  - se não existir, não tratar `product_description` concatenado como produto único
  - em cenário parcial, marcar o pedido como “sem detalhamento” e excluir da consolidação operacional, exibindo aviso claro
- Resultado: cada linha do romaneio passa a representar um único SKU/produto consolidado.

2. Separar “romaneio operacional” de “dados incompletos”
- Trocar a lógica de `ordersLackDetails` por uma validação mais rígida:
  - detectar quando falta detalhamento em qualquer pedido do caminhão
  - impedir gerar um romaneio operacional enganoso
- Em vez de gerar linhas absurdas com descrições concatenadas, mostrar alerta do tipo:
  - “X pedidos deste caminhão estão sem itens detalhados; reimporte o ADV para gerar o romaneio de carga corretamente.”

3. Corrigir a métrica de quantidade por unidade
- Para unidade de peso (`kg`, `g`): somar `weight_kg`
- Para unidade volumétrica (`FD`, `CX`, `UN`, `PCT`, etc.): somar `quantity`
- Não usar mais `orderCount` para representar fardos/caixas.
- Consolidar por chave normalizada do produto + unidade resolvida, evitando fusão errada.

4. Corrigir o parser ADV para não contaminar peso
- Em `src/lib/advParser.ts`, ajustar a montagem do item:
  - item de peso: `weight_kg = qty`, `quantity = 1`
  - item volumétrico: `quantity = qty`, `weight_kg = 0`
- Hoje o fallback `weight_kg: qty` em item volumétrico faz o total do pedido e do romaneio ficarem distorcidos.
- Também vou revisar o `weight_kg` total do pedido vindo do ADV para não depender da soma de quantidades volumétricas como se fossem quilos.

5. Ajustar o PDF para o formato operacional correto
- Manter o layout do romaneio de carga, mas com tabela limpa e confiável:
  - `#`
  - `Descrição`
  - `UN`
  - `Qtde`
- Remover a lógica que hoje imprime uma linha “válida” quando na verdade o dado veio concatenado por pedido.
- Se houver pedidos incompletos, o documento deve refletir isso com aviso, não com consolidação falsa.

6. Alinhar componentes paralelos
- Revisar `src/components/route/TruckManifestCards.tsx` para aplicar a mesma regra de consolidação e não usar `orderCount` como quantidade.
- Isso evita regressão em downloads por outro fluxo da tela.

Arquivos que vou ajustar
- `src/components/route/LoadingManifest.tsx`
- `src/lib/advParser.ts`
- `src/components/route/TruckManifestCards.tsx`
- possivelmente `src/hooks/useRoutes.ts` se eu precisar endurecer a reimportação e o feedback de incompletude

Resultado esperado
- 1 produto por linha
- unidade compilada corretamente
- quantidade total real por caminhão
- sem linhas contendo vários produtos concatenados
- sem usar “1 fardo” só porque um produto apareceu em 1 pedido
- aviso claro quando houver pedidos sem detalhamento suficiente

Detalhe técnico importante
- O erro atual não é só visual; ele é estrutural na consolidação.
- O PDF anexado mostra claramente que o sistema tratou `product_description` concatenado de um pedido como se fosse um SKU único.
- A correção precisa atacar a consolidação e o parser ao mesmo tempo; mexer só no layout não resolve.
