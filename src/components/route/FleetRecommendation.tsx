import { useState } from 'react';
import { Truck as TruckIcon, Check, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Truck } from '@/types';
import { cn } from '@/lib/utils';

interface FleetRecommendationProps {
  trucks: Truck[];
  totalWeight: number;
  totalOrders: number;
  selectedTruckIds: string[];
  onSelectionChange: (truckIds: string[]) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
  disabled?: boolean;
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
  selectedTruckIds,
  onSelectionChange,
  onConfirm,
  isConfirming,
  disabled = false,
}: FleetRecommendationProps) {
  const [showAllTrucks, setShowAllTrucks] = useState(true);

  const selectedCapacity = trucks
    .filter((t) => selectedTruckIds.includes(t.id))
    .reduce((sum, t) => sum + Number(t.capacity_kg), 0);

  const utilizationPercent = selectedCapacity > 0 
    ? Math.round((totalWeight / selectedCapacity) * 100)
    : 0;

  const isOverCapacity = totalWeight > selectedCapacity && selectedTruckIds.length > 0;
  const hasSelection = selectedTruckIds.length > 0;

  const handleTruckToggle = (truckId: string) => {
    if (disabled) return;
    const newSelection = selectedTruckIds.includes(truckId)
      ? selectedTruckIds.filter((id) => id !== truckId)
      : [...selectedTruckIds, truckId];
    onSelectionChange(newSelection);
  };

  return (
    <div className={cn("space-y-6", disabled && "opacity-70 pointer-events-none")}>
      {/* Manual Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Selecione os Caminhões</h3>
          {trucks.length > 6 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllTrucks(!showAllTrucks)}
            >
              {showAllTrucks ? 'Mostrar menos' : 'Ver todos'}
            </Button>
          )}
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
              <span className="text-xs font-medium text-destructive">Capacidade insuficiente</span>
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
      {hasSelection && !disabled && (
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
