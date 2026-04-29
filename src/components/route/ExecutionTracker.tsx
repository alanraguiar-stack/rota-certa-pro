import { useState, useEffect, useCallback } from 'react';
import { Eye, Clock, Check, AlertTriangle, FileDown, RefreshCw, MessageSquare, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { TruckWithAssignments } from '@/types';
import jsPDF from 'jspdf';
import { RescheduleOrdersDialog } from '@/components/route/RescheduleOrdersDialog';
import { useRescheduleOrders, type ReschedulableOrder } from '@/hooks/useRescheduleOrders';

interface Assignment {
  id: string;
  route_truck_id: string;
  driver_user_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  driver_name?: string;
}

interface Execution {
  id: string;
  order_id: string;
  status: string;
  delivered_at: string | null;
  signature_url: string | null;
  photo_url: string | null;
  observations: string | null;
  order?: { client_name: string; address: string; weight_kg: number };
}

interface Props {
  routeTrucks: TruckWithAssignments[];
  routeName: string;
  routeId?: string;
}

export function ExecutionTracker({ routeTrucks, routeName, routeId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [executions, setExecutions] = useState<Record<string, Execution[]>>({});
  const [loading, setLoading] = useState(true);
  const [evidenceModal, setEvidenceModal] = useState<Execution | null>(null);
  const [signedUrls, setSignedUrls] = useState<{ signature?: string; photo?: string }>({});
  const [showReschedule, setShowReschedule] = useState(false);
  const [reschedulableOrders, setReschedulableOrders] = useState<ReschedulableOrder[]>([]);
  const [loadingReschedule, setLoadingReschedule] = useState(false);
  const { fetchReschedulableOrders, rescheduleOrders } = useRescheduleOrders();

  const resolveSignedUrl = useCallback(async (path: string | null): Promise<string | undefined> => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    const { data } = await supabase.storage.from('delivery-proofs').createSignedUrl(path, 3600);
    return data?.signedUrl || undefined;
  }, []);

  const openEvidence = useCallback(async (execution: Execution) => {
    setEvidenceModal(execution);
    const [sig, photo] = await Promise.all([
      resolveSignedUrl(execution.signature_url),
      resolveSignedUrl(execution.photo_url),
    ]);
    setSignedUrls({ signature: sig, photo });
  }, [resolveSignedUrl]);

  const fetchData = async () => {
    setLoading(true);
    const rtIds = routeTrucks.map(rt => rt.id);
    if (rtIds.length === 0) { setLoading(false); return; }

    const { data: assnData } = await (supabase as any)
      .from('driver_assignments')
      .select('*')
      .in('route_truck_id', rtIds);

    const assnList: Assignment[] = assnData || [];

    // Fetch driver names
    const driverIds = [...new Set(assnList.map(a => a.driver_user_id))];
    if (driverIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', driverIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
      assnList.forEach(a => { a.driver_name = nameMap.get(a.driver_user_id) || 'Motorista'; });
    }

    setAssignments(assnList);

    // Fetch executions
    const assignmentIds = assnList.map(a => a.id);
    if (assignmentIds.length > 0) {
      const { data: execData } = await (supabase as any)
        .from('delivery_executions')
        .select('*, order:orders(client_name, address, weight_kg)')
        .in('driver_assignment_id', assignmentIds);

      const grouped: Record<string, Execution[]> = {};
      for (const e of execData || []) {
        if (!grouped[e.driver_assignment_id]) grouped[e.driver_assignment_id] = [];
        grouped[e.driver_assignment_id].push(e);
      }
      setExecutions(grouped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [routeTrucks]);

  // Realtime subscription for delivery_executions updates
  useEffect(() => {
    const channel = supabase
      .channel('execution-tracker')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'delivery_executions' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [routeTrucks]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Relatório de Execução - ${routeName}`, 14, 20);
    doc.setFontSize(10);
    let y = 35;

    for (const assn of assignments) {
      const rt = routeTrucks.find(rt => rt.id === assn.route_truck_id);
      doc.setFontSize(12);
      doc.text(`Caminhão: ${rt?.truck?.plate || '?'} | Motorista: ${assn.driver_name}`, 14, y);
      doc.text(`Status: ${assn.status}`, 14, y + 6);
      y += 14;

      const delivs = executions[assn.id] || [];
      doc.setFontSize(9);
      for (const d of delivs) {
        if (y > 270) { doc.addPage(); y = 20; }
        const time = d.delivered_at ? new Date(d.delivered_at).toLocaleString('pt-BR') : '-';
        doc.text(`${d.order?.client_name} | ${d.status} | ${time}`, 18, y);
        y += 5;
      }
      y += 8;
    }

    doc.save(`relatorio_${routeName.replace(/\s+/g, '_')}.pdf`);
  };


  const handleOpenReschedule = async () => {
    const rtIds = routeTrucks.map(rt => rt.id);
    setLoadingReschedule(true);
    setShowReschedule(true);
    const orders = await fetchReschedulableOrders(rtIds);
    setReschedulableOrders(orders);
    setLoadingReschedule(false);
  };

  const handleRescheduleConfirm = async (selected: ReschedulableOrder[]) => {
    if (!routeId) return;
    await rescheduleOrders(selected, routeId);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'em_andamento': return <Badge className="bg-warning text-warning-foreground"><Clock className="h-3 w-3 mr-1" />Em andamento</Badge>;
      case 'finalizada': return <Badge className="bg-success text-success-foreground"><Check className="h-3 w-3 mr-1" />Finalizada</Badge>;
      case 'concluida': return <Badge className="bg-success text-success-foreground"><Check className="h-3 w-3 mr-1" />Concluída</Badge>;
      case 'nao_entregue': return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Não entregue</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) return <p className="text-muted-foreground text-center py-4">Carregando execução...</p>;
  if (assignments.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Acompanhamento de Execução
              </CardTitle>
              <CardDescription>Status em tempo real das entregas</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={generatePDF}>
                <FileDown className="h-4 w-4 mr-1" /> Relatório PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenReschedule}>
                <CalendarClock className="h-4 w-4 mr-1" /> Reprogramar Vendas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {assignments.map(assn => {
            const rt = routeTrucks.find(r => r.id === assn.route_truck_id);
            const delivs = executions[assn.id] || [];
            const completed = delivs.filter(d => d.status === 'concluida').length;
            const progress = delivs.length > 0 ? (completed / delivs.length) * 100 : 0;

            return (
              <div key={assn.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {rt?.truck?.plate} — {assn.driver_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{completed}/{delivs.length} entregas</p>
                  </div>
                  {statusBadge(assn.status)}
                </div>
                <Progress value={progress} className="h-2" />

                <div className="space-y-2">
                  {delivs.map(d => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{d.order?.client_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.order?.address}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.delivered_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(d.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {statusBadge(d.status)}
                        {d.observations && (
                          <Button variant="ghost" size="sm" className="text-warning" onClick={() => setEvidenceModal(d)} title={d.observations}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                        {(d.signature_url || d.photo_url) && (
                          <Button variant="ghost" size="sm" onClick={() => openEvidence(d)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Evidence Modal */}
      <Dialog open={!!evidenceModal} onOpenChange={() => setEvidenceModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Evidências da Entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {signedUrls.signature && (
              <div>
                <p className="text-sm font-medium mb-1">Assinatura</p>
                <img src={signedUrls.signature} alt="Assinatura" className="w-full rounded-lg border" />
              </div>
            )}
            {signedUrls.photo && (
              <div>
                <p className="text-sm font-medium mb-1">Foto</p>
                <img src={signedUrls.photo} alt="Foto da entrega" className="w-full rounded-lg border" />
              </div>
            )}
            {evidenceModal?.observations && (
              <div>
                <p className="text-sm font-medium mb-1">Observações</p>
                <p className="text-sm text-muted-foreground">{evidenceModal.observations}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <RescheduleOrdersDialog
        open={showReschedule}
        onOpenChange={setShowReschedule}
        orders={reschedulableOrders}
        loading={loadingReschedule}
        onConfirm={handleRescheduleConfirm}
      />
    </>
  );
}
