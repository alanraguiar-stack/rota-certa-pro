import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, Copy, Link, KeyRound } from 'lucide-react';
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

interface DriverAccessInfo {
  access_code: string;
  driver_password: string;
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
  const [driverAccessInfo, setDriverAccessInfo] = useState<Record<string, DriverAccessInfo>>({});

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
      const driverUserIds: string[] = [];
      for (const a of data || []) {
        map[a.route_truck_id] = { id: a.id, driver_user_id: a.driver_user_id };
        driverUserIds.push(a.driver_user_id);
      }
      setExistingAssignments(map);

      // Fetch access codes for existing assigned drivers
      if (driverUserIds.length > 0) {
        fetchAccessCodes(driverUserIds);
      }
    })();
  }, [routeTrucks]);

  const fetchAccessCodes = async (userIds: string[]) => {
    const { data } = await supabase
      .from('driver_access_codes')
      .select('user_id, access_code')
      .in('user_id', userIds);

    if (data) {
      const map: Record<string, DriverAccessInfo> = {};
      for (const d of data) {
        map[d.user_id] = { access_code: d.access_code, driver_password: '' };
      }
      setDriverAccessInfo(prev => ({ ...prev, ...map }));
    }
  };

  const handleAssign = useCallback(async () => {
    setSaving(true);
    try {
      const assignedDriverIds: string[] = [];

      for (const rt of routeTrucks) {
        const driverId = selectedDrivers[rt.id];
        if (!driverId) continue;
        const existing = existingAssignments[rt.id];
        if (existing) {
          await (supabase as any)
            .from('driver_assignments')
            .update({ driver_user_id: driverId })
            .eq('id', existing.id);
          assignedDriverIds.push(driverId);
        } else {
          const { data: assignment, error } = await (supabase as any)
            .from('driver_assignments')
            .insert({ route_truck_id: rt.id, driver_user_id: driverId })
            .select()
            .single();

          if (error) throw error;
          assignedDriverIds.push(driverId);

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

      // Update route status
      await supabase.from('routes').update({ status: 'empenhada' } as any).eq('id', routeId);

      // Fetch access codes for the newly assigned drivers
      if (assignedDriverIds.length > 0) {
        await fetchAccessCodes(assignedDriverIds);
      }

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const getDriverAccessLink = (accessCode: string) => {
    return `${window.location.origin}/motorista/acesso/${accessCode}`;
  };

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
          const accessInfo = existing ? driverAccessInfo[existing.driver_user_id] : null;

          return (
            <div key={rt.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-3">
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

              {/* Access info for assigned driver — only show link, password is hashed */}
              {existing && accessInfo && (
                <div className="ml-0 rounded-md bg-muted/50 p-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <Link className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground flex-1 truncate font-mono">
                      {getDriverAccessLink(accessInfo.access_code)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(getDriverAccessLink(accessInfo.access_code), 'Link')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <KeyRound className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground flex-1 font-mono">
                      Código: {accessInfo.access_code}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(accessInfo.access_code, 'Código')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
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
