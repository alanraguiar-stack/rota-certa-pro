
# Plano: Parser Inteligente para Relatórios ADV - IMPLEMENTADO ✅

## Status: Concluído

O parser ADV foi implementado com sucesso. Arquivos criados/modificados:

### Arquivos Criados
- `src/lib/advParser.ts` - Parser especializado para relatórios ADV

### Arquivos Modificados
- `src/lib/pdfParser.ts` - Adicionada função `extractRawTextFromPDF()`
- `src/lib/orderParser.ts` - Integração com parser ADV e detecção automática

## Funcionalidades Implementadas

1. ✅ **Detecção automática de formato ADV** - O sistema identifica automaticamente se o PDF é do formato ADV
2. ✅ **Extração hierárquica** - Processa estrutura Cliente → Vendas → Itens
3. ✅ **Mapeamento de dados**:
   - `Cliente: NOME` → `client_name`
   - `Venda Nº: XXX` → `pedido_id`
   - `Descrição` (tabela) → `product_name`
   - `Qtde.` (tabela) → `weight_kg`

## Fluxo de Processamento

```text
Upload PDF → Tentar Parser ADV → Se não for ADV → Parser Genérico
```

## ⚠️ Limitação Conhecida: Endereços

O relatório ADV **não contém endereços de entrega**. Os pedidos são extraídos com o campo `address` vazio e marcados como "parcialmente válidos".

**Solução recomendada**: Após a importação, os endereços podem ser:
- Adicionados manualmente na interface
- Importados de uma base de clientes separada
- Cruzados com outro arquivo que contenha os endereços
