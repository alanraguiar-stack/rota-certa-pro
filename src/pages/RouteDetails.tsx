import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Package, Calculator, FileDown, Map, Clock, MapPin, Route as RouteIcon, AlertCircle, ChevronLeft } from 'lucide-react';
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
import { LoadingManifest } from '@/components/route/LoadingManifest';
import { LoadingConfirmation } from '@/components/route/LoadingConfirmation';
import { RouteWorkflowStepper, getActiveStep, RouteWorkflowStep } from '@/components/route/RouteWorkflowStepper';
import { RouteMap } from '@/components/route/RouteMap';
import { DepartureTimeConfig } from '@/components/route/DepartureTimeConfig';
import { TruckTimelineSummary } from '@/components/route/RouteTimeline';
import { GeocodingProgress } from '@/components/route/GeocodingProgress';
import { CollapsibleAddressFixer } from '@/components/route/CollapsibleAddressFixer';
import { RoutingStrategySelector } from '@/components/route/RoutingStrategySelector';
import { LoadConsolidationView } from '@/components/route/LoadConsolidationView';
import { SideBySideManifests } from '@/components/route/SideBySideManifests';

// Workflow step order for navigation
const WORKFLOW_ORDER: RouteWorkflowStep[] = [
  'select_trucks',
  'distribute_load',
  'loading_manifest',
  'confirm_loading',
  'optimize_routes',
  'delivery_manifest',
];

