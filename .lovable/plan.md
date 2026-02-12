
# Plano: Aprendizado com Roteiros Historicos e Regionalizacao por Cidade

## Contexto

Os arquivos enviados (CYR10.02.26.xls e DHS10.02.26.xls) sao roteiros reais feitos por um analista humano. Cada arquivo representa um caminhao (CYR, DHS) com suas entregas ja sequenciadas. A estrutura contem: Ordem, Venda, Cliente, Fantasia, CEP, Endereco, Numero, Bairro, Cidade, UF.

O objetivo e duplo:
1. **Aprender** com roteiros passados para melhorar a composicao automatica
2. **Regionalizar** os caminhoes por cidade, sem misturar cidades diferentes no mesmo veiculo

---

## Parte 1: Regionalizacao por Cidade (Prioridade Alta)

### Problema Atual
O motor de auto-roteamento (`autoRouterEngine.ts`) agrupa pedidos por **angulo geometrico** a partir do CD, ignorando completamente a cidade. Isso pode colocar entregas de Barueri, Jandira e Osasco no mesmo caminhao.

### Solucao
Alterar o algoritmo de clustering para usar **cidade como criterio primario** de agrupamento:

1. Extrair a cidade de cada pedido usando `parseAddress()` (campo `city` do `GeocodedAddress`)
2. Agrupar pedidos por cidade primeiro
3. Atribuir cada grupo-cidade a um caminhao, respeitando capacidade
4. Dentro de cada cidade, aplicar a otimizacao de rota existente (nearest neighbor, etc.)

Se uma cidade tiver mais pedidos do que cabe em um caminhao, dividir essa cidade em sub-clusters geograficos.

**Arquivo:** `src/lib/autoRouterEngine.ts`
- Nova funcao `clusterOrdersByCity()` que substitui `clusterOrdersBySector()`
- A funcao agrupa por cidade, depois distribui os grupos para os caminhoes disponibles

**Arquivo:** `src/lib/geocoding.ts`
- Melhorar o parser de cidade para lidar com enderecos que vem do formato do ERP (campos separados: Rua, Numero, Bairro, Cidade)

**Arquivo:** `src/types/index.ts`
- Adicionar campo opcional `city` ao `ParsedOrder` para que a cidade ja venha identificada desde o parsing

---

## Parte 2: Importar Roteiros Historicos para Aprendizado

### Objetivo
Criar uma tabela de historico de roteiros no banco de dados onde o sistema armazena como o analista humano agrupou e sequenciou entregas. Esses dados servem como referencia para futuras composicoes.

### Nova Tabela: `route_history_patterns`

```text
id              uuid (PK)
user_id         uuid (FK)
truck_label     text        -- Ex: "CYR", "DHS"
route_date      date        -- Data do roteiro
sequence_order  integer     -- Ordem da entrega
sale_number     text        -- Numero da venda
client_name     text        -- Nome do cliente
address         text        -- Endereco completo
neighborhood    text        -- Bairro
city            text        -- Cidade
state           text        -- UF
created_at      timestamp
```

### Nova funcionalidade: Upload de Roteiros

**Arquivo:** `src/components/route/RouteHistoryImporter.tsx` (novo)
- Componente para upload de arquivos .xls no formato "Entregas" do ERP
- Parser que le o XML-Excel e extrai: Ordem, Venda, Cliente, CEP, Endereco, Numero, Bairro, Cidade, UF
- Detecta o identificador do caminhao pelo nome do arquivo (ex: "CYR" de "CYR10.02.26.xls")
- Salva no banco com RLS por user_id

**Arquivo:** `src/pages/Settings.tsx`
- Nova aba "Historico" para acessar o importador de roteiros

### Como o sistema usa o historico

**Arquivo:** `src/lib/autoRouterEngine.ts`
- Antes de compor rotas, consultar `route_history_patterns` para ver quais cidades costumam ir juntas no mesmo caminhao
- Se historicamente Barueri e Jandira iam juntas no caminhao CYR, o sistema aprende esse padrao e sugere a mesma combinacao
- O peso do historico influencia o score de clustering, mas nao impede ajustes manuais

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/autoRouterEngine.ts` | Substituir clustering por angulo por clustering por cidade |
| `src/lib/geocoding.ts` | Melhorar extracao de cidade dos enderecos |
| `src/types/index.ts` | Adicionar campo `city` ao `ParsedOrder` |
| `src/components/route/RouteHistoryImporter.tsx` | Novo: importador de roteiros historicos |
| `src/pages/Settings.tsx` | Adicionar aba "Historico" |
| Migracao SQL | Criar tabela `route_history_patterns` com RLS |

---

## Ordem de Implementacao

1. Regionalizacao por cidade no motor de roteamento (impacto imediato)
2. Criacao da tabela de historico no banco
3. Importador de roteiros historicos
4. Integracao do historico no algoritmo de composicao

## Resultado Esperado

- Ao roteirizar, cada caminhao recebera entregas de uma cidade (ou cidades proximas se a carga permitir)
- O usuario podera carregar roteiros antigos feitos pelo analista para que o sistema aprenda os padroes
- Com o tempo, o sistema sugere composicoes cada vez mais proximas do que o analista humano faria
