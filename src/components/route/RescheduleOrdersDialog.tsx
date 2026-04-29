import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CalendarClock, MapPin, Package, Search, AlertTriangle, CheckCircle2, Clock, Filter } from 'lucide-react';
import type { ReschedulableOrder } from '@/hooks/useRescheduleOrders';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: ReschedulableOrder[];
  loading?: boolean;
  onConfirm: (selected: ReschedulableOrder[]) => Promise<void>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  concluida:    { label: 'Entregue',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200',  icon: <CheckCircle2 className="h-3 w-3" /> },
  nao_entregue: { label: 'Não entregue',   color: 'bg-red-100 text-red-700 border-red-200',              icon: <AlertTriangle className="h-3 w-3" /> },
  pendente:     { label: 'Pendente',       color: 'bg-zinc-100 text-zinc-600 border-zinc-200',           icon: <Clock className="h-3 w-3" /> },
  em_andamento: { label: 'Em andamento',   color: 'bg-blue-100 text-blue-700 border-blue-200',           icon: <Clock className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-zinc-100 text-zinc-600 border-zinc-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

type FilterStatus = 'all' | 'nao_entregue' | 'concluida' | 'pendente';

export function RescheduleOrdersDialog({ open, onOpenChange, orders, loading, onConfirm }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [submitting, setSubmitting] = useState(false);

  // Filtragem
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        !search ||
        o.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (o.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (o.pedido_id ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || o.delivery_status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus]);

  // Agrupamento por cidade
  const grouped = useMemo(() => {
    const map: Record<string, ReschedulableOrder[]> = {};
    for (const o of filtered) {
      const city = o.city ?? 'Sem cidade';
      if (!map[city]) map[city] = [];
      map[city].push(o);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggleOrder = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCity = (cityOrders: ReschedulableOrder[]) => {
    const ids = cityOrders.map(o => o.execution_id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.execution_id)));
    }
  };

  const handleConfirm = async () => {
    const selected = orders.filter(o => selectedIds.has(o.execution_id));
    if (selected.length === 0) return;
    setSubmitting(true);
    await onConfirm(selected);
    setSubmitting(false);
    setSelectedIds(new Set());
    setSearch('');
    setFilterStatus('all');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearch('');
    setFilterStatus('all');
    onOpenChange(false);
  };

  const totalWeight = useMemo(() => {
    return orders
      .filter(o => selectedIds.has(o.execution_id))
      .reduce((sum, o) => sum + o.weight_kg, 0);
  }, [orders, selectedIds]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      counts[o.delivery_status] = (counts[o.delivery_status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-primary" />
            Reprogramar Vendas
          </DialogTitle>
          <DialogDescription className="text-sm">
            Selecione as vendas que devem entrar na próxima roteirização. Elas aparecerão no pop-up ao criar uma nova rota.
          </DialogDescription>

          {/* Contadores de status */}
          <div className="flex gap-2 flex-wrap pt-1">
            {Object.entries(statusCounts).map(([status, count]) => (
              <StatusBadge key={status} status={status} />
            ))}
            <span className="text-xs text-muted-foreground self-center">· {orders.length} vendas no total</span>
          </div>
        </DialogHeader>

        {/* Filtros */}
        <div className="px-6 py-3 border-b shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, cidade ou nº pedido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1.5 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {(['all', 'nao_entregue', 'concluida', 'pendente'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterStatus === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {s === 'all' ? `Todos (${orders.length})` :
                 s === 'nao_entregue' ? `Não entregue (${statusCounts['nao_entregue'] ?? 0})` :
                 s === 'concluida' ? `Entregue (${statusCounts['concluida'] ?? 0})` :
                 `Pendente (${statusCounts['pendente'] ?? 0})`}
              </button>
            ))}
          </div>
        </div>

        {/* Selecionar todos */}
        <div className="px-6 py-2.5 border-b shrink-0 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
            <Checkbox
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onCheckedChange={toggleAll}
            />
            Selecionar todos ({filtered.length})
          </label>
          {selectedIds.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''} · {totalWeight.toFixed(1)} kg
            </span>
          )}
        </div>

        {/* Lista agrupada por cidade */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
          {loading && (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando vendas...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma venda encontrada.</p>
          )}
          {grouped.map(([city, cityOrders]) => {
            const allCitySelected = cityOrders.every(o => selectedIds.has(o.execution_id));
            const someCitySelected = cityOrders.some(o => selectedIds.has(o.execution_id));
            return (
              <div key={city}>
                {/* Header da cidade */}
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer group"
                  onClick={() => toggleCity(cityOrders)}
                >
                  <Checkbox
                    checked={allCitySelected}
                    ref={(el: any) => el && (el.indeterminate = someCitySelected && !allCitySelected)}
                    onCheckedChange={() => toggleCity(cityOrders)}
                    onClick={e => e.stopPropagation()}
                  />
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{city}</span>
                  <span className="text-xs text-muted-foreground">({cityOrders.length})</span>
                </div>

                {/* Pedidos da cidade */}
                <div className="space-y-1.5 ml-6">
                  {cityOrders.map(order => (
                    <label
                      key={order.execution_id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
                        selectedIds.has(order.execution_id)
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-background border-border hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.has(order.execution_id)}
                        onCheckedChange={() => toggleOrder(order.execution_id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{order.client_name}</span>
                          {order.pedido_id && (
                            <span className="text-xs text-muted-foreground font-mono">#{order.pedido_id}</span>
                          )}
                          <StatusBadge status={order.delivery_status} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{order.address}</p>
                        {order.observations && (
                          <p className="text-xs text-amber-600 mt-0.5 italic">"{order.observations}"</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Package className="h-3 w-3" />{order.weight_kg} kg
                          </span>
                          {order.product_description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {order.product_description}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size > 0
              ? <><span className="font-medium text-foreground">{selectedIds.size}</span> venda{selectedIds.size > 1 ? 's' : ''} · <span className="font-medium text-foreground">{totalWeight.toFixed(1)} kg</span> selecionado{selectedIds.size > 1 ? 's' : ''}</>
              : 'Nenhuma venda selecionada'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || submitting}
            >
              <CalendarClock className="h-4 w-4 mr-1.5" />
              {submitting ? 'Reprogramando...' : `Reprogramar ${selectedIds.size > 0 ? selectedIds.size : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
