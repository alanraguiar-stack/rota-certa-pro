import { Clock, PackageCheck, PackagePlus, AlertTriangle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PendingOrder } from '@/hooks/usePendingOrders';
import { ParsedOrder } from '@/types';

interface PendingOrdersCardProps {
  recoveredOrders: PendingOrder[];
  storedOrders: ParsedOrder[];
  storedCount: number;
  onCancelRecovered?: (ids: string[]) => void;
}

export function PendingOrdersCard({
  recoveredOrders,
  storedOrders,
  storedCount,
  onCancelRecovered,
}: PendingOrdersCardProps) {
  if (recoveredOrders.length === 0 && storedCount === 0) return null;

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const isOld = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-4">
      {/* Recovered orders */}
      {recoveredOrders.length > 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="h-5 w-5 text-success" />
              {recoveredOrders.length} pedido(s) recuperado(s) do backlog
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Estes pedidos foram guardados de uploads anteriores e agora serão incluídos nesta rota.
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {recoveredOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOld(o.original_upload_date) && (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                    )}
                    <span className="font-medium truncate">{o.client_name}</span>
                    <span className="text-muted-foreground truncate">{o.city}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {o.weight_kg.toLocaleString('pt-BR')} kg
                    </Badge>
                  </div>
                  {onCancelRecovered && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onCancelRecovered([o.id])}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stored orders */}
      {storedCount > 0 && (
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-5 w-5 text-info" />
              {storedCount} pedido(s) guardado(s) para dias futuros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pedidos de cidades sem entrega amanhã foram salvos no backlog e serão automaticamente
              incluídos quando o dia de entrega da cidade chegar.
            </p>
            {storedOrders.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto space-y-1.5">
                {storedOrders.slice(0, 10).map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border bg-card">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{o.client_name}</span>
                    <span className="text-muted-foreground">{o.city}</span>
                  </div>
                ))}
                {storedOrders.length > 10 && (
                  <p className="text-xs text-muted-foreground pl-3">
                    ... e mais {storedOrders.length - 10} pedidos
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
