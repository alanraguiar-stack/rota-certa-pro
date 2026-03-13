import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Navigation, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverRoutes, DeliveryExecution } from '@/hooks/useDriverRoutes';
import { DeliveryCard } from '@/components/driver/DeliveryCard';
import { useToast } from '@/hooks/use-toast';

function buildGoogleMapsUrl(stops: { address: string }[]) {
  if (stops.length === 0) return '';
  const lastStop = stops[stops.length - 1].address;
  const waypoints = stops.slice(0, -1).map(s => s.address).join('|');
  const params = new URLSearchParams({
    api: '1',
    origin: 'current+location',
    destination: lastStop,
    travelmode: 'driving',
  });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { assignments, deliveries, loading, fetchAssignments, fetchDeliveries, startRoute, confirmDelivery, markNotDelivered } = useDriverRoutes();
  const [activeAssignment, setActiveAssignment] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchAssignments();
  }, [user, fetchAssignments]);

  // Auto-select active or first pending assignment
  useEffect(() => {
    if (assignments.length > 0 && !activeAssignment) {
      const active = assignments.find(a => a.status === 'em_andamento') || assignments.find(a => a.status === 'pendente');
      if (active) {
        setActiveAssignment(active.id);
        fetchDeliveries(active.id);
      }
    }
  }, [assignments, activeAssignment, fetchDeliveries]);

  const currentAssignment = assignments.find(a => a.id === activeAssignment);
  const completedCount = deliveries.filter(d => d.status === 'concluida').length;
  const totalCount = deliveries.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleStartRoute = async () => {
    if (!currentAssignment) return;
    if (currentAssignment.status === 'pendente') {
      await startRoute(currentAssignment.id);
      await fetchAssignments();
    }
    const pendingStops = deliveries
      .filter(d => d.status === 'pendente')
      .map(d => ({ address: d.order?.address || '' }))
      .filter(s => s.address);
    if (pendingStops.length > 0) {
      const url = buildGoogleMapsUrl(pendingStops);
      window.open(url, '_blank');
    }
  };

  const handleDeliveryClick = (delivery: DeliveryExecution) => {
    if (delivery.status === 'pendente') {
      navigate(`/motorista/entrega/${delivery.id}`);
    }
  };

  const handleQuickConfirm = async (executionId: string) => {
    try {
      await confirmDelivery(executionId, '', '', '');
      toast({ title: 'Entrega confirmada!' });
      if (activeAssignment) {
        const remaining = await fetchDeliveries(activeAssignment);
        const pending = remaining.filter((d: DeliveryExecution) => d.status === 'pendente');
        if (pending.length === 0) {
          const { supabase } = await import('@/integrations/supabase/client');
          await (supabase as any)
            .from('driver_assignments')
            .update({ status: 'finalizada', finished_at: new Date().toISOString() })
            .eq('id', activeAssignment);
          toast({ title: 'Rota finalizada!', description: 'Todas as entregas concluídas.' });
          await fetchAssignments();
        }
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleQuickReject = async (executionId: string) => {
    try {
      await markNotDelivered(executionId, 'Não entregue (ação rápida)');
      toast({ title: 'Marcada como não entregue' });
      if (activeAssignment) await fetchDeliveries(activeAssignment);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Rota Certa</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { fetchAssignments(); if (activeAssignment) fetchDeliveries(activeAssignment); }}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-3 space-y-3 max-w-lg mx-auto">
        {loading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}

        {!loading && assignments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">Nenhuma rota atribuída</p>
              <p className="text-sm text-muted-foreground">Aguarde a atribuição de uma rota pelo administrador.</p>
            </CardContent>
          </Card>
        )}

        {currentAssignment && (
          <>
            {/* Route Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  {currentAssignment.route_truck?.truck?.plate} — {currentAssignment.route_truck?.truck?.model}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rota</span>
                  <span className="font-medium">{currentAssignment.route_truck?.route?.name}</span>
                </div>
                {currentAssignment.route_truck?.departure_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">
                      {new Date(currentAssignment.route_truck.departure_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{currentAssignment.status.replace('_', ' ')}</span>
                </div>

                {/* Progress */}
                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-bold text-foreground">{completedCount}/{totalCount}</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
              </CardContent>
            </Card>

            {/* Start Route Button */}
            {currentAssignment.status !== 'finalizada' && deliveries.some(d => d.status === 'pendente') && (
              <Button
                onClick={handleStartRoute}
                className="w-full h-14 text-lg gap-3 btn-cta"
                size="lg"
              >
                <Navigation className="h-6 w-6" />
                {currentAssignment.status === 'pendente' ? 'Iniciar Roteiro' : 'Continuar no Maps'}
              </Button>
            )}

            {/* Deliveries List */}
            <div className="space-y-1.5">
              <h2 className="font-semibold text-foreground">Entregas</h2>
              {deliveries.map((delivery, index) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  index={index}
                  onClick={() => handleDeliveryClick(delivery)}
                  onQuickConfirm={handleQuickConfirm}
                  onQuickReject={handleQuickReject}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
