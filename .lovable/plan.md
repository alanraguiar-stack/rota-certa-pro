

# Novo fluxo: Upload único na criação + ADV no Romaneio

## Conceito

Simplificar o wizard de criação para aceitar **apenas o "Vendas do Dia"** (itinerário). O "Detalhe das Vendas" (ADV) será carregado **depois**, diretamente na tela do Romaneio de Carga, quando o usuário precisar gerar o documento de separação.

Isso elimina completamente o problema de perda de itens no `navigate(state)` / `sessionStorage`, porque os itens nunca mais precisam ser transferidos entre páginas — eles são importados diretamente no contexto onde serão usados.

## Mudanças

### 1. Simplificar `DualFileUpload` → upload único
- Remover o slot do lado direito (ADV/Detalhe das Vendas)
- Manter apenas o upload do "Vendas do Dia" (itinerário/relatório geral)
- Remover toda a lógica de merge entre itinerário e ADV no wizard
- O componente passa a gerar `ParsedOrder[]` sem itens (apenas cliente, endereço, peso, pedido_id)

### 2. Simplificar `NewRoute.tsx` → sem itens
- Remover lógica de serialização de itens no `sessionStorage`
- O `navigate()` volta a usar apenas o state simples (sem payload grande)
- Os pedidos salvos no banco terão `order_items` vazio na criação — isso é esperado

### 3. Simplificar `RouteDetails.tsx` → sem leitura de sessionStorage para itens
- Remover a lógica de `sessionStorage.getItem('pendingOrdersWithItems')`
- O `addOrders` salva pedidos sem itens (apenas dados de roteamento)

### 4. Romaneio de Carga: upload obrigatório do ADV
- Na tela do Romaneio (`LoadingManifest.tsx`), quando `order_items` está vazio, mostrar um upload proeminente do ADV (já existe o reimport, mas torná-lo o fluxo principal)
- Ao carregar o ADV: o sistema cruza os `pedido_id` dos pedidos de cada caminhão com os itens do arquivo, persiste no `order_items`, e renderiza o romaneio consolidado
- Fluxo: Upload ADV → match por pedido_id → insert order_items → exibir romaneio

### 5. Ajustar stepper/workflow
- O passo "Romaneio de Carga" passa a ter dois estados visuais claros:
  - **Sem detalhamento**: mostra upload do ADV com instrução clara
  - **Com detalhamento**: mostra a tabela consolidada e botão de PDF

## Arquivos a editar
- `src/components/route/DualFileUpload.tsx` — simplificar para upload único
- `src/pages/NewRoute.tsx` — remover serialização de itens
- `src/pages/RouteDetails.tsx` — remover leitura de sessionStorage para itens
- `src/components/route/LoadingManifest.tsx` — tornar o upload do ADV o fluxo principal (não fallback)
- `src/hooks/useRoutes.ts` — simplificar addOrders (sem itens na criação)

## Resultado esperado
- Wizard de criação rápido: 1 arquivo → frota → composição → rota criada
- Zero risco de perda de itens (não há transferência de itens entre páginas)
- Romaneio gerado sob demanda com upload do ADV direto na tela de detalhe
- Match confiável por `pedido_id` entre pedidos do caminhão e itens do ADV

