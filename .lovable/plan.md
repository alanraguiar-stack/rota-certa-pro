
# Plano: Atualizar Nomenclatura no DualFileUpload (Aba Automático)

## Problema Identificado

Na aba **Automático** (upload de arquivos), os labels ainda usam a nomenclatura antiga:
- "Itinerário de Vendas" → deve ser **"Relatório Geral de Vendas"**
- "Relatório ADV" → deve ser **"Detalhe das Vendas"**

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/route/DualFileUpload.tsx` | Atualizar todas as referências de nomenclatura |

## Mudanças Detalhadas

### 1. Comentário do Arquivo (Linhas 1-9)

**Antes:**
```typescript
/**
 * 1) Itinerário de Vendas (endereços)
 * 2) Relatório ADV (itens detalhados)
 */
```

**Depois:**
```typescript
/**
 * 1) Relatório Geral de Vendas (endereços)
 * 2) Detalhe das Vendas (itens detalhados)
 */
```

### 2. Toast de Itinerário Detectado (Linha 119-122)

**Antes:**
```typescript
toast({
  title: 'Itinerário detectado!',
  description: `${result.itinerarioRecords.length} endereços de entrega carregados`,
});
```

**Depois:**
```typescript
toast({
  title: 'Relatório Geral detectado!',
  description: `${result.itinerarioRecords.length} endereços de entrega carregados`,
});
```

### 3. Toast de ADV Detectado (Linha 136-139)

**Antes:**
```typescript
toast({
  title: 'Relatório ADV detectado!',
  description: `${result.advOrders.length} pedidos com itens detalhados`,
});
```

**Depois:**
```typescript
toast({
  title: 'Detalhe das Vendas detectado!',
  description: `${result.advOrders.length} pedidos com itens detalhados`,
});
```

### 4. Mensagem de ADV sem Itinerário (Linha 344-348)

**Antes:**
```typescript
toast({
  title: 'Dados incompletos',
  description: 'O relatório ADV não contém endereços. Carregue também o arquivo de itinerário.',
});
```

**Depois:**
```typescript
toast({
  title: 'Dados incompletos',
  description: 'O Detalhe das Vendas não contém endereços. Carregue também o Relatório Geral.',
});
```

### 5. Função `getFileLabel` (Linhas 400-405)

**Antes:**
```typescript
const getFileLabel = (upload: UploadState, defaultLabel: string): string => {
  if (upload.detectedType === 'itinerario') return 'Itinerário de Vendas';
  if (upload.detectedType === 'adv') return 'Relatório ADV';
  ...
};
```

**Depois:**
```typescript
const getFileLabel = (upload: UploadState, defaultLabel: string): string => {
  if (upload.detectedType === 'itinerario') return 'Relatório Geral de Vendas';
  if (upload.detectedType === 'adv') return 'Detalhe das Vendas';
  ...
};
```

### 6. Labels Padrão dos Cards (Linhas 433 e 519)

**Antes:**
```typescript
{getFileLabel(file1Upload, '1. Primeiro Arquivo')}
{getFileLabel(file2Upload, '2. Segundo Arquivo')}
```

**Depois:**
```typescript
{getFileLabel(file1Upload, '1. Relatório Geral de Vendas')}
{getFileLabel(file2Upload, '2. Detalhe das Vendas')}
```

### 7. Alert de Instruções (Linhas 416-422)

**Antes:**
```typescript
<AlertDescription>
  <strong>Cruzamento Automático:</strong> Carregue dois arquivos PDF - o <strong>Itinerário de Vendas</strong> (com endereços) 
  e o <strong>Relatório ADV</strong> (com itens detalhados). O sistema irá cruzar os dados automaticamente pelo número da venda.
</AlertDescription>
```

**Depois:**
```typescript
<AlertDescription>
  <strong>Cruzamento Automático:</strong> Carregue dois arquivos PDF - o <strong>Relatório Geral de Vendas</strong> (com endereços) 
  e o <strong>Detalhe das Vendas</strong> (com itens detalhados). O sistema irá cruzar os dados automaticamente pelo número da venda.
</AlertDescription>
```

### 8. Mensagens de Ajuda (Linhas 640-644)

**Antes:**
```typescript
{file1Upload.detectedType === 'adv' 
  ? 'Carregue o arquivo de itinerário para obter os endereços de entrega.'
  : file1Upload.detectedType === 'itinerario'
  ? 'Você pode prosseguir ou carregar o relatório ADV para itens detalhados.'
  : ...}
```

**Depois:**
```typescript
{file1Upload.detectedType === 'adv' 
  ? 'Carregue o Relatório Geral para obter os endereços de entrega.'
  : file1Upload.detectedType === 'itinerario'
  ? 'Você pode prosseguir ou carregar o Detalhe das Vendas para itens detalhados.'
  : ...}
```

## Mudanças Visuais Esperadas

### Antes (como está no print)
```text
┌─────────────────┐  ┌─────────────────┐
│ 1. Primeiro     │  │ 2. Segundo      │
│ Arquivo         │  │ Arquivo         │
│ PDF ou Excel    │  │ Para cruzamento │
│ com dados de    │  │ automático de   │
│ vendas          │  │ dados           │
└─────────────────┘  └─────────────────┘

Instrução: "...Itinerário de Vendas... Relatório ADV..."
```

### Depois
```text
┌─────────────────┐  ┌─────────────────┐
│ 1. Relatório    │  │ 2. Detalhe das  │
│ Geral de Vendas │  │ Vendas          │
│ PDF ou Excel    │  │ Para cruzamento │
│ com dados de    │  │ automático de   │
│ vendas          │  │ dados           │
└─────────────────┘  └─────────────────┘

Instrução: "...Relatório Geral de Vendas... Detalhe das Vendas..."
```

## Resultado Esperado

1. Aba **Automático** mostra "1. Relatório Geral de Vendas" e "2. Detalhe das Vendas"
2. Instrução de cruzamento usa nomenclatura correta
3. Toasts de detecção mostram nomes corretos
4. Mensagens de erro/ajuda usam os novos nomes
5. Consistência total com a aba **Manual** (DualPasteData)
