
Objetivo: corrigir agora a causa real do romaneio vazio. Pelo que encontrei, o PDF não está “quebrando” na geração; ele está fielmente imprimindo que a rota não tem itens detalhados. O problema continua no parser do relatório ADV: ele detecta a venda e o cabeçalho das colunas, mas não consegue transformar as linhas seguintes em itens válidos.

Diagnóstico confirmado:
- O PDF enviado mostra 1 única linha: `Sem itens detalhados` com `441.9kg`.
- Os logs confirmam:
  - `Item columns` foi encontrado
  - mas cada venda termina em `Venda sem itens válidos`
  - depois `NewRoute` navega com `0 have items`
- Portanto, o erro atual está antes do romaneio, dentro de `parseADVDetailExcel` em `src/lib/advParser.ts`.

Causa provável no código atual:
- O parser do Excel está assumindo que a coluna `Qtde.` sempre pode virar `weight_kg`.
- Em muitos relatórios ADV, as linhas de item têm células vazias, valores em outra coluna, colunas deslocadas, ou a `Qtde.` não representa diretamente o peso esperado.
- Hoje ele só faz:
  - pega `descricao`
  - pega `qtde`
  - tenta `parseExcelWeight(qtde)`
  - se der `0`, descarta a linha inteira
- Resultado: encontra o cabeçalho, mas joga fora todos os itens.

Plano de correção:
1. Reforçar o parser de itens do ADV em `src/lib/advParser.ts`
- Criar extração de item mais tolerante por linha.
- Depois de detectar o header, mapear não só `descricao` e `qtde`, mas também colunas candidatas como:
  - código
  - unidade
  - unitário
  - total
- Para cada linha da tabela:
  - validar que existe descrição real
  - procurar o melhor número de quantidade/peso na coluna mapeada
  - se a coluna `qtde` vier vazia/inválida, tentar fallback em colunas numéricas vizinhas
  - parar a leitura ao detectar nova venda, novo cliente, header repetido ou linha de rodapé

2. Adicionar fallback por linha inteira
- Se a leitura por índice de coluna falhar, aplicar regex na linha concatenada, reaproveitando a lógica já existente do parser textual do ADV (`extractItem`) como fallback para Excel.
- Isso evita depender 100% do índice fixo da coluna 17.

3. Melhorar o critério de “linha válida de item”
- Ignorar cabeçalhos repetidos, subtotais, totais, observações e linhas em branco.
- Aceitar item mesmo quando o peso/qtde vier em formato estranho, desde que haja descrição + número plausível.
- Logar por que uma linha foi descartada, para parar de ficar “silencioso”.

4. Preservar a unidade correta para o romaneio
- Manter o fluxo atual do romaneio de carga, que já usa `product_units` para decidir se soma:
  - `weight_kg` para KG/G
  - `quantity` para CX/FD/UN/etc
- Mas ajustar o parser para preencher melhor `quantity` quando o ADV trouxer quantidade física, em vez de gravar sempre `quantity: 1`.

5. Melhorar a observabilidade durante o teste
- Em `src/lib/advParser.ts`, adicionar logs temporários como:
  - linha detectada como item
  - descrição extraída
  - valor bruto da coluna qtde
  - motivo do descarte
- Em `src/components/route/DualFileUpload.tsx`, mostrar no resumo:
  - pedidos extraídos
  - total de itens
  - quantos pedidos vieram sem item
- Isso permite confirmar imediatamente se o arquivo foi lido certo antes de criar a rota.

Arquivos a alterar:
- `src/lib/advParser.ts`
- `src/components/route/DualFileUpload.tsx`

Resultado esperado após a correção:
- O upload do relatório detalhado volta a gerar `orders` com `items`
- `NewRoute` deixa de mostrar `0 have items`
- `order_items` volta a ser persistido
- o Romaneio de Carga deixa de sair com `Sem itens detalhados` e passa a listar os produtos consolidados corretamente por caminhão

Detalhe técnico importante:
- Não há evidência de problema no PDF do romaneio nem na persistência atual do `order_items`.
- O gargalo atual está concentrado no parsing do ADV Excel/CSV, especificamente na extração das linhas de item após o cabeçalho ser detectado.
