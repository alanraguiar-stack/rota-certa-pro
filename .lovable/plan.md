
# Plano: Romaneio de Carga com Dados e Fluxo Simplificado

## Problemas Identificados

### Problema 1: Romaneio Vazio
Os itens (`order_items`) estão vazios na rota atual porque ela foi criada **antes** da correção que fizemos. A correção de adicionar `items: o.items` no `RouteDetails.tsx` já foi aplicada, mas só funciona para **novas rotas criadas após a correção**.

A rota atual (`33645b0b-...`) mostra:
- `item_id: <nil>` 
- `product_name: <nil>` 
- Todos os 26 pedidos sem itens detalhados

### Problema 2: Fluxo Obrigatório de Confirmação
O sistema atual **exige** que o carregamento seja confirmado antes de mostrar o Romaneio de Entrega. O usuário quer que **ambos documentos** (Romaneio de Carga e Romaneio de Entrega) fiquem disponíveis ao mesmo tempo.

O fluxo atual é:
```text
loading_manifest → confirm_loading → optimize_routes → delivery_manifest
```

O usuário quer:
```text
loading_manifest → [optimize_routes + delivery_manifest simultaneamente]
```

## Solução

### Parte 1: Simplificar o Fluxo de Workflow

Remover a etapa obrigatória de confirmação de carregamento e permitir que a roteirização e ambos os romaneios sejam acessíveis após a distribuição de carga.

### Parte 2: Mostrar Ambos Romaneios Lado a Lado

Na etapa de `loading_manifest`, já mostrar o botão para roteirizar e após a roteirização, exibir ambos os documentos simultaneamente.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/components/route/RouteWorkflowStepper.tsx` | Editar | Remover etapa obrigatória de confirmação, simplificar fluxo |
| `src/pages/RouteDetails.tsx` | Editar | Permitir roteirização direta após loading_manifest, remover bloqueio |

## Mudanças Técnicas

### 1. RouteWorkflowStepper.tsx

**Simplificar as etapas do workflow:**

```typescript
// ANTES - 6 etapas com confirmação obrigatória
const WORKFLOW_STEPS: WorkflowStepConfig[] = [
  { id: 'select_trucks', ... },
  { id: 'distribute_load', ... },
  { id: 'loading_manifest', ... },
  { id: 'confirm_loading', ... },  // ← REMOVER
  { id: 'optimize_routes', ... },
  { id: 'delivery_manifest', ... },
];

// DEPOIS - 5 etapas sem confirmação obrigatória
const WORKFLOW_STEPS: WorkflowStepConfig[] = [
  { id: 'select_trucks', ... },
  { id: 'distribute_load', ... },
  { id: 'loading_manifest', ... },  // Já permite roteirizar daqui
  { id: 'optimize_routes', ... },
  { id: 'delivery_manifest', ... },
];
```

**Ajustar a função `getActiveStep`:**

```typescript
// ANTES
case 'loading_confirmed':
  return 'optimize_routes';

// DEPOIS
case 'loading':
  return 'loading_manifest'; // Ou 'optimize_routes' direto
case 'loading_confirmed':
  return 'optimize_routes'; // Manter compatibilidade
```

### 2. RouteDetails.tsx

**Na etapa de `loading_manifest`, adicionar botão para roteirizar diretamente:**

```typescript
// Na etapa loading_manifest, após mostrar o romaneio de carga
{activeStep === 'loading_manifest' && (
  <div className="space-y-6">
    {/* Romaneio de Carga */}
    <LoadConsolidationView ... />
    <LoadingManifest ... />
    
    {/* Botão para roteirizar diretamente (sem confirmar) */}
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Pronto para roteirizar?</p>
            <p className="text-sm text-muted-foreground">
              Defina a ordem de entrega e gere o Romaneio de Entrega
            </p>
          </div>
          <Button onClick={handleOptimizeRoutes}>
            Roteirizar Agora
          </Button>
        </div>
      </CardContent>
    </Card>
    
    {/* Confirmação de carregamento - OPCIONAL */}
    <LoadingConfirmation ... />
  </div>
)}
```

**Ajustar `handleOptimizeRoutes` para funcionar sem confirmação:**

```typescript
// Não exigir mais status 'loading_confirmed' para roteirizar
const handleOptimizeRoutes = async () => {
  await optimizeRoutes.mutateAsync(routingStrategy);
  await refetch();
};
```

### 3. Atualizar Workflow Order

```typescript
// ANTES
const WORKFLOW_ORDER: RouteWorkflowStep[] = [
  'select_trucks',
  'distribute_load',
  'loading_manifest',
  'confirm_loading',  // ← REMOVER
  'optimize_routes',
  'delivery_manifest',
];

// DEPOIS
const WORKFLOW_ORDER: RouteWorkflowStep[] = [
  'select_trucks',
  'distribute_load',
  'loading_manifest',
  'optimize_routes',
  'delivery_manifest',
];
```

## Novo Fluxo Visual

```text
┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐
│ Selecionar      │ → │ Distribuir       │ → │ Romaneio de Carga │
│ Caminhões       │   │ Carga            │   │ + Roteirizar      │
└─────────────────┘   └──────────────────┘   └───────────────────┘
                                                      │
                                                      v
                                             ┌───────────────────┐
                                             │ Romaneio de       │
                                             │ Entrega (Final)   │
                                             └───────────────────┘
```

## Sobre Rotas Existentes

A rota atual (`33645b0b-...`) **não terá os itens preenchidos** porque foi criada antes da correção. Para ver o Romaneio de Carga com itens detalhados:

1. **Criar uma nova rota** com dados importados, ou
2. **Inserir manualmente** os itens na tabela `order_items` para os pedidos existentes

## Resultado Esperado

1. Após distribuir a carga, o usuário vê o Romaneio de Carga
2. Pode imediatamente clicar em "Roteirizar" sem precisar confirmar carregamento
3. Após roteirização, ambos os romaneios ficam visíveis
4. Confirmação de carregamento continua disponível como **opcional** para governança interna

