
# Corrigir Sequenciamento de Entregas: Cidade por Cidade, CEP por CEP

## Problema Identificado

A sequencia atual das entregas esta pulando entre cidades de forma caotica. Exemplo real do caminhao atual:

```text
1. Cotia
2. Cotia
3. OSASCO  <-- pula para Osasco
4. Cotia   <-- volta para Cotia
5. JANDIRA <-- pula para Jandira
6. OSASCO  <-- volta para Osasco
7. CAIEIRAS <-- pula para Caieiras (longe!)
8. OSASCO  <-- volta para Osasco
```

### Causa Raiz

O sistema gera coordenadas **falsas** baseadas em hash do texto do endereco (funcao `estimateCoordinates` em `geocoding.ts`). Todas as cidades caem numa area de ~20km ao redor de Barueri, entao o algoritmo de "vizinho mais proximo" nao consegue distinguir Cotia de Caieiras. O resultado e uma rota que zigzagueia entre municipios.

## Solucao: Sequenciamento Hierarquico (Cidade > CEP > Bairro)

Reescrever a logica de sequenciamento para funcionar em 3 niveis, sem depender de coordenadas falsas:

### Nivel 1 - Agrupar por Cidade
Todas as entregas da mesma cidade ficam juntas, sem excecao.

### Nivel 2 - Ordenar Cidades por Proximidade ao CD
As cidades sao ordenadas pela distancia real ao CD (Barueri). Cidades vizinhas ao CD vem primeiro (para `start_near`) ou por ultimo (para `start_far`).

### Nivel 3 - Dentro de cada Cidade, Ordenar por CEP/Bairro
Dentro da mesma cidade, agrupar por prefixo do CEP (primeiros 5 digitos = mesma regiao) e depois por bairro.

## Mapa de Proximidade de Cidades

Criar um mapa de coordenadas reais dos centros das cidades da regiao metropolitana de SP, em vez de usar hashes:

| Cidade | Lat | Lng | Distancia do CD |
|--------|-----|-----|-----------------|
| Barueri (CD) | -23.5115 | -46.8754 | 0 km |
| Osasco | -23.5325 | -46.7917 | ~8 km |
| Carapicuiba | -23.5235 | -46.8356 | ~4 km |
| Jandira | -23.5278 | -46.9024 | ~3 km |
| Cotia | -23.6038 | -46.9191 | ~11 km |
| Santana de Parnaiba | -23.4443 | -46.9173 | ~8 km |
| Embu | -23.6490 | -46.8522 | ~15 km |
| Taboao da Serra | -23.6019 | -46.7582 | ~14 km |
| Caieiras | -23.3643 | -46.7403 | ~20 km |
| Sao Paulo | -23.5505 | -46.6339 | ~24 km |
| (e mais...) | | | |

## Mudancas Tecnicas

### Arquivo 1: `src/lib/geocoding.ts`

**Adicionar** mapa de coordenadas reais de cidades (`CITY_COORDINATES`):
- Tabela com lat/lng do centro de ~30 cidades da Grande SP
- Funcao `getCityCoordinates(cityName)` que busca nesse mapa
- Funcao `getCityDistanceFromCD(cityName)` para calcular distancia real

**Alterar** `estimateCoordinates`:
- Usar as coordenadas reais da CIDADE como base
- Aplicar micro-offsets baseados em CEP e bairro DENTRO da cidade
- Resultado: enderecos da mesma cidade ficam proximos, de cidades diferentes ficam distantes

### Arquivo 2: `src/lib/routing.ts`

**Reescrever** `optimizeDeliveryOrder` e `nearestNeighborRoute`:
- Primeiro agrupar por cidade (extrair cidade do endereco parseado)
- Ordenar as cidades pela distancia ao CD conforme a estrategia
- Dentro de cada cidade, aplicar nearest-neighbor usando CEP como criterio principal
- Bonus forte para mesmo bairro e mesmo prefixo CEP

### Arquivo 3: `src/lib/distribution.ts`

**Corrigir** `clusterByGeographicProximity`:
- Substituir clustering por angulo (que usa coordenadas falsas) por clustering por cidade real
- Usar a mesma logica de agrupamento por cidade do `autoRouterEngine.ts`

**Corrigir** `reorderDeliveriesByStrategy`:
- Remover a ordenacao alfabetica (que e um "proxy" incorreto)
- Usar o mesmo sequenciamento hierarquico: cidade > CEP > bairro

## Resultado Esperado

Para o mesmo caminhao, a sequencia ficaria:

```text
 1. Barueri - R. Abelardo Luz (cidade do CD, primeiro)
 2. Barueri - R. Limoeiro
 3. Barueri - R. Zeca
 4. Barueri - R. Nova Aurora
 5. Carapicuiba - R. Laerte Cearense (cidade vizinha)
 6. Carapicuiba - Est. Fazendinha
 7. Carapicuiba - Est. do Copiuva
 8. Jandira - R. Amaralina
 9. Osasco - Rua Assemblea de Deus
10. Osasco - Est. dos Jasmins
11. Osasco - R. Quero-Quero
12. Cotia - Av. Prof. Jose Barreto (todas de Cotia juntas)
13. Cotia - R. Juiz de Fora
14. Cotia - R. Jorge Rizo
15. Cotia - R. Conde
16. Cotia - R. Francisco Moracci
17. Cotia - Av. Eng. Agenor Machado
...e assim por diante
```

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/lib/geocoding.ts` | Adicionar mapa de cidades reais + corrigir `estimateCoordinates` para usar centro da cidade |
| `src/lib/routing.ts` | Reescrever sequenciamento: cidade > CEP > bairro, sem coordenadas falsas |
| `src/lib/distribution.ts` | Corrigir clustering e `reorderDeliveriesByStrategy` para usar cidade real |
