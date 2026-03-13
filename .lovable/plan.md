

# Botões de navegação individual + Fluxo de confirmação com observações

## Contexto

Atualmente o botão "Iniciar Roteiro" abre o Google Maps com todas as paradas de uma vez, o que não funciona bem. Os botões rápidos de confirmar/rejeitar não pedem motivo.

## Mudanças

### 1. DeliveryCard — Botões Waze e Google Maps por endereço

Adicionar dois botões pequenos (ícones) no card de cada entrega pendente:
- **Google Maps**: `https://www.google.com/maps/dir/?api=1&destination={endereço}`
- **Waze**: `https://waze.com/ul?q={endereço}&navigate=yes`

Ambos abrem em nova aba. Substituem o botão global "Iniciar Roteiro" / "Continuar no Maps".

### 2. Fluxo de confirmação inline no DriverDashboard

Ao clicar em "Entregue" ou "Não Entregue" nos botões rápidos:
- Abrir um **Dialog** no próprio dashboard (sem navegar para outra página)
- **Entregue**: campo de observação **opcional** + botão confirmar
- **Não Entregue**: campo de motivo **obrigatório** (mínimo 1 caractere) + botão confirmar
- As observações ficam salvas no campo `observations` da `delivery_executions`

### 3. ExecutionTracker — Mostrar observações no painel do analista

No acompanhamento de execução, quando uma entrega tiver `observations`, exibir um ícone/badge clicável que mostra a observação. Isso permite ao analista ver ocorrências por entrega.

### 4. Remover botão global de rota

Remover o botão "Iniciar Roteiro" / "Continuar no Maps" que tenta abrir rota com todas as paradas. Manter apenas a lógica de `startRoute` para mudar o status para "em_andamento".

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/driver/DeliveryCard.tsx` | Adicionar botões Waze/Google Maps individuais por endereço |
| `src/pages/DriverDashboard.tsx` | Dialog de confirmação com observações; remover botão global de rota; adicionar botão "Iniciar Rota" que só muda status |
| `src/components/route/ExecutionTracker.tsx` | Mostrar observações das entregas no painel do analista |

