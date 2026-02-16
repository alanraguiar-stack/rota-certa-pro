import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, MapPin, Check, Navigation, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDriverRoutes, DeliveryExecution } from '@/hooks/useDriverRoutes';
import { SignatureCanvas } from '@/components/driver/SignatureCanvas';
import { DISTRIBUTION_CENTER } from '@/types';

export default function DeliveryConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirmDelivery, uploadProof, fetchDeliveries } = useDriverRoutes();

  const [execution, setExecution] = useState<DeliveryExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [observations, setObservations] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('delivery_executions')
        .select('*, order:orders(id, client_name, address, weight_kg, product_description, latitude, longitude)')
        .eq('id', id)
        .single();
      if (error) {
        console.error(error);
        toast({ title: 'Erro ao carregar entrega', variant: 'destructive' });
      } else {
        setExecution(data);
      }
      setLoading(false);
    })();
  }, [id, toast]);

  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleSubmit = async () => {
    if (!signatureDataUrl) {
      toast({ title: 'Assinatura obrigatória', description: 'Capture a assinatura do cliente.', variant: 'destructive' });
      return;
    }
    if (!photoFile) {
      toast({ title: 'Foto obrigatória', description: 'Tire uma foto da entrega.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Convert signature data URL to blob
      const sigResp = await fetch(signatureDataUrl);
      const sigBlob = await sigResp.blob();

      // Upload both
      const [sigUrl, photoUrl] = await Promise.all([
        uploadProof(sigBlob, 'signature.png'),
        uploadProof(photoFile, `photo.${photoFile.name.split('.').pop() || 'jpg'}`),
      ]);

      await confirmDelivery(execution!.id, sigUrl, photoUrl, observations);
      toast({ title: 'Entrega confirmada!', description: execution!.order?.client_name });

      // Check if there are more pending deliveries
      const remaining = await fetchDeliveries(execution!.driver_assignment_id);
      const nextPending = remaining.find((d: DeliveryExecution) => d.status === 'pendente');

      if (nextPending) {
        // Navigate to next delivery via Google Maps
        const nextAddress = nextPending.order?.address;
        if (nextAddress) {
          const url = `https://www.google.com/maps/dir/?api=1&origin=current+location&destination=${encodeURIComponent(nextAddress)}&travelmode=driving`;
          window.open(url, '_blank');
        }
        navigate('/motorista');
      } else {
        // All done - finish route
        const { useDriverRoutes: _hook } = await import('@/hooks/useDriverRoutes');
        // Mark assignment as finished
        await (supabase as any)
          .from('driver_assignments')
          .update({ status: 'finalizada', finished_at: new Date().toISOString() })
          .eq('id', execution!.driver_assignment_id);
        toast({ title: 'Rota finalizada!', description: 'Todas as entregas foram concluídas.' });
        navigate('/motorista');
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao confirmar', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Entrega não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/motorista')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/motorista')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Confirmar Entrega</h1>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto pb-32">
        {/* Client Info */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <p className="font-semibold text-foreground">{execution.order?.client_name}</p>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">{execution.order?.address}</p>
            </div>
            {execution.order?.weight_kg && (
              <p className="text-sm text-muted-foreground">Peso: {Number(execution.order.weight_kg).toFixed(1)} kg</p>
            )}
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardContent className="pt-4">
            <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
          </CardContent>
        </Card>

        {/* Photo */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Foto da Entrega</p>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Foto da entrega" className="w-full rounded-xl object-cover max-h-60" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors">
                <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Tirar foto ou selecionar</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                />
              </label>
            )}
          </CardContent>
        </Card>

        {/* Observations */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Observações (opcional)</p>
            <Textarea
              placeholder="Alguma observação sobre a entrega..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !signatureDataUrl || !photoFile}
            className="w-full h-14 text-lg gap-2 btn-cta"
            size="lg"
          >
            <Check className="h-6 w-6" />
            {submitting ? 'Confirmando...' : 'Confirmar Entrega'}
          </Button>
        </div>
      </div>
    </div>
  );
}
