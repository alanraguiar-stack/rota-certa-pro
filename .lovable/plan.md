

# Romaneio de Entrega: Layout ADV + Adição Manual de Produtos

## Problemas Identificados

1. **Impressão quebrada**: O `handlePrint` usa `window.open(doc.output('bloburl'))` que é bloqueado pelo sandbox. Precisa usar abordagem de iframe.
2. **Layout não segue o padrão ADV**: O layout atual usa blocos escuros com header por cliente. O modelo ADV que a equipe conhece é mais simples — cada entrega ocupa um bloco com: Ordem | Venda | Cliente (bold) | Cidade | Peso, seguido de "Data de Recebimento ___/___/___" e "Identificação e Assinatura do Recebedor" com linha tracejada.
3. **Não é possível adicionar produtos manualmente**: Só existe importação via planilha.

## Mudanças

### 1. Corrigir impressão (`src/components/route/DeliveryManifest.tsx`)

Substituir `window.open(doc.output('bloburl'))` pela abordagem de iframe oculto (mesmo padrão já usado em `manifest.ts` na função `printManifestPDF`).

### 2. Refazer layout do PDF no estilo ADV (`src/components/route/DeliveryManifest.tsx`)

Novo layout `generateDeliveryManifestPDF`:

- **Header**: "Itinerário de Entregas" centralizado, linha tracejada abaixo
- **Entregador**: Placa + modelo do veículo (bold)
- **Cabeçalho de colunas**: Ordem | Venda | Razão | Cidade | Peso | (sem colunas NF/Tipo Pagto que não temos)
- **Cada entrega** ocupa um bloco separado com:
  - Linha com: número sequencial, nome do cliente (bold), cidade, peso
  - Endereço abaixo do nome
  - "Data de Recebimento: ___/___/___" à esquerda
  - "Identificação e Assinatura do Recebedor" ao centro com linha tracejada
  - Separador horizontal entre blocos
- **Paginação**: "Data: dd/mm/yyyy | Hora: HH:MM | Pág.: X de Y" no rodapé
- Quebra de página automática quando o bloco não cabe na página (calcular altura antes de desenhar)
- **Rodapé final**: Km Saída / Km Retorno / Total Km + assinatura do motorista

### 3. Adição manual de produtos (`src/components/route/ProductUnitsImporter.tsx` + `src/hooks/useProductUnits.ts`)

**Hook** — adicionar função `addUnit(product_name, unit_type)`:
- Insere direto na tabela `product_units` sem deletar os existentes
- Atualiza o estado local

**Componente** — adicionar formulário inline acima da tabela de produtos cadastrados:
- Input para nome do produto
- Select/dropdown para unidade de medida (usando `validUnits`)
- Botão "Adicionar"

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/route/DeliveryManifest.tsx` | Novo layout PDF estilo ADV + fix impressão via iframe |
| `src/hooks/useProductUnits.ts` | Nova função `addUnit` |
| `src/components/route/ProductUnitsImporter.tsx` | Formulário manual de adição de produto |

