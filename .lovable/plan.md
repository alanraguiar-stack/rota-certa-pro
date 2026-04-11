

# Mover upload do ADV para a Etapa 2 (Distribuir Carga)

## Situação atual

O upload do ADV está escondido dentro do componente `LoadingManifest` na Etapa 3, atrás de um `<details>` colapsável. O usuário quer que o upload aconteça na **Etapa 2**, logo após (ou junto com) a distribuição de carga, antes de avançar para o romaneio.

## Mudança proposta

### Arquivo: `src/pages/RouteDetails.tsx`

Na seção `activeStep === 'distribute_load'` (linha ~726), após o botão "Distribuir Cargas nos Caminhões" e após a distribuição ter sido feita (quando já existem assignments nos trucks):

1. Adicionar uma seção de upload do ADV com:
   - Título: "Importar Detalhe das Vendas (ADV)"
   - Instrução: "Carregue o relatório de detalhe das vendas para gerar o romaneio de carga"
   - Botão de upload de arquivo (aceita .csv, .xls, .xlsx)
   - Indicador de status: quantos pedidos foram vinculados

2. Ao fazer upload:
   - Chamar o parser existente (`parseADVDetailExcel` / `parseVendasCSV`)
   - Chamar `reimportItems.mutateAsync(advOrders)` para persistir os itens no banco
   - Exibir toast de sucesso com contagem de itens vinculados

3. Após os itens estarem carregados, o romaneio na Etapa 3 já terá dados para consolidar

### Arquivo: `src/pages/RouteDetails.tsx` (lógica)

- Reutilizar a lógica de importação que já existe no `LoadingManifest` (ler arquivo, detectar formato, parsear, chamar reimportItems)
- Extrair essa lógica para ser usável em ambos os contextos, ou simplesmente duplicar no RouteDetails (são ~30 linhas)

### Sem mudanças em outros arquivos

A lógica de persistência (`reimportItems`) e o parser já existem e funcionam. Apenas a localização do upload muda.

## Resultado

- Etapa 2 mostra os caminhões + botão distribuir + upload do ADV
- Usuário distribui a carga, importa o ADV, e ao avançar para Etapa 3 o romaneio já está pronto
- O LoadingManifest continua funcionando como fallback caso o usuário não tenha importado na Etapa 2

