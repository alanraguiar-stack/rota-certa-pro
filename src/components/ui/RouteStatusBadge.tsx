/**
 * RouteStatusBadge — componente centralizado para exibir status de rota.
 * Único ponto de verdade para labels, cores e ícones de status.
 * Substitui getStatusBadge() em History.tsx e getStatusConfig() em Index.tsx.
 */
import { cn } from '@/lib/utils';

export type RouteStatus =
  | 'draft'
  | 'planned'
  | 'trucks_assigned'
  | 'loading'
  | 'loading_confirmed'
  | 'distributed'
  | 'completed';

interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_CONFIG: Record<RouteStatus, StatusConfig> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-muted text-muted-foreground',
  },
  planned: {
    label: 'Planejada',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  trucks_assigned: {
    label: 'Em Processo',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  loading: {
    label: 'Carregando',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  loading_confirmed: {
    label: 'Confirmada',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  distributed: {
    label: 'Distribuída',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  },
  completed: {
    label: 'Concluída',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
};

interface Props {
  status: string;
  className?: string;
}

export function RouteStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status as RouteStatus] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

/** Retorna só o label — útil para acessibilidade ou texto puro */
export function getRouteStatusLabel(status: string): string {
  return STATUS_CONFIG[status as RouteStatus]?.label ?? status;
}
