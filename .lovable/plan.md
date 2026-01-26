
# Plano: Renomear Abas e Corrigir Validação de Endereço

## Problema Identificado

1. **Nomes das áreas estão incorretos**: Atualmente mostra "1. Itinerário de Vendas" e "2. Relatório ADV"
2. **Erro de endereço na segunda área**: Ao colar dados de itens na segunda área, o sistema mostra erro "Sem endereço" — mas essa área é justamente para detalhes, não para endereços

## Solução

Renomear as áreas e remover a obrigatoriedade de endereço na área de detalhes.

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/route/DualPasteData.tsx` | Renomear labels e remover validação de endereço no ADV |

## Mudanças Técnicas

### 1. Renomear Labels das Áreas

**Antes:**
- Área 1: "1. Itinerário de Vendas" / "Itinerário (Endereços)"
- Área 2: "2. Relatório ADV" / "Relatório ADV (Itens)"

**Depois:**
- Área 1: "1. Relatório Geral de Vendas" (contém endereços)
- Área 2: "2. Detalhe das Vendas" (contém itens)

### 2. Atualizar Descrições

**Área 1:**
- Título: "1. Relatório Geral de Vendas"
- Descrição: "Cole dados com endereços de entrega"

**Área 2:**
- Título: "2. Detalhe das Vendas"  
- Descrição: "Cole dados com itens detalhados"

### 3. Remover Validação de Endereço no ADV

No `parseADVData()`, ao criar os pedidos, **não marcar como inválido** só porque não tem endereço:

```typescript
// ANTES (linha 218-220):
orders.push({
  // ...
  address: '', // ADV não tem endereço
  isValid: false, // ❌ Marcava como inválido
  error: 'Sem endereço - necessita cruzamento com itinerário', // ❌ Mostrava erro
});

// DEPOIS:
orders.push({
  // ...
  address: '', // ADV não tem endereço
  isValid: true, // ✅ Válido (é esperado não ter endereço)
  // Sem mensagem de erro
});
```

### 4. Atualizar Função `getAreaLabel`

```typescript
// ANTES:
const getAreaLabel = (area: PasteAreaState, defaultLabel: string) => {
  if (area.detectedType === 'itinerario') return 'Itinerário (Endereços)';
  if (area.detectedType === 'adv') return 'Relatório ADV (Itens)';
  // ...
};

// DEPOIS:
const getAreaLabel = (area: PasteAreaState, defaultLabel: string) => {
  if (area.detectedType === 'itinerario') return 'Relatório Geral de Vendas';
  if (area.detectedType === 'adv') return 'Detalhe das Vendas';
  // ...
};
```

### 5. Atualizar Labels Padrão nas Cards

```typescript
// ANTES (linha 625):
{getAreaLabel(area1, '1. Itinerário de Vendas')}

// DEPOIS:
{getAreaLabel(area1, '1. Relatório Geral de Vendas')}

// ANTES (linha 694):
{getAreaLabel(area2, '2. Relatório ADV')}

// DEPOIS:
{getAreaLabel(area2, '2. Detalhe das Vendas')}
```

### 6. Atualizar Toast Messages

```typescript
// ANTES:
toast({ title: 'Itinerário detectado!' });
toast({ title: 'Relatório ADV detectado!' });

// DEPOIS:
toast({ title: 'Relatório Geral detectado!' });
toast({ title: 'Detalhe das Vendas detectado!' });
```

## Mudanças Visuais

### Antes
```text
┌─────────────────┐  ┌─────────────────┐
│ 1. Itinerário   │  │ 2. Relatório ADV│
│ de Vendas       │  │                 │
│ Cole endereços  │  │ Cole itens      │
│                 │  │ ❌ Erro: sem    │
│                 │  │ endereço        │
└─────────────────┘  └─────────────────┘
```

### Depois
```text
┌─────────────────┐  ┌─────────────────┐
│ 1. Relatório    │  │ 2. Detalhe das  │
│ Geral de Vendas │  │ Vendas          │
│ Cole endereços  │  │ Cole itens      │
│                 │  │ ✓ 45 pedidos    │
│                 │  │ detectados      │
└─────────────────┘  └─────────────────┘
```

## Fluxo Corrigido

1. Usuário cola dados gerais (com endereços) na área 1
2. Sistema detecta como "Relatório Geral" e mostra "✓ 45 endereços"
3. Usuário cola detalhes (itens) na área 2
4. Sistema detecta como "Detalhe das Vendas" e mostra "✓ 45 pedidos" **sem erro**
5. Sistema cruza automaticamente pelo número da venda
6. Botão "Importar X Pedidos" fica disponível

## Resultado Esperado

- Primeira área mostra "1. Relatório Geral de Vendas"
- Segunda área mostra "2. Detalhe das Vendas"
- Colar dados de itens na segunda área **não mostra erro de endereço**
- Cruzamento funciona normalmente usando endereços da primeira área
