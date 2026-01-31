import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
  trend?: {
    value: number;
    label: string;
  };
}

const variantStyles = {
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    accentColor: 'bg-muted-foreground/20',
  },
  primary: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    accentColor: 'bg-primary/20',
  },
  success: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    accentColor: 'bg-success/20',
  },
  warning: {
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
    accentColor: 'bg-warning/20',
  },
  info: {
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
    accentColor: 'bg-info/20',
  },
};

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variant = 'default',
  trend 
}: StatsCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className="stats-card group hover-lift">
      {/* Accent bar at top */}
      <div className={cn(
        "absolute left-0 right-0 top-0 h-1 rounded-t-xl opacity-0 transition-opacity group-hover:opacity-100",
        styles.accentColor
      )} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 pt-1">
              <span className={cn(
                "text-xs font-medium",
                trend.value >= 0 ? "text-success" : "text-destructive"
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
          styles.iconBg
        )}>
          <div className={styles.iconColor}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
