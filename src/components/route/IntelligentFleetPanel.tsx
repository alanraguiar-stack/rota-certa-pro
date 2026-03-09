/**
 * Painel de Frota Inteligente
 * 
 * Exibe o raciocínio do sistema ao recomendar a frota,
 * mostrando ao usuário o "pensamento" por trás da decisão.
 */

import { useState, useMemo, useEffect } from 'react';
import { 
  Truck as TruckIcon, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  Info,
  Scale,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Truck, ParsedOrder } from '@/types';
import { cn } from '@/lib/utils';
import { 
  analyzeFleetRequirements, 
  generateReasoningExplanation,
  isFleetSelectionValid,
  FleetAnalysis
} from '@/lib/routeIntelligence';
import { TERRITORY_RULES, assignTrucksToTerritories } from '@/lib/anchorRules';

interface IntelligentFleetPanelProps {
  trucks: Truck[];
  totalWeight: number;
  totalOrders: number;
  orders?: ParsedOrder[];
  selectedTruckIds: string[];
  onSelectionChange: (truckIds: string[]) => void;
  onConfirm: () => void;
  isConfirming?: boolean;
  disabled?: boolean;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2).replace('.', ',')} t`;
  }
  return `${weight.toFixed(0)} kg`;
}

export function IntelligentFleetPanel({
  trucks,
  totalWeight,
  totalOrders,
  orders = [],
  selectedTruckIds,
  onSelectionChange,
  onConfirm,
  isConfirming,
  disabled = false,
}: IntelligentFleetPanelProps) {
  const [showAllTrucks, setShowAllTrucks] = useState(false);

  // Análise inteligente da frota
  const fleetAnalysis = useMemo(() => 
    analyzeFleetRequirements(totalWeight, trucks, 10, orders),
    [totalWeight, trucks, orders]
  );

  // Auto-aplicar recomendação e forçar inclusão de caminhões âncora
  useEffect(() => {
    if (disabled) return;

    if (
      fleetAnalysis.recommendedTrucks.length > 0 && 
      selectedTruckIds.length === 0
    ) {
      onSelectionChange(fleetAnalysis.recommendedTrucks.map(t => t.id));
    }
  }, [fleetAnalysis.recommendedTrucks, selectedTruckIds.length, disabled, onSelectionChange]);

  // Cálculos da seleção atual
  const selectedTrucks = trucks.filter(t => selectedTruckIds.includes(t.id));
  const selectedCapacity = selectedTrucks.reduce((sum, t) => sum + Number(t.capacity_kg), 0);
  const utilizationPercent = selectedCapacity > 0 
    ? Math.round((totalWeight / selectedCapacity) * 100)
    : 0;
  const isOverCapacity = totalWeight > selectedCapacity && selectedTruckIds.length > 0;
  const selectionValidation = isFleetSelectionValid(totalWeight, selectedTrucks);

  // Explicação do raciocínio
  const reasoningExplanation = useMemo(() => 
    generateReasoningExplanation(totalWeight, trucks, selectedTruckIds),
    [totalWeight, trucks, selectedTruckIds]
  );

  const handleTruckToggle = (truckId: string) => {
    if (disabled) return;
    const newSelection = selectedTruckIds.includes(truckId)
      ? selectedTruckIds.filter(id => id !== truckId)
      : [...selectedTruckIds, truckId];
    onSelectionChange(newSelection);
  };

  const handleApplyRecommendation = () => {
    if (disabled) return;
    onSelectionChange(fleetAnalysis.recommendedTrucks.map(t => t.id));
  };

  return (
    <div className={cn("space-y-6", disabled && "opacity-70 pointer-events-none")}>
      {/* Header com Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatWeight(totalWeight)}</p>
                <p className="text-sm text-muted-foreground">Peso Total do Dia</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "border-2",
          selectionValidation.valid 
            ? "bg-success/5 border-success/30" 
            : "bg-destructive/5 border-destructive/30"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                selectionValidation.valid ? "bg-success/10" : "bg-destructive/10"
              )}>
                <TruckIcon className={cn(
                  "h-5 w-5",
                  selectionValidation.valid ? "text-success" : "text-destructive"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedTruckIds.length}</p>
                <p className="text-sm text-muted-foreground">
                  {fleetAnalysis.minimumTrucksRequired > 0 
                    ? `de ${fleetAnalysis.minimumTrucksRequired} necessários`
                    : 'Caminhões'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          utilizationPercent > 95 ? "bg-warning/5 border-warning/30" :
          utilizationPercent >= 70 ? "bg-success/5 border-success/30" :
          "bg-muted/5"
        )}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/20">
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{utilizationPercent}%</p>
                <p className="text-sm text-muted-foreground">Ocupação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status da Seleção */}
      <Card className={cn(
        'transition-colors border-2',
        isOverCapacity && 'border-destructive bg-destructive/5',
        !isOverCapacity && selectedTruckIds.length > 0 && 'border-success bg-success/5'
      )}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isOverCapacity ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : selectedTruckIds.length > 0 ? (
                <Check className="h-5 w-5 text-success" />
              ) : (
                <Info className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-semibold text-lg">
                {selectedTruckIds.length === 0 
                  ? 'Selecione os caminhões'
                  : `${selectedTruckIds.length} caminhão(ões) selecionado(s)`
                }
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={cn(
                "font-medium",
                isOverCapacity && "text-destructive"
              )}>
                Capacidade: {formatWeight(selectedCapacity)}
              </span>
              <span className="text-muted-foreground">•</span>
              <span>Peso: {formatWeight(totalWeight)}</span>
              {selectedTruckIds.length > 0 && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className={cn(
                    "font-medium",
                    utilizationPercent > 95 && "text-warning",
                    utilizationPercent <= 95 && utilizationPercent >= 70 && "text-success"
                  )}>
                    {utilizationPercent}% ocupação
                  </span>
                </>
              )}
            </div>
            {!selectionValidation.valid && (
              <p className="text-sm text-destructive mt-1">
                {selectionValidation.reason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOverCapacity && (
              <Badge variant="destructive">Capacidade Insuficiente</Badge>
            )}
            {!isOverCapacity && selectedTruckIds.length > 0 && selectionValidation.valid && (
              <Badge variant="default" className="bg-success">Frota Válida</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Caminhões */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Caminhões Disponíveis</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllTrucks(!showAllTrucks)}
          >
            {showAllTrucks ? 'Mostrar menos' : 'Ver todos'}
          </Button>
        </div>

        <div className={cn(
          'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
          !showAllTrucks && trucks.length > 6 && 'max-h-[250px] overflow-y-auto'
        )}>
          {trucks.map((truck) => {
            const isSelected = selectedTruckIds.includes(truck.id);
            const isRecommended = fleetAnalysis.recommendedTrucks.some(t => t.id === truck.id);
            
            return (
              <div
                key={truck.id}
                className={cn(
                  'relative flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-all',
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-muted hover:border-primary/50 hover:bg-muted/50',
                  isRecommended && !isSelected && 'ring-2 ring-primary/30 ring-offset-2'
                )}
                onClick={() => handleTruckToggle(truck.id)}
              >
                {isRecommended && (
                  <Badge 
                    className="absolute -top-2 -right-2 text-xs"
                    variant="default"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Recomendado
                  </Badge>
                )}
                <Checkbox checked={isSelected} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{truck.plate}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {truck.model}
                  </p>
                  <p className="text-sm font-medium text-primary">
                    {formatWeight(Number(truck.capacity_kg))}
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

      {/* Botão de Confirmar */}
      {selectedTruckIds.length > 0 && !disabled && (
        <Button
          className="w-full"
          size="lg"
          onClick={onConfirm}
          disabled={isConfirming || isOverCapacity || !selectionValidation.valid}
        >
          {isConfirming ? (
            'Confirmando...'
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Confirmar Frota ({selectedTruckIds.length} caminhões)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
