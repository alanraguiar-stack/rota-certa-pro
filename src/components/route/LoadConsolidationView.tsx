/**
 * Visualização de Consolidação de Carga
 * Etapa 1: Mostra produtos consolidados e peso total do dia
 * Lógica correta: consolida por PRODUTO, não por cliente
 */

import { Package, Scale, Truck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Order, OrderItem, Truck as TruckType } from '@/types';
import { cn } from '@/lib/utils';

interface LoadConsolidationViewProps {
  orders: Order[];
  trucks: Array<{
    truck: TruckType;
    orders: Order[];
    totalWeight: number;
    occupancyPercent: number;
  }>;
}

interface ConsolidatedProduct {
  product: string;
  totalWeight: number;
  orderCount: number;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2)}t`;
  }
  return `${weight.toFixed(1)}kg`;
}

/**
 * Consolida TODOS os produtos de TODOS os pedidos
 * Agrupa por nome de produto e soma os pesos
 */
function consolidateAllProducts(orders: Order[]): ConsolidatedProduct[] {
  const productMap = new Map<string, { weight: number; count: number }>();
  
  orders.forEach(order => {
    // Se o pedido tem itens detalhados, usar eles
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const existing = productMap.get(productName) || { weight: 0, count: 0 };
        productMap.set(productName, {
          weight: existing.weight + Number(item.weight_kg),
          count: existing.count + 1,
        });
      });
    } else {
      // Fallback para produto único por pedido
      const productName = order.product_description || 'Produto não especificado';
      const existing = productMap.get(productName) || { weight: 0, count: 0 };
      productMap.set(productName, {
        weight: existing.weight + Number(order.weight_kg),
        count: existing.count + 1,
      });
    }
  });
  
  return Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      totalWeight: data.weight,
      orderCount: data.count,
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

/**
 * Consolida produtos por caminhão
 */
function consolidateProductsByTruck(orders: Order[]): ConsolidatedProduct[] {
  const productMap = new Map<string, { weight: number; count: number }>();
  
  orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const existing = productMap.get(productName) || { weight: 0, count: 0 };
        productMap.set(productName, {
          weight: existing.weight + Number(item.weight_kg),
          count: existing.count + 1,
        });
      });
    } else {
      const productName = order.product_description || 'Produto não especificado';
      const existing = productMap.get(productName) || { weight: 0, count: 0 };
      productMap.set(productName, {
        weight: existing.weight + Number(order.weight_kg),
        count: existing.count + 1,
      });
    }
  });
  
  return Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      totalWeight: data.weight,
      orderCount: data.count,
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

export function LoadConsolidationView({ orders, trucks }: LoadConsolidationViewProps) {
  // Consolidar todos os produtos do dia
  const allProducts = consolidateAllProducts(orders);
  const totalWeight = orders.reduce((sum, o) => sum + Number(o.weight_kg), 0);
  const totalCapacity = trucks.reduce((sum, t) => sum + Number(t.truck.capacity_kg), 0);
  const overallOccupancy = totalCapacity > 0 ? Math.round((totalWeight / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Resumo Geral do Dia */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Consolidação de Carga do Dia
          </CardTitle>
          <CardDescription>
            Volume total consolidado por tipo de produto
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Métricas Resumidas */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-primary">{formatWeight(totalWeight)}</p>
              <p className="text-sm text-muted-foreground">Peso Total</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{allProducts.length}</p>
              <p className="text-sm text-muted-foreground">Tipos de Produto</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{orders.length}</p>
              <p className="text-sm text-muted-foreground">Pedidos</p>
            </div>
          </div>

          {/* Lista de Produtos Consolidados */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Produtos para Separação
            </h4>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {allProducts.map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium">{product.product}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.orderCount} pedido{product.orderCount > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-base font-bold">
                    {formatWeight(product.totalWeight)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Caminhão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Distribuição por Caminhão
          </CardTitle>
          <CardDescription>
            Como os produtos foram distribuídos entre os veículos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trucks.map((truckData, idx) => {
              const truckProducts = consolidateProductsByTruck(truckData.orders);
              
              return (
                <div
                  key={truckData.truck.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  {/* Cabeçalho do Caminhão */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <span className="font-bold">{truckData.truck.plate}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        truckData.occupancyPercent > 90 ? 'border-destructive/50 text-destructive' :
                        truckData.occupancyPercent > 75 ? 'border-warning/50 text-warning' :
                        'border-success/50 text-success'
                      )}
                    >
                      {truckData.occupancyPercent}%
                    </Badge>
                  </div>
                  
                  {/* Barra de Ocupação */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatWeight(truckData.totalWeight)}</span>
                      <span>{formatWeight(Number(truckData.truck.capacity_kg))}</span>
                    </div>
                    <Progress value={truckData.occupancyPercent} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  {/* Produtos neste Caminhão */}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {truckProducts.map((product, pIdx) => (
                      <div
                        key={pIdx}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]">{product.product}</span>
                        </div>
                        <span className="font-medium shrink-0">{formatWeight(product.totalWeight)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total de Entregas */}
                  <div className="pt-2 border-t text-center">
                    <span className="text-sm text-muted-foreground">
                      {truckData.orders.length} entrega{truckData.orders.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
