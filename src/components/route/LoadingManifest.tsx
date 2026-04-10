import { useState, useRef } from 'react';
import { FileDown, Printer, Truck, Package, ClipboardCheck, Scale, AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck as TruckType, Order, OrderItem, DISTRIBUTION_CENTER, ParsedOrder } from '@/types';
import { cn } from '@/lib/utils';
import { useProductUnits, getUnitAbbrev, isWeightUnit } from '@/hooks/useProductUnits';
import { parseADVDetailExcel, isADVExcelFormat } from '@/lib/advParser';
import { decodeFileContent } from '@/lib/encoding';
import { useToast } from '@/hooks/use-toast';
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
  routeId?: string;
  onReimportItems?: (advOrders: ParsedOrder[]) => Promise<any>;
  isReimporting?: boolean;
}

interface ConsolidatedProduct {
  product: string;
  qty: number;
  unitAbbrev: string;
  unitType: string;
}

function ordersLackDetails(orders: Order[]): boolean {
  return orders.every(order => 
    (!order.items || order.items.length === 0) && 
    (!order.product_description || order.product_description === 'Sem itens detalhados')
  );
}

function consolidateProducts(orders: Order[], getUnitForProduct: (name: string) => string): ConsolidatedProduct[] {
  const productMap = new Map<string, { qty: number; unitType: string }>();
  
  const noDetails = ordersLackDetails(orders);
  
  orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const unitType = getUnitForProduct(productName);
        const existing = productMap.get(productName) || { qty: 0, unitType };
        
        if (isWeightUnit(unitType)) {
          existing.qty += Number(item.weight_kg);
        } else {
          existing.qty += (item.quantity || 1);
        }
        
        productMap.set(productName, existing);
      });
    } else if (noDetails) {
      const label = `Pedido - ${order.client_name}`;
      productMap.set(label, { qty: Number(order.weight_kg), unitType: 'kg' });
    } else {
      const label = order.product_description || `Pedido ${order.client_name}`;
      const unitType = getUnitForProduct(label);
      const existing = productMap.get(label) || { qty: 0, unitType };
      if (isWeightUnit(unitType)) {
        existing.qty += Number(order.weight_kg);
      } else {
        existing.qty += 1;
      }
      productMap.set(label, existing);
    }
  });
  
  return Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      qty: data.qty,
      unitAbbrev: getUnitAbbrev(data.unitType),
      unitType: data.unitType,
    }))
    .sort((a, b) => a.product.localeCompare(b.product));
}

function formatQty(qty: number, unitType: string): string {
  if (isWeightUnit(unitType)) {
    return qty % 1 === 0 ? String(qty) : qty.toFixed(2).replace('.', ',');
  }
  return String(Math.round(qty));
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
  // Warning if no detailed items
  const noDetails = ordersLackDetails(orders);
  let tableStartY = 80;
  if (noDetails) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 100, 0);
    doc.text('* Detalhamento de produtos nao importado - listando pedidos individuais por cliente/peso', 20, 75);
    doc.setTextColor(0, 0, 0);
    tableStartY = 82;
  }
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(noDetails ? 'PEDIDOS PARA SEPARACAO' : 'PRODUTOS PARA SEPARACAO', 20, tableStartY);
  
  const consolidatedProducts = consolidateProducts(orders, getUnitForProduct);
  
  autoTable(doc, {
    startY: tableStartY + 5,
    head: [['#', 'Descricao', 'UN', 'Qtde']],
    body: consolidatedProducts.map((p, idx) => [
      String(idx + 1),
      p.product,
      p.unitAbbrev,
      formatQty(p.qty, p.unitType),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80], fontSize: 11 },
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
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

export function LoadingManifest({ routeName, date, trucks, routeId, onReimportItems, isReimporting }: LoadingManifestProps) {
  const [selectedTruckIndex, setSelectedTruckIndex] = useState(0);
  const { getUnitForProduct } = useProductUnits();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleReimportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onReimportItems) return;
    
    try {
      let rows: unknown[][] = [];
      
      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await decodeFileContent(file);
        const delimiter = text.includes(';') ? ';' : ',';
        rows = text.split('\n').map(line => line.split(delimiter));
      } else {
        // Excel file
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
      }
      
      if (!isADVExcelFormat(rows)) {
        toast({
          title: 'Formato não reconhecido',
          description: 'O arquivo não parece ser um relatório de Detalhe das Vendas (ADV).',
          variant: 'destructive',
        });
        return;
      }
      
      const advOrders = parseADVDetailExcel(rows);
      if (advOrders.length === 0) {
        toast({
          title: 'Nenhum item encontrado',
          description: 'O arquivo não contém itens detalhados de produtos.',
          variant: 'destructive',
        });
        return;
      }
      
      await onReimportItems(advOrders);
    } catch (err: any) {
      toast({
        title: 'Erro ao processar arquivo',
        description: err.message || 'Erro desconhecido',
        variant: 'destructive',
      });
    }
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
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
    
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
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
            
            {/* Warning for missing details */}
            {selectedTruck && ordersLackDetails(selectedTruck.orders) && (
              <Alert variant="default" className="mx-4 mt-4 border-warning/50 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>Detalhamento de produtos não importado. Listando pedidos individuais por cliente e peso.</span>
                  {onReimportItems && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,.txt"
                        className="hidden"
                        onChange={handleReimportFile}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isReimporting}
                      >
                        <Upload className="h-4 w-4" />
                        {isReimporting ? 'Importando...' : 'Reimportar Detalhamento'}
                      </Button>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Consolidated Products */}
            <div className="border-b p-4">
              <h3 className="flex items-center gap-2 font-semibold mb-3">
                <Scale className="h-4 w-4" />
                {selectedTruck && ordersLackDetails(selectedTruck.orders) ? 'Pedidos para Separação' : 'Produtos Consolidados'}
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
                        {product.unitAbbrev}
                      </Badge>
                    </div>
                    <span className="font-bold">
                      {formatQty(product.qty, product.unitType)} {product.unitAbbrev}
                    </span>
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
