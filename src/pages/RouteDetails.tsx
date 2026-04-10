import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Package, Calculator, FileDown, Map, Clock, MapPin, Route as RouteIcon, AlertCircle, ChevronLeft, Lock, Unlock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouteDetails } from '@/hooks/useRoutes';
import { useTrucks } from '@/hooks/useTrucks';


import { Truck as TruckType, ParsedOrder, RoutingStrategy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ManifestViewer } from '@/components/route/ManifestViewer';
import { LoadingManifest } from '@/components/route/LoadingManifest';

import { RouteWorkflowStepper, getActiveStep, RouteWorkflowStep } from '@/components/route/RouteWorkflowStepper';
import { RouteMap } from '@/components/route/RouteMap';
import { DepartureTimeConfig } from '@/components/route/DepartureTimeConfig';
import { TruckTimelineSummary } from '@/components/route/RouteTimeline';
import { RoutingStrategySelector } from '@/components/route/RoutingStrategySelector';

import { SideBySideManifests } from '@/components/route/SideBySideManifests';
import { TruckManifestCards } from '@/components/route/TruckManifestCards';
import { TruckRouteEditor } from '@/components/route/TruckRouteEditor';
import { DriverAssignment } from '@/components/route/DriverAssignment';
import { ExecutionTracker } from '@/components/route/ExecutionTracker';

// Helper function to get strategy label
function getStrategyLabel(strategy: RoutingStrategy): string {
  const labels: Record<RoutingStrategy, string> = {
    padrao: 'Padrão',
    finalizacao_proxima: 'Finalização próxima ao CD',
    finalizacao_distante: 'Finalização distante',
  };
  return labels[strategy] || strategy;
}

