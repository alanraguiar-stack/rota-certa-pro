import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Package, Calculator, FileDown, Map, Clock, MapPin } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouteDetails } from '@/hooks/useRoutes';
import { useTrucks } from '@/hooks/useTrucks';
import { useGeocoding } from '@/hooks/useGeocoding';
import { Truck as TruckType, ParsedOrder, RoutingStrategy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ManifestViewer } from '@/components/route/ManifestViewer';
import { RouteMap } from '@/components/route/RouteMap';
import { DepartureTimeConfig } from '@/components/route/DepartureTimeConfig';
import { TruckTimelineSummary } from '@/components/route/RouteTimeline';
import { GeocodingProgress } from '@/components/route/GeocodingProgress';
import { FailedAddressFixer } from '@/components/route/FailedAddressFixer';
export default function RouteDetails() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { route, isLoading, addOrders, assignTrucks, distributeOrders, reorderDeliveries, updateDepartureTimes, updateOrderAddress, setManualCoords, refetch } = useRouteDetails(id);
  const { activeTrucks } = useTrucks();
  const { progress: geocodingProgress, geocodeOrders, retryGeocode, resetProgress: resetGeocodingProgress } = useGeocoding();

  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [hasAddedPendingOrders, setHasAddedPendingOrders] = useState(false);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('economy');
  const [showManifest, setShowManifest] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // State for manual map location selection
  const [selectingLocationFor, setSelectingLocationFor] = useState<{
    orderId: string;
    clientName: string;
  } | null>(null);

  // Handle order reordering from the map
  const handleOrderReorder = async (reorders: Array<{ orderId: string; truckId: string; newSequence: number }>) => {
    await reorderDeliveries.mutateAsync(reorders);
  };

  // Add pending orders and routing strategy from navigation state
  useEffect(() => {
    const pendingOrders = location.state?.pendingOrders as ParsedOrder[] | undefined;
    const stateStrategy = location.state?.routingStrategy as RoutingStrategy | undefined;
    
    if (stateStrategy) {
      setRoutingStrategy(stateStrategy);
    }
    
    if (pendingOrders && pendingOrders.length > 0 && !hasAddedPendingOrders && route) {
      setHasAddedPendingOrders(true);
      addOrders.mutate(
        pendingOrders.map((o) => ({
          client_name: o.client_name,
          address: o.address,
          weight_kg: o.weight_kg,
        })),
        {
          onSuccess: () => {
            // Start geocoding after orders are added
            setTimeout(() => {
              startGeocoding();
            }, 500);
          }
        }
      );
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, hasAddedPendingOrders, route, addOrders, navigate, location.pathname]);

  // Function to start geocoding
  const startGeocoding = async () => {
    if (!route || isGeocoding) return;
    
    // Get order IDs that need geocoding
    const orderIdsToGeocode = route.orders
      .filter(o => !o.geocoding_status || o.geocoding_status === 'pending')
      .map(o => o.id);
    
    if (orderIdsToGeocode.length === 0) return;
    
    setIsGeocoding(true);
    
    try {
      const result = await geocodeOrders(orderIdsToGeocode);
      
      if (result.success > 0) {
        toast({
          title: 'Geocodificação concluída',
          description: `${result.success} endereços localizados${result.failed > 0 ? `, ${result.failed} não encontrados` : ''}`,
        });
        refetch();
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Check for pending geocoding when route loads
  useEffect(() => {
    if (route && route.orders.length > 0 && !isGeocoding) {
      const needsGeocoding = route.orders.some(
        o => !o.geocoding_status || o.geocoding_status === 'pending'
      );
      
      if (needsGeocoding && geocodingProgress.status === 'idle') {
        startGeocoding();
      }
    }
  }, [route?.orders]);

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

  const handleTruckSelection = (truckId: string) => {
    setSelectedTrucks((prev) =>
      prev.includes(truckId)
        ? prev.filter((id) => id !== truckId)
        : [...prev, truckId]
    );
  };

  const calculateRecommendedTrucks = () => {
    if (!route || activeTrucks.length === 0) return [];

    const totalWeight = Number(route.total_weight_kg);
    const sortedTrucks = [...activeTrucks].sort(
      (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
    );

    const recommended: TruckType[] = [];
    let remainingWeight = totalWeight * 1.1; // 10% safety margin

    for (const truck of sortedTrucks) {
      if (remainingWeight <= 0) break;
      recommended.push(truck);
      remainingWeight -= Number(truck.capacity_kg);
    }

    return recommended;
  };

  const handleAutoSelect = () => {
    const recommended = calculateRecommendedTrucks();
    setSelectedTrucks(recommended.map((t) => t.id));
    toast({
      title: 'Seleção automática',
      description: `${recommended.length} caminhões recomendados para ${formatWeight(Number(route?.total_weight_kg ?? 0))}`,
    });
  };

  const handleAssignTrucks = async () => {
    if (selectedTrucks.length === 0) {
      toast({
        title: 'Selecione caminhões',
        description: 'Escolha pelo menos um caminhão para a rota',
        variant: 'destructive',
      });
      return;
    }

    await assignTrucks.mutateAsync(selectedTrucks);
    await refetch();
  };

  const handleDistribute = async () => {
    await distributeOrders.mutateAsync(routingStrategy);
    setShowManifest(true);
  };

  // Handlers for failed address fixer
  const handleRetryGeocode = async (orderId: string): Promise<boolean> => {
    const success = await retryGeocode(orderId);
    await refetch();
    return success;
  };

  const handleUpdateAddress = async (orderId: string, newAddress: string): Promise<boolean> => {
    try {
      await updateOrderAddress.mutateAsync({ orderId, newAddress });
      return true;
    } catch {
      return false;
    }
  };

  const handleSetManualCoords = async (orderId: string, lat: number, lng: number): Promise<void> => {
    await setManualCoords.mutateAsync({ orderId, lat, lng });
    await refetch();
  };

  // Handlers for manual map selection
  const handleStartMapSelection = (orderId: string, clientName: string) => {
    setSelectingLocationFor({ orderId, clientName });
    // Automatically show the map when user wants to select location
    setShowMap(true);
  };

  const handleCancelMapSelection = () => {
    setSelectingLocationFor(null);
  };

  const handleManualLocationSelect = async (lat: number, lng: number) => {
    if (!selectingLocationFor) return;
    
    await handleSetManualCoords(selectingLocationFor.orderId, lat, lng);
    setSelectingLocationFor(null);
    
    toast({
      title: 'Localização definida',
      description: `Coordenadas manuais salvas para ${selectingLocationFor.clientName}`,
    });
  };

  const handleShowManifest = () => {
    setShowManifest(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Carregando rota...</div>
        </div>
      </AppLayout>
    );
  }

  if (!route) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="mb-4 text-muted-foreground">Rota não encontrada</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  const totalCapacitySelected = activeTrucks
    .filter((t) => selectedTrucks.includes(t.id))
    .reduce((sum, t) => sum + Number(t.capacity_kg), 0);

  const isOverCapacity = Number(route.total_weight_kg) > totalCapacitySelected && selectedTrucks.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Geocoding Progress */}
        {(geocodingProgress.status === 'processing' || geocodingProgress.status === 'complete') && (
          <GeocodingProgress
            current={geocodingProgress.current}
            total={geocodingProgress.total}
            currentAddress={geocodingProgress.currentAddress}
            status={geocodingProgress.status}
            successCount={geocodingProgress.successCount}
            failedCount={geocodingProgress.failedCount}
          />
        )}

        {/* Failed Address Fixer */}
        {route.orders.some(o => o.geocoding_status === 'not_found' || o.geocoding_status === 'error') && (
          <FailedAddressFixer
            orders={route.orders}
            onRetryGeocode={handleRetryGeocode}
            onUpdateAddress={handleUpdateAddress}
            onSetManualCoords={handleSetManualCoords}
            onStartMapSelection={handleStartMapSelection}
            selectingOnMapFor={selectingLocationFor?.orderId}
            isProcessing={geocodingProgress.status === 'processing'}
          />
        )}
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{route.name}</h1>
            <p className="text-muted-foreground">
              {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))}
            </p>
          </div>
          {route.status !== 'draft' && (
            <div className="flex gap-2">
              <Button 
                variant={showSchedule ? "default" : "outline"} 
                onClick={() => setShowSchedule(!showSchedule)} 
                className="gap-2"
              >
                <Clock className="h-4 w-4" />
                Horários
              </Button>
              <Button 
                variant={showMap ? "default" : "outline"} 
                onClick={() => setShowMap(!showMap)} 
                className="gap-2"
              >
                <Map className="h-4 w-4" />
                Mapa
              </Button>
              <Button variant="outline" onClick={handleShowManifest} className="gap-2">
                <FileDown className="h-4 w-4" />
                Romaneios
              </Button>
            </div>
          )}
        </div>

        {/* Step 1: Select Trucks (if not assigned yet) */}
        {route.route_trucks.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Selecionar Caminhões
              </CardTitle>
              <CardDescription>
                Escolha os caminhões para esta rota ou use a recomendação automática
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Capacidade selecionada: {formatWeight(totalCapacitySelected)} / Peso total:{' '}
                    {formatWeight(Number(route.total_weight_kg))}
                  </p>
                  {isOverCapacity && (
                    <p className="text-sm font-medium text-destructive">
                      ⚠️ Capacidade insuficiente!
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={handleAutoSelect}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Recomendar Automaticamente
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeTrucks.map((truck) => (
                  <div
                    key={truck.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors',
                      selectedTrucks.includes(truck.id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => handleTruckSelection(truck.id)}
                  >
                    <Checkbox checked={selectedTrucks.includes(truck.id)} />
                    <div>
                      <p className="font-medium">{truck.plate}</p>
                      <p className="text-sm text-muted-foreground">
                        {truck.model} • {formatWeight(Number(truck.capacity_kg))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {activeTrucks.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>Nenhum caminhão ativo</p>
                  <Button variant="link" onClick={() => navigate('/frota')}>
                    Cadastrar caminhões
                  </Button>
                </div>
              )}

              {selectedTrucks.length > 0 && (
                <Button
                  className="mt-4 w-full"
                  onClick={handleAssignTrucks}
                  disabled={assignTrucks.isPending}
                >
                  {assignTrucks.isPending ? 'Atribuindo...' : 'Confirmar Seleção'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Distribute Orders (if trucks assigned but not distributed) */}
        {route.route_trucks.length > 0 && route.status === 'draft' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Distribuir Pedidos
              </CardTitle>
              <CardDescription>
                {route.route_trucks.length} caminhões selecionados. Clique para distribuir as cargas automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                size="lg"
                onClick={handleDistribute}
                disabled={distributeOrders.isPending}
              >
                {distributeOrders.isPending ? 'Distribuindo...' : 'Distribuir Cargas Automaticamente'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Map Visualization - Show if explicitly opened OR if selecting location */}
        {(showMap || selectingLocationFor) && (
          <Card className={selectingLocationFor ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                {selectingLocationFor 
                  ? `Selecione a localização: ${selectingLocationFor.clientName}`
                  : 'Visualização das Rotas'
                }
              </CardTitle>
              <CardDescription>
                {selectingLocationFor 
                  ? 'Clique no mapa para definir a localização manualmente'
                  : 'Mapa interativo com as rotas de cada caminhão'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RouteMap
                trucks={route.route_trucks.length > 0 
                  ? route.route_trucks.map(rt => ({
                      truck: rt.truck!,
                      orders: rt.assignments?.map(a => a.order!).filter(Boolean) ?? [],
                      totalWeight: Number(rt.total_weight_kg),
                      occupancyPercent: rt.occupancy_percent,
                    }))
                  : []
                }
                editable={!selectingLocationFor && route.status !== 'draft'}
                onOrderReorder={handleOrderReorder}
                isSelectingLocation={!!selectingLocationFor}
                selectingForClient={selectingLocationFor?.clientName}
                onManualLocationSelect={handleManualLocationSelect}
                onCancelSelection={handleCancelMapSelection}
              />
            </CardContent>
          </Card>
        )}

        {/* Schedule Configuration */}
        {showSchedule && route.status !== 'draft' && route.route_trucks.length > 0 && (
          <DepartureTimeConfig
            trucks={route.route_trucks.map(rt => ({
              routeTruckId: rt.id,
              truckPlate: rt.truck?.plate || '',
              truckModel: rt.truck?.model || '',
              estimatedMinutes: rt.estimated_time_minutes || 60,
              totalOrders: rt.total_orders,
              currentDepartureTime: (rt as any).departure_time || undefined,
              currentDepartureDate: (rt as any).departure_date || undefined,
              currentDeliveryTimeMinutes: (rt as any).delivery_time_minutes || 5,
            }))}
            onSave={async (schedules) => {
              await updateDepartureTimes.mutateAsync(schedules.map(s => ({
                routeTruckId: s.routeTruckId,
                departureTime: s.departureTime,
                departureDate: s.departureDate,
                deliveryTimeMinutes: s.deliveryTimeMinutes,
              })));
            }}
          />
        )}

        {/* Step 3: Show Distribution Results */}
        {route.status !== 'draft' && route.route_trucks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Distribuição de Cargas</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {route.route_trucks.map((rt) => (
                <Card key={rt.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Truck className="h-5 w-5 text-primary" />
                        {rt.truck?.plate}
                      </CardTitle>
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs font-medium',
                          rt.occupancy_percent > 90
                            ? 'bg-destructive/10 text-destructive'
                            : rt.occupancy_percent > 70
                            ? 'bg-warning/10 text-warning'
                            : 'bg-success/10 text-success'
                        )}
                      >
                        {rt.occupancy_percent}%
                      </span>
                    </div>
                    <CardDescription>{rt.truck?.model}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Carga:</span>
                        <span className="font-medium">
                          {formatWeight(Number(rt.total_weight_kg))} /{' '}
                          {formatWeight(Number(rt.truck?.capacity_kg ?? 0))}
                        </span>
                      </div>
                      <Progress value={rt.occupancy_percent} className="h-2" />
                    </div>

                    {/* Timeline if schedule is set */}
                    {(rt as any).departure_time && (
                      <div className="mb-3">
                        <TruckTimelineSummary
                          truckPlate={rt.truck?.plate || ''}
                          departureTime={(rt as any).departure_time}
                          lastDeliveryTime={(rt as any).estimated_last_delivery_time || '--:--'}
                          returnTime={(rt as any).estimated_return_time || '--:--'}
                          totalOrders={rt.total_orders}
                          totalDuration={formatTime(rt.estimated_time_minutes || 0)}
                        />
                      </div>
                    )}

                    <p className="mb-2 text-sm font-medium">
                      {rt.total_orders} entregas:
                    </p>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {rt.assignments?.map((assignment, index) => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {assignment.order?.client_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatWeight(Number(assignment.order?.weight_kg ?? 0))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Manifest Viewer */}
        {showManifest && route.status !== 'draft' && route.route_trucks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Romaneios de Entrega
              </CardTitle>
              <CardDescription>
                Visualize, baixe ou imprima os romaneios de cada caminhão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManifestViewer
                routeName={route.name}
                date={new Date(route.created_at).toLocaleDateString('pt-BR')}
                trucks={route.route_trucks.map(rt => ({
                  truck: rt.truck!,
                  orders: rt.assignments?.map(a => a.order!).filter(Boolean) ?? [],
                  totalWeight: Number(rt.total_weight_kg),
                  occupancyPercent: rt.occupancy_percent,
                  departureTime: (rt as any).departure_time || undefined,
                  departureDate: (rt as any).departure_date || undefined,
                  estimatedReturnTime: (rt as any).estimated_return_time || undefined,
                }))}
                strategy={routingStrategy}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Todos os Pedidos ({route.orders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {route.orders.map((order, index) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{order.client_name}</p>
                      <p className="text-sm text-muted-foreground">{order.address}</p>
                    </div>
                  </div>
                  <span className="font-medium">{formatWeight(Number(order.weight_kg))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
