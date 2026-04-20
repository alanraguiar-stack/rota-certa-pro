

# Limpeza: remover abas obsoletas e toasts informativos

## Contexto verificado

**Produtos — aprendizado automático ativo ✓**
- `useProductUnits.bulkAddNewProducts()` é chamado em `DualPasteData.tsx` (linhas 528 e 574) durante o upload das vendas
- Novos produtos são auto-cadastrados com `inferUnitFromName()` (REFRIGERANTE→fardo, CX→caixa, UN→unidade, etc.)
- A aba "Produtos" em Configurações é redundante

**Histórico — aprendizado automático ativo ✓**
- `RouteDetails.tsx` salva snapshots em `route_history_patterns` após cada alteração manual:
  - Linhas 304-333: ao mover/reordenar entregas (debounce 2s)
  - Linhas 588-632: ao confirmar rotas
- O `HistoryGuidedRouter` lê esses padrões e aplica peso 2x para sequências manuais
- A aba "Histórico" (importação manual de roteiros antigos) também é redundante

**Notificações no rodapé**
- O print mostra o toast "Frota confirmada!" (componente Sonner)
- Há vários toasts informativos similares espalhados pelo fluxo de roteirização que poluem a tela

## Mudanças

### 1. `src/pages/Settings.tsx` — remover abas Produtos e Histórico

- Remover imports: `ProductUnitsImporter`, `RouteHistoryImporter`, ícones `Package` e `History`
- Remover `<TabsTrigger value="products">` e `<TabsTrigger value="history">`
- Remover `<TabsContent value="products">` e `<TabsContent value="history">`
- Ajustar `grid-cols` do TabsList: de `lg:grid-cols-7` → `lg:grid-cols-5` (Conta, Calendário, Territórios, Aparência, Usuários)

### 2. Remover toasts informativos de roteirização

Manter apenas toasts de **erro** e **ações destrutivas/críticas** (exclusão, falha de upload, erro de gravação). Remover toasts puramente informativos como:

- `src/pages/NewRoute.tsx`:
  - "Frota confirmada!" (linha ~256)
  - Toasts informativos de upload/parsing bem-sucedidos
  - Toasts de "Vendas despriorizadas incluídas"
  
- `src/components/route/DualPasteData.tsx`:
  - Toasts "X novos produtos cadastrados automaticamente" (linhas ~528 e 574)

- `src/components/route/TruckRouteEditor.tsx`:
  - Toast "Endereço copiado!" (manter discreto ou remover)

A ação visual já é clara pela transição de etapa do stepper, então o toast é redundante.

### 3. Não mexer

- Os arquivos `RouteHistoryImporter.tsx`, `ProductUnitsImporter.tsx` e o hook `useHistoryPatterns` permanecem no código (são usados internamente por outros componentes ou podem ser reativados)
- O Sonner/Toaster continua disponível para erros e ações administrativas

## Arquivos editados

- `src/pages/Settings.tsx` — remoção de 2 abas
- `src/pages/NewRoute.tsx` — remoção de toasts informativos
- `src/components/route/DualPasteData.tsx` — remoção de toasts de produtos
- `src/components/route/TruckRouteEditor.tsx` — toast de cópia mais discreto

## Resultado

- Configurações mais enxutas (5 abas em vez de 7)
- Tela de roteirização limpa, sem notificações flutuantes redundantes
- Aprendizado contínuo de produtos e sequência continua funcionando em background