export default function RouteDetails() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    route, 
    isLoading, 
    addOrders, 
    assignTrucks, 
    distributeLoad,
    confirmLoading,
    optimizeRoutes,
    distributeOrders, 
    reorderDeliveries, 
    updateDepartureTimes, 
    updateOrderAddress, 
    setManualCoords, 
    refetch 
  } = useRouteDetails(id);
  const { activeTrucks } = useTrucks();
  const { progress: geocodingProgress, geocodeOrders, retryGeocode, resetProgress: resetGeocodingProgress } = useGeocoding();

  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [hasAddedPendingOrders, setHasAddedPendingOrders] = useState(false);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('economy');
  const [showMap, setShowMap] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Track if fleet was pre-configured in wizard
  const [fleetFromWizard, setFleetFromWizard] = useState(false);
  
  // State for manual map location selection
  const [selectingLocationFor, setSelectingLocationFor] = useState<{
    orderId: string;
    clientName: string;
  } | null>(null);

  // Get current workflow step
  const hasTrucks = (route?.route_trucks?.length ?? 0) > 0;
  const hasAssignments = route?.route_trucks?.some(
    rt => (rt.assignments?.length ?? 0) > 0
  ) ?? false;
  const activeStep = route ? getActiveStep(route, hasTrucks, hasAssignments) : 'select_trucks';

  // Handle order reordering from the map
  const handleOrderReorder = async (reorders: Array<{ orderId: string; truckId: string; newSequence: number }>) => {
    await reorderDeliveries.mutateAsync(reorders);
  };

  // Add pending orders, trucks, and routing strategy from navigation state (from wizard)
  useEffect(() => {
    const pendingOrders = location.state?.pendingOrders as ParsedOrder[] | undefined;
    const stateStrategy = location.state?.routingStrategy as RoutingStrategy | undefined;
    const selectedTruckIdsFromWizard = location.state?.selectedTruckIds as string[] | undefined;
    const fleetAlreadyConfigured = location.state?.fleetAlreadyConfigured as boolean | undefined;
    
    if (stateStrategy) {
      setRoutingStrategy(stateStrategy);
    }
    
    // Pre-select trucks from wizard if provided
    if (selectedTruckIdsFromWizard && selectedTruckIdsFromWizard.length > 0) {
      setSelectedTrucks(selectedTruckIdsFromWizard);
      if (fleetAlreadyConfigured) {
        setFleetFromWizard(true);
      }
    }
    
    if (pendingOrders && pendingOrders.length > 0 && !hasAddedPendingOrders && route) {
      setHasAddedPendingOrders(true);
      addOrders.mutate(
        pendingOrders.map((o) => ({
          client_name: o.client_name,
          address: o.address,
          weight_kg: o.weight_kg,
          product_description: o.product_description,
          items: o.items,
        })),
        {
          onSuccess: () => {
            // Start geocoding after orders are added
            setTimeout(() => {
              startGeocoding();
            }, 500);
            
            // Auto-assign trucks if fleet was configured in wizard
            if (selectedTruckIdsFromWizard && selectedTruckIdsFromWizard.length > 0 && fleetAlreadyConfigured) {
              setTimeout(async () => {
                try {
                  await assignTrucks.mutateAsync(selectedTruckIdsFromWizard);
                  await refetch();
                  toast({
                    title: 'Frota atribuída automaticamente',
                    description: `${selectedTruckIdsFromWizard.length} caminhão(ões) configurado(s)`,
                  });
                } catch (error) {
                  console.error('Auto-assign trucks error:', error);
                }
              }, 1000);
            }
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

  // Step 1 of workflow: Distribute load (Romaneio de Carga)
  const handleDistributeLoad = async () => {
    await distributeLoad.mutateAsync();
    await refetch();
  };

  // Step 2 of workflow: Confirm loading
  const handleConfirmLoading = async (confirmedBy: string) => {
    await confirmLoading.mutateAsync(confirmedBy);
    await refetch();
  };

  // Step 3 of workflow: Optimize routes (Roteirização)
  const handleOptimizeRoutes = async () => {
    await optimizeRoutes.mutateAsync(routingStrategy);
    await refetch();
  };

  // Navigate back one step in workflow
  const handleGoBack = () => {
    const currentIndex = WORKFLOW_ORDER.indexOf(activeStep);
    if (currentIndex <= 0) {
      // Go back to route list
      navigate('/');
      return;
    }
    
    // Determine what needs to be reset to go back
    toast({
      title: 'Voltar para etapa anterior',
      description: 'Use o fluxo do wizard para refazer etapas anteriores.',
    });
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

  // Handle "continue anyway" for failed geocoding - non-blocking
  const handleContinueWithFailedAddresses = () => {
    toast({
      title: 'Continuando com endereços informados',
      description: 'Os endereços não localizados serão usados como informado. A roteirização usará aproximações.',
    });
    // Just dismiss the warning - the flow continues naturally
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

  // Prepare truck data for components
  const truckDataForComponents = route.route_trucks.map(rt => ({
    truck: rt.truck!,
    orders: rt.assignments?.map(a => a.order!).filter(Boolean) ?? [],
    totalWeight: Number(rt.total_weight_kg),
    occupancyPercent: rt.occupancy_percent,
  }));

  // Check if there are failed geocoding addresses
  const hasFailedAddresses = route.orders.some(
    o => o.geocoding_status === 'not_found' || o.geocoding_status === 'error'
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{route.name}</h1>
            <p className="text-muted-foreground">
              {route.total_orders} pedidos • {formatWeight(Number(route.total_weight_kg))}
              {route.loading_confirmed_at && (
                <span className="ml-2 text-success">
                  • Carregamento confirmado por {route.loading_confirmed_by}
                </span>
              )}
            </p>
          </div>
          {route.status === 'distributed' && (
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
            </div>
          )}
        </div>

        {/* Workflow Stepper */}
        <Card>
          <CardContent className="py-4">
            <RouteWorkflowStepper route={route} hasTrucks={hasTrucks} hasAssignments={hasAssignments} />
          </CardContent>
        </Card>

        {/* Recovery Alert - If status is inconsistent with data */}
        {hasAssignments && (route.status === 'draft' || route.status === 'trucks_assigned') && (
          <Card className="border-warning bg-warning/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium">Status desatualizado</p>
                    <p className="text-sm text-muted-foreground">
                      A distribuição foi realizada, mas o status não foi atualizado corretamente.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={async () => {
                    const { supabase } = await import('@/integrations/supabase/client');
                    await supabase.from('routes').update({ status: 'loading' }).eq('id', route.id);
                    refetch();
                    toast({ title: 'Status corrigido!' });
                  }}
                >
                  Corrigir e Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Failed Address Fixer - COLLAPSIBLE (takes less space) */}
        {hasFailedAddresses && (
          <CollapsibleAddressFixer
            orders={route.orders}
            onRetryGeocode={handleRetryGeocode}
            onUpdateAddress={handleUpdateAddress}
            onSetManualCoords={handleSetManualCoords}
            onStartMapSelection={handleStartMapSelection}
            onContinueAnyway={handleContinueWithFailedAddresses}
            selectingOnMapFor={selectingLocationFor?.orderId}
            isProcessing={geocodingProgress.status === 'processing'}
          />
        )}

        {/* ============================================ */}
        {/* ETAPA 1: SELECIONAR CAMINHÕES               */}
        {/* (Only shown if fleet wasn't configured in wizard) */}
        {/* ============================================ */}
        {activeStep === 'select_trucks' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Etapa 1: Selecionar Caminhões
              </CardTitle>
              <CardDescription>
                {fleetFromWizard 
                  ? 'A frota foi configurada no wizard. Aguarde a atribuição automática ou ajuste manualmente.'
                  : 'Escolha os caminhões para esta rota ou use a recomendação automática'
                }
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
                  {assignTrucks.isPending ? 'Atribuindo...' : 'Confirmar Seleção de Caminhões'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* ETAPA 2: DISTRIBUIR CARGA (ROMANEIO)       */}
        {/* ============================================ */}
        {activeStep === 'distribute_load' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Etapa 2: Distribuir Carga
                  </CardTitle>
                  <CardDescription>
                    {route.route_trucks.length} caminhões selecionados. Distribua as cargas entre os veículos.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {route.route_trucks.map((rt) => (
                  <div key={rt.id} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-medium">{rt.truck?.plate}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rt.truck?.model}</p>
                    <p className="text-sm">Capacidade: {formatWeight(Number(rt.truck?.capacity_kg ?? 0))}</p>
                  </div>
                ))}
              </div>
              
              <Button
                className="w-full"
                size="lg"
                onClick={handleDistributeLoad}
                disabled={distributeLoad.isPending}
              >
                {distributeLoad.isPending ? 'Distribuindo...' : 'Distribuir Cargas nos Caminhões'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* ETAPA 3: ROMANEIO DE CARGA                 */}
        {/* ============================================ */}
        {activeStep === 'loading_manifest' && (
          <div className="space-y-6">
            {/* Sub-etapa 1: Consolidação de Carga */}
            <LoadConsolidationView
              orders={route.orders}
              trucks={truckDataForComponents}
            />
            
            {/* Sub-etapa 2: Romaneio de Carga por Caminhão (para impressão) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileDown className="h-5 w-5" />
                  Romaneios de Carga para Impressão
                </CardTitle>
                <CardDescription>
                  Gere o romaneio para separação e conferência no Centro de Distribuição.
                  Após a separação física, confirme o carregamento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LoadingManifest
                  routeName={route.name}
                  date={new Date(route.created_at).toLocaleDateString('pt-BR')}
                  trucks={truckDataForComponents}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ============================================ */}
        {/* ETAPA 4: CONFIRMAR CARREGAMENTO            */}
        {/* ============================================ */}
        {activeStep === 'loading_manifest' && (
          <LoadingConfirmation
            routeName={route.name}
            trucks={truckDataForComponents}
            onConfirm={handleConfirmLoading}
            isLoading={confirmLoading.isPending}
          />
        )}

        {/* ============================================ */}
        {/* ETAPA 5: ROTEIRIZAÇÃO                      */}
        {/* ============================================ */}
        {activeStep === 'optimize_routes' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RouteIcon className="h-5 w-5" />
                Etapa 4: Roteirização
              </CardTitle>
              <CardDescription>
                Carregamento confirmado por <strong>{route.loading_confirmed_by}</strong>.
                Agora defina a estratégia e otimize a ordem de entrega.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">Escolha a estratégia de roteirização:</h3>
                <RoutingStrategySelector
                  selectedStrategy={routingStrategy}
                  onStrategyChange={setRoutingStrategy}
                />
              </div>
              
              <Button
                className="w-full"
                size="lg"
                onClick={handleOptimizeRoutes}
                disabled={optimizeRoutes.isPending}
              >
                {optimizeRoutes.isPending ? 'Otimizando rotas...' : 'Roteirizar e Gerar Ordem de Entrega'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* ETAPA 6: ROMANEIO DE ENTREGA (FINAL)       */}
        {/* ============================================ */}
        {activeStep === 'delivery_manifest' && (
          <>
            {/* Map Visualization - Compact */}
            {(showMap || selectingLocationFor) && (
              <Card className={selectingLocationFor ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Map className="h-5 w-5" />
                    {selectingLocationFor 
                      ? `Selecione: ${selectingLocationFor.clientName}`
                      : 'Mapa das Rotas'
                    }
                  </CardTitle>
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
                    editable={!selectingLocationFor}
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
            {showSchedule && route.route_trucks.length > 0 && (
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

            {/* DOCUMENTOS LADO A LADO */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileDown className="h-5 w-5" />
                  Documentos Finais
                </CardTitle>
                <CardDescription>
                  Romaneio de Carga (separação) e Romaneio de Entrega (motorista) lado a lado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SideBySideManifests
                  routeName={route.name}
                  date={new Date(route.created_at).toLocaleDateString('pt-BR')}
                  trucks={route.route_trucks.map(rt => ({
                    truck: rt.truck!,
                    orders: rt.assignments?.map(a => a.order!).filter(Boolean) ?? [],
                    totalWeight: Number(rt.total_weight_kg),
                    occupancyPercent: rt.occupancy_percent,
                    departureTime: (rt as any).departure_time || undefined,
                    estimatedReturnTime: (rt as any).estimated_return_time || undefined,
                  }))}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* All Orders List */}
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
                      {order.product_description && (
                        <p className="text-xs text-muted-foreground italic">{order.product_description}</p>
                      )}
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
