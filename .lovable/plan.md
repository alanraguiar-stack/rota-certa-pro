
# Plano de Implementacao: 4 Melhorias no Fluxo Logistico

## 1. Remover "Raciocinio do Sistema" do Painel de Frota

**Arquivo:** `src/components/route/IntelligentFleetPanel.tsx`

Remover o bloco entre linhas 178-243 (card "Raciocinio do Sistema" com os passos numerados e recomendacao). Manter as 3 metricas principais (Peso Total, Caminhoes, Ocupacao), o status da selecao, a lista de caminhoes e o botao de confirmar.

Tambem remover imports nao utilizados (`Brain`, `Calculator`, `Sparkles` se nao usado em outro lugar) e estados (`showReasoning`).

---

## 2. Remover Geocodificacao e Correcao de Enderecos

**Arquivo:** `src/pages/RouteDetails.tsx`

Remocoes especificas:
- **Imports** (linhas 11, 22-23): Remover `useGeocoding`, `GeocodingProgress`, `CollapsibleAddressFixer`
- **Hook** (linha 76): Remover chamada `useGeocoding()`
- **Estado** (linha 83): Remover `isGeocoding`
- **Estado** (linhas 93-96): Remover `selectingLocationFor`
- **Funcao** (linhas 170-197): Remover `startGeocoding`
- **useEffect** (linhas 200-210): Remover verificacao de geocodificacao pendente
- **Chamada** (linhas 142-144): Remover `setTimeout(() => startGeocoding())` no onSuccess do addOrders
- **Handlers** (linhas 314-341): Remover `handleRetryGeocode`, `handleUpdateAddress`, `handleSetManualCoords`, `handleContinueWithFailedAddresses`
- **Handlers** (linhas 393-413): Remover `handleStartMapSelection`, `handleCancelMapSelection`, `handleManualLocationSelect`
- **JSX** (linhas 534-558): Remover blocos `GeocodingProgress` e `CollapsibleAddressFixer`
- **Variavel** (linhas 453-455): Remover `hasFailedAddresses`

---

## 3. Implementar Drag-and-Drop no TruckRouteEditor

**Arquivo:** `src/components/route/TruckRouteEditor.tsx`

Usar drag-and-drop nativo do HTML5 (sem bibliotecas adicionais):

### Mudancas no `TruckTab` (linha 209):
- Adicionar estados: `draggedOrderId` e `dropTargetIndex`
- Criar handlers: `handleDragStart`, `handleDragOver`, `handleDragEnd`, `handleDrop`

### Mudancas no `OrderCard` (linha 66):
- Adicionar props: `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`, `isDragTarget`
- No div raiz do card: `draggable={!isLocked}`, bind dos eventos de drag
- Feedback visual: borda azul e sombra quando `isDragTarget === true`

### Fluxo:
1. Usuario clica e arrasta pelo `GripVertical` ou pelo card inteiro
2. Enquanto arrasta, uma linha azul aparece entre os cards indicando posicao de drop
3. Ao soltar, chama `onReorder(truckId, orderId, newSequence)`
4. Botoes de seta (ChevronUp/Down) continuam funcionando como alternativa

---

## 4. Unidades de Medida no Romaneio de Carga

### 4.1 Nova tabela no banco de dados

```sql
CREATE TABLE public.product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_units_user ON product_units(user_id);

ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own product units"
  ON product_units FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 4.2 Novo hook: `src/hooks/useProductUnits.ts`

- Busca `product_units` do banco para o usuario logado
- Funcao `getUnitForProduct(productName)`: faz matching normalizado (sem acentos, case-insensitive) entre o nome do item e a tabela
- Funcao `importProductUnits(data)`: insere em batch na tabela
- Cache em memoria (React Query)

### 4.3 Novo componente: `src/components/route/ProductUnitsImporter.tsx`

- Upload de arquivo Excel/CSV usando a lib `xlsx` (ja instalada)
- Espera 2 colunas: Nome do Produto e Unidade de Medida
- Preview em tabela dos dados lidos
- Botao "Salvar" que persiste na tabela `product_units`
- Valida unidades aceitas: kg, g, fardo, unidade, caixa, pacote, litro, garrafa

### 4.4 Atualizar `src/pages/Settings.tsx`

- Adicionar nova tab "Produtos" com icone Package
- Dentro da tab, renderizar `ProductUnitsImporter`
- Exibir tabela dos produtos ja cadastrados com opcao de deletar

### 4.5 Atualizar `src/components/route/LoadingManifest.tsx`

A interface `ConsolidatedProduct` ganha novos campos:

```typescript
interface ConsolidatedProduct {
  product: string;
  totalWeight: number;
  totalQuantity: number;
  unitType: string; // 'kg', 'g', 'fardo', 'unidade', etc.
  orderCount: number;
}
```

A funcao `consolidateProducts` recebe um mapa de unidades:
- Se unidade = 'kg' ou 'g': consolida por peso (soma `weight_kg`)
- Se unidade = 'fardo', 'unidade', 'caixa', etc.: consolida por quantidade (soma `quantity`)
- Produtos sem correspondencia na tabela sao tratados como peso (comportamento atual)

Na UI e no PDF, a tabela mostra:

```
| # | Produto                    | Qtde | Unidade | Peso     |
|---|----------------------------|------|---------|----------|
| 1 | QUEIJO PRATO ESPLANADA 3KG | 5    | kg      | 15,00kg  |
| 2 | REFRIGERANTE TUBAINA 2 LT  | 12   | fardo   | -        |
```

O `LoadingManifest` component precisara receber o mapa de unidades como prop ou buscar internamente via hook.

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/route/IntelligentFleetPanel.tsx` | Remover card de raciocinio |
| `src/pages/RouteDetails.tsx` | Remover geocodificacao e handlers relacionados |
| `src/components/route/TruckRouteEditor.tsx` | Implementar drag-and-drop HTML5 |
| `src/components/route/LoadingManifest.tsx` | Atualizar consolidacao com unidades |
| `src/hooks/useProductUnits.ts` | Novo - hook para tabela de unidades |
| `src/components/route/ProductUnitsImporter.tsx` | Novo - importador de planilha |
| `src/pages/Settings.tsx` | Adicionar tab de produtos |
| Migracao SQL | Criar tabela `product_units` |
