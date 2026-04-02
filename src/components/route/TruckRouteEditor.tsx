/**
 * Componente de Ajuste Manual de Rotas por Caminhão
 * Interface com tabs por caminhão, drag-and-drop, recálculo em tempo real
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  Truck, 
  GripVertical, 
  ArrowRightLeft, 
  Scale, 
  MapPin, 
  Check, 
  AlertTriangle,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Package,
  Search,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truck as TruckType, Order, OrderItem } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TruckData {
  truck: TruckType;
  routeTruckId: string;
  orders: Order[];
  totalWeight: number;
  occupancyPercent: number;
  isLocked: boolean;
}

interface TruckRouteEditorProps {
  routeName: string;
  trucks: TruckData[];
  onOrderMove: (orderId: string, fromTruckId: string, toTruckId: string, newSequence: number) => Promise<void>;
  onReorder: (truckId: string, orderId: string, newSequence: number) => Promise<void>;
  onLockTruck: (truckId: string) => Promise<void>;
  onUnlockTruck: (truckId: string) => Promise<void>;
  onConfirmAllRoutes: () => Promise<void>;
  isProcessing?: boolean;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2)}t`;
  }
  return `${weight.toFixed(1)}kg`;
}

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface SearchMatch {
  orderId: string;
  clientName: string;
  address: string;
  truckPlate: string;
  routeTruckId: string;
  sequence: number;
}

function OrderCard({ 
  order, 
  sequence, 
  isLocked,
  otherTrucks,
  onMoveToTruck,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragTarget,
  isHighlighted,
  orderRef,
}: { 
  order: Order; 
  sequence: number;
  isLocked: boolean;
  otherTrucks: Array<{ id: string; plate: string; canFit: boolean }>;
  onMoveToTruck: (truckId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragTarget?: boolean;
  isHighlighted?: boolean;
  orderRef?: React.Ref<HTMLDivElement>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const orderItems = order.items || [];
  const hasItems = orderItems.length > 0;
  
  return (
    <div 
      ref={orderRef}
      className={cn(
        "rounded-lg border bg-card transition-all select-text",
        isLocked ? "opacity-75" : "hover:shadow-md",
        isDragTarget && "border-primary border-2 shadow-lg bg-primary/5 -translate-y-0.5 scale-[1.01]",
        isHighlighted && "ring-2 ring-amber-400 bg-amber-50/50 dark:bg-amber-900/20",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle — left section is draggable */}
        <div 
          className={cn(
            "flex items-center gap-1 py-2 pr-2 -ml-1 pl-1 rounded-l-lg",
            !isLocked && "cursor-grab active:cursor-grabbing hover:bg-muted/80 transition-colors"
          )}
          draggable={!isLocked}
          onDragStart={(e) => {
            if (isLocked) return;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', order.id);
            onDragStart?.();
          }}
        >
          {!isLocked && (
            <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
            {sequence}
          </span>
        </div>
        
        {/* Order Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium truncate">{order.client_name}</p>
            <Badge variant="secondary" className="shrink-0">
              {formatWeight(Number(order.weight_kg))}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            <MapPin className="inline h-3 w-3 mr-1" />
            {order.address}
          </p>
        </div>
        
        {/* Actions */}
        {!isLocked && (
          <div className="flex items-center gap-1">
            {/* Move Up/Down */}
            <div className="flex flex-col">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                disabled={isFirst}
                onClick={onMoveUp}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                disabled={isLast}
                onClick={onMoveDown}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Move to Another Truck */}
            {otherTrucks.length > 0 && (
              <Select onValueChange={onMoveToTruck}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Mover" />
                </SelectTrigger>
                <SelectContent>
                  {otherTrucks.map(truck => (
                    <SelectItem 
                      key={truck.id} 
                      value={truck.id}
                      disabled={!truck.canFit}
                    >
                      <span className={!truck.canFit ? "text-muted-foreground" : ""}>
                        {truck.plate}
                        {!truck.canFit && " (cheio)"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        
        {/* Expand for items */}
        {hasItems && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>
      
      {/* Items Detail */}
      {isExpanded && hasItems && (
        <div className="border-t px-3 py-2 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            <Package className="inline h-3 w-3 mr-1" />
            Itens do pedido:
          </p>
          <div className="space-y-1">
            {orderItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span>{item.product_name}</span>
                <span className="text-muted-foreground">
                  {item.quantity}x • {formatWeight(Number(item.weight_kg))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TruckTab({
  truckData,
  otherTrucks,
  onOrderMove,
  onReorder,
  onLockTruck,
  onUnlockTruck,
  isProcessing,
  highlightedOrderId,
}: {
  truckData: TruckData;
  otherTrucks: TruckData[];
  onOrderMove: (orderId: string, fromTruckId: string, toTruckId: string, newSequence: number) => Promise<void>;
  onReorder: (truckId: string, orderId: string, newSequence: number) => Promise<void>;
  onLockTruck: (truckId: string) => Promise<void>;
  onUnlockTruck: (truckId: string) => Promise<void>;
  isProcessing?: boolean;
  highlightedOrderId?: string | null;
}) {
  const { toast } = useToast();
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  
  // Scroll to highlighted order
  useEffect(() => {
    if (highlightedOrderId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedOrderId]);
  
  const handleMoveToTruck = useCallback(async (orderId: string, toTruckId: string) => {
    try {
      await onOrderMove(orderId, truckData.routeTruckId, toTruckId, 999);
      toast({
        title: 'Pedido movido',
        description: 'O pedido foi transferido para outro caminhão',
      });
    } catch (error) {
      toast({
        title: 'Erro ao mover pedido',
        description: 'Não foi possível mover o pedido',
        variant: 'destructive',
      });
    }
  }, [truckData.routeTruckId, onOrderMove, toast]);
  
  const handleReorder = useCallback(async (orderId: string, direction: 'up' | 'down') => {
    const currentIndex = truckData.orders.findIndex(o => o.id === orderId);
    if (currentIndex === -1) return;
    
    const newSequence = direction === 'up' ? currentIndex : currentIndex + 2;
    
    try {
      await onReorder(truckData.routeTruckId, orderId, newSequence);
    } catch (error) {
      toast({
        title: 'Erro ao reordenar',
        description: 'Não foi possível reordenar a entrega',
        variant: 'destructive',
      });
    }
  }, [truckData, onReorder, toast]);

  const handleDragDrop = useCallback(async (targetIndex: number) => {
    if (draggedOrderId === null) return;
    const sourceIndex = truckData.orders.findIndex(o => o.id === draggedOrderId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) return;
    
    // 1-indexed sequence: target position in the list
    const newSequence = targetIndex + 1;
    
    try {
      await onReorder(truckData.routeTruckId, draggedOrderId, newSequence);
    } catch (error) {
      toast({
        title: 'Erro ao reordenar',
        variant: 'destructive',
      });
    }
  }, [draggedOrderId, truckData, onReorder, toast]);
  
  const handleLockToggle = useCallback(async () => {
    try {
      if (truckData.isLocked) {
        await onUnlockTruck(truckData.routeTruckId);
        toast({
          title: 'Rota desbloqueada',
          description: 'A rota pode ser editada novamente',
        });
      } else {
        await onLockTruck(truckData.routeTruckId);
        toast({
          title: 'Rota confirmada',
          description: 'A rota foi bloqueada para edição',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status da rota',
        variant: 'destructive',
      });
    }
  }, [truckData, onLockTruck, onUnlockTruck, toast]);
  
  // Prepare other trucks with canFit info
  const otherTrucksWithCapacity = useMemo(() => {
    return otherTrucks.map(t => ({
      id: t.routeTruckId,
      plate: t.truck.plate,
      canFit: t.occupancyPercent < 95,
    }));
  }, [otherTrucks]);
  
  const isOverCapacity = truckData.occupancyPercent > 100;
  const isNearCapacity = truckData.occupancyPercent > 90;
  
  return (
    <div className="space-y-4">
      {/* Truck Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            truckData.isLocked ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
          )}>
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{truckData.truck.plate}</h3>
              {truckData.isLocked && (
                <Badge variant="outline" className="border-success text-success">
                  <Lock className="h-3 w-3 mr-1" />
                  Confirmada
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{truckData.truck.model}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xl font-bold">{truckData.orders.length}</p>
              <p className="text-xs text-muted-foreground">Entregas</p>
            </div>
            <div>
              <p className="text-xl font-bold">{formatWeight(truckData.totalWeight)}</p>
              <p className="text-xs text-muted-foreground">Peso</p>
            </div>
            <div>
              <p className={cn(
                "text-xl font-bold",
                isOverCapacity ? "text-destructive" : isNearCapacity ? "text-warning" : "text-success"
              )}>
                {truckData.occupancyPercent}%
              </p>
              <p className="text-xs text-muted-foreground">Ocupação</p>
            </div>
          </div>
          
          <Button
            variant={truckData.isLocked ? "outline" : "default"}
            onClick={handleLockToggle}
            disabled={isProcessing}
            className="gap-2"
          >
            {truckData.isLocked ? (
              <>
                <Unlock className="h-4 w-4" />
                Desbloquear
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmar Rota
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Capacity Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Capacidade utilizada</span>
          <span className="font-medium">
            {formatWeight(truckData.totalWeight)} / {formatWeight(Number(truckData.truck.capacity_kg))}
          </span>
        </div>
        <Progress 
          value={Math.min(truckData.occupancyPercent, 100)} 
          className={cn(
            "h-3",
            isOverCapacity && "[&>div]:bg-destructive",
            isNearCapacity && !isOverCapacity && "[&>div]:bg-warning"
          )}
        />
        {isOverCapacity && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Capacidade excedida! Remova entregas ou mova para outro caminhão.
          </p>
        )}
      </div>
      
      {/* Orders List */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Sequência de Entregas {!truckData.isLocked && '(arraste para reordenar)'}
        </h4>
        
        {truckData.orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="mx-auto h-8 w-8 opacity-50 mb-2" />
            <p>Nenhuma entrega atribuída</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {truckData.orders.map((order, idx) => (
              <OrderCard
                key={order.id}
                order={order}
                sequence={idx + 1}
                isLocked={truckData.isLocked}
                otherTrucks={otherTrucksWithCapacity}
                onMoveToTruck={(toTruckId) => handleMoveToTruck(order.id, toTruckId)}
                onMoveUp={() => handleReorder(order.id, 'up')}
                onMoveDown={() => handleReorder(order.id, 'down')}
                isFirst={idx === 0}
                isLast={idx === truckData.orders.length - 1}
                onDragStart={() => setDraggedOrderId(order.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTargetIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDragDrop(idx);
                  setDraggedOrderId(null);
                  setDropTargetIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedOrderId(null);
                  setDropTargetIndex(null);
                }}
                isDragTarget={dropTargetIndex === idx && draggedOrderId !== order.id}
                isHighlighted={highlightedOrderId === order.id}
                orderRef={highlightedOrderId === order.id ? highlightRef : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TruckRouteEditor({
  routeName,
  trucks,
  onOrderMove,
  onReorder,
  onLockTruck,
  onUnlockTruck,
  onConfirmAllRoutes,
  isProcessing,
}: TruckRouteEditorProps) {
  const [activeTab, setActiveTab] = useState(trucks[0]?.routeTruckId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  
  const allLocked = trucks.every(t => t.isLocked);
  const lockedCount = trucks.filter(t => t.isLocked).length;
  
  // Search matches
  const searchMatches = useMemo<SearchMatch[]>(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = normalizeText(searchQuery);
    const matches: SearchMatch[] = [];
    for (const truck of trucks) {
      truck.orders.forEach((order, idx) => {
        const searchText = [order.client_name, order.address, order.city].filter(Boolean).map(normalizeText).join(' ');
        if (searchText.includes(q)) {
          matches.push({
            orderId: order.id,
            clientName: order.client_name,
            address: order.address,
            truckPlate: truck.truck.plate,
            routeTruckId: truck.routeTruckId,
            sequence: idx + 1,
          });
        }
      });
    }
    return matches;
  }, [searchQuery, trucks]);
  
  const handleSelectMatch = useCallback((match: SearchMatch) => {
    setActiveTab(match.routeTruckId);
    setHighlightedOrderId(match.orderId);
    setSearchQuery('');
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedOrderId(null), 3000);
  }, []);
  
  // Summary stats
  const totalOrders = trucks.reduce((sum, t) => sum + t.orders.length, 0);
  const totalWeight = trucks.reduce((sum, t) => sum + t.totalWeight, 0);
  const avgOccupancy = trucks.length > 0 
    ? Math.round(trucks.reduce((sum, t) => sum + t.occupancyPercent, 0) / trucks.length)
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Ajuste Manual das Rotas
              </CardTitle>
              <CardDescription>
                Revise e ajuste a distribuição de entregas entre os caminhões
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm py-1.5">
                {lockedCount}/{trucks.length} confirmadas
              </Badge>
              
              <Button
                onClick={onConfirmAllRoutes}
                disabled={!allLocked || isProcessing}
                size="lg"
              >
                {allLocked ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Gerar Romaneios
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Confirme Todas as Rotas
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setHighlightedOrderId(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            {/* Search Results Dropdown */}
            {searchMatches.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-lg border bg-popover shadow-md max-h-64 overflow-y-auto">
                {searchMatches.map((match) => (
                  <button
                    key={match.orderId}
                    onClick={() => handleSelectMatch(match)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{match.clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          <MapPin className="inline h-3 w-3 mr-1" />
                          {match.address}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        <Truck className="h-3 w-3 mr-1" />
                        {match.truckPlate} • #{match.sequence}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {searchQuery.length >= 2 && searchMatches.length === 0 && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-lg border bg-popover shadow-md p-4 text-center text-sm text-muted-foreground">
                Nenhuma entrega encontrada
              </div>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold text-primary">{trucks.length}</p>
              <p className="text-xs text-muted-foreground">Caminhões</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">Entregas</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-bold">{formatWeight(totalWeight)}</p>
              <p className="text-xs text-muted-foreground">Peso Total</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className={cn(
                "text-2xl font-bold",
                avgOccupancy > 90 ? "text-warning" : "text-success"
              )}>
                {avgOccupancy}%
              </p>
              <p className="text-xs text-muted-foreground">Ocupação Média</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs for Each Truck */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4">
            <TabsList className="h-auto p-0 bg-transparent gap-0">
              {trucks.map((truckData) => (
                <TabsTrigger
                  key={truckData.routeTruckId}
                  value={truckData.routeTruckId}
                  className={cn(
                    "rounded-none border-b-2 border-transparent data-[state=active]:border-primary",
                    "px-4 py-3 gap-2",
                    truckData.isLocked && "text-success"
                  )}
                >
                  <Truck className="h-4 w-4" />
                  {truckData.truck.plate}
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-xs",
                      truckData.isLocked && "bg-success/10 text-success"
                    )}
                  >
                    {truckData.orders.length}
                  </Badge>
                  {truckData.isLocked && <Lock className="h-3 w-3 text-success" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          {trucks.map((truckData) => (
            <TabsContent 
              key={truckData.routeTruckId} 
              value={truckData.routeTruckId}
              className="p-4 m-0"
            >
              <TruckTab
                truckData={truckData}
                otherTrucks={trucks.filter(t => t.routeTruckId !== truckData.routeTruckId)}
                onOrderMove={onOrderMove}
                onReorder={onReorder}
                onLockTruck={onLockTruck}
                onUnlockTruck={onUnlockTruck}
                isProcessing={isProcessing}
                highlightedOrderId={highlightedOrderId}
              />
            </TabsContent>
          ))}
        </Tabs>
      </Card>
      
      {/* Help Text */}
      {!allLocked && (
        <p className="text-center text-sm text-muted-foreground">
          💡 Dica: Use as setas para reordenar entregas ou o seletor "Mover" para transferir entre caminhões.
          Confirme cada rota quando estiver satisfeito com a distribuição.
        </p>
      )}
    </div>
  );
}
