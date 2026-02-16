
# Modulo de Execucao de Rotas com Google Maps

## Analise de Viabilidade

Sim, e **100% possivel** implementar este modulo com a stack atual. Abaixo esta o detalhamento completo.

---

## Requisitos Externos

### Google Maps API Key
- Necessario para abrir rotas com multiplas paradas no Google Maps
- **Nao e necessario integrar o SDK do Google Maps no app** -- basta abrir URLs do tipo `https://www.google.com/maps/dir/...` com as paradas sequenciadas
- Isso funciona **sem API key** em dispositivos moveis (abre o app Google Maps diretamente)
- Opcao zero-custo: usar deep links do Google Maps

### Armazenamento de Fotos e Assinaturas
- Criar um bucket no Supabase Storage para fotos de entrega e assinaturas
- As imagens sao salvas como arquivos, nao no banco de dados

---

## Mudancas no Banco de Dados

### 1. Novo role: `motorista`

Adicionar ao enum `app_role`:

```text
ALTER TYPE app_role ADD VALUE 'motorista';
```

### 2. Nova tabela: `driver_assignments`

Vincula motorista a um route_truck (caminhao + rota).

```text
id              uuid PK
route_truck_id  uuid FK -> route_trucks
driver_user_id  uuid FK -> auth.users
status          text (pendente, em_andamento, finalizada)
started_at      timestamp
finished_at     timestamp
created_at      timestamp
```

### 3. Nova tabela: `delivery_executions`

Registra a execucao de cada entrega individual.

```text
id              uuid PK
driver_assignment_id  uuid FK -> driver_assignments
order_id        uuid FK -> orders
status          text (pendente, concluida, nao_entregue)
delivered_at    timestamp
signature_url   text (URL do Storage)
photo_url       text (URL do Storage)
observations    text
created_at      timestamp
```

### 4. Storage bucket: `delivery-proofs`

Bucket publico para armazenar fotos e assinaturas capturadas pelo motorista.

### 5. RLS

- `driver_assignments`: motorista ve apenas as suas; admin ve todas
- `delivery_executions`: motorista manipula apenas as vinculadas a ele; admin ve todas
- `delivery-proofs` bucket: motorista faz upload; todos autenticados podem ler

---

## Novos Componentes e Paginas

### Pagina: `/motorista` (Dashboard do Motorista)

Tela otimizada para celular exibindo:
- Caminhao designado
- Data da rota
- Lista de entregas em ordem com status (pendente/concluida)
- Botao "Iniciar Roteiro" (abre Google Maps com todas as paradas)
- Progresso visual (X de Y entregas concluidas)

### Pagina: `/motorista/entrega/:id` (Confirmacao de Entrega)

- Informacoes do cliente e endereco
- Captura de assinatura (canvas touch)
- Captura de foto (input camera nativo do celular)
- Campo de observacoes
- Botao "Confirmar Entrega" (salva timestamp + evidencias)
- Botao "Ir para Proxima Entrega" (abre Google Maps para proximo destino)

### Componente: `SignatureCanvas`

Canvas HTML5 para captura de assinatura por toque, com botao limpar e exportacao para PNG.

### Pagina do Admin: Acompanhamento de Execucao

Na pagina de detalhes da rota (`/rota/:id`), nova aba/secao:
- Status da rota (nao iniciada / em andamento / finalizada)
- Status de cada entrega com horario real
- Visualizacao das evidencias (assinatura + foto)
- Botao para gerar relatorio PDF de execucao

---

## Integracao com Google Maps (Zero Custo)

Usar deep links ao inves de SDK:

```text
https://www.google.com/maps/dir/?api=1
  &origin=CD_ADDRESS
  &destination=LAST_STOP
  &waypoints=STOP1|STOP2|STOP3
  &travelmode=driving
```

Isso abre o app Google Maps no celular automaticamente, com todas as paradas na ordem. O motorista navega pelo Google Maps e volta ao app para confirmar cada entrega.

---

## Fluxo Completo

```text
Admin planeja rota
        |
Admin atribui motorista + caminhao
        |
Status: "empenhada" (bloqueada)
        |
Motorista ve rota no dashboard
        |
Clica "Iniciar Roteiro"
        |
Google Maps abre com todas paradas
        |
Motorista chega na 1a parada
        |
Volta ao app -> Confirma entrega
  (assinatura + foto + timestamp)
        |
Clica "Proxima Entrega"
        |
Google Maps abre para 2a parada
        |
... repete para cada entrega ...
        |
Ultima entrega confirmada
        |
Status: "finalizada"
        |
Admin ve relatorio completo
```

---

## Arquivos Novos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/DriverDashboard.tsx` | Tela principal do motorista |
| `src/pages/DeliveryConfirmation.tsx` | Tela de confirmacao com assinatura/foto |
| `src/components/driver/SignatureCanvas.tsx` | Componente de captura de assinatura |
| `src/components/driver/DeliveryCard.tsx` | Card de entrega na lista do motorista |
| `src/components/route/DriverAssignment.tsx` | Componente para admin atribuir motorista |
| `src/components/route/ExecutionTracker.tsx` | Painel de acompanhamento para admin |
| `src/hooks/useDriverRoutes.ts` | Hook para consultas do motorista |

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Novas rotas /motorista e /motorista/entrega/:id |
| `src/hooks/useUserRole.ts` | Adicionar role 'motorista' ao tipo AppRole |
| `src/components/layout/AppSidebar.tsx` | Menu condicional por role |
| `src/pages/RouteDetails.tsx` | Secao de atribuicao de motorista e acompanhamento |
| `src/types/index.ts` | Novos tipos para execucao |
| Migracao SQL | Tabelas, enum, storage bucket, RLS |

---

## Ordem de Implementacao

1. Migracao SQL (enum, tabelas, storage, RLS)
2. Componente de atribuicao de motorista (admin)
3. Dashboard do motorista
4. Tela de confirmacao de entrega (assinatura + foto)
5. Integracao com Google Maps via deep links
6. Painel de acompanhamento para admin
7. Relatorio PDF de execucao

---

## Limitacoes e Observacoes

- **Rastreamento em tempo real do GPS**: Nao esta no escopo inicial. O admin ve o status das entregas (pendente/concluida), mas nao a localizacao em tempo real do motorista
- **Offline**: Se o motorista perder conexao, a confirmacao ficara pendente ate reconectar. Uma versao futura pode adicionar suporte offline com Service Worker
- **Notificacoes push**: Nao incluidas nesta versao, mas podem ser adicionadas depois
