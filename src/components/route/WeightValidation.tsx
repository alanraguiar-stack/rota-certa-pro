import { Package, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ParsedOrder, Truck as TruckType } from '@/types';
import { cn } from '@/lib/utils';

interface WeightValidationProps {
  orders: ParsedOrder[];
  trucks: TruckType[];
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`;
  }
  return `${weight.toFixed(0)}kg`;
}

export function WeightValidation({ orders, trucks }: WeightValidationProps) {
  // CRÍTICO: Calcular peso de TODOS os pedidos, não apenas os válidos
  // Isso garante que o peso total do arquivo seja exibido corretamente
  const allOrdersWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
  
  // Pedidos válidos são os que têm endereço (para roteirização)
  const validOrders = orders.filter((o) => o.isValid);
  const validOrdersWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
  
  // USAR PESO TOTAL DE TODOS OS PEDIDOS para cálculos de frota
  const totalWeight = allOrdersWeight;
  
  const totalCapacity = trucks.reduce((sum, t) => sum + Number(t.capacity_kg), 0);
  const utilizationPercent = totalCapacity > 0 ? (totalWeight / totalCapacity) * 100 : 0;
  
  // Calcular médias baseado em TODOS os pedidos
  const avgOrderWeight = orders.length > 0 ? totalWeight / orders.length : 0;
  const minTrucksNeeded = Math.ceil(totalWeight / (trucks.length > 0 ? Math.max(...trucks.map(t => Number(t.capacity_kg))) : 1));
  
  const hasEnoughCapacity = totalWeight <= totalCapacity;
  const hasOrders = orders.length > 0;
  
  // Detectar se há diferença significativa entre peso total e peso dos pedidos válidos
  const hasMismatch = Math.abs(allOrdersWeight - validOrdersWeight) > 100;
  const invalidOrdersCount = orders.length - validOrders.length;
  const invalidOrdersWeight = allOrdersWeight - validOrdersWeight;

  // Metrics calculation - mostrar todos os pedidos, não apenas válidos
  const metrics = [
    {
      label: 'Total de Pedidos',
      value: orders.length.toString(),
      subValue: invalidOrdersCount > 0 ? `(${validOrders.length} c/ endereço)` : undefined,
      icon: Package,
      color: 'text-primary',
    },
    {
      label: 'Peso Total',
      value: formatWeight(totalWeight),
      icon: Package,
      color: 'text-primary',
    },
    {
      label: 'Peso Médio/Pedido',
      value: formatWeight(avgOrderWeight),
      icon: Package,
      color: 'text-muted-foreground',
    },
    {
      label: 'Mín. Caminhões',
      value: minTrucksNeeded.toString(),
      icon: Truck,
      color: 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card
        className={cn(
          'transition-colors',
          !hasOrders && 'border-muted',
          hasOrders && hasEnoughCapacity && 'border-success/50 bg-success/5',
          hasOrders && !hasEnoughCapacity && 'border-destructive/50 bg-destructive/5'
        )}
      >
        <CardContent className="flex items-center gap-4 py-4">
          {!hasOrders ? (
            <>
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Adicione pedidos</p>
                <p className="text-sm text-muted-foreground">
                  Importe uma planilha ou adicione pedidos manualmente para começar
                </p>
              </div>
            </>
          ) : hasEnoughCapacity ? (
            <>
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="font-medium text-success">Capacidade suficiente</p>
                <p className="text-sm text-muted-foreground">
                  Sua frota tem capacidade para transportar todos os pedidos
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Capacidade insuficiente</p>
                <p className="text-sm text-muted-foreground">
                  O peso total excede a capacidade da frota. Cadastre mais caminhões ou reduza os pedidos.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Alerta de Pedidos sem Endereço */}
      {hasMismatch && invalidOrdersCount > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-warning flex-shrink-0" />
            <div>
              <p className="font-medium text-warning">Alguns pedidos não têm endereço</p>
              <p className="text-sm text-muted-foreground">
                {invalidOrdersCount} pedido{invalidOrdersCount > 1 ? 's' : ''} sem endereço válido ({formatWeight(invalidOrdersWeight)}).
                Corrija os endereços para incluí-los na rota.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <metric.icon className={cn('h-4 w-4', metric.color)} />
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
              <p className="mt-1 text-xl font-bold">{metric.value}</p>
              {metric.subValue && (
                <p className="text-xs text-muted-foreground">{metric.subValue}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Capacity Bar */}
      {hasOrders && trucks.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Utilização da Frota</span>
              <span className={cn(
                'text-sm font-bold',
                utilizationPercent <= 80 && 'text-success',
                utilizationPercent > 80 && utilizationPercent <= 100 && 'text-warning',
                utilizationPercent > 100 && 'text-destructive'
              )}>
                {Math.round(utilizationPercent)}%
              </span>
            </div>
            <Progress 
              value={Math.min(utilizationPercent, 100)} 
              className={cn(
                'h-3',
                utilizationPercent > 100 && '[&>div]:bg-destructive'
              )} 
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Peso: {formatWeight(totalWeight)}</span>
              <span>Capacidade: {formatWeight(totalCapacity)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fleet Summary */}
      {trucks.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 text-sm font-medium">Frota Disponível</h4>
          <div className="flex flex-wrap gap-2">
            {trucks.slice(0, 6).map((truck) => (
              <div
                key={truck.id}
                className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm"
              >
                <Truck className="h-3 w-3 text-primary" />
                <span className="font-medium">{truck.plate}</span>
                <span className="text-muted-foreground">
                  {formatWeight(Number(truck.capacity_kg))}
                </span>
              </div>
            ))}
            {trucks.length > 6 && (
              <div className="flex items-center rounded-full bg-background px-3 py-1.5 text-sm text-muted-foreground">
                +{trucks.length - 6} mais
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
