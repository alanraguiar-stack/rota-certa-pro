import { useState } from 'react';
import { FileDown, Printer, Truck, Package, ClipboardCheck, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Truck as TruckType, Order, OrderItem, DISTRIBUTION_CENTER } from '@/types';
import { cn } from '@/lib/utils';
import { useProductUnits } from '@/hooks/useProductUnits';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LoadingManifestProps {
  routeName: string;
  date: string;
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
  totalQuantity: number;
  unitType: string;
  orderCount: number;
}

/**
 * Consolidate products from orders with unit type awareness
 */
function consolidateProducts(orders: Order[], getUnitForProduct: (name: string) => string): ConsolidatedProduct[] {
  const productMap = new Map<string, { weight: number; quantity: number; count: number; unitType: string }>();
  
  orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const unitType = getUnitForProduct(productName);
        const existing = productMap.get(productName) || { weight: 0, quantity: 0, count: 0, unitType };
        productMap.set(productName, {
          weight: existing.weight + Number(item.weight_kg),
          quantity: existing.quantity + (item.quantity || 1),
          count: existing.count + 1,
          unitType,
        });
      });
    } else {
      const label = order.product_description || `Pedido ${order.client_name}`;
      const unitType = getUnitForProduct(label);
      const existing = productMap.get(label) || { weight: 0, quantity: 0, count: 0, unitType };
      productMap.set(label, {
        weight: existing.weight + Number(order.weight_kg),
        quantity: existing.quantity + 1,
        count: existing.count + 1,
        unitType,
      });
    }
  });
  
  return Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      totalWeight: data.weight,
      totalQuantity: data.quantity,
      unitType: data.unitType,
      orderCount: data.count,
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2)}t`;
  }
  return `${weight.toFixed(1)}kg`;
}

function generateLoadingManifestPDF(
  routeName: string,
  date: string,
  truck: TruckType,
  orders: Order[],
  totalWeight: number,
  occupancyPercent: number,
  getUnitForProduct: (name: string) => string
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE CARGA', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(routeName, pageWidth / 2, 28, { align: 'center' });
  
  // Truck info box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 35, pageWidth - 30, 25, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 35, pageWidth - 30, 25, 'S');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VEÍCULO:', 20, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(`${truck.plate} - ${truck.model}`, 45, 43);
  
  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', 110, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(date, 125, 43);
  
  doc.setFont('helvetica', 'bold');
  doc.text('CAPACIDADE:', 20, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(formatWeight(Number(truck.capacity_kg)), 50, 52);
  
  doc.setFont('helvetica', 'bold');
  doc.text('CARGA TOTAL:', 80, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatWeight(totalWeight)} (${occupancyPercent}%)`, 110, 52);
  
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGAS:', 155, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(String(orders.length), 180, 52);
  
  // Consolidated Products Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS PARA SEPARACAO', 20, 80);
  
  const consolidatedProducts = consolidateProducts(orders, getUnitForProduct);
  const isWeightUnit = (u: string) => u === 'kg' || u === 'g';
  
  autoTable(doc, {
    startY: 85,
    head: [['#', 'Produto', 'Qtde', 'Unidade', 'Peso Total']],
    body: consolidatedProducts.map((p, idx) => [
      String(idx + 1),
      p.product,
      isWeightUnit(p.unitType) ? '-' : String(p.totalQuantity),
      p.unitType,
      isWeightUnit(p.unitType) ? formatWeight(p.totalWeight) : '-',
    ]),
    foot: [['', 'TOTAL', '', '', formatWeight(totalWeight)]],
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80], fontSize: 11 },
    footStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });
  
  // Signature section
  const signatureY = (doc as any).lastAutoTable?.finalY + 20 || 250;
  
  // Check if we need a new page for signatures
  if (signatureY > 260) {
    doc.addPage();
  }
  
  const sigY = signatureY > 260 ? 30 : signatureY;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFERÊNCIA DE CARGA', 20, sigY);
  
  // Separator signature box
  doc.setDrawColor(150, 150, 150);
  doc.rect(20, sigY + 5, 80, 30, 'S');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Separador:', 25, sigY + 12);
  doc.line(25, sigY + 25, 95, sigY + 25);
  doc.text('Assinatura', 55, sigY + 32);
  
  // Checker signature box
  doc.rect(110, sigY + 5, 80, 30, 'S');
  doc.text('Conferente:', 115, sigY + 12);
  doc.line(115, sigY + 25, 185, sigY + 25);
  doc.text('Assinatura', 145, sigY + 32);
  
  // Date/time box
  doc.rect(20, sigY + 40, 170, 15, 'S');
  doc.text('Data da conferência: ____/____/______ Hora: ____:____', 25, sigY + 50);
  
  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Gerado por Rota Certa', pageWidth / 2, 290, { align: 'center' });
  
  return doc;
}

