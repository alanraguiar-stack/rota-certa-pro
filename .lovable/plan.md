

# Ajustes de Organizacao e Correcao do Sistema

## 1. Campo de Busca em Configuracoes > Produtos

**Arquivo:** `src/components/route/ProductUnitsImporter.tsx`

Adicionar um campo de busca (`Input`) acima da tabela de "Produtos Cadastrados" (linha 218). O filtro sera aplicado em tempo real sobre `units`, filtrando por `product_name` (case-insensitive). A lista exibida sera o resultado filtrado.

## 2. Unidade Correta no Romaneio de Carga (Refrigerante = Fardo)

**Arquivos:** `src/components/route/LoadConsolidationView.tsx`, `src/components/route/TruckManifestCards.tsx`

O sistema atualmente exibe TODOS os produtos consolidados em kg. A correcao consiste em:

- Importar e usar o hook `useProductUnits` (ou receber `getUnitForProduct` como prop) nos componentes de consolidacao
- Na funcao `consolidateProducts` e `consolidateAllProducts`, ao formatar o peso para exibicao, verificar a unidade do produto via `getUnitForProduct(productName)`
- Se a unidade for volumetrica (fardo, unidade, caixa, etc.), exibir a **quantidade** (count) com o label da unidade em vez do peso em kg
- No PDF de carga (`generateLoadingPDF`), aplicar a mesma logica na coluna "Peso Total" da tabela

Isso resolve o caso do refrigerante que deve aparecer como "29 fardos" em vez de "858.3kg".

## 3. Remover Secao "Confirmar Carregamento" (Print 1)

**Arquivo:** `src/pages/RouteDetails.tsx`

Remover o bloco `<details>` das linhas 618-638 que contem o componente `LoadingConfirmation` (secao "Conferencia Fisica (Opcional)"). Este bloco sera completamente removido sem substituicao.

## 4. Layout das Cargas por Caminhao - Remover Scroll Interno

**Arquivo:** `src/components/route/LoadConsolidationView.tsx`

- Linha 153: Remover `max-h-[300px] overflow-y-auto` do container de "Produtos para Separacao"
- Linha 231: Remover `max-h-32 overflow-y-auto` do container de produtos por caminhao

Isso faz com que toda a lista fique visivel sem scroll interno.

## 5. Remover Secao "Consolidacao de Carga do Dia" (Print 2)

**Arquivo:** `src/pages/RouteDetails.tsx`

Remover o bloco `<details>` das linhas 574-593 que contem o componente `LoadConsolidationView`. Esta secao sera completamente removida.

## 6. Corrigir Botoes de Impressao e Download do Romaneio de Entrega

**Arquivo:** `src/components/route/TruckManifestCards.tsx`

Os botoes de impressao usam `window.open(doc.output('bloburl'), '_blank')` que e bloqueado pelo sandbox do navegador. Substituir pela abordagem de iframe usada em `src/lib/manifest.ts`:

```text
const blob = doc.output('blob');
const url = URL.createObjectURL(blob);
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.src = url;
document.body.appendChild(iframe);
iframe.onload = () => {
  iframe.contentWindow?.print();
  setTimeout(() => {
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  }, 1000);
};
```

Aplicar esta correcao nas funcoes `handlePrintLoading` (linha 422) e `handlePrintDelivery` (linha 430).

## Resumo de Arquivos

| Arquivo | Mudancas |
|---------|----------|
| `src/components/route/ProductUnitsImporter.tsx` | Adicionar campo de busca com filtro em tempo real |
| `src/components/route/LoadConsolidationView.tsx` | Remover scroll interno dos containers de produtos |
| `src/components/route/TruckManifestCards.tsx` | Corrigir botoes de impressao (iframe), usar unidade correta na consolidacao |
| `src/pages/RouteDetails.tsx` | Remover secoes LoadingConfirmation e LoadConsolidationView |

