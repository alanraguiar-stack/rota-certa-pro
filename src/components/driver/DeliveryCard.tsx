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
        'w-full rounded-xl border-2 p-4 transition-all',
        config.className,
      )}
    >
      <div className="flex items-start gap-3">
        <button onClick={onClick} className="flex items-start gap-3 flex-1 text-left active:scale-[0.98]">
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            delivery.status === 'concluida' ? 'bg-success text-success-foreground' :
            delivery.status === 'nao_entregue' ? 'bg-destructive text-destructive-foreground' :
            'bg-muted text-muted-foreground'
          )}>
            {delivery.status === 'pendente' ? index + 1 : <StatusIcon className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{delivery.order?.client_name}</p>
            <div className="flex items-start gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground line-clamp-2">{delivery.order?.address}</p>
            </div>
            {delivery.delivered_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(delivery.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </button>

        {/* Quick action buttons for pending deliveries */}
        {delivery.status === 'pendente' && (onQuickConfirm || onQuickReject) && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {onQuickConfirm && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-success hover:bg-success/10 hover:text-success"
                onClick={(e) => { e.stopPropagation(); onQuickConfirm(delivery.id); }}
              >
                <CheckCircle2 className="h-5 w-5" />
              </Button>
            )}
            {onQuickReject && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onQuickReject(delivery.id); }}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
