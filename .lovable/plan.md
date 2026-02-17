

# Melhorias no Importador de Roteiros + Importar 3 Arquivos

## O que sera feito

Aprimorar o importador para lidar com as variantes de nome de arquivo encontradas nos 3 roteiros enviados, adicionar upload multiplo e importar os dados automaticamente.

## Variantes de nome de arquivo identificadas

| Arquivo | Truck | Data no nome | Observacao |
|---------|-------|-------------|------------|
| CYR9829.xlsx | CYR | Nenhuma | Data disponivel na coluna "Fechamento" |
| EEF16.02-1750KG.xls | EEF | 16.02 (sem ano) | Peso no nome do arquivo |
| DHS10.02.26-2.xls | DHS | 10.02.26 | Sufixo "-2" |

## Mudancas no RouteHistoryImporter.tsx

### 1. Regex de data mais robusto

O regex atual `(\d{2})\.(\d{2})\.(\d{2})` so pega DD.MM.YY com 3 segmentos. Precisa tambem aceitar DD.MM (sem ano, assume ano atual).

### 2. Fallback de data via coluna "Fechamento"

Quando o nome do arquivo nao contem data (ex: `CYR9829.xlsx`), extrair a data da coluna "Fechamento" da primeira linha de dados (formato `DD/MM/YYYY`).

### 3. Truck label mais robusto

O regex atual `^([A-Z]{2,5})` ja funciona para todos os 3 casos (CYR, EEF, DHS). Sem mudanca necessaria.

### 4. Upload multiplo

- Alterar o input para aceitar `multiple`
- Processar cada arquivo individualmente
- Estado `previews` passa de objeto unico para array de `HistoryImport[]`
- Botao "Salvar Todos" para importar em lote
- Preview individual com opcao de remover antes de salvar

### 5. Copiar os 3 arquivos para o projeto

Copiar os arquivos enviados para `src/assets/` para referencia futura nao e necessario -- os dados serao importados diretamente no banco de dados pelo usuario atraves da interface.

## Resumo tecnico das mudancas

**Arquivo:** `src/components/route/RouteHistoryImporter.tsx`

- `extractRouteDate`: adicionar fallback para formato `DD.MM` (sem ano)
- `handleFileUpload`: extrair coluna "fechamento" como fallback de data; suportar `multiple` files
- Estado `preview` -> `previews: HistoryImport[]`
- `handleImport` aceita indice ou importa todos
- UI: lista de previews com "Salvar Todos" e "Remover" individual

## Fluxo do usuario

1. Acesse Configuracoes > aba Historico
2. Clique na area de upload e selecione 1 ou mais arquivos
3. O sistema mostra preview de cada roteiro com caminhao, data e entregas
4. Clique em "Salvar Todos" ou salve individualmente
5. Os padroes ficam disponiveis para o motor de roteamento aprender

