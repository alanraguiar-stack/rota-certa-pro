

# Plano: Painel de Territórios por Caminhão (Configurações)

## Objetivo

Criar uma nova aba "Territórios" em Configurações onde o operador configura, para cada caminhão ativo, qual é sua **cidade âncora** e quais são as **cidades secundárias** (fill). O sistema já vem pré-configurado com as regras atuais do `anchorRules.ts`, mas permite ajustes via UI. As configurações são salvas no banco e o motor de roteirização as consome em vez das regras hardcoded.

## Como funciona

- Lista todos os caminhões ativos (da tabela `trucks`)
- Para cada caminhão, o operador escolhe:
  - **Cidade Âncora** (select com todas as cidades conhecidas + opção "Apoio/Sem âncora")
  - **Cidades Secundárias** (multi-select com checkboxes)
- Valores padrão pré-populados conforme as regras existentes:
  - Barueri → fill: Cotia, Vargem Grande Paulista
  - Osasco (TRC1Z00) → sem fill cities
  - Carapicuíba → sem fill cities
  - Jandira → fill: Itapevi
  - Embu → fill: Embu das Artes
  - Apoio → fill: Pirapora, Santana de Parnaíba, Taboão, São Paulo

## Mudanças

### 1. Migration: tabela `truck_territories`

```sql
CREATE TABLE public.truck_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  truck_id uuid NOT NULL,
  anchor_city text NOT NULL DEFAULT '',
  fill_cities text[] NOT NULL DEFAULT '{}',
  max_deliveries integer NOT NULL DEFAULT 25,
  priority integer NOT NULL DEFAULT 50,
  is_support boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE truck_territories ENABLE ROW LEVEL SECURITY;
-- CRUD policies for own records (user_id = auth.uid())
```

Unique constraint em `(user_id, truck_id)` para garantir uma config por caminhão.

### 2. Novo componente: `src/components/settings/TruckTerritoryTab.tsx`

- Busca caminhões ativos via `useTrucks()`
- Busca configs salvas de `truck_territories`
- Se não existe config para um caminhão, mostra os defaults baseados em `TERRITORY_RULES` (match por `fixedPlate` ou por ordem de prioridade)
- Card por caminhão com:
  - Placa + modelo (header)
  - Select: Cidade Âncora (lista de todas as cidades do `anchorRules` + campo livre)
  - Checkboxes: Cidades secundárias
  - Input: Max entregas (default 25)
- Botão "Salvar" que faz upsert em `truck_territories`
- Botão "Resetar para Padrão" que apaga os registros e volta aos defaults

### 3. Hook: `src/hooks/useTruckTerritories.ts`

- Query para buscar `truck_territories` do user
- Mutation para salvar (upsert)
- Mutation para resetar (delete all)
- Função `getTerritoryForTruck(plate)` que retorna a config salva ou o default do `anchorRules.ts`

### 4. Integrar no motor: `src/lib/autoRouterEngine.ts`

- Antes de usar `TERRITORY_RULES`, verificar se existem configs do banco
- Se existem, construir `TerritoryRule[]` a partir dos dados salvos em `truck_territories`, substituindo as regras hardcoded
- As regras avançadas (neighborhoodFills, neighborhoodExceptions, excludedNeighborhoods, priorityNeighborhoods) continuam hardcoded por enquanto — o painel gerencia apenas cidade âncora + fill cities

### 5. Aba em Settings

- Adicionar tab "Territórios" com ícone `MapPin` entre "Calendário" e "Produtos"
- `TabsList` passa de `grid-cols-5 lg:grid-cols-6` para `grid-cols-6 lg:grid-cols-7`

## Defaults pré-populados (primeira vez)

| Caminhão | Âncora | Fill Cities |
|---|---|---|
| TRC1Z00 | Osasco | — |
| FIO0R12 | Barueri (Parque Viana) | Jandira, Itapevi |
| Outros (por ordem) | Barueri, Carapicuíba, Jandira, Embu | conforme anchorRules |
| Último | Apoio | Pirapora, Santana de Parnaíba, Taboão, São Paulo |

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Nova tabela `truck_territories` com RLS |
| `src/hooks/useTruckTerritories.ts` | Novo — CRUD do banco |
| `src/components/settings/TruckTerritoryTab.tsx` | Novo — UI do painel |
| `src/pages/Settings.tsx` | Adicionar aba "Territórios" |
| `src/lib/autoRouterEngine.ts` | Consumir configs do banco quando disponíveis |

