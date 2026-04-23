import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, AlertTriangle } from 'lucide-react';
import { PendingOrder } from '@/hooks/usePendingOrders';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: PendingOrder[];
  onConfirm: (selectedIds: string[]) => void;
  onClear?: (ids: string[]) => Promise<void> | void;
}

export function DeprioritizedOrdersDialog({ open, onOpenChange, orders, onConfirm, onClear }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map: Record<string, PendingOrder[]> = {};
    for (const o of orders) {
      const city = o.city || 'Sem cidade';
      if (!map[city]) map[city] = [];
      map[city].push(o);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [orders]);

  const toggleOrder = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleClear = async () => {
    if (!onClear) return;
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : orders.map(o => o.id);
    const count = ids.length;
    const ok = window.confirm(
      `Remover ${count} venda(s) do backlog? Elas não aparecerão mais em rotas futuras.`
    );
    if (!ok) return;
    await onClear(ids);
    setSelectedIds(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Vendas Despriorizadas Disponíveis
          </DialogTitle>
          <DialogDescription>
            Existem {orders.length} venda(s) de roteirizações anteriores que foram despriorizadas. Selecione individualmente quais deseja incluir nesta rota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Select all */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox
              checked={selectedIds.size === orders.length}
              onCheckedChange={toggleAll}
            />
            <span className="text-sm font-medium">
              Selecionar todos ({selectedIds.size}/{orders.length})
            </span>
          </div>

          {/* Grouped by city */}
          {grouped.map(([city, cityOrders]) => (
            <div key={city} className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold capitalize">{city}</span>
                <Badge variant="outline" className="text-xs">{cityOrders.length}</Badge>
              </div>

              {cityOrders.map(order => (
                <label
                  key={order.id}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(order.id)}
                    onCheckedChange={() => toggleOrder(order.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.address}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {order.weight_kg} kg
                      </span>
                      {order.pedido_id && (
                        <span className="text-xs text-muted-foreground">
                          Venda #{order.pedido_id}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Ignorar
          </Button>
          {onClear && (
            <Button
              variant="ghost"
              onClick={handleClear}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {selectedIds.size > 0
                ? `Limpar selecionadas (${selectedIds.size})`
                : `Limpar todas (${orders.length})`}
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            Incluir {selectedIds.size} Selecionada(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
