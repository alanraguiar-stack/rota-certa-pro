import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ParsedOrder } from '@/types';
import { useToast } from '@/hooks/use-toast';

export interface PendingOrder {
  id: string;
  user_id: string;
  client_name: string;
  address: string;
  city: string;
  weight_kg: number;
  pedido_id: string | null;
  product_description: string | null;
  original_upload_date: string;
  target_day_of_week: number | null;
  status: string;
  routed_at: string | null;
  route_id: string | null;
  created_at: string;
}

export function usePendingOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  /** Save filtered-out orders to backlog */
  const savePendingOrders = useCallback(async (
    orders: ParsedOrder[],
    citySchedule: Record<string, Set<number>>
  ): Promise<number> => {
    if (!user || orders.length === 0) return 0;

    const rows = orders.map(o => {
      // Find the target day(s) for this city
      const cityDays = citySchedule[o.city || ''];
      const targetDay = cityDays ? Array.from(cityDays)[0] : null; // first scheduled day

      return {
        user_id: user.id,
        client_name: o.client_name,
        address: o.address,
        city: o.city || 'Desconhecida',
        weight_kg: o.weight_kg,
        pedido_id: o.pedido_id || null,
        product_description: o.product_description || null,
        target_day_of_week: targetDay,
        status: 'pending',
      };
    });

    const { error } = await (supabase as any)
      .from('pending_orders')
      .insert(rows);

    if (error) {
      console.error('Error saving pending orders:', error);
      return 0;
    }

    return rows.length;
  }, [user]);

  /** Get pending orders whose cities are allowed for the given date */
  const getPendingOrdersForDate = useCallback(async (
    allowedCities: Set<string> | null
  ): Promise<PendingOrder[]> => {
    if (!user) return [];
    if (!allowedCities) return []; // calendar disabled = no backlog recovery

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('pending_orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    setLoading(false);
    if (error || !data) return [];

    // Filter to only cities allowed for the target date
    return (data as PendingOrder[]).filter(o =>
      allowedCities.has(o.city)
    );
  }, [user]);

  /** Get all pending orders for management view */
  const getAllPending = useCallback(async (): Promise<PendingOrder[]> => {
    if (!user) return [];
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from('pending_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setLoading(false);
    if (error) return [];
    return (data || []) as PendingOrder[];
  }, [user]);

  /** Mark orders as routed */
  const markAsRouted = useCallback(async (orderIds: string[], routeId: string) => {
    if (!user || orderIds.length === 0) return;

    await (supabase as any)
      .from('pending_orders')
      .update({
        status: 'routed',
        routed_at: new Date().toISOString(),
        route_id: routeId,
      })
      .in('id', orderIds);
  }, [user]);

  /** Cancel pending orders */
  const cancelPending = useCallback(async (orderIds: string[]) => {
    if (!user || orderIds.length === 0) return;

    await (supabase as any)
      .from('pending_orders')
      .update({ status: 'cancelled' })
      .in('id', orderIds);

    toast({
      title: 'Pedidos cancelados',
      description: `${orderIds.length} pedido(s) removido(s) do backlog`,
    });
  }, [user, toast]);

  /** Convert PendingOrder back to ParsedOrder for routing */
  const toParsedOrders = useCallback((pending: PendingOrder[]): ParsedOrder[] => {
    return pending.map(p => ({
      pedido_id: p.pedido_id || undefined,
      client_name: p.client_name,
      address: p.address,
      weight_kg: p.weight_kg,
      product_description: p.product_description || undefined,
      items: [],
      city: p.city,
      isValid: true,
      _backlogId: p.id, // keep reference for marking as routed
    } as ParsedOrder & { _backlogId: string }));
  }, []);

  return {
    loading,
    savePendingOrders,
    getPendingOrdersForDate,
    getAllPending,
    markAsRouted,
    cancelPending,
    toParsedOrders,
  };
}
