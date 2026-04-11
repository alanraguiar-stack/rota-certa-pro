

# Mover upload do ADV para DEPOIS da confirmação de rotas

## Situação atual

O fluxo atual tem 4 etapas no stepper:
1. Selecionar Caminhões
2. Distribuir Carga (com upload ADV aqui — posição errada)
3. Romaneio de Carga (editor de rotas + romaneio colapsável)
4. Romaneio de Entrega

O usuário quer que o ADV seja carregado **depois** de confirmar as rotas nos caminhões, não durante a distribuição. A lógica é: primeiro distribui, depois ajusta/confirma as rotas, e só então carrega o detalhamento para gerar o romaneio.

## Novo fluxo proposto

1. **Selecionar Caminhões** — sem mudança
2. **Distribuir Carga** — sem mudança, remover o ADVUploadSection daqui
3. **Confirmar Rotas** (atual `loading_manifest`) — editor de rotas por caminhão, botão confirmar. Quando confirma, avança para a etapa 4
4. **Importar ADV + Gerar Romaneio** — nova tela: upload do ADV proeminente, depois de importar mostra botão "Gerar Romaneio" que renderiza o LoadingManifest consolidado
5. **Romaneio de Entrega** — sem mudança

## Mudanças técnicas

### 1. `RouteWorkflowStepper.tsx`
- Adicionar novo step `import_adv` entre `loading_manifest` e `optimize_routes` (ou renomear)
- Atualizar `WORKFLOW_STEPS` para 6 etapas: `select_trucks` → `distribute_load` → `loading_manifest` (editor de rotas) → `import_adv` (upload ADV + romaneio) → `delivery_manifest`
- Remover `optimize_routes` que já não é usado
- Atualizar `getActiveStep` para incluir a nova etapa (usar status `loading_confirmed` para `import_adv`)

### 2. `RouteDetails.tsx`
- **Remover** `ADVUploadSection` da etapa `distribute_load`
- **Etapa `loading_manifest`**: manter o `TruckRouteEditor`, mas quando o usuário confirma rotas (`handleConfirmAllRoutesAndProceed`), o status vai para `loading_confirmed`, avançando para a nova etapa
- **Nova etapa `import_adv`**: mostrar o `ADVUploadSection` como elemento principal. Após importar, mostrar o `LoadingManifest` com o romaneio consolidado e botão para avançar para `delivery_manifest`

### 3. `handleConfirmAllRoutesAndProceed`
- Após otimizar e salvar padrões, atualizar status para `loading_confirmed` (se ainda não está) para que o stepper avance para `import_adv`

## Resultado
- Fluxo linear claro: distribui → confirma rotas → carrega ADV → vê romaneio → entrega
- O sistema já sabe qual caminhão tem quais vendas quando o ADV é carregado
- Romaneio só aparece após o upload do ADV, nunca vazio

