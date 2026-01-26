

# Plano: Filtrar Apenas Colunas Essenciais do Excel

## Problema Identificado

O arquivo `vendas.xlsx` possui mais de 20 colunas, mas para roteirização só precisamos de **6 colunas essenciais**:

| Coluna Essencial | Uso |
|------------------|-----|
| `Venda` | ID do pedido |
| `Cliente` | Nome do cliente |
| `End. Ent.` | Endereço (rua + número) |
| `Bairro Ent.` | Bairro de entrega |
| `Cidade Ent.` | Cidade de entrega |
| `Cep Ent.` | CEP de entrega |
| `Peso Bruto` | Peso total em kg |

**Colunas a ignorar**: Total, Ordem, Endereço (duplicado), Fantasia, Peso Liq., Número, Tipo de Saída, Loja, Bairro, Cidade, UF, Cep, Região, Data, Fechamento, NF, Dt. Prev. Entreg, etc.

## Solução

Modificar o parser para **extrair apenas os dados essenciais** e ignorar colunas desnecessárias durante o processamento.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/orderParser.ts` | Ajustar detecção para priorizar colunas "Ent." e ignorar duplicados |

## Mudanças Técnicas

### 1. Priorizar Colunas com Sufixo "Ent."

O arquivo tem colunas duplicadas (ex: `Bairro` e `Bairro Ent.`). Precisamos priorizar as versões com "Ent." que são os dados de **entrega**:

```typescript
// Ordem de prioridade na busca de colunas
// Primeiro buscar padrões com "Ent." (entrega), depois os genéricos

bairro: [
  /bairro\.?\s*ent\.?/i,  // PRIORIDADE: Bairro Ent.
  /bairro/i,              // Fallback: Bairro genérico
],
cidade: [
  /cidade\.?\s*ent\.?/i,  // PRIORIDADE: Cidade Ent.
  /cidade/i,              // Fallback
],
cep: [
  /cep\.?\s*ent\.?/i,     // PRIORIDADE: Cep Ent.
  /^cep$/i,               // Fallback
],
```

### 2. Detectar Formato Itinerário e Aplicar Mapeamento Correto

Adicionar lógica para detectar quando o arquivo é formato Itinerário (tem colunas "Ent.") e mapear corretamente:

```typescript
function detectItineraryFormat(headers: string[]): boolean {
  const headerText = headers.join(' ').toLowerCase();
  return /end\.?\s*ent|bairro\.?\s*ent|cidade\.?\s*ent|cep\.?\s*ent/.test(headerText);
}

// Se for formato itinerário, usar mapeamento específico
if (detectItineraryFormat(headers)) {
  // Forçar uso das colunas com sufixo "Ent."
  // Ignorar colunas duplicadas (Bairro vs Bairro Ent.)
}
```

### 3. Ignorar Colunas Não Essenciais

Criar lista de exclusão para colunas que devem ser completamente ignoradas:

```typescript
const IGNORED_COLUMNS = [
  /^total$/i,
  /^ordem$/i,
  /^fantasia$/i,
  /tipo\s*de?\s*sa[íi]da/i,
  /^loja$/i,
  /^regi[ãa]o$/i,
  /^n[º°]?$/i,      // Número de NF
  /^nf$/i,
  /fechamento/i,
  /dt\.?\s*prev/i,
];
```

### 4. Resolver Conflito Entre Colunas Duplicadas

O arquivo tem `Bairro` e `Bairro Ent.` — precisamos garantir que só usamos `Bairro Ent.`:

```typescript
// Na função findColumn, se encontrar múltiplas correspondências,
// priorizar a que tem "Ent." no nome

const findColumn = (patterns: RegExp[]): number => {
  let bestMatch = -1;
  let isEntMatch = false;
  
  for (let idx = 0; idx < normalizedHeaders.length; idx++) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedHeaders[idx])) {
        const hasEnt = /ent\.?$/i.test(normalizedHeaders[idx]);
        // Se ainda não tem match, ou se este é "Ent." e o anterior não era
        if (bestMatch === -1 || (hasEnt && !isEntMatch)) {
          bestMatch = idx;
          isEntMatch = hasEnt;
        }
      }
    }
  }
  return bestMatch;
};
```

## Mapeamento Final para `vendas.xlsx`

| Coluna Original | Mapeamento | Status |
|-----------------|------------|--------|
| `Venda` | `pedido_id` | ✅ Usar |
| `Cliente` | `client_name` | ✅ Usar |
| `End. Ent.` | `rua` (endereço completo) | ✅ Usar |
| `Bairro Ent.` | `bairro` | ✅ Usar |
| `Cidade Ent.` | `cidade` | ✅ Usar |
| `Cep Ent.` | `cep` | ✅ Usar |
| `Peso Bruto` | `weight_kg` | ✅ Usar |
| `UF Ent.` | `estado` | ✅ Usar |
| `Total` | — | ❌ Ignorar |
| `Ordem` | — | ❌ Ignorar |
| `Endereço` | — | ❌ Ignorar (duplicado) |
| `Bairro` | — | ❌ Ignorar (duplicado) |
| `Cidade` | — | ❌ Ignorar (duplicado) |
| `UF` | — | ❌ Ignorar (duplicado) |
| `Cep` | — | ❌ Ignorar (duplicado) |
| ... | — | ❌ Ignorar |

## Endereço Construído

O sistema montará o endereço assim:

```
R. FILOMENA FONGARO, 36, VILA FANTON, SAO PAULO - SP, 05201-160
```

## Passos de Implementação

1. **Atualizar função `findColumn`**: Priorizar colunas com sufixo "Ent." quando houver duplicatas
2. **Atualizar padrões de regex**: Garantir que padrões específicos vêm antes dos genéricos
3. **Adicionar log de debug**: Mostrar quais colunas foram mapeadas para facilitar diagnóstico
4. **Testar com vendas.xlsx**: Confirmar que apenas dados essenciais são extraídos

## Resultado Esperado

1. Upload do arquivo `vendas.xlsx`
2. Sistema detecta formato Itinerário
3. Mapeia **apenas** as 7 colunas essenciais (Venda, Cliente, End. Ent., Bairro Ent., Cidade Ent., Cep Ent., Peso Bruto, UF Ent.)
4. Ignora todas as outras 15+ colunas
5. Constrói endereço completo para geocodificação
6. Importa todos os pedidos com sucesso

