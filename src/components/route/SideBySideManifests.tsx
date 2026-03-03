/**
 * Visualização lado a lado dos Romaneios
 * Coluna esquerda: Romaneio de Carga (consolidado por produto)
 * Coluna direita: Romaneio de Entrega (ordem de entrega por cliente)
 */

import { useState } from 'react';
import { FileDown, Printer, ClipboardCheck, MapPin, Truck, Package, Scale, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck as TruckType, Order, OrderItem, DISTRIBUTION_CENTER } from '@/types';
import { cn } from '@/lib/utils';
import { useProductUnits } from '@/hooks/useProductUnits';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SideBySideManifestsProps {
  routeName: string;
  date: string;
  trucks: Array<{
    truck: TruckType;
    orders: Order[];
    totalWeight: number;
    occupancyPercent: number;
    departureTime?: string;
    estimatedReturnTime?: string;
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

function toASCII(text: string): string {
  if (!text) return '';
  const charMap: Record<string, string> = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n',
    'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'Ç': 'C', 'Ñ': 'N',
  };
  return text.split('').map(char => charMap[char] || char).join('');
}

function consolidateProducts(orders: Order[]): ConsolidatedProduct[] {
  const productMap = new Map<string, { weight: number; count: number }>();
  
  orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      // Use detailed items when available
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const existing = productMap.get(productName) || { weight: 0, count: 0 };
        productMap.set(productName, {
          weight: existing.weight + Number(item.weight_kg),
          count: existing.count + 1,
        });
      });
    } else {
      // Fallback: use product_description or client name with order total weight
      const label = order.product_description || `Pedido ${order.client_name}`;
      const existing = productMap.get(label) || { weight: 0, count: 0 };
      productMap.set(label, {
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
    .sort((a, b) => a.product.localeCompare(b.product));
}

// PDF Generator for Loading Manifest (simplified - only products)
const WEIGHT_UNITS = ['kg', 'g'];

function generateLoadingPDF(
  routeName: string,
  date: string,
  truck: TruckType,
  products: ConsolidatedProduct[],
  totalWeight: number,
  occupancyPercent: number,
  getUnitForProduct?: (name: string) => string
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE CARGA', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(toASCII(routeName), pageWidth / 2, 28, { align: 'center' });
  
  // Info box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 35, pageWidth - 30, 20, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 35, pageWidth - 30, 20, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VEICULO:', 20, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(`${truck.plate} - ${toASCII(truck.model)}`, 45, 43);
  
  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', 120, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(date, 135, 43);
  
  doc.setFont('helvetica', 'bold');
  doc.text('CARGA TOTAL:', 20, 51);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatWeight(totalWeight)} (${occupancyPercent}%)`, 55, 51);
  
  // Products table - ONLY PRODUCTS (no clients)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS PARA SEPARACAO', 20, 68);
  
  autoTable(doc, {
    startY: 73,
    head: [['#', 'Produto', 'Peso Total']],
    body: products.map((p, idx) => {
      let display = formatWeight(p.totalWeight);
      if (getUnitForProduct) {
        const unit = getUnitForProduct(p.product);
        if (!WEIGHT_UNITS.includes(unit)) {
          display = `${p.orderCount} ${unit}${p.orderCount > 1 ? 's' : ''}`;
        }
      }
      return [
        String(idx + 1),
        toASCII(p.product),
        display,
      ];
    }),
    foot: [['', 'TOTAL', formatWeight(totalWeight)]],
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80], fontSize: 10 },
    footStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'right' },
    },
  });
  
  // Signature fields
  const lastY = (doc as any).lastAutoTable?.finalY || 150;
  const sigY = Math.min(lastY + 20, 220);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFERENCIA DE CARGA', 20, sigY);
  
  // Signature boxes
  doc.setDrawColor(150, 150, 150);
  doc.rect(20, sigY + 5, 80, 30, 'S');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Separador:', 25, sigY + 12);
  doc.line(25, sigY + 25, 95, sigY + 25);
  doc.text('Assinatura', 55, sigY + 32);
  
  doc.rect(110, sigY + 5, 80, 30, 'S');
  doc.text('Conferente:', 115, sigY + 12);
  doc.line(115, sigY + 25, 185, sigY + 25);
  doc.text('Assinatura', 145, sigY + 32);
  
  doc.rect(20, sigY + 40, 170, 15, 'S');
  doc.text('Data da conferencia: ____/____/______ Hora: ____:____', 25, sigY + 50);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Gerado por Rota Certa', pageWidth / 2, 290, { align: 'center' });
  
  return doc;
}

// PDF Generator for Delivery Manifest
function generateDeliveryPDF(
  routeName: string,
  date: string,
  truck: TruckType,
  orders: Order[],
  totalWeight: number,
  departureTime?: string
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE ENTREGA', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(toASCII(routeName), pageWidth / 2, 26, { align: 'center' });
  
  // Info box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 32, pageWidth - 30, 20, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 32, pageWidth - 30, 20, 'S');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VEICULO:', 20, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${truck.plate}`, 42, 40);
  
  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', 75, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(date, 90, 40);
  
  if (departureTime) {
    doc.setFont('helvetica', 'bold');
    doc.text('SAIDA:', 125, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(departureTime, 145, 40);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGAS:', 20, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(String(orders.length), 45, 48);
  
  doc.setFont('helvetica', 'bold');
  doc.text('PESO TOTAL:', 60, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(formatWeight(totalWeight), 90, 48);
  
  // Deliveries list
  let currentY = 60;
  
  orders.forEach((order, idx) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    // Header
    doc.setFillColor(80, 80, 80);
    doc.rect(15, currentY, pageWidth - 30, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${idx + 1}. ${toASCII(order.client_name)}`, 20, currentY + 5);
    doc.text(formatWeight(Number(order.weight_kg)), pageWidth - 25, currentY + 5, { align: 'right' });
    
    currentY += 9;
    
    // Address
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(toASCII(order.address), pageWidth - 40);
    doc.text(addressLines, 20, currentY + 3);
    currentY += addressLines.length * 3.5 + 4;
    
    // Signature line
    doc.setDrawColor(180, 180, 180);
    doc.line(20, currentY + 5, pageWidth / 2 - 10, currentY + 5);
    doc.line(pageWidth / 2 + 10, currentY + 5, pageWidth - 20, currentY + 5);
    
    doc.setFontSize(7);
    doc.text('Assinatura', 35, currentY + 9);
    doc.text('Observacoes', pageWidth / 2 + 30, currentY + 9);
    
    currentY += 15;
  });
  
  // KM fields
  const footerY = Math.max(currentY + 10, 260);
  const kmY = footerY > 280 ? 20 : footerY;
  
  if (footerY > 280) doc.addPage();
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Km Saida: ____________', 20, kmY);
  doc.text('Km Retorno: ____________', 75, kmY);
  doc.text('Total Km: ____________', 135, kmY);
  
  doc.setFontSize(8);
  doc.text('Motorista: ________________________________', 20, kmY + 10);
  doc.text('Hora Retorno: ________', 130, kmY + 10);
  
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text('Gerado por Rota Certa', pageWidth / 2, kmY + 20, { align: 'center' });
  
  return doc;
}

export function SideBySideManifests({ routeName, date, trucks }: SideBySideManifestsProps) {
  const [selectedTruckIndex, setSelectedTruckIndex] = useState(0);
  const { getUnitForProduct } = useProductUnits();
  const selectedTruck = trucks[selectedTruckIndex];
  
  if (trucks.length === 0 || !selectedTruck) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Nenhum caminhão com entregas atribuídas</p>
        </CardContent>
      </Card>
    );
  }
  
  const consolidatedProducts = consolidateProducts(selectedTruck.orders);
  
  const handleDownloadLoading = () => {
    const doc = generateLoadingPDF(
      routeName,
      date,
      selectedTruck.truck,
      consolidatedProducts,
      selectedTruck.totalWeight,
      selectedTruck.occupancyPercent,
      getUnitForProduct
    );
    doc.save(`romaneio-carga-${selectedTruck.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
  };
  
  const handleDownloadDelivery = () => {
    const doc = generateDeliveryPDF(
      routeName,
      date,
      selectedTruck.truck,
      selectedTruck.orders,
      selectedTruck.totalWeight,
      selectedTruck.departureTime
    );
    doc.save(`romaneio-entrega-${selectedTruck.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
  };
  
  const handlePrintLoading = () => {
    const doc = generateLoadingPDF(
      routeName,
      date,
      selectedTruck.truck,
      consolidatedProducts,
      selectedTruck.totalWeight,
      selectedTruck.occupancyPercent,
      getUnitForProduct
    );
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };
  
  const handlePrintDelivery = () => {
    const doc = generateDeliveryPDF(
      routeName,
      date,
      selectedTruck.truck,
      selectedTruck.orders,
      selectedTruck.totalWeight,
      selectedTruck.departureTime
    );
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };
  
  const handleDownloadAll = () => {
    trucks.forEach((truckData, index) => {
      const products = consolidateProducts(truckData.orders);
      setTimeout(() => {
        // Loading manifest
        const loadingDoc = generateLoadingPDF(
          routeName, date, truckData.truck, products, truckData.totalWeight, truckData.occupancyPercent, getUnitForProduct
        );
        loadingDoc.save(`romaneio-carga-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
        
        // Delivery manifest
        const deliveryDoc = generateDeliveryPDF(
          routeName, date, truckData.truck, truckData.orders, truckData.totalWeight, truckData.departureTime
        );
        deliveryDoc.save(`romaneio-entrega-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
      }, index * 800);
    });
  };
  
  return (
    <div className="space-y-4">
      {/* Truck Selector */}
      <div className="flex flex-wrap gap-2">
        {trucks.map((t, index) => (
          <Button
            key={t.truck.id}
            variant={selectedTruckIndex === index ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTruckIndex(index)}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            {t.truck.plate}
            <Badge variant="secondary" className="ml-1">
              {formatWeight(t.totalWeight)}
            </Badge>
          </Button>
        ))}
      </div>
      
      {/* Download All Button */}
      {trucks.length > 1 && (
        <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
          <FileDown className="h-4 w-4" />
          Baixar Todos os Romaneios
        </Button>
      )}
      
      {/* Side by Side View */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: Romaneio de Carga */}
        <Card>
          <CardHeader className="border-b bg-muted/30 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Romaneio de Carga
                </CardTitle>
                <CardDescription>Separação no CD • {selectedTruck.truck.plate}</CardDescription>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleDownloadLoading} className="gap-1">
                <FileDown className="h-3 w-3" />
                PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrintLoading} className="gap-1">
                <Printer className="h-3 w-3" />
                Imprimir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 border-b p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Peso Total</p>
                <p className="font-bold">{formatWeight(selectedTruck.totalWeight)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ocupação</p>
                <p className={cn(
                  'font-bold',
                  selectedTruck.occupancyPercent > 90 ? 'text-destructive' : 
                  selectedTruck.occupancyPercent > 70 ? 'text-warning' : 'text-success'
                )}>
                  {selectedTruck.occupancyPercent}%
                </p>
              </div>
            </div>
            
            {/* Products List - NO CLIENTS */}
            <div className="p-3">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Produtos ({consolidatedProducts.length})
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {consolidatedProducts.map((product, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border p-2 bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{product.product}</span>
                    </div>
                    <Badge variant="secondary" className="font-bold">
                      {(() => {
                        const unit = getUnitForProduct(product.product);
                        if (WEIGHT_UNITS.includes(unit)) return formatWeight(product.totalWeight);
                        return `${product.orderCount} ${unit}${product.orderCount > 1 ? 's' : ''}`;
                      })()}
                    </Badge>
                  </div>
                ))}
              </div>
              
              <Separator className="my-3" />
              
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{formatWeight(selectedTruck.totalWeight)}</span>
              </div>
            </div>
            
            {/* Signature Fields */}
            <div className="border-t bg-muted/20 p-3">
              <p className="text-xs font-medium mb-2">Conferência</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="border rounded p-2 bg-background text-center">
                  <p className="text-xs text-muted-foreground">Separador</p>
                  <div className="border-b border-dashed h-6 mt-1" />
                </div>
                <div className="border rounded p-2 bg-background text-center">
                  <p className="text-xs text-muted-foreground">Conferente</p>
                  <div className="border-b border-dashed h-6 mt-1" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* RIGHT: Romaneio de Entrega */}
        <Card>
          <CardHeader className="border-b bg-muted/30 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  Romaneio de Entrega
                </CardTitle>
                <CardDescription>Rota do Motorista • {selectedTruck.truck.plate}</CardDescription>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleDownloadDelivery} className="gap-1">
                <FileDown className="h-3 w-3" />
                PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrintDelivery} className="gap-1">
                <Printer className="h-3 w-3" />
                Imprimir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 border-b p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Entregas</p>
                <p className="font-bold">{selectedTruck.orders.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peso</p>
                <p className="font-bold">{formatWeight(selectedTruck.totalWeight)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saída</p>
                <p className="font-bold">{selectedTruck.departureTime || '--:--'}</p>
              </div>
            </div>
            
            {/* Deliveries List */}
            <div className="max-h-[380px] overflow-y-auto">
              {selectedTruck.orders.map((order, idx) => (
                <div key={order.id} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{order.client_name}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {formatWeight(Number(order.weight_kg))}
                    </Badge>
                  </div>
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {order.address}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
