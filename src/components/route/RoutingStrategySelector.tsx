import { Compass, Home, ArrowUpRight, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoutingStrategy, ROUTING_STRATEGIES, DISTRIBUTION_CENTER } from '@/types';
import { cn } from '@/lib/utils';

interface RoutingStrategySelectorProps {
  selectedStrategy: RoutingStrategy | null;
  onStrategyChange: (strategy: RoutingStrategy) => void;
}

const iconMap = {
  Compass,
  Home,
  ArrowUpRight,
};

export function RoutingStrategySelector({
  selectedStrategy,
  onStrategyChange,
}: RoutingStrategySelectorProps) {
  return (
    <div className="space-y-4">
      {/* Distribution Center Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{DISTRIBUTION_CENTER.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {DISTRIBUTION_CENTER.address}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Options */}
      <div className="grid gap-3 sm:grid-cols-3">
        {ROUTING_STRATEGIES.map((strategy) => {
          const isSelected = selectedStrategy === strategy.id;
          const Icon = iconMap[strategy.icon as keyof typeof iconMap] || Compass;

          return (
            <Card
              key={strategy.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
                isSelected && 'border-primary ring-2 ring-primary/20'
              )}
              onClick={() => onStrategyChange(strategy.id)}
            >
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="bg-primary">
                      Selecionado
                    </Badge>
                  )}
                </div>
                <h4 className="mb-1 font-semibold">{strategy.name}</h4>
                <p className="text-sm text-muted-foreground">{strategy.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Strategy Info */}
      {selectedStrategy && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            {(() => {
              const strategy = ROUTING_STRATEGIES.find((s) => s.id === selectedStrategy);
              const Icon = strategy ? iconMap[strategy.icon as keyof typeof iconMap] || Compass : Compass;
              return (
                <>
                  <Icon className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-primary">
                      Estratégia: {strategy?.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getStrategyExplanation(selectedStrategy)}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function getStrategyExplanation(strategy: RoutingStrategy): string {
  switch (strategy) {
    case 'padrao':
      return 'O caminhão sai do CD e faz primeiro a entrega mais próxima dentro da sua cidade principal, avançando progressivamente até a mais distante. Rotas previsíveis e fáceis de acompanhar.';
    case 'finalizacao_proxima':
      return 'O caminhão começa pela entrega mais distante e vai retornando progressivamente em direção ao CD, facilitando o retorno ao final do dia.';
    case 'finalizacao_distante':
      return 'O caminhão começa pelas entregas próximas ao CD e avança até a região mais distante. Ideal quando o retorno ao CD não é prioridade.';
    default:
      return '';
  }
}
