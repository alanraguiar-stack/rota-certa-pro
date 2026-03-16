

# Correção: Contagem de vendas no ADV CSV usando coluna F

## Problema

O parser ADV está encontrando 111 pedidos em vez de 103. A detecção usa regex no texto concatenado da linha (`venda\s*n[º°]?\s*:\s*(\d+)`), que pode falhar com problemas de encoding (chars garbled como `N�` em vez de `Nº`) e criar registros duplicados ou falsos positivos.

## Solução

Usar a **coluna F (índice 5)** diretamente para extrair o número da venda, como o usuário sugeriu. No CSV, a coluna F contém o número da venda APENAS nas linhas "Venda Nº:", sendo vazia nas demais linhas.

### Mudança em `parseADVDetailExcel` (`src/lib/advParser.ts`)

Adicionar uma estratégia complementar de detecção de venda:

1. **Antes do regex**: verificar se a coluna F (índice 5) contém um número puro (6+ dígitos) E se alguma coluna anterior contém o marcador "Venda" (mesmo com encoding quebrado)
2. Se a coluna F tiver um número válido de venda, usar esse valor diretamente em vez de depender do regex no texto concatenado
3. Isso elimina falsos positivos causados por encoding e garante paridade com o arquivo real

### Mudança no display (`src/components/route/DualFileUpload.tsx`)

A mensagem de sucesso na linha 192 já usa `advOrders.length` para contar pedidos. Se a contagem da extração estiver correta, o display estará correto automaticamente.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/advParser.ts` | Em `parseADVDetailExcel`: adicionar extração de venda por coluna F (índice 5) como método primário, com fallback para regex |

