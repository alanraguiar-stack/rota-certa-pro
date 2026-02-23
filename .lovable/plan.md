

# Renomear labels dos relatórios e corrigir mensagem de erro

## Problema
1. O lado esquerdo mostra "Relatório Geral de Vendas" - deve ser **"Vendas do Dia"**
2. O lado direito "Detalhe das Vendas" - **manter como está**
3. A mensagem de erro menciona "Relatório Geral" - deve referenciar "Vendas do Dia"
4. O Detalhe das Vendas contém nome do cliente (sem endereço) - o endereço está nas Vendas do Dia

## Alterações

### Arquivo 1: `src/components/route/DualFileUpload.tsx`

| Local | De | Para |
|-------|-----|------|
| Instrução (linha 613) | "Relatório Geral de Vendas" | "Vendas do Dia" |
| Label detectado (linha 595) | `'Relatório Geral de Vendas'` | `'Vendas do Dia'` |
| Default label esquerdo (linha 627) | `'1. Relatório Geral de Vendas'` | `'1. Vendas do Dia'` |
| Toast itinerário (linhas 217, 350) | `'Relatório Geral detectado!'` | `'Vendas do Dia detectado!'` |
| Toast erro (linha 531) | `'Carregue também o Relatório Geral.'` | `'Carregue também as Vendas do Dia.'` |
| Hint inferior (linha 849) | `'Carregue o Relatório Geral para obter os endereços'` | `'Carregue as Vendas do Dia para obter os endereços'` |

### Arquivo 2: `src/components/route/DualPasteData.tsx`

| Local | De | Para |
|-------|-----|------|
| Label detectado (linha 775) | `'Relatório Geral de Vendas'` | `'Vendas do Dia'` |
| Default label esquerdo (linha 801) | `'1. Relatório Geral de Vendas'` | `'1. Vendas do Dia'` |
| Instrução (linha 787) | "Relatório Geral de Vendas" | "Vendas do Dia" |
| Toast itinerário (linha 485) | `'Relatório Geral detectado!'` | `'Vendas do Dia detectado!'` |
| Toast erro (linha 736) | `'Cole também o Relatório Geral.'` | `'Cole também as Vendas do Dia.'` |

Total: ~12 ocorrências em 2 arquivos. Nenhuma lógica muda, apenas os textos exibidos ao usuário.

