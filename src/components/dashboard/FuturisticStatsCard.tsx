import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface FuturisticStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
  trend?: {
    value: number;
    label: string;
  };
  glowing?: boolean;
  className?: string;
  delay?: number;
}

const variantConfig = {
  default: {
    iconBg: 'bg-muted/50',
    iconColor: 'text-muted-foreground',
    borderGlow: '',
    accentGradient: 'from-muted-foreground/10 to-transparent',
  },
  primary: {
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    borderGlow: 'hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)]',
    accentGradient: 'from-primary/10 to-transparent',
  },
  success: {
    iconBg: 'bg-success/15',
    iconColor: 'text-success',
    borderGlow: 'hover:shadow-[0_0_30px_hsl(var(--success)/0.15)]',
    accentGradient: 'from-success/10 to-transparent',
  },
  warning: {
    iconBg: 'bg-warning/15',
    iconColor: 'text-warning',
    borderGlow: 'hover:shadow-[0_0_30px_hsl(var(--warning)/0.15)]',
    accentGradient: 'from-warning/10 to-transparent',
  },
  info: {
    iconBg: 'bg-info/15',
    iconColor: 'text-info',
    borderGlow: 'hover:shadow-[0_0_30px_hsl(var(--info)/0.15)]',
    accentGradient: 'from-info/10 to-transparent',
  },
};

export function FuturisticStatsCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend,
  glowing = false,
  className,
  delay = 0,
}: FuturisticStatsCardProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5 transition-all duration-500",
        "hover:-translate-y-1 hover:border-primary/30",
        config.borderGlow,
        glowing && "animate-glow-pulse",
        "opacity-0 animate-slide-in-bottom",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {/* Gradient accent overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100",
        config.accentGradient
      )} />

      {/* Top accent line */}
      <div className={cn(
        "absolute left-0 right-0 top-0 h-[2px] opacity-0 transition-all duration-300 group-hover:opacity-100",
        variant === 'primary' && "bg-gradient-to-r from-transparent via-primary to-transparent",
        variant === 'success' && "bg-gradient-to-r from-transparent via-success to-transparent",
        variant === 'warning' && "bg-gradient-to-r from-transparent via-warning to-transparent",
        variant === 'info' && "bg-gradient-to-r from-transparent via-info to-transparent",
        variant === 'default' && "bg-gradient-to-r from-transparent via-muted-foreground to-transparent"
      )} />

      {/* Content */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl sm:text-4xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-1">
              {trend.value >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={cn(
                "text-xs font-semibold",
                trend.value >= 0 ? "text-success" : "text-destructive"
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>

        <div className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
          "group-hover:scale-110 group-hover:rotate-3",
          config.iconBg
        )}>
          <div className={cn("transition-colors", config.iconColor)}>
            {icon}
          </div>
        </div>
      </div>

      {/* Corner decoration */}
      <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-gradient-to-tl from-primary/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
}
