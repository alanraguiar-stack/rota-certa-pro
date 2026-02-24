

# Corrigir Alocacao Territorial: Usar Campo `city` do Relatorio (Coluna L) em vez de Parser de Endereco

## Problema Raiz

O motor de roteirizacao (`autoRouterEngine.ts`) determina a cidade de cada pedido parseando o texto do endereco com regex (`parseAddress`), que frequentemente extrai a cidade errada. Enquanto isso, o campo `order.city` ja contem a cidade correta vinda diretamente da coluna L ("Cidade Ent.") do relatorio de vendas. O resultado: cidades aleatorias nos caminhoes.

**Linha 177 do autoRouterEngine.ts (problema):**
```text
const city = normalizeCityName(order.geocoded.city || 'desconhecida');
```
Deveria ser:
```text
const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
```

## Solucao

Alterar TODOS os pontos em `autoRouterEngine.ts` onde a cidade e determinada para priorizar `order.city` (coluna L do relatorio) sobre `order.geocoded.city` (regex do endereco). A mesma correcao se aplica na validacao e no sequenciamento.

### Mudancas no arquivo `src/lib/autoRouterEngine.ts`

**1. Agrupamento por cidade (linha 177)**
Trocar `order.geocoded.city` por `order.city || order.geocoded.city` no loop de agrupamento.

**2. Construcao de cidades por caminhao (linhas 289, 349)**
Mesma correcao no loop que monta a lista de cidades de cada composicao.

**3. Caminhoes nao-ancora - agrupamento de remanescentes (linha 389)**
Mesma correcao.

**4. Validacao - cidades nao autorizadas (linha 514)**
Usar `order.city` antes de tentar `parseAddress` para determinar a cidade do pedido.

**5. Validacao - alternancia de cidades (linha 534)**
Mesma correcao.

**6. Sequenciamento - agrupamento por cidade (linha 573)**
Mesma correcao.

### Resumo das alteracoes

Todas as mudancas sao no mesmo arquivo (`src/lib/autoRouterEngine.ts`) e seguem o mesmo padrao: em qualquer ponto que determine a cidade de um pedido, priorizar `order.city` (dado confiavel da planilha) sobre `order.geocoded.city` (inferencia por regex).

Nao ha mudancas em interfaces, tipos ou outros arquivos. A logica de alocacao por ancora, limites de entregas, excepcoes de bairro e sequenciamento ja esta correta -- o unico problema e a fonte do dado de cidade.

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/autoRouterEngine.ts` | ~6 pontos: priorizar `order.city` sobre `order.geocoded.city` em agrupamento, validacao e sequenciamento |

