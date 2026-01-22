import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Order, RouteTruck, OrderAssignment, RoutingStrategy } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { distributeOrders, reorderDeliveriesByStrategy } from '@/lib/distribution';
import { optimizeDeliveryOrder } from '@/lib/routing';
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

          return {
            ...rt,
            assignments: assignments ?? [],
            occupancy_percent: rt.truck
              ? Math.round((Number(rt.total_weight_kg) / Number(rt.truck.capacity_kg)) * 100)
              : 0,
          };
        })
      );

      return {
        ...route,
        orders: orders ?? [],
        route_trucks: routeTrucksWithAssignments,
      };
    },
    enabled: !!routeId,
  });

  const addOrders = useMutation({
    mutationFn: async (orders: Array<{ client_name: string; address: string; weight_kg: number }>) => {
      const ordersToInsert = orders.map((o, index) => ({
        route_id: routeId!,
        client_name: o.client_name,
        address: o.address,
        weight_kg: o.weight_kg,
        sequence_order: index + 1,
      }));

      const { data, error } = await supabase
        .from('orders')
        .insert(ordersToInsert)
        .select();

      if (error) throw error;

      // Update route totals
      const totalWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
      await supabase
        .from('routes')
        .update({
          total_weight_kg: (routeQuery.data?.total_weight_kg ?? 0) + totalWeight,
          total_orders: (routeQuery.data?.total_orders ?? 0) + orders.length,
        })
        .eq('id', routeId!);

      return data;
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atribuir caminhões',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const distributeOrdersMutation = useMutation({
    mutationFn: async (strategy: RoutingStrategy = 'economy') => {
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
      const ordersMap = new Map(route.orders.map(o => [o.id, o]));

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
        .update({ status: 'planned' })
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
            .map(r => route.orders.find(o => o.id === r.orderId))
            .filter((o): o is Order => o !== undefined);
          
          const routeMetrics = optimizeDeliveryOrder(truckOrders, 'economy');
          
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

  return {
    route: routeQuery.data,
    isLoading: routeQuery.isLoading,
    error: routeQuery.error,
    addOrders,
    deleteOrder,
    assignTrucks,
    distributeOrders: distributeOrdersMutation,
    reorderDeliveries,
    refetch: routeQuery.refetch,
  };
}
