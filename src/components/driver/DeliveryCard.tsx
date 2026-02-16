import { MapPin, Check, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeliveryExecution } from '@/hooks/useDriverRoutes';

interface DeliveryCardProps {
  delivery: DeliveryExecution;
  index: number;
  onClick: () => void;
}

export function DeliveryCard({ delivery, index, onClick }: DeliveryCardProps) {
  const statusConfig = {
    pendente: { icon: Clock, label: 'Pendente', className: 'border-border' },
    concluida: { icon: Check, label: 'Concluída', className: 'border-success bg-success/5' },
    nao_entregue: { icon: AlertTriangle, label: 'Não entregue', className: 'border-destructive bg-destructive/5' },
  };

  const config = statusConfig[delivery.status as keyof typeof statusConfig] || statusConfig.pendente;
  const StatusIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border-2 p-4 transition-all active:scale-[0.98]',
        config.className,
        delivery.status === 'pendente' && 'hover:border-primary/50'
      )}
    >
      <div className="flex items-start gap-3">
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
      </div>
    </button>
  );
}
