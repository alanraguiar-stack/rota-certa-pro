import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteWizardStep, WIZARD_STEPS } from '@/types';

interface WizardStepperProps {
  currentStep: RouteWizardStep;
  completedSteps: RouteWizardStep[];
  onStepClick?: (step: RouteWizardStep) => void;
}

export function WizardStepper({ currentStep, completedSteps, onStepClick }: WizardStepperProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between gap-2">
      {WIZARD_STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.includes(step.id);
        const isPending = !isActive && !isCompleted;
        const isClickable = isCompleted && onStepClick;

        return (
          <div
            key={step.id}
            className={cn(
              'flex flex-1 items-center',
              index < WIZARD_STEPS.length - 1 && 'gap-2'
            )}
          >
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                'flex flex-col items-center gap-1.5 transition-all',
                isClickable && 'cursor-pointer hover:opacity-80',
                !isClickable && 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all',
                  isActive && 'bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20',
                  isCompleted && 'bg-success text-success-foreground',
                  isPending && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.number}
              </div>
              <div className="hidden text-center sm:block">
                <p
                  className={cn(
                    'text-xs font-medium',
                    isActive && 'text-primary',
                    isCompleted && 'text-success',
                    isPending && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </p>
              </div>
            </button>

            {/* Connector line */}
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1',
                  index < currentIndex ? 'bg-success' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