// Workflow step order for navigation
const WORKFLOW_ORDER: RouteWorkflowStep[] = [
  'select_trucks',
  'distribute_load',
  'loading_manifest',
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
    moveOrderToTruck,
    reorderSingleDelivery,
    lockTruckRoute,
    unlockTruckRoute,
    refetch 
  } = useRouteDetails(id);
  const { activeTrucks } = useTrucks();
  

  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([]);
  const [hasAddedPendingOrders, setHasAddedPendingOrders] = useState(false);
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('padrao');
  const [showMap, setShowMap] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  
  
  // Track locked trucks (in-memory state until we add DB column)
  const [lockedTruckIds, setLockedTruckIds] = useState<Set<string>>(new Set());
  
  // Track orders that were manually moved between trucks
  const [manuallyMovedOrderIds, setManuallyMovedOrderIds] = useState<Set<string>>(new Set());
  
  // Debounced snapshot saving for continuous learning
  const snapshotTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  const saveTruckSnapshot = useCallback(async (truckId: string) => {
    // Clear previous timer for this truck
    if (snapshotTimerRef.current[truckId]) {
      clearTimeout(snapshotTimerRef.current[truckId]);
    }
    
    snapshotTimerRef.current[truckId] = setTimeout(async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { parseAddress } = await import('@/lib/geocoding');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !route) return;

        const rt = route.route_trucks.find(r => r.id === truckId);
        if (!rt) return;

        const plate = rt.truck?.plate || 'SEM-PLACA';
        const today = new Date().toISOString().split('T')[0];

        // Delete existing patterns for this truck+date to avoid duplicates
        await supabase
          .from('route_history_patterns')
          .delete()
          .eq('user_id', user.id)
          .eq('truck_label', plate)
          .eq('route_date', today);

        const patterns = (rt.assignments || [])
          .filter(a => a.order)
          .map(a => {
            const order = a.order!;
            const parsed = parseAddress(order.address);
            return {
              user_id: user.id,
              truck_label: plate,
              client_name: order.client_name,
              address: order.address,
              city: order.city || parsed.city || null,
              neighborhood: parsed.neighborhood || null,
              state: parsed.state || null,
              sequence_order: a.delivery_sequence ?? 0,
              route_date: today,
              was_manually_moved: true, // entire truck is analyst-validated when any edit occurs
            };
          });

        if (patterns.length > 0) {
          await supabase.from('route_history_patterns').insert(patterns);
          console.log(`[ContinuousLearning] Saved ${patterns.length} patterns for ${plate}`);
        }
      } catch (err) {
        console.error('[ContinuousLearning] Error saving snapshot:', err);
      }
    }, 2000);
  }, [route, manuallyMovedOrderIds]);
  
  // Track if fleet was pre-configured in wizard
  const [fleetFromWizard, setFleetFromWizard] = useState(false);
  

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
          city: o.city,
        })),
        {
          onSuccess: () => {
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

  // Handlers for TruckRouteEditor
  const handleOrderMoveToTruck = useCallback(async (
    orderId: string, 
    fromTruckId: string, 
    toTruckId: string, 
    newSequence: number
  ) => {
    // Track this order as manually moved
    setManuallyMovedOrderIds(prev => new Set([...prev, orderId]));
    await moveOrderToTruck.mutateAsync({ 
      orderId, 
      fromRouteTruckId: fromTruckId, 
      toRouteTruckId: toTruckId, 
      newSequence 
    });
    await refetch();
    // Save snapshots for both affected trucks
    saveTruckSnapshot(fromTruckId);
    saveTruckSnapshot(toTruckId);
  }, [moveOrderToTruck, refetch, saveTruckSnapshot]);

  const handleReorderInTruck = useCallback(async (
    truckId: string, 
    orderId: string, 
    newSequence: number
  ) => {
    // Track reordered orders as manually moved for learning
    setManuallyMovedOrderIds(prev => new Set([...prev, orderId]));
    await reorderSingleDelivery.mutateAsync({ routeTruckId: truckId, orderId, newSequence });
    // Save snapshot for learning
    saveTruckSnapshot(truckId);
  }, [reorderSingleDelivery, saveTruckSnapshot]);

  const handleLockTruck = useCallback(async (truckId: string) => {
    setLockedTruckIds(prev => new Set([...prev, truckId]));
    await lockTruckRoute.mutateAsync(truckId);
    // Continuous learning already handles snapshots via saveTruckSnapshot
    // Force an immediate save (no debounce) when locking
    saveTruckSnapshot(truckId);
  }, [lockTruckRoute, saveTruckSnapshot]);

  const handleUnlockTruck = useCallback(async (truckId: string) => {
    setLockedTruckIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(truckId);
      return newSet;
    });
    await unlockTruckRoute.mutateAsync(truckId);
  }, [unlockTruckRoute]);

  const handleConfirmAllRoutesAndProceed = useCallback(async () => {
    // Optimize routes with the selected strategy, skipping locked trucks
    const excludeIds = Array.from(lockedTruckIds);
    await optimizeRoutes.mutateAsync({ strategy: routingStrategy, excludeTruckIds: excludeIds });
    await refetch();

    // Save snapshot to route_history_patterns for learning
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { parseAddress } = await import('@/lib/geocoding');
      const { data: { user } } = await supabase.auth.getUser();
      if (user && route) {
        const today = new Date().toISOString().split('T')[0];
        const patterns: any[] = [];
        const truckPlates: string[] = [];
        const citiesSet = new Set<string>();

        for (const rt of route.route_trucks) {
          const plate = rt.truck?.plate || 'SEM-PLACA';
          truckPlates.push(plate);
          const assignments = rt.assignments || [];
          for (const a of assignments) {
            const order = a.order;
            if (!order) continue;
            
            // Extract neighborhood and state from address
            const parsed = parseAddress(order.address);
            const city = order.city || parsed.city || null;
            if (city) citiesSet.add(city);
            
            patterns.push({
              user_id: user.id,
              truck_label: plate,
              client_name: order.client_name,
              address: order.address,
              city,
              neighborhood: parsed.neighborhood || null,
              state: parsed.state || null,
              sequence_order: a.delivery_sequence ?? 0,
              route_date: today,
              was_manually_moved: manuallyMovedOrderIds.has(order.id),
            });
          }
        }

        if (patterns.length > 0) {
          await supabase.from('route_history_patterns').insert(patterns);
          console.log(`[PatternLearning] Saved ${patterns.length} patterns from confirmed routes`);
        }
        
        // Save fleet decision history
        await supabase.from('fleet_decision_history').insert({
          user_id: user.id,
          route_id: route.id,
          total_weight: Number(route.total_weight_kg),
          total_orders: route.total_orders,
          city_count: citiesSet.size,
          cities: Array.from(citiesSet),
          trucks_selected: route.route_trucks.length,
          truck_plates: truckPlates,
          routing_strategy: routingStrategy,
        });
        console.log(`[FleetHistory] Saved fleet decision: ${truckPlates.length} trucks, ${citiesSet.size} cities`);
      }
    } catch (err) {
      console.error('[PatternLearning] Error saving patterns:', err);
    }

    toast({
      title: 'Rotas confirmadas e otimizadas!',
      description: 'Os romaneios estão prontos para geração.',
    });
  }, [optimizeRoutes, routingStrategy, refetch, toast, route, lockedTruckIds, manuallyMovedOrderIds]);


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

        {/* Recovery Alert - No assignments OR partial assignments */}
        {(() => {
          const totalAssigned = route.route_trucks.reduce(
            (sum, rt) => sum + (rt.assignments?.length ?? 0), 0
          );
          const totalOrders = route.total_orders;
          const isPartial = totalAssigned > 0 && totalAssigned < totalOrders;
          const isZero = !hasAssignments && hasTrucks;
          const isInconsistent = (isZero || isPartial) && 
            (route.status === 'loading' || route.status === 'distributed' || route.status === 'loading_confirmed');
          
          if (!isInconsistent) return null;

          const missingCount = totalOrders - totalAssigned;

          return (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">
                        {isZero ? 'Distribuição inconsistente' : 'Distribuição incompleta'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isZero 
                          ? 'Nenhum pedido está atribuído aos caminhões. Reprocesse a distribuição.'
                          : `${totalAssigned} de ${totalOrders} pedidos atribuídos — ${missingCount} pedido(s) ficaram de fora. Redistribua as cargas.`
                        }
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="destructive"
                    disabled={distributeLoad.isPending}
                    onClick={async () => {
                      try {
                        const { supabase } = await import('@/integrations/supabase/client');
                        await Promise.all(
                          route.route_trucks.map(rt =>
                            supabase.from('route_trucks').update({ total_weight_kg: 0, total_orders: 0 }).eq('id', rt.id)
                          )
                        );
                        await supabase.from('routes').update({ status: 'trucks_assigned' }).eq('id', route.id);
                        await refetch();
                        await distributeLoad.mutateAsync();
                        await refetch();
                        toast({ title: 'Distribuição reprocessada com sucesso!' });
                      } catch (err: any) {
                        toast({ title: 'Erro ao reprocessar', description: err.message, variant: 'destructive' });
                      }
                    }}
                  >
                    {distributeLoad.isPending ? 'Reprocessando...' : 'Redistribuir Cargas'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })()}

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
        {/* ETAPA 3: AJUSTE MANUAL DE ROTAS + ROMANEIO */}
        {/* ============================================ */}
        {activeStep === 'loading_manifest' && (
          <div className="space-y-6">
            {/* Resumo de vendas por cidade */}
            {(() => {
              const cityTotals: Record<string, number> = {};
              for (const rt of route.route_trucks) {
                for (const a of (rt.assignments || [])) {
                  const city = a.order?.city || 'Sem cidade';
                  cityTotals[city] = (cityTotals[city] || 0) + 1;
                }
              }
              const sorted = Object.entries(cityTotals).sort((a, b) => b[1] - a[1]);
              if (sorted.length === 0) return null;
              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4" />
                      Resumo por Cidade ({sorted.reduce((s, [, v]) => s + v, 0)} vendas)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {sorted.map(([city, count], index) => (
                        <div
                          key={city}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-1.5",
                            index < 3 ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-border"
                          )}
                        >
                          <span className="text-sm capitalize">{city}</span>
                          <Badge
                            variant={index < 3 ? "default" : "outline"}
                            className="min-w-[1.5rem] justify-center text-xs font-bold"
                          >
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Editor de Rotas por Caminhão */}
            <TruckRouteEditor
              routeName={route.name}
              trucks={route.route_trucks.map(rt => ({
                truck: rt.truck!,
                routeTruckId: rt.id,
                orders: rt.assignments?.map(a => a.order!).filter(Boolean) ?? [],
                totalWeight: Number(rt.total_weight_kg),
                occupancyPercent: rt.occupancy_percent,
                isLocked: lockedTruckIds.has(rt.id),
              }))}
              onOrderMove={handleOrderMoveToTruck}
              onReorder={handleReorderInTruck}
              onLockTruck={handleLockTruck}
              onUnlockTruck={handleUnlockTruck}
              onConfirmAllRoutes={handleConfirmAllRoutesAndProceed}
              isProcessing={optimizeRoutes.isPending || moveOrderToTruck.isPending}
            />
            
            {/* Romaneio de Carga por Caminhão (para impressão) - colapsável */}
            <details className="group">
              <summary className="cursor-pointer list-none">
                <Card className="hover:bg-muted/30 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileDown className="h-4 w-4" />
                      Romaneios de Carga para Impressão
                      <ChevronLeft className="ml-auto h-4 w-4 transition-transform group-open:rotate-[-90deg]" />
                    </CardTitle>
                  </CardHeader>
                </Card>
              </summary>
              <div className="mt-4">
                <LoadingManifest
                  routeName={route.name}
                  date={new Date(route.created_at).toLocaleDateString('pt-BR')}
                  trucks={truckDataForComponents}
                />
              </div>
            </details>

          </div>
        )}

        {/* Etapa optimize_routes foi removida - agora a roteirização acontece diretamente na loading_manifest */}

        {/* ============================================ */}
        {/* ETAPA 6: ROMANEIO DE ENTREGA (FINAL)       */}
        {/* ============================================ */}
        {activeStep === 'delivery_manifest' && (
          <>
            {/* Map Visualization - Compact */}
            {showMap && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Map className="h-5 w-5" />
                    Mapa das Rotas
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
                    editable={true}
                    onOrderReorder={handleOrderReorder}
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

            {/* DOCUMENTOS POR CAMINHÃO - Layout com Cards */}
            <TruckManifestCards
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
          </>
        )}

        {/* Driver Assignment - shown when route is distributed/completed */}
        {(activeStep === 'delivery_manifest' || route.status === 'distributed' || route.status === 'completed') && route.route_trucks.length > 0 && (
          <DriverAssignment
            routeTrucks={route.route_trucks}
            routeId={route.id}
            onAssigned={() => refetch()}
          />
        )}

        {/* Execution Tracker - shown when route has driver assignments */}
        {route.route_trucks.length > 0 && (
          <ExecutionTracker
            routeTrucks={route.route_trucks}
            routeName={route.name}
          />
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
