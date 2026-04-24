import { Check, Truck, Package, ClipboardCheck, Route, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RouteWorkflowStep = 
  | 'select_trucks'
  | 'distribute_load'
  | 'loading_manifest'
  | 'import_adv'
  | 'delivery_manifest';

export interface WorkflowStepConfig {
  id: RouteWorkflowStep;
  title: string;
  description: string;
  icon: React.ElementType;
  phase: 'romaneio' | 'roteirizacao';
}

export const WORKFLOW_STEPS: WorkflowStepConfig[] = [
  { 
    id: 'select_trucks', 
    title: 'Selecionar Caminhões', 
    description: 'Escolha os veículos para a carga',
    icon: Truck,
    phase: 'romaneio',
  },
  { 
    id: 'distribute_load', 
    title: 'Distribuir Carga', 
    description: 'Alocar pedidos por caminhão',
    icon: Package,
    phase: 'romaneio',
  },
  { 
    id: 'loading_manifest', 
    title: 'Confirmar Rotas', 
    description: 'Ajustar e confirmar sequência de entrega',
    icon: ClipboardCheck,
    phase: 'romaneio',
  },
  { 
    id: 'import_adv', 
    title: 'Romaneio de Carga', 
    description: 'Importar ADV e gerar romaneio',
    icon: Upload,
    phase: 'romaneio',
  },
  { 
    id: 'delivery_manifest', 
    title: 'Romaneio de Entrega', 
    description: 'Documento para o motorista',
    icon: FileText,
    phase: 'roteirizacao',
  },
];

export function getStepConfig(step: RouteWorkflowStep): WorkflowStepConfig | undefined {
  return WORKFLOW_STEPS.find(s => s.id === step);
}

interface RouteForStepper {
  status: string;
  loading_confirmed_at?: string | null;
  loading_confirmed_by?: string | null;
}

export function getActiveStep(
  route: RouteForStepper | null, 
  hasTrucks: boolean,
  hasAssignments: boolean = false
): RouteWorkflowStep {
  if (!route) return 'select_trucks';
  
  if (!hasTrucks) return 'select_trucks';
  
  if (hasAssignments && (route.status === 'draft' || route.status === 'trucks_assigned')) {
    return 'loading_manifest';
  }
  
  switch (route.status) {
    case 'draft':
      return hasTrucks ? 'distribute_load' : 'select_trucks';
    case 'trucks_assigned':
      return 'distribute_load';
    case 'loading':
      return 'loading_manifest';
    case 'loading_confirmed':
      return 'import_adv';
    case 'distributed':
    case 'completed':
      return 'delivery_manifest';
    default:
      return 'select_trucks';
  }
}

export function isStepComplete(step: RouteWorkflowStep, activeStep: RouteWorkflowStep): boolean {
  const stepOrder = WORKFLOW_STEPS.map(s => s.id);
  const stepIndex = stepOrder.indexOf(step);
  const activeIndex = stepOrder.indexOf(activeStep);
  return stepIndex < activeIndex;
}

interface RouteWorkflowStepperProps {
  route: RouteForStepper | null;
  hasTrucks: boolean;
  hasAssignments?: boolean;
  /** Etapa que o usuário está visualizando (override visual). Se omitida, usa activeStep. */
  viewStep?: RouteWorkflowStep;
  /** Callback quando o usuário clica em uma etapa concluída ou na ativa. */
  onStepClick?: (step: RouteWorkflowStep) => void;
}

export function RouteWorkflowStepper({ route, hasTrucks, hasAssignments = false, viewStep, onStepClick }: RouteWorkflowStepperProps) {
  const activeStep = getActiveStep(route, hasTrucks, hasAssignments);
  const effectiveView = viewStep ?? activeStep;
  
  return (
    <div className="space-y-4">
      {/* Phase labels */}
      <div className="flex justify-between text-sm font-medium">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-primary">ROMANEIO DE CARGA</span>
          <span className="text-muted-foreground">(Logística Interna)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-success">ROTEIRIZAÇÃO</span>
          <span className="text-muted-foreground">(Logística Externa)</span>
        </div>
      </div>
      
      {/* Steps */}
      <div className="flex items-center gap-1">
        {WORKFLOW_STEPS.map((step, index) => {
          const isActive = step.id === activeStep;
          const isCompleted = isStepComplete(step.id, activeStep);
          const isPending = !isActive && !isCompleted;
          const isViewing = step.id === effectiveView && effectiveView !== activeStep;
          const isClickable = (isCompleted || isActive) && !!onStepClick;
          const StepIcon = step.icon;
          
          // Phase separator
          const showPhaseSeparator = index === 4; // Before "Romaneio de Entrega"
          
          const handleClick = () => {
            if (!isClickable) return;
            onStepClick!(step.id);
          };

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Phase separator before roteirização */}
              {showPhaseSeparator && (
                <div className="mx-2 flex flex-col items-center">
                  <div className="h-8 w-[2px] bg-muted-foreground/30" />
                </div>
              )}
              
              <button
                type="button"
                onClick={handleClick}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                aria-label={isClickable ? `Ir para etapa ${step.title}` : step.title}
                title={isClickable
                  ? (isViewing ? 'Você está revendo esta etapa' : `Ir para ${step.title}`)
                  : (isPending ? 'Etapa ainda não disponível' : step.title)
                }
                className={cn(
                  'flex flex-col items-center flex-1 bg-transparent border-0 p-0',
                  isClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
                  !isClickable && 'cursor-default'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-all',
                    isActive && step.phase === 'romaneio' && 'bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20',
                    isActive && step.phase === 'roteirizacao' && 'bg-success text-success-foreground shadow-lg ring-4 ring-success/20',
                    isCompleted && 'bg-success text-success-foreground',
                    isPending && 'bg-muted text-muted-foreground',
                    // Anel laranja (warning) sutil quando o usuário está revendo essa etapa
                    isViewing && 'ring-4 ring-warning/40 ring-offset-1 ring-offset-background'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="mt-2 text-center hidden lg:block">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isActive && step.phase === 'romaneio' && 'text-primary',
                      isActive && step.phase === 'roteirizacao' && 'text-success',
                      isCompleted && 'text-success',
                      isPending && 'text-muted-foreground',
                      isViewing && 'text-warning'
                    )}
                  >
                    {step.title}
                  </p>
                </div>
              </button>
              
              {/* Connector line */}
              {index < WORKFLOW_STEPS.length - 1 && !showPhaseSeparator && index !== 3 && (
                <div
                  className={cn(
                    'h-0.5 w-full max-w-8',
                    isCompleted ? 'bg-success' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
