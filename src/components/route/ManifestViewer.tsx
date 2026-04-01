import { useState, useEffect } from 'react';
import { FileDown, Printer, Eye, Truck, MapPin, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Truck as TruckType, Order, DISTRIBUTION_CENTER, RoutingStrategy } from '@/types';
import { OptimizedRoute, optimizeDeliveryOrder } from '@/lib/routing';
import { downloadManifestPDF, printManifestPDF, ManifestData } from '@/lib/manifest';
import { cn } from '@/lib/utils';

interface ManifestViewerProps {
  routeName: string;
  date: string;
  trucks: Array<{
    truck: TruckType;
    orders: Order[];
    totalWeight: number;
    occupancyPercent: number;
    departureTime?: string;
    departureDate?: string;
    estimatedReturnTime?: string;
  }>;
  strategy: RoutingStrategy;
}

export function ManifestViewer({ routeName, date, trucks, strategy }: ManifestViewerProps) {
  const [selectedTruckIndex, setSelectedTruckIndex] = useState(0);
  const [optimizedRoutes, setOptimizedRoutes] = useState<Map<string, OptimizedRoute>>(new Map());
  const [isOptimizing, setIsOptimizing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function optimize() {
      setIsOptimizing(true);
      const routes = new Map<string, OptimizedRoute>();
      for (const t of trucks) {
        const route = await optimizeDeliveryOrder(t.orders, strategy);
        if (cancelled) return;
        routes.set(t.truck.id, route);
      }
      setOptimizedRoutes(routes);
      setIsOptimizing(false);
    }
    optimize();
    return () => { cancelled = true; };
  }, [trucks, strategy]);

  const selectedTruck = trucks[selectedTruckIndex];
  const selectedRoute = optimizedRoutes.get(selectedTruck?.truck.id);

  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(0)}kg`;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const handleDownloadPDF = () => {
    if (!selectedTruck || !selectedRoute) return;
    
    const manifestData: ManifestData = {
      routeName,
      date,
      truck: selectedTruck.truck,
      route: selectedRoute,
      totalWeight: selectedTruck.totalWeight,
      occupancyPercent: selectedTruck.occupancyPercent,
    };
    
    downloadManifestPDF(manifestData);
  };

  const handlePrint = () => {
    if (!selectedTruck || !selectedRoute) return;
    
    const manifestData: ManifestData = {
      routeName,
      date,
      truck: selectedTruck.truck,
      route: selectedRoute,
      totalWeight: selectedTruck.totalWeight,
      occupancyPercent: selectedTruck.occupancyPercent,
    };
    
    printManifestPDF(manifestData);
  };

  const handleDownloadAll = () => {
    trucks.forEach((truckData, index) => {
      const route = optimizedRoutes.get(truckData.truck.id);
      if (route) {
        setTimeout(() => {
          downloadManifestPDF({
            routeName,
            date,
            truck: truckData.truck,
            route,
            totalWeight: truckData.totalWeight,
            occupancyPercent: truckData.occupancyPercent,
          });
        }, index * 500); // Stagger downloads
      }
    });
  };

  if (trucks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Nenhum caminhão com entregas atribuídas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Truck selector tabs */}
      <div className="flex flex-wrap gap-2">
        {trucks.map((t, index) => (
          <Button
            key={t.truck.id}
            variant={selectedTruckIndex === index ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTruckIndex(index)}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            {t.truck.plate}
            <Badge variant="secondary" className="ml-1">
              {t.orders.length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={handleDownloadPDF} className="gap-2">
          <FileDown className="h-4 w-4" />
          Baixar PDF
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        {trucks.length > 1 && (
          <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
            <FileDown className="h-4 w-4" />
            Baixar Todos
          </Button>
        )}
      </div>

      {/* Manifest preview */}
      {selectedTruck && selectedRoute && (
        <Card className="print:shadow-none">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Romaneio de Entregas</CardTitle>
                <CardDescription>{routeName}</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold">
                {selectedTruck.truck.plate}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Route summary */}
            <div className="grid grid-cols-2 gap-4 border-b p-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Veículo</p>
                <p className="font-semibold">{selectedTruck.truck.model}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-semibold">{date}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso Total</p>
                <p className="font-semibold">{formatWeight(selectedTruck.totalWeight)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ocupação</p>
                <p className={cn(
                  'font-semibold',
                  selectedTruck.occupancyPercent > 90 ? 'text-destructive' : 
                  selectedTruck.occupancyPercent > 70 ? 'text-warning' : 'text-success'
                )}>
                  {selectedTruck.occupancyPercent}%
                </p>
              </div>
            </div>

            {/* Route metrics */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  <strong>{selectedRoute.totalDistance}</strong> km
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  <strong>{formatTime(selectedRoute.estimatedMinutes)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  <strong>{selectedRoute.orderedDeliveries.length}</strong> entregas
                </span>
              </div>
              {selectedTruck.departureTime && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Saída:</span>
                    <Badge variant="outline" className="font-bold text-green-600">
                      {selectedTruck.departureTime}
                    </Badge>
                  </div>
                  {selectedTruck.estimatedReturnTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Retorno:</span>
                      <Badge variant="outline" className="font-bold text-orange-600">
                        {selectedTruck.estimatedReturnTime}
                      </Badge>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Origin */}
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-primary/5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                CD
              </div>
              <div>
                <p className="text-sm font-medium">{DISTRIBUTION_CENTER.name}</p>
                <p className="text-xs text-muted-foreground">{DISTRIBUTION_CENTER.address}</p>
              </div>
            </div>

            {/* Deliveries list */}
            <div className="divide-y">
              {selectedRoute.orderedDeliveries.map((delivery, index) => (
                <div key={delivery.order.id} className="flex items-start gap-3 p-4 hover:bg-muted/30">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{delivery.order.client_name}</p>
                    <p className="text-sm text-muted-foreground">{delivery.order.address}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatWeight(Number(delivery.order.weight_kg))}</span>
                      <span>+{delivery.distanceFromPrevious} km</span>
                      <span>~{formatTime(delivery.estimatedArrivalMinutes)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Assinatura</p>
                    <div className="mt-1 h-8 w-24 border-b border-dashed border-muted-foreground/50" />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t bg-muted/20 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Retorno ao CD: +{(selectedRoute.totalDistance - (selectedRoute.orderedDeliveries[selectedRoute.orderedDeliveries.length - 1]?.cumulativeDistance ?? 0)).toFixed(1)} km</span>
                <span>Gerado por Rota Certa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
