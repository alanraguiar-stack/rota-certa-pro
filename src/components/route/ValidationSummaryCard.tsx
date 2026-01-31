/**
 * Card de Resumo de Validação
 * 
 * Exibe um resumo visual do estado atual da validação,
 * mostrando se o sistema está pronto para prosseguir.
 */

import { Check, AlertTriangle, XCircle, Info, ArrowRight, Scale, Truck, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ValidationResult, ValidationSummary } from '@/lib/routeIntelligence';

interface ValidationSummaryCardProps {
  summary: ValidationSummary;
  errors?: Array<{ code: string; message: string; severity: string }>;
  warnings?: Array<{ code: string; message: string }>;
  className?: string;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2).replace('.', ',')} t`;
  }
  return `${weight.toFixed(0)} kg`;
}

export function ValidationSummaryCard({
  summary,
  errors = [],
  warnings = [],
  className,
}: ValidationSummaryCardProps) {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const hasCritical = criticalErrors.length > 0;

  // Determine overall status
  const status = hasCritical 
    ? 'critical' 
    : hasErrors 
      ? 'error' 
      : hasWarnings 
        ? 'warning' 
        : 'success';

  const statusConfig = {
    critical: {
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/50',
      label: 'Erro Crítico',
    },
    error: {
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      label: 'Erros Encontrados',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
      label: 'Avisos',
    },
    success: {
      icon: Check,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
      label: 'Validado',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className={cn("border-2", config.borderColor, config.bgColor, className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", config.color)} />
            <span>Validação do Sistema</span>
          </div>
          <Badge 
            variant={status === 'success' ? 'default' : 'outline'}
            className={cn(
              status === 'success' && 'bg-success',
              status === 'warning' && 'border-warning text-warning',
              (status === 'error' || status === 'critical') && 'border-destructive text-destructive'
            )}
          >
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold">{formatWeight(summary.totalWeight)}</p>
              <p className="text-xs text-muted-foreground">Peso Total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold">{summary.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Pedidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold">
                {summary.selectedTrucks}/{summary.requiredTrucks}
              </p>
              <p className="text-xs text-muted-foreground">Caminhões</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Ocupação</span>
                <span className="font-bold">{summary.utilizationPercent}%</span>
              </div>
              <Progress value={summary.utilizationPercent} className="h-2" />
            </div>
          </div>
        </div>

        {/* Checklist de validação */}
        <div className="space-y-2 pt-2 border-t">
          <ValidationCheckItem 
            label="Capacidade suficiente"
            isValid={summary.isCapacitySufficient}
          />
          <ValidationCheckItem 
            label="Todos os pedidos atribuídos"
            isValid={summary.allOrdersAssigned}
          />
          <ValidationCheckItem 
            label="Pesos conferidos"
            isValid={summary.weightsMatch}
          />
        </div>

        {/* Erros e avisos */}
        {(hasErrors || hasWarnings) && (
          <div className="space-y-2 pt-2 border-t">
            {errors.map((error, index) => (
              <div 
                key={`error-${index}`}
                className="flex items-start gap-2 p-2 rounded-md bg-destructive/10"
              >
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">{error.message}</p>
                </div>
              </div>
            ))}
            {warnings.map((warning, index) => (
              <div 
                key={`warning-${index}`}
                className="flex items-start gap-2 p-2 rounded-md bg-warning/10"
              >
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-warning-foreground">{warning.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValidationCheckItem({ label, isValid }: { label: string; isValid: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {isValid ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span className={cn(
        "text-sm",
        isValid ? "text-success" : "text-destructive"
      )}>
        {label}
      </span>
    </div>
  );
}
