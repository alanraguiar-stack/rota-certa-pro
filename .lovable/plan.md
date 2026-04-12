

# Blindar Romaneio de Carga + Botão para avançar ao Romaneio de Entrega

## O que muda

### 1. Botão "Avançar para Romaneio de Entrega" na Etapa 4

Após o ADV ser importado com sucesso, adicionar um botão proeminente abaixo do `LoadingManifest` que:
- Atualiza o status da rota para `distributed` no banco
- Faz `refetch()` para o stepper avançar automaticamente para a Etapa 5
- Só aparece quando existem `order_items` vinculados (ADV já importado)

**Arquivo:** `src/pages/RouteDetails.tsx` (dentro do bloco `activeStep === 'import_adv'`, após o `LoadingManifest`)

### 2. Blindar a Etapa 4 contra alterações indevidas

- Desabilitar o botão de upload do ADV se já existirem items importados, mostrando badge "Importado" + botão secundário "Reimportar" com confirmação (`confirm()`)
- Isso impede reimportação acidental sem permissão explícita

**Arquivo:** `src/pages/RouteDetails.tsx` (no `ADVUploadSection` ou na lógica ao redor)

### 3. Corrigir separador de fase no stepper

O separador de fase está no index 3 (`import_adv`), mas deveria estar no index 4 (`delivery_manifest`) — a fase "Roteirização" começa no romaneio de entrega, não no romaneio de carga.

**Arquivo:** `src/components/route/RouteWorkflowStepper.tsx` — mudar `showPhaseSeparator` de `index === 3` para `index === 4`

### 4. Blindar etapas anteriores

Quando o status é `loading_confirmed` ou posterior:
- Na Etapa 2 e 3, não permitir edições (mover pedidos, reordenar) — os componentes já recebem props como `isLocked`, basta não renderizá-los ou desabilitar interação

## Resultado

- Romaneio de carga fica protegido após importação do ADV
- Botão claro para avançar para o romaneio de entrega
- Fluxo linear sem ambiguidade

