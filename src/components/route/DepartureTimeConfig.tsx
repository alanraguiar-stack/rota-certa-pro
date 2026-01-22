import { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Truck, MapPin, ArrowRight, Settings2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface TruckSchedule {
  routeTruckId: string;
  truckPlate: string;
  truckModel: string;
  departureDate: string;
  departureTime: string;
  estimatedMinutes: number;
  totalOrders: number;
  deliveryTimeMinutes: number;
}

interface RouteTimeEstimate {
  departureTime: string;
  lastDeliveryTime: string;
  returnTime: string;
  totalDuration: string;
  totalMinutes: number;
}

interface DepartureTimeConfigProps {
  trucks: Array<{
    routeTruckId: string;
    truckPlate: string;
    truckModel: string;
    estimatedMinutes: number;
    totalOrders: number;
    currentDepartureTime?: string;
    currentDepartureDate?: string;
    currentDeliveryTimeMinutes?: number;
  }>;
  onSave: (schedules: TruckSchedule[]) => Promise<void>;
  defaultDeliveryTimeMinutes?: number;
  returnToCDRequired?: boolean;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

function calculateRouteEstimate(
  departureTime: string,
  estimatedTravelMinutes: number,
  totalOrders: number,
  deliveryTimeMinutes: number,
  returnToCDRequired: boolean
): RouteTimeEstimate {
  // Calculate total delivery time (time per stop * number of stops)
  const totalDeliveryTime = totalOrders * deliveryTimeMinutes;
  
  // Assume return to CD takes roughly same as initial departure (simplified)
  // Using the estimated travel minutes which already includes return
  const travelWithoutReturn = estimatedTravelMinutes * 0.7; // Approximate: 70% is deliveries, 30% is return
  const returnTime = estimatedTravelMinutes * 0.3;
  
  // Last delivery time = departure + travel time + delivery time (excluding return)
  const lastDeliveryMinutes = travelWithoutReturn + totalDeliveryTime;
  const lastDeliveryTime = addMinutesToTime(departureTime, lastDeliveryMinutes);
  
  // Return time = last delivery + return travel
  const returnMinutes = returnToCDRequired ? lastDeliveryMinutes + returnTime : lastDeliveryMinutes;
  const finalReturnTime = addMinutesToTime(departureTime, returnMinutes);
  
  return {
    departureTime,
    lastDeliveryTime,
    returnTime: finalReturnTime,
    totalDuration: formatTime(returnMinutes),
    totalMinutes: returnMinutes,
  };
}

export function DepartureTimeConfig({
  trucks,
  onSave,
  defaultDeliveryTimeMinutes = 5,
  returnToCDRequired = true,
}: DepartureTimeConfigProps) {
  const today = new Date().toISOString().split('T')[0];
  const [showSettings, setShowSettings] = useState(false);
  const [globalDeliveryTime, setGlobalDeliveryTime] = useState(defaultDeliveryTimeMinutes);
  const [includeReturn, setIncludeReturn] = useState(returnToCDRequired);
  const [isSaving, setIsSaving] = useState(false);
  
  const [schedules, setSchedules] = useState<TruckSchedule[]>(() => 
    trucks.map(t => ({
      routeTruckId: t.routeTruckId,
      truckPlate: t.truckPlate,
      truckModel: t.truckModel,
      departureDate: t.currentDepartureDate || today,
      departureTime: t.currentDepartureTime || '08:00',
      estimatedMinutes: t.estimatedMinutes,
      totalOrders: t.totalOrders,
      deliveryTimeMinutes: t.currentDeliveryTimeMinutes || defaultDeliveryTimeMinutes,
    }))
  );

  // Update schedules when global settings change
  useEffect(() => {
    setSchedules(prev => prev.map(s => ({
      ...s,
      deliveryTimeMinutes: globalDeliveryTime,
    })));
  }, [globalDeliveryTime]);

  // Calculate estimates for each truck
  const estimates = useMemo(() => {
    return schedules.map(schedule => ({
      routeTruckId: schedule.routeTruckId,
      estimate: calculateRouteEstimate(
        schedule.departureTime,
        schedule.estimatedMinutes,
        schedule.totalOrders,
        schedule.deliveryTimeMinutes,
        includeReturn
      ),
    }));
  }, [schedules, includeReturn]);

  const updateSchedule = (routeTruckId: string, updates: Partial<TruckSchedule>) => {
    setSchedules(prev => prev.map(s => 
      s.routeTruckId === routeTruckId ? { ...s, ...updates } : s
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(schedules);
    } finally {
      setIsSaving(false);
    }
  };

  // Find the latest return time
  const latestReturn = useMemo(() => {
    if (estimates.length === 0) return null;
    return estimates.reduce((latest, current) => {
      if (!latest) return current;
      return current.estimate.totalMinutes > latest.estimate.totalMinutes ? current : latest;
    }, estimates[0]);
  }, [estimates]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horário de Saída e Previsão de Retorno
            </CardTitle>
            <CardDescription>
              Configure o horário de saída de cada caminhão para calcular a previsão de retorno
            </CardDescription>
          </div>
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Configurações
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Settings */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent>
            <div className="mb-6 rounded-lg border bg-muted/30 p-4 space-y-4">
              <h4 className="font-medium text-sm">Configurações Globais</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="delivery-time" className="text-sm">
                    Tempo médio por entrega
                  </Label>
                  <span className="text-sm font-medium">{globalDeliveryTime} min</span>
                </div>
                <Slider
                  id="delivery-time"
                  min={3}
                  max={20}
                  step={1}
                  value={[globalDeliveryTime]}
                  onValueChange={([value]) => setGlobalDeliveryTime(value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Tempo estimado para cada parada (descarga, conferência, assinatura)
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="return-cd" className="text-sm">
                    Incluir retorno ao CD
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Considerar tempo de retorno ao Centro de Distribuição
                  </p>
                </div>
                <Switch
                  id="return-cd"
                  checked={includeReturn}
                  onCheckedChange={setIncludeReturn}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Truck Schedules */}
        <div className="space-y-4">
          {schedules.map((schedule, index) => {
            const estimateData = estimates.find(e => e.routeTruckId === schedule.routeTruckId);
            const estimate = estimateData?.estimate;
            
            return (
              <div 
                key={schedule.routeTruckId}
                className="rounded-lg border p-4 space-y-4"
              >
                {/* Truck Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{schedule.truckPlate}</p>
                      <p className="text-sm text-muted-foreground">{schedule.truckModel}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {schedule.totalOrders} entregas
                  </Badge>
                </div>

                {/* Time Inputs */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`date-${index}`} className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data da Rota
                    </Label>
                    <Input
                      id={`date-${index}`}
                      type="date"
                      value={schedule.departureDate}
                      onChange={(e) => updateSchedule(schedule.routeTruckId, { departureDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`time-${index}`} className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Hora de Saída
                    </Label>
                    <Input
                      id={`time-${index}`}
                      type="time"
                      value={schedule.departureTime}
                      onChange={(e) => updateSchedule(schedule.routeTruckId, { departureTime: e.target.value })}
                    />
                  </div>
                </div>

                {/* Timeline Visualization */}
                {estimate && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Previsão da Rota</span>
                      <Badge variant="secondary">
                        Duração: {estimate.totalDuration}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Departure */}
                      <div className="flex flex-col items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 border-2 border-green-500">
                          <span className="text-xs font-bold text-green-600">{estimate.departureTime}</span>
                        </div>
                        <span className="mt-1 text-[10px] text-muted-foreground">Saída CD</span>
                      </div>
                      
                      {/* Arrow */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="h-0.5 flex-1 bg-gradient-to-r from-green-500 via-blue-500 to-orange-500" />
                        <ArrowRight className="h-4 w-4 text-blue-500 mx-1" />
                        <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-500 to-orange-500" />
                      </div>
                      
                      {/* Last Delivery */}
                      <div className="flex flex-col items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 border-2 border-blue-500">
                          <span className="text-xs font-bold text-blue-600">{estimate.lastDeliveryTime}</span>
                        </div>
                        <span className="mt-1 text-[10px] text-muted-foreground">Última Ent.</span>
                      </div>
                      
                      {includeReturn && (
                        <>
                          {/* Arrow */}
                          <div className="flex items-center justify-center w-8">
                            <ArrowRight className="h-4 w-4 text-orange-500" />
                          </div>
                          
                          {/* Return */}
                          <div className="flex flex-col items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 border-2 border-orange-500">
                              <span className="text-xs font-bold text-orange-600">{estimate.returnTime}</span>
                            </div>
                            <span className="mt-1 text-[10px] text-muted-foreground">Retorno CD</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        {latestReturn && (
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Previsão de Conclusão Geral</p>
                <p className="text-sm text-muted-foreground">
                  Todos os caminhões retornados até:
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {latestReturn.estimate.returnTime}
                </p>
                <p className="text-sm text-muted-foreground">
                  Duração máxima: {latestReturn.estimate.totalDuration}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button 
          className="w-full" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Salvando...' : 'Salvar Horários'}
        </Button>
      </CardContent>
    </Card>
  );
}
