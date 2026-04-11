
Objetivo: corrigir de forma definitiva a importação do “Detalhe das Vendas”, eliminando o erro atual, validando o arquivo inteiro e deixando apenas um ponto de upload.

Diagnóstico confirmado:
- O erro atual não é mais de `quantity integer`.
- Agora a falha vem do banco: `order_items.weight_kg` tem constraint `CHECK (weight_kg > 0)`.
- O arquivo enviado tem itens por unidade (`UN`, `FD`, `CX` etc.), e o parser corretamente gera `weight_kg = 0` para esses itens.
- Isso é compatível com a operação do romaneio, mas incompatível com a modelagem atual da tabela.
- Também existe dívida de arquitetura: o upload CSV está passando pelo parser genérico `parseADVDetailExcel`, embora já exista um parser específico para esse formato (`parseVendasCSV`), e o componente `LoadingManifest` ainda carrega lógica antiga de reimportação.

Formato do arquivo validado:
- CSV hierárquico com `;`
- Blocos por cliente
- Linha de venda: `Venda Nº`
- Cabeçalho de itens: `Código / Descrição / UN / Qtde / Unitário / Total`
- Itens em linhas subsequentes
- Esse formato combina muito melhor com parser dedicado por colunas fixas do que com heurística genérica

Plano de correção:

1. Corrigir a modelagem do banco
- Criar migration para ajustar `order_items.weight_kg` de `> 0` para permitir `0`.
- Manter `quantity > 0`.
- Justificativa: item por unidade pode ter quantidade física válida sem peso unitário conhecido.
- Isso alinha banco com a regra real do romaneio.

2. Trocar a rota de parsing do CSV/TXT
- Em `RouteDetails.tsx`, quando o arquivo for `.csv` ou `.txt`, usar o parser específico do ADV CSV em vez do parser genérico.
- Manter Excel (`.xls/.xlsx`) no parser atual.
- Isso reduz ambiguidade de colunas, evita leituras erradas de quantidade e melhora a confiabilidade do vínculo por `pedido_id`.

3. Tabular e validar o arquivo inteiro antes de inserir
- Em `advParser.ts`, montar uma etapa de validação/normalização que:
  - conte clientes, vendas e itens
  - detecte vendas sem número
  - detecte itens sem descrição
  - detecte quantidades inválidas
  - normalize unidade (`KG`, `UN`, `FD`, `CX`, etc.)
  - agrupe tudo por `venda_id`
- Se houver problemas, retornar erro amigável com resumo, em vez de falhar só no insert.

4. Normalizar o modelo dos itens antes de salvar
- Regras:
  - item em `KG/G` → salvar `weight_kg > 0`, `quantity = 1`
  - item em unidade/volume (`UN/FD/CX/...`) → salvar `weight_kg = 0`, `quantity` inteira
- Em `useRoutes.ts`, reforçar saneamento final antes do insert:
  - `weight_kg = Math.max(0, Number(...))`
  - `quantity = Math.max(1, Math.round(...))`
  - `unit` normalizada
- Isso cria uma última barreira de segurança.

5. Deixar um único lugar para upload
- Remover a lógica de upload/reimport do `LoadingManifest.tsx`.
- O único upload ficará no `ADVUploadSection` da etapa `import_adv`.
- `LoadingManifest` passa a ser somente visualização/geração do romaneio.

6. Melhorar a etapa 4 do fluxo
- Em `RouteDetails.tsx`, após importação bem-sucedida:
  - mostrar resumo: vendas lidas, pedidos cruzados, itens inseridos, pedidos sem match
  - habilitar botão “Gerar Romaneio”
- Se não houver match suficiente por `pedido_id`, mostrar aviso claro com contagem.

Arquivos envolvidos:
- `supabase/migrations/...` — ajuste da constraint de `order_items.weight_kg`
- `src/lib/advParser.ts` — parser dedicado + validação completa do CSV
- `src/hooks/useRoutes.ts` — saneamento final e mensagens de erro melhores
- `src/pages/RouteDetails.tsx` — usar parser correto por tipo de arquivo + etapa única de upload
- `src/components/route/LoadingManifest.tsx` — remover upload duplicado e deixar somente exibição

Resultado esperado:
- O ADV sobe sem quebrar quando houver itens por unidade
- O sistema lê o arquivo inteiro de forma determinística
- O vínculo por número da venda funciona de forma mais confiável
- Existe apenas um ponto de upload
- O romaneio passa a ser gerado só depois de uma importação válida

Observação técnica importante:
- Esta é uma correção de arquitetura, não só de mensagem de erro.
- Sem ajustar a constraint do banco, o problema continuará reaparecendo sempre que o ADV trouxer itens sem peso unitário.
