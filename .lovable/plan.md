

# Correcao: Motor de Roteirizacao Territorial Rigido

## Problema Identificado

O caminhao CYR (Osasco) esta recebendo entregas de cidades nao autorizadas. A raiz do problema esta em tres pontos:

1. **Excecoes de bairro sem cidade definida**: As `neighborhoodExceptions` (Jaguare, Parque Imperial para CYR) buscam bairros em TODAS as cidades. Se um bairro "Jaguare" aparece em Sao Paulo, o sistema puxa essa entrega para CYR sem verificar se a cidade e permitida.

2. **Validacao contradiz a alocacao**: A validacao em `validateComposition` verifica se todas as cidades estao em `allowedCities`, mas as excecoes de bairro adicionam cidades fora dessa lista, gerando violacao.

3. **Falta de rigidez territorial**: O motor nao impoe de forma absoluta que cada caminhao APENAS receba entregas de sua cidade ancora + cidades de encaixe explicitamente definidas.

## Solucao

### 1. `src/lib/anchorRules.ts` - Adicionar cidade de origem nas excecoes de bairro

Cada `NeighborhoodException` precisa declarar de qual cidade o bairro pertence. Isso evita que bairros homonimos de outras cidades sejam puxados indevidamente.

```text
interface NeighborhoodException {
  neighborhood: string;
  city: string;              // NOVO: cidade de onde vem o bairro
  maxDeliveries: number;
  insertAfterNeighborhood?: string;
}
```

Atualizar as regras:
- CYR: `jaguare` e `parque imperial` pertencem a `sao paulo`
- FKD: `metalurgicos` pertence a `osasco`, `vila do conde` pertence a `barueri` (ou a cidade correta - confirmar com dados)

### 2. `src/lib/autoRouterEngine.ts` - Reforcamento territorial absoluto

**Excecoes de bairro (linhas 242-260)**: Adicionar filtro por cidade na busca de excecoes. Antes de testar o bairro, verificar se a cidade do pedido corresponde a `exception.city`.

**Validacao (linhas 498-517)**: Ao construir `allowedCities`, incluir as cidades das excecoes de bairro. Assim a validacao nao contradiz a alocacao.

**Pedidos restantes (linhas 366-420)**: Caminhoes nao-ancora que recebem pedidos remanescentes devem manter blocos por cidade, sem misturar cidades aleatoriamente. Adicionar agrupamento estrito.

### 3. `src/lib/autoRouterEngine.ts` - Sequenciamento revisado

O sequenciamento ja esta correto (cidade ancora primeiro, blocos continuos). Apenas garantir que a validacao de alternancia funcione corretamente apos as correcoes de alocacao.

### 4. `src/components/route/AutoCompositionView.tsx` - Sem mudanca

O componente de visualizacao ja exibe corretamente badges de ancora, complemento e violacoes. Nenhuma alteracao necessaria.

## Detalhes Tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/anchorRules.ts` | Adicionar campo `city` em `NeighborhoodException`; atualizar regras CYR e FKD |
| `src/lib/autoRouterEngine.ts` | Filtrar excecoes de bairro por cidade; incluir cidades de excecao em `allowedCities` na validacao; remover logica de caminhoes nao-ancora que mistura cidades |

## Resultado

- CYR recebera APENAS: entregas de Osasco + ate 2 entregas dos bairros Jaguare/Parque Imperial **de Sao Paulo especificamente**
- EUR recebera APENAS: Barueri + Jandira/Itapevi/Cotia/Vargem Grande Paulista
- FKD recebera APENAS: Carapicuiba + excecoes de bairro definidas
- EEF recebera: suas cidades proprias + todos os excedentes
- Nenhuma mistura aleatoria de cidades sera possivel

