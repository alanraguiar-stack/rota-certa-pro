import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Package, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useDriverRoutes, DeliveryExecution } from '@/hooks/useDriverRoutes';
import { DeliveryCard } from '@/components/driver/DeliveryCard';
import { useToast } from '@/hooks/use-toast';

type ConfirmMode = 'entregue' | 'nao_entregue';

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { assignments, deliveries, loading, fetchAssignments, fetchDeliveries, startRoute, confirmDelivery, markNotDelivered } = useDriverRoutes();
  usePageTitle('Minhas Rotas');
  const [activeAssignment, setActiveAssignment] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; mode: ConfirmMode; executionId: string }>({ open: false, mode: 'entregue', executionId: '' });
  const [observations, setObservations] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchAssignments();
  }, [user, fetchAssignments]);

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
    if (!currentAssignment || currentAssignment.status !== 'pendente') return;
    await startRoute(currentAssignment.id);
    await fetchAssignments();
    toast({ title: 'Rota iniciada!' });
  };

  const handleDeliveryClick = (delivery: DeliveryExecution) => {
    if (delivery.status === 'pendente') {
      navigate(`/motorista/entrega/${delivery.id}`);
    }
  };

  const openConfirmDialog = (executionId: string, mode: ConfirmMode) => {
    setObservations('');
    setConfirmDialog({ open: true, mode, executionId });
  };

  const handleConfirmSubmit = async () => {
    if (confirmDialog.mode === 'nao_entregue' && !observations.trim()) {
      toast({ title: 'Motivo obrigatório', description: 'Informe o motivo da não entrega.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (confirmDialog.mode === 'entregue') {
        await confirmDelivery(confirmDialog.executionId, '', '', observations.trim());
        toast({ title: 'Entrega confirmada!' });
      } else {
        await markNotDelivered(confirmDialog.executionId, observations.trim());
        toast({ title: 'Marcada como não entregue' });
      }
      setConfirmDialog({ open: false, mode: 'entregue', executionId: '' });
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
    } finally {
      setSubmitting(false);
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

            {/* Start Route Button — only changes status */}
            {currentAssignment.status === 'pendente' && (
              <Button
                onClick={handleStartRoute}
                className="w-full h-14 text-lg gap-3 btn-cta"
                size="lg"
              >
                <Play className="h-6 w-6" />
                Iniciar Rota
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
                  onQuickConfirm={(id) => openConfirmDialog(id, 'entregue')}
                  onQuickReject={(id) => openConfirmDialog(id, 'nao_entregue')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog(prev => ({ ...prev, open: false })); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.mode === 'entregue' ? 'Confirmar Entrega' : 'Não Entregue'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.mode === 'entregue'
                ? 'Deseja confirmar esta entrega? Você pode adicionar uma observação opcional.'
                : 'Informe o motivo da não entrega. Este campo é obrigatório.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={confirmDialog.mode === 'entregue' ? 'Observação (opcional)' : 'Motivo da não entrega (obrigatório)'}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              variant={confirmDialog.mode === 'entregue' ? 'default' : 'destructive'}
              onClick={handleConfirmSubmit}
              disabled={submitting || (confirmDialog.mode === 'nao_entregue' && !observations.trim())}
            >
              {submitting ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
