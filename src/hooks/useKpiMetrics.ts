import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo, useState } from 'react';

export type KpiPeriod = 'today' | '7d' | '30d';

function getDateRange(period: KpiPeriod) {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    prevEnd = new Date(start);
  } else if (period === '7d') {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
    prevEnd = new Date(start);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 7);
  } else {
    start = new Date(now);
    start.setDate(start.getDate() - 30);
    prevEnd = new Date(start);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 30);
  }

  return {
    start: start.toISOString(),
    end,
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
  };
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function useKpiMetrics() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<KpiPeriod>('7d');
  const range = useMemo(() => getDateRange(period), [period]);

  const routesQuery = useQuery({
    queryKey: ['kpi-routes', user?.id, range.start, range.end],
    queryFn: async () => {
      const [current, previous] = await Promise.all([
        supabase.from('routes').select('total_orders, total_weight_kg, created_at')
          .gte('created_at', range.start).lte('created_at', range.end),
        supabase.from('routes').select('total_orders, total_weight_kg')
          .gte('created_at', range.prevStart).lte('created_at', range.prevEnd),
      ]);
      return { current: current.data ?? [], previous: previous.data ?? [] };
    },
    enabled: !!user,
  });

  const occupancyQuery = useQuery({
    queryKey: ['kpi-occupancy', user?.id, range.start, range.end],
    queryFn: async () => {
      const { data: routeTrucks } = await supabase
        .from('route_trucks')
        .select('total_weight_kg, truck_id, route_id')
        .gte('created_at', range.start)
        .lte('created_at', range.end);

      if (!routeTrucks?.length) return 0;

      const truckIds = [...new Set(routeTrucks.map(rt => rt.truck_id))];
      const { data: trucks } = await supabase
        .from('trucks')
        .select('id, capacity_kg')
        .in('id', truckIds);

      const capacityMap = new Map(trucks?.map(t => [t.id, Number(t.capacity_kg)]) ?? []);
      let totalOccupancy = 0;
      let count = 0;

      for (const rt of routeTrucks) {
        const cap = capacityMap.get(rt.truck_id);
        if (cap && cap > 0) {
          totalOccupancy += (Number(rt.total_weight_kg) / cap) * 100;
          count++;
        }
      }

      return count > 0 ? Math.round(totalOccupancy / count) : 0;
    },
    enabled: !!user,
  });

  const deliveryQuery = useQuery({
    queryKey: ['kpi-deliveries', user?.id, range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_executions')
        .select('status, created_at')
        .gte('created_at', range.start)
        .lte('created_at', range.end);

      if (error || !data) return { completed: 0, total: 0 };
      const completed = data.filter(d => d.status === 'entregue').length;
      return { completed, total: data.length };
    },
    enabled: !!user,
  });

  const citiesQuery = useQuery({
    queryKey: ['kpi-cities', user?.id, range.start, range.end],
    queryFn: async () => {
      // Get route IDs in period first
      const { data: routes } = await supabase
        .from('routes')
        .select('id')
        .gte('created_at', range.start)
        .lte('created_at', range.end);

      if (!routes?.length) return 0;

      const routeIds = routes.map(r => r.id);
      const { data: orders } = await supabase
        .from('orders')
        .select('city')
        .in('route_id', routeIds)
        .not('city', 'is', null);

      const uniqueCities = new Set(orders?.map(o => o.city?.toLowerCase().trim()).filter(Boolean));
      return uniqueCities.size;
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    const currentRoutes = routesQuery.data?.current ?? [];
    const previousRoutes = routesQuery.data?.previous ?? [];

    const totalOrders = currentRoutes.reduce((s, r) => s + r.total_orders, 0);
    const prevOrders = previousRoutes.reduce((s, r) => s + r.total_orders, 0);

    const totalWeight = currentRoutes.reduce((s, r) => s + Number(r.total_weight_kg), 0);
    const prevWeight = previousRoutes.reduce((s, r) => s + Number(r.total_weight_kg), 0);

    const delivery = deliveryQuery.data ?? { completed: 0, total: 0 };
    const completionRate = delivery.total > 0
      ? Math.round((delivery.completed / delivery.total) * 100)
      : 0;

    return {
      totalOrders,
      ordersTrend: calcTrend(totalOrders, prevOrders),
      totalWeight,
      weightTrend: calcTrend(totalWeight, prevWeight),
      occupancy: occupancyQuery.data ?? 0,
      completionRate,
      completedDeliveries: delivery.completed,
      totalDeliveries: delivery.total,
      citiesServed: citiesQuery.data ?? 0,
    };
  }, [routesQuery.data, occupancyQuery.data, deliveryQuery.data, citiesQuery.data]);

  const isLoading = routesQuery.isLoading || occupancyQuery.isLoading ||
    deliveryQuery.isLoading || citiesQuery.isLoading;

  return { metrics, period, setPeriod, isLoading };
}
