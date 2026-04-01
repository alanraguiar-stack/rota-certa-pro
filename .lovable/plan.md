

# Plano: Corrigir Romaneio de Carga Vazio (Fallback sem Itens)

## Causa Raiz

Esta rota foi criada **sem o arquivo de detalhamento (ADV)**. Todos os pedidos têm `product_description = "Sem itens detalhados"` e zero registros em `order_items`. O código atual agrupa tudo numa única linha com esse texto genérico, que parece vazio/inútil.

## Correção

### `src/components/route/LoadingManifest.tsx`

1. **Melhorar o fallback do `consolidateProducts`**: quando nenhum pedido tem `items`, listar cada pedido individualmente pelo nome do cliente + peso, em vez de agrupar tudo sob "Sem itens detalhados"
2. **Adicionar aviso visual**: mostrar um alerta amarelo no topo explicando que o detalhamento de produtos não foi importado e que o romaneio está usando dados resumidos
3. **PDF também reflete o fallback**: a função `generateLoadingManifestPDF` deve gerar a tabela com os pedidos individuais quando não há itens detalhados

### Lógica do fallback

```text
SE nenhum pedido tem items E todos têm "Sem itens detalhados":
  → Listar cada pedido como: "Pedido - [Nome do Cliente]" | Peso | Qtd: 1
SENÃO (fallback parcial):
  → Manter lógica atual (usa product_description ou items)
```

### Resultado esperado

- Rotas **com** ADV: comportamento inalterado (produtos consolidados)
- Rotas **sem** ADV: romaneio lista cada pedido por cliente/peso + aviso de que o detalhamento não foi importado

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/LoadingManifest.tsx` | Fallback inteligente + aviso visual + PDF atualizado |

