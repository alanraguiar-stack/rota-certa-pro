import { useState, useMemo } from 'react';
import { Truck as TruckIcon, Sparkles, Check, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Truck, FleetRecommendation as FleetRecommendationType } from '@/types';
import { cn } from '@/lib/utils';

interface FleetRecommendationProps {
  trucks: Truck[];
  totalWeight: number;
  totalOrders: number;
  selectedTruckIds: string[];
  onSelectionChange: (truckIds: string[]) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}

// Algorithm to recommend optimal fleet combination
function calculateFleetRecommendations(
  trucks: Truck[],
  totalWeight: number,
  totalOrders: number
): FleetRecommendationType[] {
  if (trucks.length === 0 || totalWeight === 0) return [];

  const recommendations: FleetRecommendationType[] = [];
  const sortedTrucks = [...trucks].sort((a, b) => Number(b.capacity_kg) - Number(a.capacity_kg));
  const safetyMargin = 1.1; // 10% de margem
  const targetWeight = totalWeight * safetyMargin;

  // Strategy 1: Use fewer large trucks (efficiency)
  const efficientCombo = findEfficientCombination(sortedTrucks, targetWeight);
  if (efficientCombo.trucks.length > 0) {
    recommendations.push({
      ...efficientCombo,
      reason: 'Menor quantidade de veículos para máxima eficiência',
    });
  }

  // Strategy 2: Balance load evenly across trucks
  const balancedCombo = findBalancedCombination(sortedTrucks, targetWeight, totalOrders);
  if (balancedCombo.trucks.length > 0 && 
      JSON.stringify(balancedCombo.trucks.map(t => t.id)) !== 
      JSON.stringify(efficientCombo.trucks.map(t => t.id))) {
    recommendations.push({
      ...balancedCombo,
      reason: 'Distribuição equilibrada entre veículos',
    });
  }

  // Strategy 3: Consider max deliveries limit
  const deliveryOptimized = findDeliveryOptimizedCombination(sortedTrucks, targetWeight, totalOrders);
  if (deliveryOptimized.trucks.length > 0 &&
      JSON.stringify(deliveryOptimized.trucks.map(t => t.id)) !== 
      JSON.stringify(efficientCombo.trucks.map(t => t.id)) &&
      JSON.stringify(deliveryOptimized.trucks.map(t => t.id)) !== 
      JSON.stringify(balancedCombo.trucks.map(t => t.id))) {
    recommendations.push({
      ...deliveryOptimized,
      reason: 'Otimizado para número de entregas por veículo',
    });
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

function findEfficientCombination(trucks: Truck[], targetWeight: number): Omit<FleetRecommendationType, 'reason'> {
  const selected: Truck[] = [];
  let totalCapacity = 0;

  for (const truck of trucks) {
    if (totalCapacity >= targetWeight) break;
    selected.push(truck);
    totalCapacity += Number(truck.capacity_kg);
  }

  const utilization = (targetWeight / totalCapacity) * 100;
  const score = Math.min(100, utilization) - (selected.length * 5); // Penalize more trucks

  return {
    trucks: selected,
    totalCapacity,
    utilizationPercent: Math.round(utilization),
    score: Math.round(score),
  };
}

function findBalancedCombination(trucks: Truck[], targetWeight: number, totalOrders: number): Omit<FleetRecommendationType, 'reason'> {
  // Target ~80% capacity for better balance
  const targetUtilization = 0.8;
  const selected: Truck[] = [];
  let totalCapacity = 0;

  const sortedByBalance = [...trucks].sort((a, b) => {
    const idealLoadA = Number(a.capacity_kg) * targetUtilization;
    const idealLoadB = Number(b.capacity_kg) * targetUtilization;
    return idealLoadB - idealLoadA;
  });

  for (const truck of sortedByBalance) {
    selected.push(truck);
    totalCapacity += Number(truck.capacity_kg);
    if (totalCapacity >= targetWeight && (totalCapacity * targetUtilization) >= targetWeight * 0.9) {
      break;
    }
  }

  const utilization = (targetWeight / totalCapacity) * 100;
  const score = 85 - Math.abs(80 - utilization); // Best score at 80% utilization

  return {
    trucks: selected,
    totalCapacity,
    utilizationPercent: Math.round(utilization),
    score: Math.round(score),
  };
}

function findDeliveryOptimizedCombination(trucks: Truck[], targetWeight: number, totalOrders: number): Omit<FleetRecommendationType, 'reason'> {
  // Consider max_deliveries when selecting trucks
  const trucksWithDeliveryLimit = trucks.filter(t => t.max_deliveries);
  const trucksWithoutLimit = trucks.filter(t => !t.max_deliveries);
  
  const avgOrdersPerTruck = Math.ceil(totalOrders / trucks.length);
  const selected: Truck[] = [];
  let totalCapacity = 0;
  let estimatedOrdersHandled = 0;

  // First, add trucks that can handle the order volume
  const sortedTrucks = [
    ...trucksWithDeliveryLimit.sort((a, b) => (b.max_deliveries ?? 0) - (a.max_deliveries ?? 0)),
    ...trucksWithoutLimit.sort((a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)),
  ];

  for (const truck of sortedTrucks) {
    selected.push(truck);
    totalCapacity += Number(truck.capacity_kg);
    estimatedOrdersHandled += truck.max_deliveries ?? avgOrdersPerTruck;
    
    if (totalCapacity >= targetWeight && estimatedOrdersHandled >= totalOrders) break;
  }

  const utilization = (targetWeight / totalCapacity) * 100;
  const orderCoverage = (estimatedOrdersHandled / totalOrders) * 100;
  const score = (utilization * 0.6) + (Math.min(100, orderCoverage) * 0.4);

  return {
    trucks: selected,
    totalCapacity,
    utilizationPercent: Math.round(utilization),
    score: Math.round(score),
  };
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`;
  }
  return `${weight.toFixed(0)}kg`;
}

export function FleetRecommendation({
  trucks,
  totalWeight,
  totalOrders,
  selectedTruckIds,
  onSelectionChange,
  onConfirm,
  isConfirming,
}: FleetRecommendationProps) {
  const [showAllTrucks, setShowAllTrucks] = useState(false);

  const recommendations = useMemo(
    () => calculateFleetRecommendations(trucks, totalWeight, totalOrders),
    [trucks, totalWeight, totalOrders]
  );

  const selectedCapacity = trucks
    .filter((t) => selectedTruckIds.includes(t.id))
    .reduce((sum, t) => sum + Number(t.capacity_kg), 0);

  const utilizationPercent = selectedCapacity > 0 
    ? Math.round((totalWeight / selectedCapacity) * 100)
    : 0;

  const isOverCapacity = totalWeight > selectedCapacity && selectedTruckIds.length > 0;
  const hasSelection = selectedTruckIds.length > 0;

  const handleTruckToggle = (truckId: string) => {
    const newSelection = selectedTruckIds.includes(truckId)
      ? selectedTruckIds.filter((id) => id !== truckId)
      : [...selectedTruckIds, truckId];
    onSelectionChange(newSelection);
  };

  const handleApplyRecommendation = (recommendation: FleetRecommendationType) => {
    onSelectionChange(recommendation.trucks.map((t) => t.id));
  };

  return (
    <div className="space-y-6">
      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Recomendações Inteligentes</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.slice(0, 3).map((rec, index) => {
              const isSelected = rec.trucks.every((t) => selectedTruckIds.includes(t.id)) &&
                rec.trucks.length === selectedTruckIds.length;

              return (
                <Card
                  key={index}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    isSelected && 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  )}
                  onClick={() => handleApplyRecommendation(rec)}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        {index === 0 ? 'Recomendado' : `Opção ${index + 1}`}
                      </Badge>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TruckIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {rec.trucks.length} {rec.trucks.length === 1 ? 'caminhão' : 'caminhões'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Capacidade: {formatWeight(rec.totalCapacity)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={rec.utilizationPercent} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium">{rec.utilizationPercent}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {showAllTrucks ? 'Todos os Caminhões' : 'Seleção Manual'}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllTrucks(!showAllTrucks)}
          >
            {showAllTrucks ? 'Mostrar menos' : 'Ver todos'}
          </Button>
        </div>

        {/* Selection Summary */}
        <Card className={cn(
          'transition-colors',
          isOverCapacity && 'border-destructive/50 bg-destructive/5'
        )}>
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isOverCapacity ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : hasSelection ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Info className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {selectedTruckIds.length} {selectedTruckIds.length === 1 ? 'caminhão selecionado' : 'caminhões selecionados'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Capacidade: {formatWeight(selectedCapacity)} / Peso: {formatWeight(totalWeight)}
                {hasSelection && ` (${utilizationPercent}% utilização)`}
              </p>
            </div>
            {isOverCapacity && (
              <Badge variant="destructive">Capacidade insuficiente</Badge>
            )}
          </CardContent>
        </Card>

        {/* Truck List */}
        <div className={cn(
          'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
          !showAllTrucks && 'max-h-[200px] overflow-y-auto'
        )}>
          {trucks.map((truck) => {
            const isSelected = selectedTruckIds.includes(truck.id);
            return (
              <div
                key={truck.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
                onClick={() => handleTruckToggle(truck.id)}
              >
                <Checkbox checked={isSelected} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{truck.plate}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {truck.model} • {formatWeight(Number(truck.capacity_kg))}
                    {truck.max_deliveries && ` • Max ${truck.max_deliveries} entregas`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {trucks.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <TruckIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Nenhum caminhão ativo cadastrado</p>
          </div>
        )}
      </div>

      {/* Confirm Button */}
      {hasSelection && (
        <Button
          className="w-full"
          size="lg"
          onClick={onConfirm}
          disabled={isConfirming || isOverCapacity}
        >
          {isConfirming ? 'Confirmando...' : 'Confirmar Seleção de Frota'}
        </Button>
      )}
    </div>
  );
}
