import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Route, Order, RouteTruck, OrderAssignment } from '@/types';
import { useToast } from '@/hooks/use-toast';

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

  const distributeOrders = useMutation({
    mutationFn: async () => {
      const route = routeQuery.data;
      if (!route || route.route_trucks.length === 0 || route.orders.length === 0) {
        throw new Error('É necessário ter pedidos e caminhões atribuídos');
      }

      // Simple distribution algorithm: balance by weight
      const trucks = route.route_trucks.map((rt) => ({
        id: rt.id,
        capacity: Number(rt.truck?.capacity_kg ?? 0),
        currentWeight: 0,
        orders: [] as { orderId: string; weight: number; sequence: number }[],
      }));

      // Sort orders by weight descending for better distribution
      const sortedOrders = [...route.orders].sort(
        (a, b) => Number(b.weight_kg) - Number(a.weight_kg)
      );

      // Distribute orders to trucks with least load that can fit the order
      for (const order of sortedOrders) {
        const orderWeight = Number(order.weight_kg);
        
        // Find truck with least weight that can still fit this order
        const availableTrucks = trucks
          .filter((t) => t.currentWeight + orderWeight <= t.capacity)
          .sort((a, b) => a.currentWeight - b.currentWeight);

        if (availableTrucks.length === 0) {
          // If no truck can fit, assign to truck with most remaining capacity
          const truckWithMostSpace = [...trucks].sort(
            (a, b) => (b.capacity - b.currentWeight) - (a.capacity - a.currentWeight)
          )[0];
          truckWithMostSpace.currentWeight += orderWeight;
          truckWithMostSpace.orders.push({
            orderId: order.id,
            weight: orderWeight,
            sequence: truckWithMostSpace.orders.length + 1,
          });
        } else {
          availableTrucks[0].currentWeight += orderWeight;
          availableTrucks[0].orders.push({
            orderId: order.id,
            weight: orderWeight,
            sequence: availableTrucks[0].orders.length + 1,
          });
        }
      }

      // Clear existing assignments
      for (const rt of route.route_trucks) {
        await supabase.from('order_assignments').delete().eq('route_truck_id', rt.id);
      }

      // Create new assignments and update route_truck totals
      for (const truck of trucks) {
        if (truck.orders.length > 0) {
          const assignmentsToInsert = truck.orders.map((o) => ({
            order_id: o.orderId,
            route_truck_id: truck.id,
            delivery_sequence: o.sequence,
          }));

          await supabase.from('order_assignments').insert(assignmentsToInsert);
        }

        // Update route_truck totals
        await supabase
          .from('route_trucks')
          .update({
            total_weight_kg: truck.currentWeight,
            total_orders: truck.orders.length,
          })
          .eq('id', truck.id);
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
      toast({ title: 'Distribuição concluída!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro na distribuição',
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
    distributeOrders,
    refetch: routeQuery.refetch,
  };
}
