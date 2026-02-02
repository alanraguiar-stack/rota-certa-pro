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
    <div className="flex items-center justify-between gap-3">
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
              index < WIZARD_STEPS.length - 1 && 'gap-3'
            )}
          >
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                'flex flex-col items-center gap-2 transition-all duration-300',
                isClickable && 'cursor-pointer hover:opacity-80',
                !isClickable && 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                  isActive && 'bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-lg shadow-accent/25 ring-4 ring-accent/20',
                  isCompleted && 'bg-success text-success-foreground shadow-md',
                  isPending && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step.number}
              </div>
              <div className="hidden text-center sm:block">
                <p
                  className={cn(
                    'text-xs font-semibold transition-colors duration-300',
                    isActive && 'text-accent',
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
                  'h-1 flex-1 rounded-full transition-all duration-500',
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
