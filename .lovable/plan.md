
Objetivo: corrigir o Romaneio de Carga para que ele mostre a separação real por caminhão, compilando corretamente os itens por unidade de medida e ficando alinhado ao modelo que você enviou.

Diagnóstico do que encontrei:
- Na rota que está aberta agora, os caminhões não têm itens detalhados salvos no banco (`order_items = 0` para todos os caminhões dessa rota). Isso por si só já faz o romaneio sair com métrica ruim ou cair em fallback.
- Mesmo quando existem itens, a lógica atual ainda pode errar a unidade final porque há cadastros conflitantes de produto no banco (ex.: o mesmo item aparece uma vez como `fardo` e outra como `kg`).
- O layout atual do romaneio também não segue bem o modelo: hoje ele está muito centrado em peso total/capacidade e pouco centrado na separação operacional.

O que vou implementar:

1. Blindar a origem dos dados do romaneio
- Antes de gerar o PDF, validar se o caminhão realmente tem itens detalhados.
- Se não tiver, não deixar gerar um romaneio “enganoso”; mostrar aviso claro e acionar a reimportação de detalhamento.
- Garantir que o romaneio use os itens do pedido, e não apenas o peso bruto do cliente, quando houver detalhamento disponível.

2. Fazer um pente-fino definitivo na unidade de medida
- Reforçar a resolução da unidade com esta prioridade:
  1. unidade explícita do item importado
  2. cadastro do produto no banco
  3. inferência pelo nome do item
- Corrigir conflitos de cadastros duplicados/quebrados para que um produto embalado não volte a aparecer como `kg`.
- Tratar corretamente padrões do ERP como `FD12UN`, `CX12UN`, `PACK`, `PC`, `SC`, bebidas e outros casos recorrentes.
- Se houver conflito entre um cadastro antigo errado e um marcador explícito forte no nome do produto, priorizar o marcador explícito.

3. Corrigir a consolidação da carga por caminhão
- Para itens de peso (`KG`, `G`): somar peso.
- Para itens volumétricos (`FD`, `CX`, `UN`, `PCT`, etc.): somar quantidade.
- Consolidar por identidade de produto normalizada, evitando que pequenas variações de texto gerem linhas duplicadas para o mesmo item.
- Padronizar formatação final:
  - peso com decimal quando necessário
  - unidades de volume em inteiro
  - siglas consistentes no romaneio

4. Refazer o Romaneio de Carga no formato operacional do modelo
- Ajustar o cabeçalho para o padrão do modelo enviado:
  - número do itinerário/rota
  - data
  - placa/caminhão
  - lista de vendas do caminhão
- Refatorar a tabela principal para foco em separação:
  - Descrição
  - UN
  - Qtde
- Se os metadados estiverem disponíveis no detalhamento, incluir também:
  - Código
  - Grupo
- Remover do centro do documento os blocos que hoje atrapalham a leitura operacional e manter só o que ajuda a carga.

5. Corrigir o fluxo de persistência para não perder qualidade entre importação e impressão
- Revisar o parser/importação para garantir que os itens cheguem ao banco com unidade e quantidade corretas.
- Evitar que produtos novos sejam auto-cadastrados com unidade errada e passem a “contaminar” romaneios futuros.
- Se necessário para reproduzir fielmente o modelo, ampliar os metadados salvos dos itens (por exemplo código/grupo como campos opcionais).

6. Validar com casos reais antes de concluir
- Testar rota com bebidas em fardo/caixa.
- Testar rota com itens em KG.
- Testar rota mista no mesmo caminhão.
- Verificar se a soma do romaneio bate com a separação real esperada por caminhão.
- Confirmar que, sem itens detalhados, o sistema alerta corretamente em vez de gerar um romaneio ruim.

Arquivos que pretendo revisar
- `src/components/route/LoadingManifest.tsx`
- `src/hooks/useProductUnits.ts`
- `src/lib/advParser.ts`
- `src/hooks/useRoutes.ts`
- `src/types/index.ts`
- e, se necessário, uma migração no banco para enriquecer os metadados dos itens

Detalhe técnico importante
- O problema não é só visual. Hoje existem 2 causas misturadas: falta de itens detalhados em algumas rotas e resolução inconsistente de unidade em produtos cadastrados.
- Para o modelo ficar realmente confiável, o romaneio precisa ser guiado por item detalhado + unidade correta, e não por peso bruto do pedido.
- Se o seu PDF modelo exigir obrigatoriamente `Código` e `Grupo`, eu já deixo isso contemplado na implementação usando metadados do item quando existirem, com extensão do armazenamento se necessário.
