import { useState, useRef } from 'react';
import { FileDown, Printer, Truck, Package, ClipboardCheck, Scale, AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck as TruckType, Order, OrderItem, DISTRIBUTION_CENTER, ParsedOrder } from '@/types';
import { cn } from '@/lib/utils';
import { useProductUnits, getUnitAbbrev, isWeightUnit, inferUnitFromName } from '@/hooks/useProductUnits';
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

/**
 * Resolve a unidade de medida com prioridade:
 * 1. Marcadores fortes no nome do produto (FD12UN, CX6, etc.)
 * 2. Cadastro do produto no banco
 * 3. Inferência por categoria (bebidas, etc.)
 * 4. Default: kg
 */
function resolveUnit(productName: string, getUnitForProduct: (name: string) => string): string {
  // Primeiro: checar marcadores fortes no nome do produto
  const inferred = inferUnitFromName(productName);
  
  // Se a inferência encontrou algo diferente de kg (marcador forte), usar ela
  if (inferred !== 'kg') return inferred;
  
  // Senão, consultar o banco via getUnitForProduct (que já tem seu próprio fallback)
  return getUnitForProduct(productName);
}

/**
 * Normaliza nome do produto para consolidação
 * Remove espaços extras, padroniza case
 */
function normalizeProductKey(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function consolidateProducts(orders: Order[], getUnitForProduct: (name: string) => string): ConsolidatedProduct[] {
  const productMap = new Map<string, { product: string; qty: number; unitType: string }>();
  
  const noDetails = ordersLackDetails(orders);
  
  orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const key = normalizeProductKey(productName);
        const unitType = resolveUnit(productName, getUnitForProduct);
        const existing = productMap.get(key) || { product: productName, qty: 0, unitType };
        
        if (isWeightUnit(unitType)) {
          existing.qty += Number(item.weight_kg);
        } else {
          existing.qty += (item.quantity || 1);
        }
        
        productMap.set(key, existing);
      });
    } else if (noDetails) {
      // Fallback: sem itens detalhados, usar peso bruto por cliente
      const label = `Pedido - ${order.client_name}`;
      const key = normalizeProductKey(label);
      productMap.set(key, { product: label, qty: Number(order.weight_kg), unitType: 'kg' });
    } else {
      const label = order.product_description || `Pedido ${order.client_name}`;
      const key = normalizeProductKey(label);
      const unitType = resolveUnit(label, getUnitForProduct);
      const existing = productMap.get(key) || { product: label, qty: 0, unitType };
      if (isWeightUnit(unitType)) {
        existing.qty += Number(order.weight_kg);
      } else {
        existing.qty += 1;
      }
      productMap.set(key, existing);
    }
  });
  
  return Array.from(productMap.values())
    .map(data => ({
      product: data.product,
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

/**
 * Extrai lista de nomes de clientes únicos do caminhão
 */
function getClientList(orders: Order[]): string[] {
  const unique = new Set<string>();
  orders.forEach(o => unique.add(o.client_name));
  return Array.from(unique).sort();
}

/**
 * Converte caracteres especiais para compatibilidade com PDF (Helvetica)
 */
function pdfSafe(text: string): string {
  if (!text) return '';
  let r = text;
  r = r.replace(/[""]/g, '"').replace(/['']/g, "'");
  r = r.replace(/[–—]/g, '-').replace(/…/g, '...');
  // Map accented chars to ASCII for Helvetica compatibility
  const map: Record<string, string> = {
    'á':'a','à':'a','ã':'a','â':'a','ä':'a',
    'é':'e','è':'e','ê':'e','ë':'e',
    'í':'i','ì':'i','î':'i','ï':'i',
    'ó':'o','ò':'o','õ':'o','ô':'o','ö':'o',
    'ú':'u','ù':'u','û':'u','ü':'u',
    'ç':'c','ñ':'n',
    'Á':'A','À':'A','Ã':'A','Â':'A','Ä':'A',
    'É':'E','È':'E','Ê':'E','Ë':'E',
    'Í':'I','Ì':'I','Î':'I','Ï':'I',
    'Ó':'O','Ò':'O','Õ':'O','Ô':'O','Ö':'O',
    'Ú':'U','Ù':'U','Û':'U','Ü':'U',
    'Ç':'C','Ñ':'N','°':'o','º':'o','ª':'a',
  };
  return r.split('').map(c => map[c] || c).join('');
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
  const margin = 15;
  let y = 18;

  // ── Title ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Romaneio', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // ── Header info line ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const headerLine = `Data: ${pdfSafe(date)}  |  Entregador: ${pdfSafe(truck.plate)} - ${pdfSafe(truck.model)}  |  Entregas: ${orders.length}  |  Peso: ${formatWeight(totalWeight)} (${occupancyPercent}%)`;
  doc.text(pdfSafe(headerLine), pageWidth / 2, y, { align: 'center' });
  y += 6;

  // ── Vendas (client list) ──
  const clients = getClientList(orders);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Clientes:', margin, y);
  doc.setFont('helvetica', 'normal');
  const clientText = pdfSafe(clients.join(' , '));
  // Wrap client text across multiple lines if needed
  const clientLines = doc.splitTextToSize(clientText, pageWidth - 2 * margin - 20);
  doc.text(clientLines, margin + 20, y);
  y += Math.max(clientLines.length * 4, 5) + 4;

  // ── Warning if no detailed items ──
  const noDetails = ordersLackDetails(orders);
  if (noDetails) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 100, 0);
    doc.text('* Detalhamento de produtos nao importado - listando pedidos individuais por cliente/peso', margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // ── Consolidated Products Table ──
  const consolidatedProducts = consolidateProducts(orders, getUnitForProduct);

  autoTable(doc, {
    startY: y,
    head: [['#', pdfSafe('Descricao'), 'UN', 'Qtde']],
    body: consolidatedProducts.map((p, idx) => [
      String(idx + 1),
      pdfSafe(p.product),
      p.unitAbbrev,
      formatQty(p.qty, p.unitType),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80], fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  // ── Signature section ──
  const tableEndY = (doc as any).lastAutoTable?.finalY || y + 20;
  let sigY = tableEndY + 15;

  // Check if we need a new page
  if (sigY > 255) {
    doc.addPage();
    sigY = 25;
  }

  doc.setFontSize(9);
  doc.text('Data: ___/___/___', margin, sigY);
  sigY += 10;

  doc.setDrawColor(150, 150, 150);
  doc.line(margin, sigY, margin + 80, sigY);
  doc.setFontSize(8);
  doc.text('Assinatura', margin + 30, sigY + 5);

  // ── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    pdfSafe(`Gerado em ${new Date().toLocaleString('pt-BR')} - Rota Certa`),
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: 'center' }
  );

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
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const selectedTruck = trucks[selectedTruckIndex];
  
  const handleDownloadPDF = () => {
    if (!selectedTruck) return;
    const doc = generateLoadingManifestPDF(
      routeName, date, selectedTruck.truck, selectedTruck.orders,
      selectedTruck.totalWeight, selectedTruck.occupancyPercent, getUnitForProduct
    );
    doc.save(`romaneio-carga-${selectedTruck.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
  };
  
  const handlePrint = () => {
    if (!selectedTruck) return;
    const doc = generateLoadingManifestPDF(
      routeName, date, selectedTruck.truck, selectedTruck.orders,
      selectedTruck.totalWeight, selectedTruck.occupancyPercent, getUnitForProduct
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
          routeName, date, truckData.truck, truckData.orders,
          truckData.totalWeight, truckData.occupancyPercent, getUnitForProduct
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
              {t.orders.length} entregas
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
                <CardTitle className="text-xl">Romaneio de Carga</CardTitle>
                <CardDescription>
                  {routeName} • {date} • {selectedTruck.truck.plate} - {selectedTruck.truck.model}
                </CardDescription>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-lg font-bold">
                  {selectedTruck.truck.plate}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTruck.orders.length} entregas • {formatWeight(selectedTruck.totalWeight)} ({selectedTruck.occupancyPercent}%)
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Clientes */}
            <div className="border-b px-4 py-3 bg-primary/5">
              <p className="text-xs text-muted-foreground mb-1">Clientes neste caminhão</p>
              <p className="text-sm">
                {getClientList(selectedTruck.orders).join(' • ')}
              </p>
            </div>
            
            {/* Warning for missing details */}
            {ordersLackDetails(selectedTruck.orders) && (
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
            
            {/* Consolidated Products Table */}
            <div className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-16 text-center">UN</TableHead>
                    <TableHead className="w-20 text-right">Qtde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedProducts.map((product, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{product.product}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {product.unitAbbrev}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatQty(product.qty, product.unitType)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <Separator className="my-3" />
              <div className="flex items-center justify-between font-bold text-sm">
                <span>{consolidatedProducts.length} produtos</span>
                <span>Peso total: {formatWeight(selectedTruck.totalWeight)}</span>
              </div>
            </div>
            
            {/* Signature fields */}
            <div className="border-t bg-muted/20 p-4">
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
