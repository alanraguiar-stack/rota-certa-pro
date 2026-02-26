import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Order, RouteTruck, OrderAssignment, RoutingStrategy, OrderItem, ParsedOrderItem, ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { distributeOrders, reorderDeliveriesByStrategy } from '@/lib/distribution';
import { autoComposeRoute } from '@/lib/autoRouterEngine';
import { optimizeDeliveryOrder } from '@/lib/routing';

// Helper to convert Supabase order to local Order type
function toOrder(o: unknown): Order | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const obj = o as Record<string, unknown>;
  return {
    id: String(obj.id ?? ''),
    route_id: String(obj.route_id ?? ''),
    client_name: String(obj.client_name ?? ''),
    address: String(obj.address ?? ''),
    weight_kg: Number(obj.weight_kg ?? 0),
    product_description: obj.product_description != null ? String(obj.product_description) : null,
    sequence_order: obj.sequence_order != null ? Number(obj.sequence_order) : null,
    created_at: String(obj.created_at ?? ''),
    latitude: obj.latitude != null ? Number(obj.latitude) : null,
    longitude: obj.longitude != null ? Number(obj.longitude) : null,
    geocoding_status: obj.geocoding_status != null ? String(obj.geocoding_status) : null,
    city: obj.city != null ? String(obj.city) : null,
  };
}
export function useRoutes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const routesQuery = useQuery({
    queryKey: ['routes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Route[];
    },
    enabled: !!user,
  });

  const createRoute = useMutation({
    mutationFn: async (name: string) => {
      const { data: route, error } = await supabase
        .from('routes')
        .insert({
          user_id: user!.id,
          name,
        })
        .select()
        .single();

      if (error) throw error;
      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar rota',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateRoute = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Route> }) => {
      const { data: route, error } = await supabase
        .from('routes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar rota',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Rota removida!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover rota',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    routes: routesQuery.data ?? [],
    isLoading: routesQuery.isLoading,
    error: routesQuery.error,
    createRoute,
    updateRoute,
    deleteRoute,
  };
}

export function useRouteDetails(routeId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const routeQuery = useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      if (!routeId) return null;

      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', routeId)
        .maybeSingle();

      if (routeError) throw routeError;
      if (!route) return null;

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('route_id', routeId)
        .order('sequence_order', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch order items for all orders
      const orderIds = (orders ?? []).map(o => o.id);
      let orderItems: Record<string, OrderItem[]> = {};
      
      if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (!itemsError && items) {
          // Group items by order_id
          items.forEach(item => {
            if (!orderItems[item.order_id]) {
              orderItems[item.order_id] = [];
            }
            orderItems[item.order_id].push(item as OrderItem);
          });
        }
      }

      // Attach items to orders
      const ordersWithItems = (orders ?? []).map(order => ({
        ...order,
        items: orderItems[order.id] || [],
      }));

      const { data: routeTrucks, error: trucksError } = await supabase
        .from('route_trucks')
        .select(`
          *,
          truck:trucks(*)
        `)
        .eq('route_id', routeId);

      if (trucksError) throw trucksError;

      // Get assignments for each route_truck
      const routeTrucksWithAssignments = await Promise.all(
        (routeTrucks ?? []).map(async (rt) => {
          const { data: assignments } = await supabase
            .from('order_assignments')
            .select(`
              *,
              order:orders(*)
            `)
            .eq('route_truck_id', rt.id)
            .order('delivery_sequence', { ascending: true });

          // Attach items to orders in assignments
          const assignmentsWithItems = (assignments ?? []).map(assignment => {
            const order = assignment.order as any;
            if (order) {
              return {
                ...assignment,
                order: {
                  ...order,
                  items: orderItems[order.id] || [],
                },
              };
            }
            return assignment;
          });

          return {
            ...rt,
            assignments: assignmentsWithItems,
            occupancy_percent: rt.truck
              ? Math.round((Number(rt.total_weight_kg) / Number(rt.truck.capacity_kg)) * 100)
              : 0,
          };
        })
      );

      return {
        ...route,
        orders: ordersWithItems,
        route_trucks: routeTrucksWithAssignments,
      };
    },
    enabled: !!routeId,
  });

  const addOrders = useMutation({
    mutationFn: async (orders: Array<{ 
      client_name: string; 
      address: string; 
      weight_kg: number; 
      product_description?: string;
      items?: ParsedOrderItem[];
      city?: string;
    }>) => {
      const ordersToInsert = orders.map((o, index) => ({
        route_id: routeId!,
        client_name: o.client_name,
        address: o.address,
        weight_kg: o.weight_kg,
        product_description: o.product_description || null,
        sequence_order: index + 1,
        city: o.city || null,
      }));

      const { data: insertedOrders, error } = await supabase
        .from('orders')
        .insert(ordersToInsert)
        .select();

      if (error) throw error;
      if (!insertedOrders) throw new Error('Falha ao inserir pedidos');

      // Insert order items for each order
      const itemsToInsert: Array<{
        order_id: string;
        product_name: string;
        weight_kg: number;
        quantity: number;
      }> = [];

      insertedOrders.forEach((insertedOrder, index) => {
        const originalOrder = orders[index];
        if (originalOrder.items && originalOrder.items.length > 0) {
          originalOrder.items.forEach(item => {
            itemsToInsert.push({
              order_id: insertedOrder.id,
              product_name: item.product_name,
              weight_kg: item.weight_kg,
              quantity: item.quantity,
            });
          });
        }
      });

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Failed to insert order items:', itemsError);
          // Don't throw - orders are already inserted
        }
      }

      // Update route totals
      const totalWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
      await supabase
        .from('routes')
        .update({
          total_weight_kg: (routeQuery.data?.total_weight_kg ?? 0) + totalWeight,
          total_orders: (routeQuery.data?.total_orders ?? 0) + orders.length,
        })
        .eq('id', routeId!);

      return insertedOrders;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Pedidos adicionados!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar pedidos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const order = routeQuery.data?.orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Pedido não encontrado');

      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;

      // Update route totals
      await supabase
        .from('routes')
        .update({
          total_weight_kg: Math.max(0, (routeQuery.data?.total_weight_kg ?? 0) - Number(order.weight_kg)),
          total_orders: Math.max(0, (routeQuery.data?.total_orders ?? 0) - 1),
        })
        .eq('id', routeId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Pedido removido!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover pedido',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const assignTrucks = useMutation({
    mutationFn: async (truckIds: string[]) => {
      // Remove existing assignments
      await supabase.from('route_trucks').delete().eq('route_id', routeId!);

      // Create new route_trucks
      const routeTrucksToInsert = truckIds.map((truckId) => ({
        route_id: routeId!,
        truck_id: truckId,
      }));

      const { data, error } = await supabase
        .from('route_trucks')
        .insert(routeTrucksToInsert)
        .select();

      if (error) throw error;

      // Update route status to trucks_assigned
      await supabase
        .from('routes')
        .update({ status: 'trucks_assigned' })
        .eq('id', routeId!);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atribuir caminhões',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Step 1: Distribute orders to trucks (Romaneio de Carga - without route optimization)
  const distributeLoadMutation = useMutation({
    mutationFn: async () => {
      const route = routeQuery.data;
      if (!route || route.route_trucks.length === 0 || route.orders.length === 0) {
        throw new Error('É necessário ter pedidos e caminhões atribuídos');
      }

      // Convert DB orders to ParsedOrder format for the anchor engine
      const parsedOrders: ParsedOrder[] = route.orders.map(o => ({
        pedido_id: o.id,
        client_name: o.client_name,
        address: o.address,
        weight_kg: Number(o.weight_kg),
        product_description: o.product_description,
        city: (o as any).city || undefined,
        items: (o.items || []).map(item => ({
          product_name: item.product_name,
          weight_kg: Number(item.weight_kg),
          quantity: item.quantity,
        })),
        isValid: true,
      }));

      // Get truck objects from route_trucks
      const trucks = route.route_trucks
        .map(rt => rt.truck!)
        .filter(Boolean);

      // Use anchor-based engine instead of generic distribution
      const result = autoComposeRoute(parsedOrders, trucks, { strategy: 'padrao' });

      console.log('[distributeLoad] autoComposeRoute result:', {
        compositions: result.compositions.map(c => ({
          plate: c.truck.plate,
          orders: c.orders.length,
          cities: c.cities,
        })),
        warnings: result.warnings,
        reasoning: result.reasoning,
      });

      // Clear existing assignments
      for (const rt of route.route_trucks) {
        await supabase.from('order_assignments').delete().eq('route_truck_id', rt.id);
      }

      // Map compositions back to route_trucks by truck ID
      for (const comp of result.compositions) {
        const rt = route.route_trucks.find(r => r.truck?.id === comp.truck.id);
        if (!rt) continue;

        if (comp.orders.length > 0) {
          const assignmentsToInsert = comp.orders.map((o, idx) => ({
            order_id: o.pedido_id!, // pedido_id is the order.id from DB
            route_truck_id: rt.id,
            delivery_sequence: idx + 1,
          }));

          await supabase.from('order_assignments').insert(assignmentsToInsert);
        }

        // Update route_truck totals
        await supabase
          .from('route_trucks')
          .update({
            total_weight_kg: comp.totalWeight,
            total_orders: comp.orders.length,
          })
          .eq('id', rt.id);
      }

      // Update route status to 'loading' (ready for loading manifest)
      console.log('[distributeLoad] Updating route status to loading for routeId:', routeId);
      
      const { error: statusError, data: statusData } = await supabase
        .from('routes')
        .update({ status: 'loading' })
        .eq('id', routeId!)
        .select();

      console.log('[distributeLoad] Status update result:', { statusData, statusError });

      if (statusError) {
        console.error('[distributeLoad] Failed to update route status:', statusError);
        throw new Error(`Erro ao atualizar status: ${statusError.message}`);
      }

      if (!statusData || statusData.length === 0) {
        console.warn('[distributeLoad] No rows updated - RLS policy may be blocking the update');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Carga distribuída! Gere o Romaneio de Carga.' });
    },
    onError: (error) => {
      toast({
        title: 'Erro na distribuição de carga',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Step 2: Confirm loading (after physical loading is done)
  const confirmLoadingMutation = useMutation({
    mutationFn: async (confirmedBy: string) => {
      await supabase
        .from('routes')
        .update({ 
          status: 'loading_confirmed',
          loading_confirmed_at: new Date().toISOString(),
          loading_confirmed_by: confirmedBy,
        })
        .eq('id', routeId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Carregamento confirmado! Pronto para roteirizar.' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao confirmar carregamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Step 3: Route optimization (after loading is confirmed)
  const optimizeRoutesMutation = useMutation({
    mutationFn: async (strategy: RoutingStrategy = 'padrao') => {
      const route = routeQuery.data;
      if (!route || route.route_trucks.length === 0) {
        throw new Error('É necessário ter caminhões com carga atribuída');
      }

      const ordersMap = new Map(route.orders.map(o => [o.id, toOrder(o)]).filter((entry): entry is [string, Order] => entry[1] !== undefined));

      // Optimize each truck's route
      for (const rt of route.route_trucks) {
        const assignments = rt.assignments || [];
        const truckOrders = assignments
          .map(a => ordersMap.get(a.order?.id || ''))
          .filter((o): o is Order => o !== undefined);

        if (truckOrders.length === 0) continue;

        // Optimize route based on actual addresses
        const optimizedRoute = optimizeDeliveryOrder(truckOrders, strategy);

        // Update assignment sequences based on optimized route
        for (let i = 0; i < optimizedRoute.orderedDeliveries.length; i++) {
          const delivery = optimizedRoute.orderedDeliveries[i];
          const assignment = assignments.find(a => a.order?.id === delivery.order.id);
          if (assignment) {
            await supabase
              .from('order_assignments')
              .update({ delivery_sequence: i + 1 })
              .eq('id', assignment.id);
          }
        }

        // Update route_truck with distance and time estimates
        await supabase
          .from('route_trucks')
          .update({
            estimated_distance_km: optimizedRoute.totalDistance,
            estimated_time_minutes: optimizedRoute.estimatedMinutes,
          })
          .eq('id', rt.id);
      }

      // Update route status to 'distributed'
      await supabase
        .from('routes')
        .update({ status: 'distributed' })
        .eq('id', routeId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Rotas otimizadas! Gere os Romaneios de Entrega.' });
    },
    onError: (error) => {
      toast({
        title: 'Erro na roteirização',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Legacy: Combined distribution (for backwards compatibility)
  const distributeOrdersMutation = useMutation({
    mutationFn: async (strategy: RoutingStrategy = 'padrao') => {
      const route = routeQuery.data;
      if (!route || route.route_trucks.length === 0 || route.orders.length === 0) {
        throw new Error('É necessário ter pedidos e caminhões atribuídos');
      }

      // Use the advanced distribution algorithm
      const routeTrucks = route.route_trucks.map(rt => ({
        id: rt.id,
        truck: rt.truck!,
      }));

      const distributionResult = distributeOrders(
        route.orders,
        routeTrucks,
        strategy
      );

      // Reorder deliveries based on routing strategy
      const reorderedDistributions = reorderDeliveriesByStrategy(
        distributionResult.distributions,
        route.orders,
        strategy
      );

      // Now optimize each truck's route using real address-based routing
      const ordersMap = new Map(route.orders.map(o => [o.id, toOrder(o)]).filter((entry): entry is [string, Order] => entry[1] !== undefined));

      for (const dist of reorderedDistributions) {
        // Get orders for this truck
        const truckOrders = dist.orders
          .map(o => ordersMap.get(o.orderId))
          .filter((o): o is Order => o !== undefined);

        // Optimize route based on actual addresses
        const optimizedRoute = optimizeDeliveryOrder(truckOrders, strategy);

        // Update order sequences based on optimized route
        dist.orders = optimizedRoute.orderedDeliveries.map((delivery, index) => ({
          orderId: delivery.order.id,
          weight: Number(delivery.order.weight_kg),
          sequence: index + 1,
        }));
      }

      // Clear existing assignments
      for (const rt of route.route_trucks) {
        await supabase.from('order_assignments').delete().eq('route_truck_id', rt.id);
      }

      // Create new assignments and update route_truck totals
      for (const dist of reorderedDistributions) {
        if (dist.orders.length > 0) {
          const assignmentsToInsert = dist.orders.map((o) => ({
            order_id: o.orderId,
            route_truck_id: dist.routeTruckId,
            delivery_sequence: o.sequence,
          }));

          await supabase.from('order_assignments').insert(assignmentsToInsert);
        }

        // Calculate route metrics
        const truckOrders = dist.orders
          .map(o => ordersMap.get(o.orderId))
          .filter((o): o is Order => o !== undefined);
        
        const routeMetrics = optimizeDeliveryOrder(truckOrders, strategy);

        // Update route_truck totals with distance and time estimates
        await supabase
          .from('route_trucks')
          .update({
            total_weight_kg: dist.currentWeight,
            total_orders: dist.orders.length,
            estimated_distance_km: routeMetrics.totalDistance,
            estimated_time_minutes: routeMetrics.estimatedMinutes,
          })
          .eq('id', dist.routeTruckId);
      }

      // Update route status
      await supabase
        .from('routes')
        .update({ status: 'distributed' })
        .eq('id', routeId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({ title: 'Distribuição otimizada concluída!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro na distribuição',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const reorderDeliveries = useMutation({
    mutationFn: async (reorders: Array<{ orderId: string; truckId: string; newSequence: number }>) => {
      const route = routeQuery.data;
      if (!route) throw new Error('Rota não encontrada');

      // Group reorders by truck
      const reordersByTruck = new Map<string, typeof reorders>();
      
      for (const reorder of reorders) {
        // Find the route_truck_id for this truck
        const routeTruck = route.route_trucks.find(rt => rt.truck?.id === reorder.truckId);
        if (!routeTruck) continue;
        
        const existing = reordersByTruck.get(routeTruck.id) ?? [];
        existing.push(reorder);
        reordersByTruck.set(routeTruck.id, existing);
      }

      // Update each assignment's delivery_sequence
      for (const [routeTruckId, truckReorders] of reordersByTruck) {
        for (const reorder of truckReorders) {
          // Find the assignment for this order
          const routeTruck = route.route_trucks.find(rt => rt.id === routeTruckId);
          const assignment = routeTruck?.assignments?.find(a => a.order?.id === reorder.orderId);
          
          if (assignment) {
            await supabase
              .from('order_assignments')
              .update({ delivery_sequence: reorder.newSequence })
              .eq('id', assignment.id);
          }
        }

        // Recalculate route metrics for this truck
        const routeTruck = route.route_trucks.find(rt => rt.id === routeTruckId);
        if (routeTruck) {
          const truckOrders = truckReorders
            .sort((a, b) => a.newSequence - b.newSequence)
            .map(r => toOrder(route.orders.find(o => o.id === r.orderId)))
            .filter((o): o is Order => o !== undefined);
          
          const routeMetrics = optimizeDeliveryOrder(truckOrders, 'padrao');
          
          await supabase
            .from('route_trucks')
            .update({
              estimated_distance_km: routeMetrics.totalDistance,
              estimated_time_minutes: routeMetrics.estimatedMinutes,
            })
            .eq('id', routeTruckId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      toast({ title: 'Ordem de entrega atualizada!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao reordenar entregas',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateDepartureTimes = useMutation({
    mutationFn: async (schedules: Array<{
      routeTruckId: string;
      departureTime: string;
      departureDate: string;
      deliveryTimeMinutes: number;
    }>) => {
      const route = routeQuery.data;
      if (!route) throw new Error('Rota não encontrada');

      for (const schedule of schedules) {
        const routeTruck = route.route_trucks.find(rt => rt.id === schedule.routeTruckId);
        if (!routeTruck) continue;

        // Calculate estimated times based on departure + route duration
        const estimatedMinutes = routeTruck.estimated_time_minutes || 0;
        const totalOrders = routeTruck.total_orders || 0;
        
        // Parse departure time
        const [hours, mins] = schedule.departureTime.split(':').map(Number);
        const departureMinutes = hours * 60 + mins;
        
        // Calculate delivery time (travel * 0.7 + stops * delivery_time)
        const travelTime = estimatedMinutes * 0.7;
        const deliveryStopTime = totalOrders * schedule.deliveryTimeMinutes;
        const lastDeliveryMinutes = departureMinutes + travelTime + deliveryStopTime;
        
        // Calculate return time (add remaining travel)
        const returnMinutes = lastDeliveryMinutes + (estimatedMinutes * 0.3);
        
        // Convert back to time strings
        const lastDeliveryHours = Math.floor(lastDeliveryMinutes / 60) % 24;
        const lastDeliveryMins = Math.round(lastDeliveryMinutes % 60);
        const returnHours = Math.floor(returnMinutes / 60) % 24;
        const returnMins = Math.round(returnMinutes % 60);
        
        const estimatedLastDeliveryTime = `${lastDeliveryHours.toString().padStart(2, '0')}:${lastDeliveryMins.toString().padStart(2, '0')}`;
        const estimatedReturnTime = `${returnHours.toString().padStart(2, '0')}:${returnMins.toString().padStart(2, '0')}`;

        await supabase
          .from('route_trucks')
          .update({
            departure_time: schedule.departureTime,
            departure_date: schedule.departureDate,
            delivery_time_minutes: schedule.deliveryTimeMinutes,
            estimated_last_delivery_time: estimatedLastDeliveryTime,
            estimated_return_time: estimatedReturnTime,
          } as any)
          .eq('id', schedule.routeTruckId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      toast({ title: 'Horários atualizados!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar horários',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateOrderAddress = useMutation({
    mutationFn: async ({ orderId, newAddress }: { orderId: string; newAddress: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          address: newAddress,
          geocoding_status: 'pending',
          latitude: null,
          longitude: null,
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar endereço',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const setManualCoords = useMutation({
    mutationFn: async ({ orderId, lat, lng }: { orderId: string; lat: number; lng: number }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          latitude: lat,
          longitude: lng,
          geocoding_status: 'manual',
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      toast({ title: 'Coordenadas definidas manualmente!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao definir coordenadas',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Move order between trucks
  const moveOrderToTruck = useMutation({
    mutationFn: async ({ 
      orderId, 
      fromRouteTruckId, 
      toRouteTruckId, 
      newSequence 
    }: { 
      orderId: string; 
      fromRouteTruckId: string;
      toRouteTruckId: string; 
      newSequence: number;
    }) => {
      const route = routeQuery.data;
      if (!route) throw new Error('Rota não encontrada');
      
      const order = route.orders.find(o => o.id === orderId);
      if (!order) throw new Error('Pedido não encontrado');
      
      const toRouteTruck = route.route_trucks.find(rt => rt.id === toRouteTruckId);
      if (!toRouteTruck) throw new Error('Caminhão destino não encontrado');
      
      // Delete old assignment
      await supabase
        .from('order_assignments')
        .delete()
        .eq('order_id', orderId);
      
      // Create new assignment in destination truck
      const { error: insertError } = await supabase
        .from('order_assignments')
        .insert({
          order_id: orderId,
          route_truck_id: toRouteTruckId,
          delivery_sequence: newSequence,
        });
      
      if (insertError) throw insertError;
      
      // Recalculate totals for both trucks
      const fromTruck = route.route_trucks.find(rt => rt.id === fromRouteTruckId);
      if (fromTruck) {
        const newFromWeight = Number(fromTruck.total_weight_kg) - Number(order.weight_kg);
        const newFromOrders = (fromTruck.total_orders || 1) - 1;
        
        await supabase
          .from('route_trucks')
          .update({
            total_weight_kg: Math.max(0, newFromWeight),
            total_orders: Math.max(0, newFromOrders),
          })
          .eq('id', fromRouteTruckId);
      }
      
      const newToWeight = Number(toRouteTruck.total_weight_kg) + Number(order.weight_kg);
      const newToOrders = (toRouteTruck.total_orders || 0) + 1;
      
      await supabase
        .from('route_trucks')
        .update({
          total_weight_kg: newToWeight,
          total_orders: newToOrders,
        })
        .eq('id', toRouteTruckId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      toast({ title: 'Pedido movido com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao mover pedido',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Reorder single delivery within a truck
  const reorderSingleDelivery = useMutation({
    mutationFn: async ({ 
      routeTruckId, 
      orderId, 
      newSequence 
    }: { 
      routeTruckId: string; 
      orderId: string; 
      newSequence: number;
    }) => {
      const route = routeQuery.data;
      if (!route) throw new Error('Rota não encontrada');
      
      const routeTruck = route.route_trucks.find(rt => rt.id === routeTruckId);
      if (!routeTruck) throw new Error('Caminhão não encontrado');
      
      const assignments = routeTruck.assignments || [];
      const currentAssignment = assignments.find(a => a.order?.id === orderId);
      if (!currentAssignment) throw new Error('Atribuição não encontrada');
      
      const currentSequence = currentAssignment.delivery_sequence;
      const isMovingUp = newSequence < currentSequence;
      
      // Update other assignments' sequences
      for (const a of assignments) {
        if (a.id === currentAssignment.id) continue;
        
        let newSeq = a.delivery_sequence;
        
        if (isMovingUp) {
          // Moving up: shift others down
          if (a.delivery_sequence >= newSequence && a.delivery_sequence < currentSequence) {
            newSeq = a.delivery_sequence + 1;
          }
        } else {
          // Moving down: shift others up
          if (a.delivery_sequence > currentSequence && a.delivery_sequence <= newSequence) {
            newSeq = a.delivery_sequence - 1;
          }
        }
        
        if (newSeq !== a.delivery_sequence) {
          await supabase
            .from('order_assignments')
            .update({ delivery_sequence: newSeq })
            .eq('id', a.id);
        }
      }
      
      // Update the moved assignment
      await supabase
        .from('order_assignments')
        .update({ delivery_sequence: newSequence })
        .eq('id', currentAssignment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao reordenar entrega',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Lock/unlock truck route (for confirmation workflow)
  const lockTruckRoute = useMutation({
    mutationFn: async (routeTruckId: string) => {
      // We'll use a custom field or status - for now store in the route_trucks
      // Since we don't have a locked field, we can use estimated_return_time as a flag
      // or add metadata. For now, we'll set a special marker.
      // In production, you'd add a 'is_locked' column via migration.
      
      // For now, we'll track this in local state only and emit success
      // The UI will manage the locked state
      return { routeTruckId, locked: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
    },
  });

  const unlockTruckRoute = useMutation({
    mutationFn: async (routeTruckId: string) => {
      return { routeTruckId, locked: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
    },
  });

  return {
    route: routeQuery.data,
    isLoading: routeQuery.isLoading,
    error: routeQuery.error,
    addOrders,
    deleteOrder,
    assignTrucks,
    distributeLoad: distributeLoadMutation,
    confirmLoading: confirmLoadingMutation,
    optimizeRoutes: optimizeRoutesMutation,
    distributeOrders: distributeOrdersMutation,
    reorderDeliveries,
    updateDepartureTimes,
    updateOrderAddress,
    setManualCoords,
    moveOrderToTruck,
    reorderSingleDelivery,
    lockTruckRoute,
    unlockTruckRoute,
    refetch: routeQuery.refetch,
  };
}