export function LoadingManifest({ routeName, date, trucks }: LoadingManifestProps) {
  const [selectedTruckIndex, setSelectedTruckIndex] = useState(0);
  const { getUnitForProduct } = useProductUnits();
  
  const selectedTruck = trucks[selectedTruckIndex];
  
  const handleDownloadPDF = () => {
    if (!selectedTruck) return;
    
    const doc = generateLoadingManifestPDF(
      routeName,
      date,
      selectedTruck.truck,
      selectedTruck.orders,
      selectedTruck.totalWeight,
      selectedTruck.occupancyPercent,
      getUnitForProduct
    );
    
    doc.save(`romaneio-carga-${selectedTruck.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
  };
  
  const handlePrint = () => {
    if (!selectedTruck) return;
    
    const doc = generateLoadingManifestPDF(
      routeName,
      date,
      selectedTruck.truck,
      selectedTruck.orders,
      selectedTruck.totalWeight,
      selectedTruck.occupancyPercent,
      getUnitForProduct
    );
    
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };
  
  const handleDownloadAll = () => {
    trucks.forEach((truckData, index) => {
      setTimeout(() => {
        const doc = generateLoadingManifestPDF(
          routeName,
          date,
          truckData.truck,
          truckData.orders,
          truckData.totalWeight,
          truckData.occupancyPercent,
          getUnitForProduct
        );
        doc.save(`romaneio-carga-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
      }, index * 500);
    });
  };
  
  if (trucks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Nenhum caminhão com carga atribuída</p>
        </CardContent>
      </Card>
    );
  }
  
  const isWeightUnit = (u: string) => u === 'kg' || u === 'g';
  
  const consolidatedProducts = selectedTruck 
    ? consolidateProducts(selectedTruck.orders, getUnitForProduct) 
    : [];
  
  return (
    <div className="space-y-4">
      {/* Truck selector tabs */}
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
      
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={handleDownloadPDF} className="gap-2">
          <FileDown className="h-4 w-4" />
          Baixar PDF
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        {trucks.length > 1 && (
          <Button variant="outline" onClick={handleDownloadAll} className="gap-2">
            <FileDown className="h-4 w-4" />
            Baixar Todos
          </Button>
        )}
      </div>
      
      {/* Loading Manifest preview */}
      {selectedTruck && (
        <Card className="print:shadow-none">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ClipboardCheck className="h-5 w-5" />
                  Romaneio de Carga
                </CardTitle>
                <CardDescription>{routeName} • {date}</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold">
                {selectedTruck.truck.plate}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Truck summary */}
            <div className="grid grid-cols-2 gap-4 border-b p-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Veículo</p>
                <p className="font-semibold">{selectedTruck.truck.model}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capacidade</p>
                <p className="font-semibold">{formatWeight(Number(selectedTruck.truck.capacity_kg))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Carga Total</p>
                <p className="font-semibold">{formatWeight(selectedTruck.totalWeight)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ocupação</p>
                <p className={cn(
                  'font-semibold',
                  selectedTruck.occupancyPercent > 90 ? 'text-destructive' : 
                  selectedTruck.occupancyPercent > 70 ? 'text-warning' : 'text-success'
                )}>
                  {selectedTruck.occupancyPercent}%
                </p>
              </div>
            </div>
            
            {/* Origin */}
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-primary/5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                CD
              </div>
              <div>
                <p className="text-sm font-medium">{DISTRIBUTION_CENTER.name}</p>
                <p className="text-xs text-muted-foreground">{DISTRIBUTION_CENTER.address}</p>
              </div>
            </div>
            
            {/* Consolidated Products */}
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold mb-3">
                <Scale className="h-4 w-4" />
                Produtos Consolidados
              </h3>
              <div className="space-y-2">
                {consolidatedProducts.map((product, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between rounded-lg border p-3 bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{product.product}</span>
                      <Badge variant="outline" className="text-xs">
                        {product.unitType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      {!isWeightUnit(product.unitType) && (
                        <span className="text-sm font-medium">
                          {product.totalQuantity} {product.unitType}
                        </span>
                      )}
                      {isWeightUnit(product.unitType) && (
                        <span className="font-bold">{formatWeight(product.totalWeight)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between font-bold">
                <span>TOTAL DA CARGA</span>
                <span className="text-lg">{formatWeight(selectedTruck.totalWeight)}</span>
              </div>
            </div>
            
            {/* Removed: Detailed orders list - Romaneio de Carga should only show consolidated products */}
            
            {/* Signature fields */}
            <div className="border-t bg-muted/20 p-4">
              <h3 className="font-semibold mb-3">Conferência de Carga</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-2">Separador</p>
                  <div className="border-b border-dashed h-8" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Assinatura</p>
                </div>
                <div className="border rounded-lg p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-2">Conferente</p>
                  <div className="border-b border-dashed h-8" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Assinatura</p>
                </div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Data: ____/____/______ Hora: ____:____
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
