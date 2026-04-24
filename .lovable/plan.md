
# Permitir voltar para etapas anteriores clicando no stepper

## Comportamento desejado

Na tela de detalhes da rota, o usuário hoje vê o stepper com 5 etapas (Selecionar Caminhões → Distribuir Carga → Confirmar Rotas → Romaneio de Carga → Romaneio de Entrega), mas só consegue ver/editar a etapa correspondente ao status atual da rota. O usuário quer poder **clicar em qualquer etapa anterior já concluída** (ícones verdes) e voltar para visualizar/editar aquela seção, mantendo a rota viva no status real em que ela está.

## Princípios

- **Nada de "rebaixar" a rota no banco**: clicar em uma etapa anterior é um *override visual*. O status real da rota (`draft`, `loading_confirmed`, `distributed`, etc.) não muda só porque o usuário voltou para olhar.
- **Só etapas concluídas (verdes) e a ativa são clicáveis.** Etapas futuras (cinza) continuam não clicáveis.
- **A etapa ativa real continua destacada** mesmo quando o usuário está visualizando uma anterior, com um banner discreto avisando "Você está revendo a etapa X — voltar para a etapa atual".
- **Ações destrutivas não são reexecutadas só por revisitar.** Se o usuário fizer uma alteração real numa etapa anterior (ex: trocar caminhões, redistribuir), aí sim o fluxo natural já existente cuida da consistência (esses handlers já existem hoje).

## Plano de implementação

### 1) Stepper passa a aceitar clique
**Arquivo**: `src/components/route/RouteWorkflowStepper.tsx`

- Adicionar prop opcional `onStepClick?: (step: RouteWorkflowStep) => void`.
- Adicionar prop opcional `viewStep?: RouteWorkflowStep` para indicar qual etapa está sendo *visualizada* (pode ser diferente da `activeStep`).
- Renderizar cada item como `<button>` quando `isCompleted` (verde) ou `isActive`, chamando `onStepClick(step.id)`.
- Etapas pendentes (`isPending`) continuam como `div` não-clicáveis.
- Adicionar destaque visual extra (ring sutil) na etapa que está sendo *visualizada* quando `viewStep` é diferente da `activeStep`, para o usuário enxergar de relance "estou aqui agora, mas o real é ali".
- Adicionar `cursor-pointer` + hover suave nas clicáveis.

### 2) Estado de "etapa visualizada" na página
**Arquivo**: `src/pages/RouteDetails.tsx`

- Adicionar estado `const [viewStep, setViewStep] = useState<RouteWorkflowStep | null>(null);`.
- Calcular `const displayStep = viewStep ?? activeStep;` — é o que controla qual seção é renderizada.
- Trocar **todas** as condicionais que hoje fazem `activeStep === 'select_trucks'`, `activeStep === 'distribute_load'`, `activeStep === 'loading_manifest'`, `activeStep === 'import_adv'`, `activeStep === 'delivery_manifest'` para usar `displayStep`.
- A condicional final do bloco final (`activeStep === 'delivery_manifest' || route.status === 'distributed' || route.status === 'completed'`) também passa a olhar `displayStep`.

### 3) Travar regressão
- `setViewStep` só pode ser chamado com uma etapa **igual ou anterior** à `activeStep`. Para etapas futuras à `activeStep`, ignora o clique.
- Se o usuário clicar de volta na própria `activeStep`, fazemos `setViewStep(null)` (volta ao modo normal).

### 4) Banner de "modo revisão"
Quando `viewStep && viewStep !== activeStep`, renderizar logo abaixo do stepper um aviso curto:

> Você está revendo a etapa **"<título>"**. A rota continua na etapa **"<título atual>"**.  
> Botão: **Voltar para a etapa atual**

Clicar no botão faz `setViewStep(null)`.

### 5) Limpar `viewStep` em mudança real
Sempre que a `activeStep` real avançar (porque o usuário fez uma ação que mudou o status da rota), resetar `viewStep` para `null`, evitando que o usuário fique "preso" numa etapa antiga depois de avançar de verdade. Implementar com `useEffect` observando `activeStep`.

### 6) Passar handlers para o stepper
Na chamada existente:

```tsx
<RouteWorkflowStepper 
  route={route} 
  hasTrucks={hasTrucks} 
  hasAssignments={hasAssignments}
  viewStep={viewStep ?? undefined}
  onStepClick={(step) => {
    // só aceita etapas <= activeStep
    const order = ['select_trucks','distribute_load','loading_manifest','import_adv','delivery_manifest'];
    if (order.indexOf(step) <= order.indexOf(activeStep)) {
      setViewStep(step === activeStep ? null : step);
    }
  }}
/>
```

### 7) Remover/atualizar botão "Voltar" hoje confuso
O `handleGoBack` atual (linhas ~503-516) só mostra um toast informando "Use o wizard para refazer". Com a nova navegação clicável no stepper, esse comportamento fica redundante — manter o botão Voltar do header para sair da rota, mas o atalho de "etapa anterior" agora é o próprio clique no stepper.

## Arquivos editados
- `src/components/route/RouteWorkflowStepper.tsx` — clique + destaque de etapa visualizada
- `src/pages/RouteDetails.tsx` — estado `viewStep`, troca de `activeStep`→`displayStep` nas seções, banner de revisão

## Resultado
- Clicar numa etapa verde no stepper → a tela mostra aquela seção (ex: voltar de "Romaneio de Carga" para "Distribuir Carga" e ajustar a alocação).
- Etapas futuras continuam bloqueadas — não dá pra "pular" pra frente.
- O status real da rota no banco não é alterado só por revisitar uma etapa.
- Banner deixa claro quando o usuário está em modo revisão e oferece um clique pra voltar ao "agora".
