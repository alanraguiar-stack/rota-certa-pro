
# Plano: Remover Exigência de Endereço na Área "Detalhe das Vendas"

## Problema Identificado

Na área **"2. Detalhe das Vendas"**, quando o usuário cola dados de itens, está aparecendo o erro **"Endereço muito curto (mín 10 caracteres)"**.

Isso acontece porque:
1. Os dados colados não são detectados como tipo `adv` (falta padrões como "vendas detalhadas", "cliente:", etc.)
2. O código cai no fallback que usa `parsePastedData()` 
3. Essa função exige endereço com mínimo 10 caracteres
4. Como a área 2 é para **itens detalhados** (não para endereços), isso não deveria ser exigido

## Solução

Criar um parser específico para a área 2 que **não exige endereço**, já que:
- A área 1 é para endereços (Relatório Geral de Vendas)
- A área 2 é para itens (Detalhe das Vendas)
- Endereços virão do cruzamento entre as duas áreas

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/route/DualPasteData.tsx` | Criar parser sem validação de endereço para área 2 |

## Mudanças Técnicas

### 1. Criar Função `parseDetailData()` Sem Validação de Endereço

Nova função que extrai dados de itens sem exigir endereço:

```typescript
// Parsear dados de detalhe (itens) - SEM exigir endereço
function parseDetailData(text: string): { orders: ParsedOrder[]; vendaIds: Set<string> } {
  const orders: ParsedOrder[] = [];
  const vendaIds = new Set<string>();
  
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { orders, vendaIds };
  
  // Processar como tabular (colunas separadas por tab ou espaços múltiplos)
  // Detectar colunas: Pedido, Cliente, Produto, Qtd, Peso
  // NÃO exigir endereço - apenas extrair itens
  
  // Para cada linha, criar order com isValid: true
  // (mesmo sem endereço, pois virá do cruzamento)
}
```

### 2. Modificar `processText()` para Usar Parser Diferente por Área

```typescript
// ANTES (fallback genérico para ambas as áreas):
const result = parsePastedData(text);

// DEPOIS (parser sem validação para área 2):
if (areaNum === 2) {
  // Área 2 é para itens - não exigir endereço
  const { orders } = parseDetailData(text);
  // Marcar todos como válidos
  setAreaState({ ..., status: 'success', data: orders });
} else {
  // Área 1 - usar parser normal que exige endereço
  const result = parsePastedData(text);
}
```

### 3. Melhorar Detecção de Tipo ADV

Expandir os padrões que identificam dados de itens:

```typescript
// ANTES:
if (/vendas\s*detalhadas|cliente:|qtd\.?\s*ped|#\s*cliente/i.test(text)) {
  return 'adv';
}

// DEPOIS (mais flexível):
if (/vendas\s*detalhadas|cliente:|qtd\.?\s*ped|#\s*cliente|produto|quantidade|mussarela|mortadela/i.test(text)) {
  return 'adv';
}
```

### 4. Remover Mensagem de Erro de Endereço na Área 2

Na área 2, **nunca mostrar erro de endereço** pois não é esperado ter endereço nessa área:

```typescript
// Para área 2, ignorar erros de endereço
const relevantErrors = areaNum === 2 
  ? errors.filter(e => e.field !== 'endereço')
  : errors;
```

## Fluxo Corrigido

1. Usuário cola dados do Relatório Geral na área 1
2. Sistema detecta endereços e mostra "✓ 45 endereços"
3. Usuário cola dados de itens na área 2
4. Sistema detecta itens e mostra **"✓ 45 pedidos"** (sem erro de endereço)
5. Sistema cruza automaticamente pelo número da venda
6. Botão "Importar X Pedidos" disponível

## Resultado Esperado

- Colar dados de itens na área 2 **não mostra mais erro de endereço**
- Dados são processados normalmente e cruzados com a área 1
- Importação funciona corretamente
