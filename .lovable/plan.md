
# Plano: Motor Inteligente de Leitura de Planilhas ✅ IMPLEMENTADO

## Resumo da Implementação

O sistema foi completamente reestruturado para operar como um "analista logístico humano":
- Lê TUDO primeiro, sem exceção
- Entende o significado dos dados
- Valida coerência antes de decidir
- Só então toma decisões

## Arquitetura Final

```
src/lib/spreadsheet/
├── index.ts              # Exportações públicas
├── types.ts              # Tipos e interfaces
├── columnDetector.ts     # Detecção semântica de colunas
├── weightExtractor.ts    # Extração robusta de peso
├── validationEngine.ts   # Validação de coerência
└── intelligentReader.ts  # Motor principal
```

## Funcionalidades Implementadas

### 1. Leitura Completa da Planilha ✅
- Lê TODAS as linhas
- Lê TODAS as colunas
- Classifica cada linha: header, dados, vazia, totalização, observação
- Ignora automaticamente linhas irrelevantes

### 2. Identificação de Colunas por Significado ✅
- Detecta colunas pelo NOME, não pela posição
- Palavras-chave para cada tipo semântico:
  - Peso: "Peso Bruto", "Peso Total", "Total KG", etc.
  - Cliente: "Cliente", "Razão Social", "Nome", etc.
  - Endereço: "End. Ent.", "Rua", "Bairro", "Cidade", "CEP", etc.
- Normalização super-agressiva: "Peso  Bruto" → "pesobruto"

### 3. Detecção Inteligente de Peso ✅
- 5 níveis de detecção com fallback:
  1. Nome exato da coluna
  2. Super-normalização
  3. Busca por "peso" no nome
  4. Índice fixo para formato MB (coluna F = índice 5)
  5. Heurística numérica (excluindo monetárias)
- Exclui colunas monetárias automaticamente
- Valida média de peso (1-1500 kg/entrega)

### 4. Tratamento de Dados Sujos ✅
- Ignora linhas vazias
- Ignora linhas de totalização ("TOTAL GERAL")
- Trata formatos BR (1.234,56) e US (1,234.56)
- Remove sufixos de unidade (kg, g, t)

### 5. Validação de Coerência ✅
- Verifica peso médio realista (10-2000 kg)
- Detecta se coluna "Total (R$)" foi confundida com peso
- Valida se endereços são suficientes
- Calcula caminhões estimados

### 6. Autocorreção e Diagnóstico ✅
- Gera relatório detalhado de diagnóstico
- Mostra qual coluna foi interpretada como peso
- Lista warnings e sugestões
- Permite identificar problemas rapidamente

## Integração no Componente de Upload

O `DualFileUpload.tsx` agora usa o motor inteligente como **primeira opção** para arquivos Excel:

```typescript
// PRIMEIRO: Tentar o Motor Inteligente
const { analysis, orders } = await analyzeSpreadsheet(file);

// Exibe diagnóstico no console
// Retorna peso total formatado (ex: "13,05 t")
// Estima caminhões necessários
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Coluna Selecionada | Às vezes "Total" (R$) | **Sempre "Peso Bruto"** |
| Peso Total | Variável/errado | **Correto** |
| Diagnóstico | Nenhum | **Completo no console** |
| Robustez | Frágil | **Tolerante a variações** |

## Arquivos Criados/Modificados

### Novos:
- `src/lib/spreadsheet/types.ts`
- `src/lib/spreadsheet/columnDetector.ts`
- `src/lib/spreadsheet/weightExtractor.ts`
- `src/lib/spreadsheet/validationEngine.ts`
- `src/lib/spreadsheet/intelligentReader.ts`
- `src/lib/spreadsheet/index.ts`
- `src/hooks/useIntelligentParser.ts`
- `src/test/spreadsheet.test.ts`

### Modificados:
- `src/components/route/DualFileUpload.tsx` - Integrado motor inteligente

## Próximos Passos

1. **Testar com planilha real** - Upload do `Relatório_de_Vendas_-_MB-3.xlsx`
2. **Verificar peso total** - Deve ser ~13.048,56 kg
3. **Verificar console** - Diagnóstico completo visível
4. **Ajustar se necessário** - O motor registra tudo para debug
