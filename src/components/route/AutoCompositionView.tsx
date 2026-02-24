/**
 * Componente de visualização da composição automática de caminhões
 * Exibe CORREDORES REGIONAIS por caminhão e bloqueia confirmação se houver violações
 */

import { Truck, Package, Scale, TrendingUp, AlertCircle, CheckCircle2, Brain, MapPin, ShieldAlert, Navigation } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ParsedOrder, Truck as TruckType } from '@/types';
import { cn } from '@/lib/utils';
import { 
  AutoRouterResult, 
  TruckComposition,
  getRoutingSummary 
} from '@/lib/autoRouterEngine';

interface AutoCompositionViewProps {
  result: AutoRouterResult;
  onConfirm: () => void;
  onAdjust?: () => void;
  isProcessing?: boolean;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`;
  }
  return `${weight.toFixed(0)}kg`;
}

function EfficiencyBadge({ efficiency }: { efficiency: 'excellent' | 'good' | 'fair' | 'poor' }) {
  const config = {
    excellent: { label: 'Excelente', className: 'bg-success/10 text-success border-success/30' },
    good: { label: 'Bom', className: 'bg-primary/10 text-primary border-primary/30' },
    fair: { label: 'Regular', className: 'bg-warning/10 text-warning border-warning/30' },
    poor: { label: 'Baixo', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  };
  
  return (
    <Badge variant="outline" className={config[efficiency].className}>
      {config[efficiency].label}
    </Badge>
  );
}

function TruckCompositionCard({ composition, index, hasViolation }: { composition: TruckComposition; index: number; hasViolation: boolean }) {
  const truckColors = [
    'text-blue-600 bg-blue-100',
    'text-green-600 bg-green-100',
    'text-purple-600 bg-purple-100',
    'text-orange-600 bg-orange-100',
    'text-pink-600 bg-pink-100',
  ];
  
  const colorClass = truckColors[index % truckColors.length];
  
  const productSummary = new Map<string, number>();
  composition.orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        const current = productSummary.get(item.product_name) || 0;
        productSummary.set(item.product_name, current + item.weight_kg);
      });
    } else if (order.product_description) {
      const current = productSummary.get(order.product_description) || 0;
      productSummary.set(order.product_description, current + order.weight_kg);
    }
  });
  
  const topProducts = Array.from(productSummary.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const cities = composition.cities || [];
  const corridorName = composition.corridorName;
  
  return (
    <Card className={cn(hasViolation && 'border-destructive/50 bg-destructive/5')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full p-2', colorClass)}>
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">{composition.truck.plate}</CardTitle>
              <CardDescription>{composition.truck.model}</CardDescription>
            </div>
          </div>
          <Badge 
            variant="outline"
            className={cn(
              composition.occupancyPercent > 90 ? 'border-destructive/50 text-destructive' :
              composition.occupancyPercent > 75 ? 'border-warning/50 text-warning' :
              'border-success/50 text-success'
            )}
          >
            {composition.occupancyPercent}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Corridor name */}
        {corridorName && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
            <Navigation className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{corridorName}</span>
          </div>
        )}

        {/* City tags */}
        {cities.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Cidades ({cities.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {cities.map((city) => (
                <Badge 
                  key={city} 
                  variant="secondary" 
                  className={cn(
                    "text-xs capitalize",
                    city === 'barueri' && "bg-muted/80 text-muted-foreground border-muted",
                    hasViolation && city !== 'barueri' && "bg-destructive/10 text-destructive border-destructive/30"
                  )}
                >
                  {city}
                  {city === 'barueri' && ' (hub)'}
                </Badge>
              ))}
            </div>
            {corridorName && !hasViolation && (
              <p className="text-xs text-success">✓ Agrupamento conforme padrão do analista</p>
            )}
            {hasViolation && (
              <p className="text-xs text-destructive">⚠ Mistura fora do padrão operacional</p>
            )}
          </div>
        )}

        {/* Capacity bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ocupação</span>
            <span className="font-medium">
              {formatWeight(composition.totalWeight)} / {formatWeight(Number(composition.truck.capacity_kg))}
            </span>
          </div>
          <Progress value={composition.occupancyPercent} className="h-2" />
        </div>
        
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground text-xs">Entregas</p>
            <p className="font-semibold">{composition.orders.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-muted-foreground text-xs">Peso Médio</p>
            <p className="font-semibold">
              {formatWeight(composition.totalWeight / Math.max(composition.orders.length, 1))}
            </p>
          </div>
        </div>
        
        {/* Top products */}
        {topProducts.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Principais produtos:</p>
            <div className="flex flex-wrap gap-1">
              {topProducts.map(([product, weight]) => (
                <Badge key={product} variant="secondary" className="text-xs">
                  {product}: {formatWeight(weight)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Orders preview */}
        <div className="max-h-32 overflow-y-auto space-y-1">
          {composition.orders.slice(0, 5).map((order, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm rounded border px-2 py-1">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                {idx + 1}
              </span>
              <span className="truncate flex-1">{order.client_name}</span>
              <span className="text-muted-foreground shrink-0">{formatWeight(order.weight_kg)}</span>
            </div>
          ))}
          {composition.orders.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              + {composition.orders.length - 5} entregas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AutoCompositionView({ 
  result, 
  onConfirm, 
  onAdjust,
  isProcessing 
}: AutoCompositionViewProps) {
  const summary = getRoutingSummary(result);
  const activeCompositions = result.compositions.filter(c => c.orders.length > 0);
  const hasViolations = result.validation && !result.validation.valid;
  
  const violatedTrucks = new Set<string>();
  if (hasViolations && result.validation.violations) {
    for (const v of result.validation.violations) {
      const match = v.match(/Caminhão\s+(\S+)/);
      if (match) violatedTrucks.add(match[1]);
    }
  }

  // Count corridors
  const corridorCount = new Set(
    activeCompositions.filter(c => c.corridorName).map(c => c.corridorName)
  ).size;
  
  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Composição por Corredores Regionais
              </CardTitle>
              <CardDescription>
                Agrupamento baseado nos padrões históricos do analista
                {corridorCount > 0 && ` • ${corridorCount} corredor(es) identificado(s)`}
              </CardDescription>
            </div>
            <EfficiencyBadge efficiency={summary.efficiency} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{summary.trucksActive}</p>
              <p className="text-sm text-muted-foreground">Caminhões</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.totalDeliveries}</p>
              <p className="text-sm text-muted-foreground">Entregas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.totalWeight}</p>
              <p className="text-sm text-muted-foreground">Carga Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.avgOccupancy}</p>
              <p className="text-sm text-muted-foreground">Ocupação Média</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Violations - BLOCKING */}
      {hasViolations && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Rota incoerente com padrão operacional histórico
            </CardTitle>
            <CardDescription className="text-destructive/80">
              A composição contém misturas de cidades que o analista nunca fez. Corrija antes de confirmar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {result.validation.violations.map((violation, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm rounded border border-destructive/30 bg-background px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>{violation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Reasoning / History insights */}
      {result.reasoning && result.reasoning.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Raciocínio de corredores ({result.reasoning.length})
            </CardTitle>
            <CardDescription>
              Decisões baseadas nos corredores regionais do analista
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {result.reasoning.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm rounded border border-primary/20 bg-background px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Truck Compositions */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Distribuição por Corredores ({activeCompositions.length})
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeCompositions.map((composition, index) => (
            <TruckCompositionCard 
              key={composition.truck.id} 
              composition={composition} 
              index={index}
              hasViolation={violatedTrucks.has(composition.truck.plate)}
            />
          ))}
        </div>
      </div>
      
      {/* Unassigned Orders */}
      {result.unassignedOrders.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pedidos Não Atribuídos ({result.unassignedOrders.length})
            </CardTitle>
            <CardDescription>
              Estes pedidos excedem a capacidade disponível
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {result.unassignedOrders.map((order, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                  <span>{order.client_name}</span>
                  <Badge variant="destructive">{formatWeight(order.weight_kg)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Separator />
      
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onAdjust && (
          <Button variant="outline" onClick={onAdjust} disabled={isProcessing}>
            Ajustar Manualmente
          </Button>
        )}
        <Button 
          size="lg" 
          onClick={onConfirm} 
          disabled={isProcessing || activeCompositions.length === 0 || hasViolations}
          className="min-w-[200px]"
        >
          {isProcessing ? (
            'Processando...'
          ) : hasViolations ? (
            <>
              <ShieldAlert className="mr-2 h-5 w-5" />
              Composição Bloqueada
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Confirmar e Criar Rota
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
