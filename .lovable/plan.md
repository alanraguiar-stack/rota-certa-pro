

# Adicionar Formatos ao Importador de Historico (sem remover os existentes)

## Objetivo

Somar novos formatos de entrada ao importador de roteiros em Configuracoes > Historico, mantendo o suporte atual a `.xls/.xlsx` intacto.

## Novos formatos a adicionar

| Formato | Metodo de parsing |
|---------|------------------|
| **CSV** (.csv) | `file.text()` + split por `;` ou `,` (auto-detectado) |
| **PDF** (.pdf) | `parsePDFFile()` ja existente em `src/lib/pdfParser.ts` |
| **Texto colado** | Textarea + parsing por `\t` ou `;` |

## Mudancas no arquivo

**Arquivo:** `src/components/route/RouteHistoryImporter.tsx`

### 1. Expandir o input de arquivo

- Alterar `accept` de `.xls,.xlsx` para `.xls,.xlsx,.csv,.pdf`
- Atualizar texto descritivo para listar todos os formatos aceitos

### 2. Refatorar `parseFile` com deteccao por extensao

Adicionar branches dentro de `parseFile` sem alterar o fluxo Excel existente:

```text
parseFile(file)
  |
  extensao .xls/.xlsx -> logica atual (XLSX.read) -- sem mudanca
  |
  extensao .csv -> novo: file.text() -> detectar separador -> split -> mapear colunas
  |
  extensao .pdf -> novo: parsePDFFile(file) -> rows[][] -> mapear colunas
```

### 3. Extrair logica de mapeamento em funcao reutilizavel

Criar funcao `mapRowsToHistoryImport(rawRows: string[][], truckLabel: string, routeDate: string | null, filename: string)` que contem a logica de:
- Buscar header "ordem"
- Mapear indices de colunas (venda, cliente, endereco, bairro, cidade, uf)
- Gerar array de `ParsedHistoryRow`
- Fallback de data via coluna "fechamento"

Essa funcao sera chamada pelos 3 parsers (Excel, CSV, PDF) e tambem pelo parsing de texto colado.

### 4. Parser CSV (novo)

- Ler arquivo como texto com `file.text()`
- Detectar separador: se a primeira linha tem mais `;` que `,`, usar `;`
- Separar linhas por `\n`, colunas pelo separador detectado
- Passar `rawRows` para `mapRowsToHistoryImport`

### 5. Parser PDF (novo)

- Importar `parsePDFFile` de `@/lib/pdfParser`
- Chamar `parsePDFFile(file)` que retorna `{ rows: string[][] }`
- Passar `rows` para `mapRowsToHistoryImport`

### 6. Area de colagem (novo)

Adicionar abaixo do upload de arquivo:
- Um `textarea` para colar dados tabulares
- Um `input` de texto para informar o rotulo do caminhao (ex: "CYR")
- Um botao "Processar Texto"
- O texto colado e separado por `\t` ou `;`
- Passa para `mapRowsToHistoryImport`

### 7. UI

- Manter a area de upload existente, apenas expandindo os formatos aceitos
- Adicionar um separador com "ou" entre o upload e a area de colagem
- O restante do fluxo (previews, salvar, etc.) permanece identico

## Resumo de impacto

- **Nenhuma funcionalidade existente e removida ou alterada**
- Excel continua funcionando exatamente como antes
- Upload multiplo continua funcionando
- Apenas novas opcoes sao somadas

