import { Clock, MapPin, Truck, Home, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineStop {
  time: string;
  label: string;
  sublabel?: string;
  type: 'departure' | 'delivery' | 'return';
  sequence?: number;
}

interface RouteTimelineProps {
  stops: TimelineStop[];
  className?: string;
  compact?: boolean;
}

export function RouteTimeline({ stops, className, compact = false }: RouteTimelineProps) {
  const getStopStyles = (type: TimelineStop['type']) => {
    switch (type) {
      case 'departure':
        return {
          bg: 'bg-green-500',
          border: 'border-green-500',
          text: 'text-green-600',
          icon: Home,
        };
      case 'delivery':
        return {
          bg: 'bg-blue-500',
          border: 'border-blue-500',
          text: 'text-blue-600',
          icon: MapPin,
        };
      case 'return':
        return {
          bg: 'bg-orange-500',
          border: 'border-orange-500',
          text: 'text-orange-600',
          icon: Home,
        };
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        {stops.map((stop, index) => {
          const styles = getStopStyles(stop.type);
          const Icon = styles.icon;
          
          return (
            <div key={index} className="flex items-center gap-1">
              <div className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                stop.type === 'departure' && 'bg-green-100 text-green-700',
                stop.type === 'delivery' && 'bg-blue-100 text-blue-700',
                stop.type === 'return' && 'bg-orange-100 text-orange-700',
              )}>
                <Icon className="h-3 w-3" />
                <span className="font-medium">{stop.time}</span>
              </div>
              {index < stops.length - 1 && (
                <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Timeline line */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-green-500 via-blue-500 to-orange-500" />
      
      <div className="space-y-4">
        {stops.map((stop, index) => {
          const styles = getStopStyles(stop.type);
          const Icon = styles.icon;
          
          return (
            <div key={index} className="relative flex items-start gap-4 pl-2">
              {/* Timeline dot */}
              <div className={cn(
                'relative z-10 flex h-5 w-5 items-center justify-center rounded-full',
                styles.bg,
              )}>
                {stop.type === 'delivery' && stop.sequence ? (
                  <span className="text-[10px] font-bold text-white">{stop.sequence}</span>
                ) : (
                  <Icon className="h-3 w-3 text-white" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('font-semibold', styles.text)}>{stop.time}</span>
                  <span className="text-sm font-medium">{stop.label}</span>
                </div>
                {stop.sublabel && (
                  <p className="text-xs text-muted-foreground mt-0.5">{stop.sublabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TruckTimelineSummaryProps {
  truckPlate: string;
  departureTime: string;
  lastDeliveryTime: string;
  returnTime: string;
  totalOrders: number;
  totalDuration: string;
}

export function TruckTimelineSummary({
  truckPlate,
  departureTime,
  lastDeliveryTime,
  returnTime,
  totalOrders,
  totalDuration,
}: TruckTimelineSummaryProps) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{truckPlate}</span>
        </div>
        <span className="text-xs text-muted-foreground">{totalDuration}</span>
      </div>
      
      <RouteTimeline
        compact
        stops={[
          { time: departureTime, label: 'Saída', type: 'departure' },
          { time: `${totalOrders}x`, label: 'Entregas', type: 'delivery' },
          { time: returnTime, label: 'Retorno', type: 'return' },
        ]}
      />
    </div>
  );
}
