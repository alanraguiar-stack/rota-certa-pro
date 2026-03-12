import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DriverAssignment {
  id: string;
  route_truck_id: string;
  driver_user_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  route_truck?: {
    id: string;
    route_id: string;
    truck_id: string;
    total_weight_kg: number;
    total_orders: number;
    departure_date: string | null;
    departure_time: string | null;
    truck?: {
      plate: string;
      model: string;
      capacity_kg: number;
    };
    route?: {
      id: string;
      name: string;
      status: string;
    };
  };
}

export interface DeliveryExecution {
  id: string;
  driver_assignment_id: string;
  order_id: string;
  status: string;
  delivered_at: string | null;
  signature_url: string | null;
  photo_url: string | null;
  observations: string | null;
  created_at: string;
  order?: {
    id: string;
    client_name: string;
    address: string;
    weight_kg: number;
    product_description: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export function useDriverRoutes() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryExecution[]>([]);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('driver_assignments')
        .select(`
          *,
          route_truck:route_trucks(
            id, route_id, truck_id, total_weight_kg, total_orders, departure_date, departure_time,
            truck:trucks(plate, model, capacity_kg),
            route:routes(id, name, status)
          )
        `)
        .eq('driver_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (err) {
      console.error('Error fetching driver assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchDeliveries = useCallback(async (assignmentId: string) => {
    try {
      // First get the route_truck_id for this assignment to join order_assignments
      const { data: assignmentData } = await (supabase as any)
        .from('driver_assignments')
        .select('route_truck_id')
        .eq('id', assignmentId)
        .single();

      const { data, error } = await (supabase as any)
        .from('delivery_executions')
        .select(`
          *,
          order:orders(id, client_name, address, weight_kg, product_description, latitude, longitude)
        `)
        .eq('driver_assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      // Sort by delivery_sequence from order_assignments
      if (data && assignmentData?.route_truck_id) {
        const orderIds = data.map((d: any) => d.order_id);
        const { data: seqData } = await (supabase as any)
          .from('order_assignments')
          .select('order_id, delivery_sequence')
          .eq('route_truck_id', assignmentData.route_truck_id)
          .in('order_id', orderIds);

        if (seqData) {
          const seqMap = new Map(seqData.map((s: any) => [s.order_id, Number(s.delivery_sequence)]));
          data.sort((a: any, b: any) => {
            const seqA = seqMap.get(a.order_id) ?? 999;
            const seqB = seqMap.get(b.order_id) ?? 999;
            return (seqA as number) - (seqB as number);
          });
        }
      }

      if (error) throw error;
      setDeliveries(data || []);
      return data || [];
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      return [];
    }
  }, []);

  const startRoute = useCallback(async (assignmentId: string) => {
    const { error } = await (supabase as any)
      .from('driver_assignments')
      .update({ status: 'em_andamento', started_at: new Date().toISOString() })
      .eq('id', assignmentId);
    if (error) throw error;
  }, []);

  const confirmDelivery = useCallback(async (
    executionId: string,
    signatureUrl?: string,
    photoUrl?: string,
    observations?: string
  ) => {
    const updateData: any = {
      status: 'concluida',
      delivered_at: new Date().toISOString(),
      observations: observations || null,
    };
    if (signatureUrl) updateData.signature_url = signatureUrl;
    if (photoUrl) updateData.photo_url = photoUrl;

    const { error } = await (supabase as any)
      .from('delivery_executions')
      .update(updateData)
      .eq('id', executionId);
    if (error) throw error;
  }, []);

  const markNotDelivered = useCallback(async (executionId: string, observations: string) => {
    const { error } = await (supabase as any)
      .from('delivery_executions')
      .update({
        status: 'nao_entregue',
        delivered_at: new Date().toISOString(),
        observations,
      })
      .eq('id', executionId);
    if (error) throw error;
  }, []);

  const finishRoute = useCallback(async (assignmentId: string) => {
    const { error } = await (supabase as any)
      .from('driver_assignments')
      .update({ status: 'finalizada', finished_at: new Date().toISOString() })
      .eq('id', assignmentId);
    if (error) throw error;
  }, []);

  const uploadProof = useCallback(async (file: Blob, fileName: string): Promise<string> => {
    const path = `${user?.id}/${Date.now()}_${fileName}`;
    const { error } = await supabase.storage
      .from('delivery-proofs')
      .upload(path, file, { contentType: file.type || 'image/png' });
    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('delivery-proofs')
      .getPublicUrl(path);
    return urlData.publicUrl;
  }, [user]);

  return {
    loading,
    assignments,
    deliveries,
    fetchAssignments,
    fetchDeliveries,
    startRoute,
    confirmDelivery,
    markNotDelivered,
    finishRoute,
    uploadProof,
  };
}
