import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ReschedulableOrder {
  execution_id: string;
  order_id: string;
  client_name: string;
  address: string;
  city: string | null;
  weight_kg: number;
  pedido_id: string | null;
  product_description: string | null;
  delivery_status: string;
  delivered_at: string | null;
  observations: string | null;
}

export function useRescheduleOrders() {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Busca todas as entregas de uma rota que podem ser reprogramadas.
   * Inclui todas as vendas roteirizadas, independente do status.
   */
  const fetchReschedulableOrders = useCallback(async (
    routeTruckIds: string[]
  ): Promise<ReschedulableOrder[]> => {
    if (!user || routeTruckIds.length === 0) return [];

    // Busca assignments dos caminhões da rota
    const { data: assignments } = await (supabase as any)
      .from('driver_assignments')
      .select('id')
      .in('route_truck_id', routeTruckIds);

    if (!assignments || assignments.length === 0) return [];

    const assignmentIds = assignments.map((a: any) => a.id);

    // Busca execuções com dados do pedido
    const { data: executions } = await (supabase as any)
      .from('delivery_executions')
      .select(`
        id,
        order_id,
        status,
        delivered_at,
        observations,
        order:orders(
          client_name,
          address,
          city,
          weight_kg,
          pedido_id,
          product_description
        )
      `)
      .in('driver_assignment_id', assignmentIds);

    if (!executions) return [];

    return executions.map((e: any) => ({
      execution_id: e.id,
      order_id: e.order_id,
      client_name: e.order?.client_name ?? 'Cliente desconhecido',
      address: e.order?.address ?? '',
      city: e.order?.city ?? null,
      weight_kg: e.order?.weight_kg ?? 0,
      pedido_id: e.order?.pedido_id ?? null,
      product_description: e.order?.product_description ?? null,
      delivery_status: e.status,
      delivered_at: e.delivered_at,
      observations: e.observations,
    }));
  }, [user]);

  /**
   * Insere os pedidos selecionados na tabela pending_orders com status 'deprioritized'
   * para aparecerem no pop-up da próxima roteirização.
   */
  const rescheduleOrders = useCallback(async (
    orders: ReschedulableOrder[],
    sourceRouteId: string
  ): Promise<number> => {
    if (!user || orders.length === 0) return 0;

    const rows = orders.map(o => ({
      user_id: user.id,
      client_name: o.client_name,
      address: o.address,
      city: o.city ?? 'Desconhecida',
      weight_kg: o.weight_kg,
      pedido_id: o.pedido_id ?? null,
      product_description: o.product_description ?? null,
      status: 'deprioritized',          // aparece no pop-up da próxima rota
      route_id: sourceRouteId,           // rastreia de qual rota veio
      original_upload_date: new Date().toISOString().split('T')[0],
    }));

    const { error, data } = await (supabase as any)
      .from('pending_orders')
      .insert(rows)
      .select('id');

    if (error) {
      console.error('[rescheduleOrders] error:', error);
      toast({
        title: 'Erro ao reprogramar',
        description: 'Não foi possível reprogramar as vendas. Tente novamente.',
        variant: 'destructive',
      });
      return 0;
    }

    toast({
      title: `${orders.length} venda${orders.length > 1 ? 's' : ''} reprogramada${orders.length > 1 ? 's' : ''}`,
      description: 'Elas aparecerão no pop-up da próxima roteirização.',
    });

    return (data as any[]).length;
  }, [user, toast]);

  return {
    fetchReschedulableOrders,
    rescheduleOrders,
  };
}
