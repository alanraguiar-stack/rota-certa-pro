import { MapPin, Check, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DeliveryExecution } from '@/hooks/useDriverRoutes';

interface DeliveryCardProps {
  delivery: DeliveryExecution;
  index: number;
  onClick: () => void;
  onQuickConfirm?: (id: string) => void;
  onQuickReject?: (id: string) => void;
}

export function DeliveryCard({ delivery, index, onClick, onQuickConfirm, onQuickReject }: DeliveryCardProps) {
  const statusConfig = {
    pendente: { icon: Clock, label: 'Pendente', className: 'border-border' },
    concluida: { icon: Check, label: 'Concluída', className: 'border-success bg-success/5' },
    nao_entregue: { icon: AlertTriangle, label: 'Não entregue', className: 'border-destructive bg-destructive/5' },
  };

  const config = statusConfig[delivery.status as keyof typeof statusConfig] || statusConfig.pendente;
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        'w-full rounded-xl border-2 p-3 transition-all',
        config.className,
      )}
    >
      <div className="flex items-start gap-2">
        <button onClick={onClick} className="flex items-start gap-2 flex-1 min-w-0 text-left active:scale-[0.98]">
          <div className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5',
            delivery.status === 'concluida' ? 'bg-success text-success-foreground' :
            delivery.status === 'nao_entregue' ? 'bg-destructive text-destructive-foreground' :
            'bg-muted text-muted-foreground'
          )}>
            {delivery.status === 'pendente' ? index + 1 : <StatusIcon className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{delivery.order?.client_name}</p>
            <div className="flex items-start gap-1 mt-0.5">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground line-clamp-2">{delivery.order?.address}</p>
            </div>
            {delivery.order?.weight_kg && (
              <p className="text-xs font-semibold text-foreground mt-1">
                {delivery.order.weight_kg} kg
              </p>
            )}
            {delivery.order?.product_description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 break-all">
                {delivery.order.product_description}
              </p>
            )}
            {delivery.delivered_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(delivery.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </button>

        {delivery.status === 'pendente' && (onQuickConfirm || onQuickReject) && (
          <div className="flex flex-col gap-1 shrink-0">
            {onQuickConfirm && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-success hover:bg-success/10 hover:text-success"
                onClick={(e) => { e.stopPropagation(); onQuickConfirm(delivery.id); }}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            {onQuickReject && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onQuickReject(delivery.id); }}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
