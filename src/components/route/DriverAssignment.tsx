import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { TruckWithAssignments } from '@/types';

interface DriverUser {
  user_id: string;
  full_name: string | null;
}

interface Props {
  routeTrucks: TruckWithAssignments[];
  routeId: string;
  onAssigned: () => void;
}

export function DriverAssignment({ routeTrucks, routeId, onAssigned }: Props) {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<Record<string, { id: string; driver_user_id: string }>>({});
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fetch drivers (users with motorista role)
  useEffect(() => {
    (async () => {
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'motorista');

      if (!roles?.length) return;
      const driverIds = roles.map((r: any) => r.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', driverIds);

      setDrivers(profiles || []);
    })();
  }, []);

  // Fetch existing assignments
  useEffect(() => {
    (async () => {
      const rtIds = routeTrucks.map(rt => rt.id);
      if (rtIds.length === 0) return;

      const { data } = await (supabase as any)
        .from('driver_assignments')
        .select('id, route_truck_id, driver_user_id')
        .in('route_truck_id', rtIds);

      const map: Record<string, { id: string; driver_user_id: string }> = {};
      for (const a of data || []) {
        map[a.route_truck_id] = { id: a.id, driver_user_id: a.driver_user_id };
      }
      setExistingAssignments(map);
    })();
  }, [routeTrucks]);

  const handleAssign = useCallback(async () => {
    setSaving(true);
    try {
      for (const rt of routeTrucks) {
        const driverId = selectedDrivers[rt.id];
        if (!driverId) continue;
        const existing = existingAssignments[rt.id];
        if (existing) {
          // Update
          await (supabase as any)
            .from('driver_assignments')
            .update({ driver_user_id: driverId })
            .eq('id', existing.id);
        } else {
          // Insert assignment + create delivery_executions for each order
          const { data: assignment, error } = await (supabase as any)
            .from('driver_assignments')
            .insert({ route_truck_id: rt.id, driver_user_id: driverId })
            .select()
            .single();

          if (error) throw error;

          // Create delivery executions for all orders in this truck
          const orderIds = rt.assignments?.map(a => a.order_id) || [];
          if (orderIds.length > 0) {
            const executions = orderIds.map(orderId => ({
              driver_assignment_id: assignment.id,
              order_id: orderId,
            }));
            await (supabase as any).from('delivery_executions').insert(executions);
          }
        }
      }

      // Update route status to empenhada
      await supabase.from('routes').update({ status: 'empenhada' } as any).eq('id', routeId);

      toast({ title: 'Motoristas atribuídos!', description: 'A rota está empenhada e pronta para execução.' });
      onAssigned();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao atribuir', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [routeTrucks, selectedDrivers, existingAssignments, routeId, toast, onAssigned]);

  const handleRemoveAssignment = useCallback(async (routeTruckId: string) => {
    const existing = existingAssignments[routeTruckId];
    if (!existing) return;

    await (supabase as any).from('delivery_executions').delete().eq('driver_assignment_id', existing.id);
    await (supabase as any).from('driver_assignments').delete().eq('id', existing.id);
    
    setExistingAssignments(prev => {
      const copy = { ...prev };
      delete copy[routeTruckId];
      return copy;
    });
    toast({ title: 'Atribuição removida' });
    onAssigned();
  }, [existingAssignments, toast, onAssigned]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Atribuir Motoristas
        </CardTitle>
        <CardDescription>Vincule um motorista a cada caminhão para empenhar a rota</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {routeTrucks.map(rt => {
          const existing = existingAssignments[rt.id];
          const existingDriver = existing ? drivers.find(d => d.user_id === existing.driver_user_id) : null;

          return (
            <div key={rt.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1">
                <p className="font-medium text-foreground">{rt.truck?.plate} — {rt.truck?.model}</p>
                <p className="text-sm text-muted-foreground">
                  {rt.assignments?.length || 0} entregas • {Number(rt.total_weight_kg).toFixed(0)} kg
                </p>
              </div>
              {existing ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-success">
                    {existingDriver?.full_name || 'Motorista atribuído'}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveAssignment(rt.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <Select
                  value={selectedDrivers[rt.id] || ''}
                  onValueChange={(v) => setSelectedDrivers(prev => ({ ...prev, [rt.id]: v }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Selecionar motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(d => (
                      <SelectItem key={d.user_id} value={d.user_id}>
                        {d.full_name || d.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}

        {drivers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum motorista cadastrado. Atribua o role "motorista" a um usuário nas Configurações.
          </p>
        )}

        <Button
          onClick={handleAssign}
          disabled={saving || Object.keys(selectedDrivers).length === 0}
          className="w-full"
        >
          {saving ? 'Salvando...' : 'Atribuir e Empenhar Rota'}
        </Button>
      </CardContent>
    </Card>
  );
}
