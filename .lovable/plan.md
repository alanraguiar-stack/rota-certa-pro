

# Filtro de Cidades na Etapa 3 + Backlog de Vendas Despriorizadas

## Resumo

1. **Remover banner "Etapa 4"** e subir o card "Romaneio de carga pronto" para o topo da etapa
2. **Chips de cidade clicáveis na Etapa 3** — desabilitar cidades inteiras da roteirização
3. **Salvar vendas despriorizadas** no backlog (`pending_orders` com `status = 'deprioritized'`)
4. **Na nova rota, após upload**, mostrar dialog com vendas despriorizadas a nível de **cliente individual** para reinclusão seletiva

## Mudanças

### 1. `src/pages/RouteDetails.tsx` — Etapa 4: UI cleanup

- Remover o `<Card>` "Etapa 4: Importar Detalhamento..." (linhas 1046-1056)
- Mover o card "Romaneio de carga pronto / Avançar" (linhas 1074-1104) para o topo, antes do `ADVUploadSection`

### 2. `src/pages/RouteDetails.tsx` — Etapa 3: Chips clicáveis de cidade

- Adicionar estado `const [disabledCities, setDisabledCities] = useState<Set<string>>(new Set())`
- Cada chip de cidade vira um botão toggle: ao clicar, adiciona/remove do set
- Cidades desabilitadas: `opacity-40 line-through` + ícone X vermelho
- Abaixo dos chips, painel colapsável "Vendas removidas (N)" listando os pedidos das cidades desabilitadas
- No `handleConfirmAllRoutesAndProceed`: antes de confirmar, salvar as vendas das cidades desabilitadas no backlog como `deprioritized`, e removê-las das `order_assignments` do banco

### 3. `src/hooks/usePendingOrders.ts` — Novos métodos

- `saveDeprioritizedOrders(orders: Order[], routeId: string)`: salva com `status: 'deprioritized'` e `route_id` de origem. Campos: `client_name`, `address`, `city`, `weight_kg`, `pedido_id`, `product_description`
- `getDeprioritized()`: busca todas com `status = 'deprioritized'` do usuário
- `markAsRouted` já existe e será reusado para as reincluídas

### 4. `src/components/route/DeprioritizedOrdersDialog.tsx` — Novo componente

- Recebe `PendingOrder[]` com `status = 'deprioritized'`
- **Agrupa por cidade** visualmente (headers), mas cada **cliente é um checkbox individual**
- "Selecionar todos" no topo
- Mostra: nome do cliente, endereço, peso, pedido_id
- Botão "Incluir Selecionadas" retorna IDs selecionados ao pai

### 5. `src/pages/NewRoute.tsx` — Popup após upload

- Após `handleAutoDataReady`, chamar `getDeprioritized()`
- Se houver resultados, abrir `DeprioritizedOrdersDialog`
- Ao confirmar seleção: converter para `ParsedOrder`, adicionar ao array de orders, marcar como `routed` no backlog

### 6. Banco de dados

Sem migração necessária — a tabela `pending_orders` já tem todos os campos. Usaremos `status = 'deprioritized'` como novo valor de status.

## Fluxo do usuário

```text
Etapa 3 — Confirmar Rotas:
  Resumo por Cidade: [OSASCO 16] [COTIA 6] [CAJAMAR 1] ← clica CAJAMAR
  → CAJAMAR fica riscado/cinza
  → Painel "Vendas removidas (1)": Cliente X - Cajamar - 45kg
  → Confirmar Rotas → salva no backlog como deprioritized

Nova Rota (outro dia):
  → Upload vendas
  → Dialog: "1 venda despriorizada disponível"
  → Lista por cidade, checkbox por cliente:
    ── CAJAMAR ──
    ☑ Cliente X — Rua Y — 45kg — Venda #1234
  → "Incluir Selecionadas" → adicionado à roteirização
```

## Arquivos

- `src/pages/RouteDetails.tsx` — chips toggle, banner cleanup, salvar depriorizadas ao confirmar
- `src/hooks/usePendingOrders.ts` — `saveDeprioritizedOrders`, `getDeprioritized`
- `src/components/route/DeprioritizedOrdersDialog.tsx` — novo
- `src/pages/NewRoute.tsx` — buscar e exibir dialog após upload

