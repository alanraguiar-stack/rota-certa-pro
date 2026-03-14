

# Plano: Aprendizado de Ajustes Manuais + Link do Motorista na Atribuição

## Duas funcionalidades

### 1. Aprender ajustes manuais de sequência/posição

**Problema**: Quando o operador reordena entregas ou move pedidos entre caminhões no `TruckRouteEditor`, essas decisões manuais se perdem. O sistema não aprende com esses ajustes.

**Solução**: Ao confirmar todas as rotas (`handleConfirmAllRoutesAndProceed`), salvar automaticamente um snapshot das posições finais na tabela `route_history_patterns` existente. Isso alimenta o motor de padrões (`historyPatternEngine`) que já analisa co-ocorrência de cidades, corredores regionais e sequenciamento.

**Implementação**:
- Em `RouteDetails.tsx`, dentro de `handleConfirmAllRoutesAndProceed`, após otimizar as rotas, inserir os dados finais de cada `order_assignment` na tabela `route_history_patterns` com:
  - `truck_label` = placa do caminhão
  - `city`, `client_name`, `address`, `neighborhood` = dados do pedido
  - `sequence_order` = posição final após ajustes
  - `route_date` = data da rota
  - `user_id` = usuário logado
- Isso acontece de forma transparente, sem UI adicional
- O motor existente (`historyPatternEngine.ts`) já consome esses dados para gerar hints, corredores e validação de combinações

### 2. Exibir link do motorista após atribuição

**Problema**: Após empenhar a rota e atribuir motoristas, o administrador precisa ir a Configuracoes para copiar o link de acesso, e isso estava dando erro.

**Solução**: Após a atribuição bem-sucedida no `DriverAssignment.tsx`, mostrar diretamente o link de acesso e a senha de cada motorista atribuído, com botoes de copiar.

**Implementacao**:
- Em `DriverAssignment.tsx`, após `handleAssign` com sucesso, buscar os `driver_access_codes` dos motoristas atribuídos
- Exibir inline para cada caminhão com motorista atribuído:
  - Link de acesso: `/motorista/acesso/RC-XXXX`
  - Senha do motorista
  - Botões de copiar para ambos
- Isso elimina a necessidade de ir a Configurações

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | Salvar snapshot no `route_history_patterns` ao confirmar rotas |
| `src/components/route/DriverAssignment.tsx` | Exibir link + senha do motorista após atribuição |

