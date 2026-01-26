

# Plano: Corrigir Detecção de Colunas em PDFs

## Problema Identificado

O sistema diz que "Nome do cliente é obrigatório", mesmo com a coluna "Cliente" presente no PDF. Isso acontece porque:

1. O parser de PDF extrai texto baseado em coordenadas X/Y
2. A reconstrução da tabela pode estar falhando devido a:
   - Colunas sendo mescladas incorretamente
   - O texto "Cliente" sendo fragmentado ou não detectado como header
   - Tolerâncias de agrupamento inadequadas para o layout do PDF

## Solução Proposta

### Passo 1: Adicionar Logs de Diagnóstico

Adicionar logs temporários para visualizar como o PDF está sendo interpretado:

```typescript
// Em parsePDFFile()
console.log('PDF Headers detectados:', rows[0]);
console.log('Total de colunas:', columnBoundaries.length);
console.log('Primeira linha de dados:', rows[1]);
```

### Passo 2: Melhorar Detecção de Colunas

Ajustar o algoritmo `detectColumns()` para ser mais robusto:

- Aumentar a tolerância de gap mínimo entre colunas
- Usar a linha de header como referência principal para detectar colunas
- Aplicar normalização de texto para remover espaços extras

### Passo 3: Fallback para Detecção Simples

Se a detecção automática falhar, usar um fallback que:
1. Trata cada texto separado como uma coluna
2. Tenta casar os nomes das colunas com padrões conhecidos

### Passo 4: Preview dos Dados Extraídos

Adicionar uma visualização prévia dos dados extraídos do PDF antes de processar, permitindo verificar se a estrutura foi detectada corretamente.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/pdfParser.ts` | Adicionar logs e melhorar algoritmo de detecção |
| `src/lib/orderParser.ts` | Melhorar fallback na detecção de colunas |

## Mudanças Técnicas

### 1. `src/lib/pdfParser.ts`

```typescript
// Adicionar log para diagnóstico
export async function parsePDFFile(file: File): Promise<PDFParseResult> {
  // ... código existente ...
  
  // Após detectar colunas:
  console.log('[PDF Parser] Colunas detectadas:', columnBoundaries.length);
  console.log('[PDF Parser] Primeira linha (headers):', rows[0]);
  
  // Debug: mostrar como cada linha foi interpretada
  if (rows.length > 0) {
    console.log('[PDF Parser] Exemplo de dados (linha 2):', rows[1]);
  }
  
  return { rows, pageCount: pdf.numPages };
}
```

### 2. `src/lib/orderParser.ts` - Melhorar Fallback

```typescript
// Em parseSalesPDF() - após falha na detecção:
if (!mapping) {
  console.warn('[Order Parser] Mapeamento automático falhou');
  console.warn('[Order Parser] Headers detectados:', headers);
  
  // Fallback: tentar encontrar colunas por padrão de texto
  // mesmo se não corresponderem exatamente aos padrões
}
```

## Teste

1. Fazer upload do PDF novamente
2. Verificar os logs no console do navegador (F12)
3. Os logs mostrarão exatamente como as colunas estão sendo interpretadas
4. Com base nos logs, ajustar o algoritmo de detecção

## Próximos Passos Após Diagnóstico

Dependendo do que os logs revelarem:

- **Se colunas estão mescladas**: Ajustar tolerância de gap
- **Se texto está fragmentado**: Melhorar agrupamento por proximidade X
- **Se headers não correspondem**: Flexibilizar os padrões de detecção

