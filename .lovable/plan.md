
# Plano: Correção do Design Responsivo - Áreas de Colagem de Dados

## Problema Identificado

Na página `/nova-rota`, quando a tela tem uma largura intermediária (entre 768px e ~1100px), as duas colunas de entrada de dados ficam "espremidas":
- Títulos como "1. Relatório Geral de Vendas" quebram em múltiplas linhas
- Textareas ficam muito estreitas
- Botões e ícones ficam comprimidos
- Layout visual fica desorganizado

## Causa Raiz

O breakpoint `md:grid-cols-2` (768px) é muito agressivo para este layout que precisa de mais espaço horizontal por card. As duas colunas só ficam boas em telas maiores (>1024px).

## Solução

Ajustar os breakpoints responsivos para:
1. Usar `lg:grid-cols-2` em vez de `md:grid-cols-2` (trocar 768px por 1024px)
2. Adicionar largura mínima nos cards para evitar compressão excessiva
3. Melhorar a responsividade dos títulos e descrições

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/components/route/DualPasteData.tsx` | Editar | Ajustar breakpoint do grid |
| `src/components/route/DualFileUpload.tsx` | Editar | Ajustar breakpoint do grid |

## Mudanças Técnicas

### 1. DualPasteData.tsx

**Linha 732** - Alterar breakpoint do grid:

```typescript
// ANTES
<div className="grid gap-6 md:grid-cols-2">

// DEPOIS
<div className="grid gap-6 lg:grid-cols-2">
```

**Linhas 739-741 e 808-810** - Melhorar responsividade dos títulos:

```typescript
// ANTES
<CardTitle className="flex items-center gap-2 text-base">

// DEPOIS
<CardTitle className="flex items-center gap-2 text-base flex-wrap">
```

### 2. DualFileUpload.tsx

**Linha 424** - Alterar breakpoint do grid:

```typescript
// ANTES
<div className="grid gap-6 md:grid-cols-2">

// DEPOIS
<div className="grid gap-6 lg:grid-cols-2">
```

**Linhas 431-433 e 517-519** - Melhorar responsividade dos títulos:

```typescript
// ANTES
<CardTitle className="flex items-center gap-2 text-base">

// DEPOIS
<CardTitle className="flex items-center gap-2 text-base flex-wrap">
```

### 3. Adicionar Largura Mínima nos Cards (Opcional - Segurança Extra)

Adicionar classe `min-w-0` nos cards para evitar overflow:

```typescript
<Card className={cn(
  'transition-all min-w-0',  // min-w-0 evita overflow de conteúdo
  ...
)}>
```

## Comparação de Breakpoints Tailwind

| Breakpoint | Tamanho | Comportamento Atual | Comportamento Novo |
|------------|---------|--------------------|--------------------|
| `sm` | 640px | 1 coluna | 1 coluna |
| `md` | 768px | 2 colunas (espremido) | 1 coluna |
| `lg` | 1024px | 2 colunas | 2 colunas |
| `xl` | 1280px | 2 colunas | 2 colunas |

## Resultado Esperado

1. Em telas menores que 1024px: layout em coluna única (sem espremer)
2. Em telas 1024px ou maiores: layout em duas colunas (espaço adequado)
3. Títulos não quebram de forma estranha
4. Textareas mantêm altura e largura legíveis
5. Experiência visual limpa e profissional
