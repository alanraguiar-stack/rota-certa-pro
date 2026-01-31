/**
 * Layout visual com cards por caminhão
 * Cada card exibe identificação do caminhão e botões para romaneios
 * Inclui validação inteligente no topo
 */

import { FileDown, Printer, Truck, Package, MapPin, Scale, ClipboardCheck, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Truck as TruckType, Order, OrderItem, DISTRIBUTION_CENTER } from '@/types';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TruckManifestCardsProps {
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

/**
 * Consolidate products from orders - uses order_items when available
 * Falls back to order.weight_kg with client_name when no items
 */
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
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

// PDF Generator for Loading Manifest (products only - for CD team)
function generateLoadingPDF(
  routeName: string,
  date: string,
  truck: TruckType,
  products: ConsolidatedProduct[],
  totalWeight: number,
  occupancyPercent: number
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
  doc.rect(15, 35, pageWidth - 30, 22, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 35, pageWidth - 30, 22, 'S');
  
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
  doc.text('CARGA TOTAL:', 20, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatWeight(totalWeight)} (${occupancyPercent}%)`, 55, 52);
  
  doc.setFont('helvetica', 'bold');
  doc.text('CAPACIDADE:', 100, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(formatWeight(Number(truck.capacity_kg)), 130, 52);
  
  // Products table - NO CLIENT NAMES
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS PARA SEPARACAO', 20, 68);
  
  autoTable(doc, {
    startY: 73,
    head: [['#', 'Produto', 'Peso Total']],
    body: products.map((p, idx) => [
      String(idx + 1),
      toASCII(p.product),
      formatWeight(p.totalWeight),
    ]),
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

// PDF Generator for Delivery Manifest (route for driver)
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
  doc.rect(15, 32, pageWidth - 30, 22, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 32, pageWidth - 30, 22, 'S');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VEICULO:', 20, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${truck.plate} - ${toASCII(truck.model)}`, 42, 40);
  
  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', 100, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(date, 115, 40);
  
  if (departureTime) {
    doc.setFont('helvetica', 'bold');
    doc.text('SAIDA:', 145, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(departureTime, 165, 40);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGAS:', 20, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(String(orders.length), 45, 50);
  
  doc.setFont('helvetica', 'bold');
  doc.text('PESO TOTAL:', 60, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(formatWeight(totalWeight), 90, 50);
  
  // Origin info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Origem: ${toASCII(DISTRIBUTION_CENTER.address)}`, 20, 60);
  
  // Deliveries list with signature fields
  let currentY = 68;
  
  orders.forEach((order, idx) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    // Header bar
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
  
  // KM fields at bottom
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

export function TruckManifestCards({ routeName, date, trucks }: TruckManifestCardsProps) {
  if (trucks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Nenhum caminhão com entregas atribuídas</p>
        </CardContent>
      </Card>
    );
  }
  
  const handleDownloadAll = () => {
    trucks.forEach((truckData, index) => {
      const products = consolidateProducts(truckData.orders);
      setTimeout(() => {
        // Loading manifest
        const loadingDoc = generateLoadingPDF(
          routeName, date, truckData.truck, products, truckData.totalWeight, truckData.occupancyPercent
        );
        loadingDoc.save(`romaneio-carga-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
        
        // Delivery manifest
        const deliveryDoc = generateDeliveryPDF(
          routeName, date, truckData.truck, truckData.orders, truckData.totalWeight, truckData.departureTime
        );
        deliveryDoc.save(`romaneio-entrega-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
      }, index * 600);
    });
  };
  
  // Calculate validation metrics
  const totalWeightDistributed = trucks.reduce((sum, t) => sum + t.totalWeight, 0);
  const totalOrders = trucks.reduce((sum, t) => sum + t.orders.length, 0);
  const avgOccupancy = trucks.length > 0 
    ? Math.round(trucks.reduce((sum, t) => sum + t.occupancyPercent, 0) / trucks.length)
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Validation Summary Header */}
      <Card className="bg-success/5 border-success/30 border-2">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <Check className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">Roteirização Concluída</p>
              <p className="text-sm text-muted-foreground">
                {totalOrders} entregas distribuídas em {trucks.length} caminhões • 
                Peso total: {formatWeight(totalWeightDistributed)} • 
                Ocupação média: {avgOccupancy}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Header with total and download all */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Documentos por Caminhão
          </h3>
          <p className="text-sm text-muted-foreground">
            Clique para baixar ou imprimir os romaneios
          </p>
        </div>
        <Button onClick={handleDownloadAll} className="gap-2" size="lg">
          <FileDown className="h-4 w-4" />
          Baixar Todos ({trucks.length * 2} PDFs)
        </Button>
      </div>
      
      {/* Truck Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {trucks.map((truckData) => {
          const products = consolidateProducts(truckData.orders);
          
          const handleDownloadLoading = () => {
            const doc = generateLoadingPDF(
              routeName, date, truckData.truck, products, truckData.totalWeight, truckData.occupancyPercent
            );
            doc.save(`romaneio-carga-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
          };
          
          const handleDownloadDelivery = () => {
            const doc = generateDeliveryPDF(
              routeName, date, truckData.truck, truckData.orders, truckData.totalWeight, truckData.departureTime
            );
            doc.save(`romaneio-entrega-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
          };
          
          const handlePrintLoading = () => {
            const doc = generateLoadingPDF(
              routeName, date, truckData.truck, products, truckData.totalWeight, truckData.occupancyPercent
            );
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
          };
          
          const handlePrintDelivery = () => {
            const doc = generateDeliveryPDF(
              routeName, date, truckData.truck, truckData.orders, truckData.totalWeight, truckData.departureTime
            );
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
          };
          
          return (
            <Card key={truckData.truck.id} className="overflow-hidden">
              {/* Truck Header */}
              <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{truckData.truck.plate}</CardTitle>
                      <p className="text-sm text-muted-foreground">{truckData.truck.model}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={truckData.occupancyPercent > 90 ? "destructive" : truckData.occupancyPercent > 70 ? "secondary" : "default"}
                    className="text-sm px-3 py-1"
                  >
                    {truckData.occupancyPercent}% ocupado
                  </Badge>
                </div>
                
                {/* Progress bar */}
                <Progress value={truckData.occupancyPercent} className="h-2 mt-3" />
              </CardHeader>
              
              <CardContent className="pt-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-2xl font-bold text-primary">{truckData.orders.length}</p>
                    <p className="text-xs text-muted-foreground">Entregas</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-2xl font-bold">{formatWeight(truckData.totalWeight)}</p>
                    <p className="text-xs text-muted-foreground">Peso Total</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-2xl font-bold">{products.length}</p>
                    <p className="text-xs text-muted-foreground">Produtos</p>
                  </div>
                </div>
                
                <Separator />
                
                {/* Documents Section */}
                <div className="space-y-3">
                  {/* Loading Manifest */}
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Romaneio de Carga</p>
                        <p className="text-xs text-muted-foreground">Separação no CD</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handlePrintLoading}>
                        <Printer className="h-3 w-3" />
                      </Button>
                      <Button size="sm" onClick={handleDownloadLoading} className="gap-1">
                        <FileDown className="h-3 w-3" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  
                  {/* Delivery Manifest */}
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Romaneio de Entrega</p>
                        <p className="text-xs text-muted-foreground">Rota do motorista</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handlePrintDelivery}>
                        <Printer className="h-3 w-3" />
                      </Button>
                      <Button size="sm" onClick={handleDownloadDelivery} className="gap-1">
                        <FileDown className="h-3 w-3" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Quick Product Summary (collapsed) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors">
                    <Scale className="h-4 w-4" />
                    Ver produtos ({products.length})
                    <span className="ml-auto text-xs">▼</span>
                  </summary>
                  <div className="mt-3 space-y-1 max-h-[150px] overflow-y-auto">
                    {products.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/30">
                        <span className="truncate flex-1">{product.product}</span>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          {formatWeight(product.totalWeight)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </details>
                
                {/* Quick Delivery Summary (collapsed) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors">
                    <MapPin className="h-4 w-4" />
                    Ver entregas ({truckData.orders.length})
                    <span className="ml-auto text-xs">▼</span>
                  </summary>
                  <div className="mt-3 space-y-1 max-h-[200px] overflow-y-auto">
                    {truckData.orders.map((order, idx) => (
                      <div key={order.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-muted/30">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate flex-1">{order.client_name}</span>
                        <Badge variant="outline" className="shrink-0">
                          {formatWeight(Number(order.weight_kg))}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
