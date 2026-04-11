import { useState, useRef } from 'react';
import { FileDown, Printer, Truck, Package, AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck as TruckType, Order, OrderItem, ParsedOrder } from '@/types';
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
  productCode?: string;
  qty: number;
  unitAbbrev: string;
  unitType: string;
}

function ordersLackDetails(orders: Order[]): boolean {
  return orders.every(order => !order.items || order.items.length === 0);
}

function countOrdersWithoutItems(orders: Order[]): number {
  return orders.filter(order => !order.items || order.items.length === 0).length;
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
  const productMap = new Map<string, { product: string; productCode?: string; qty: number; unitType: string }>();
  
  orders.forEach(order => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: OrderItem) => {
        const productName = item.product_name || 'Produto não especificado';
        const productCode = (item as any).product_code || undefined;
        // Use product_code as key if available, otherwise normalized name
        const key = productCode || normalizeProductKey(productName);
        // Use unit from DB if available, otherwise resolve via inference
        const unitType = item.unit && item.unit !== 'kg' 
          ? item.unit 
          : resolveUnit(productName, getUnitForProduct);
        const existing = productMap.get(key) || { product: productName, productCode, qty: 0, unitType };
        
        if (isWeightUnit(unitType)) {
          existing.qty += Number(item.weight_kg);
        } else {
          existing.qty += (item.quantity || 1);
        }
        
        productMap.set(key, existing);
      });
    }
  });
  
  return Array.from(productMap.values())
    .map(data => ({
      product: data.product,
      productCode: data.productCode,
      qty: data.qty,
      unitAbbrev: getUnitAbbrev(data.unitType),
      unitType: data.unitType,
    }))
    .sort((a, b) => a.product.localeCompare(b.product));
}


/**
 * Combina quantidade + unidade por extenso para a coluna "Peso Total" do romaneio.
 * Ex: 3 + fardo → "3 fardos", 120.5 + kg → "120.5kg", 1 + caixa → "1 caixa"
 */
function formatQtyWithUnit(qty: number, unitType: string): string {
  const u = unitType.toLowerCase().trim();

  // Unidades de peso: sem espaço, ex "120.5kg"
  if (u === 'kg') {
    const formatted = qty % 1 === 0 ? String(qty) : qty.toFixed(1);
    return `${formatted}kg`;
  }
  if (u === 'g') {
    const formatted = qty % 1 === 0 ? String(qty) : qty.toFixed(0);
    return `${formatted}g`;
  }

  const rounded = Math.round(qty);
  const plural = rounded !== 1;

  const nameMap: Record<string, [string, string]> = {
    fardo: ['fardo', 'fardos'],
    caixa: ['caixa', 'caixas'],
    pacote: ['pacote', 'pacotes'],
    unidade: ['unidade', 'unidades'],
    litro: ['litro', 'litros'],
    garrafa: ['garrafa', 'garrafas'],
    peca: ['peca', 'pecas'],
    saco: ['saco', 'sacos'],
    display: ['display', 'displays'],
  };

  const names = nameMap[u];
  if (names) {
    return `${rounded} ${plural ? names[1] : names[0]}`;
  }

  return `${rounded} ${unitType}`;
}

function formatWeight(weight: number): string {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(2)}t`;
  }
  return `${weight.toFixed(1)}kg`;
}

/**
 * Converte caracteres especiais para compatibilidade com PDF (Helvetica)
 */
function pdfSafe(text: string): string {
  if (!text) return '';
  let r = text;
  r = r.replace(/[""]/g, '"').replace(/['']/g, "'");
  r = r.replace(/[–—]/g, '-').replace(/…/g, '...');
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
  let y = 20;

  // ── Title ──
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE CARGA', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(pdfSafe(routeName), pageWidth / 2, y, { align: 'center' });
  y += 10;

  // ── Header info box using autoTable (2 rows: VEICULO/DATA, CARGA TOTAL/CAPACIDADE) ──
  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'VEICULO', styles: { fontStyle: 'bold', fontSize: 9 } },
        { content: pdfSafe(`${truck.plate} - ${truck.model}`), styles: { fontSize: 9 } },
        { content: 'DATA', styles: { fontStyle: 'bold', fontSize: 9 } },
        { content: pdfSafe(date), styles: { fontSize: 9 } },
      ],
      [
        { content: 'CARGA TOTAL', styles: { fontStyle: 'bold', fontSize: 9 } },
        { content: formatWeight(totalWeight), styles: { fontSize: 9 } },
        { content: 'CAPACIDADE', styles: { fontStyle: 'bold', fontSize: 9 } },
        { content: `${formatWeight(truck.capacity_kg)} (${occupancyPercent}%)`, styles: { fontSize: 9 } },
      ],
    ],
    theme: 'grid',
    styles: { cellPadding: 3, lineColor: [180, 180, 180], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 60 },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Section title ──
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS PARA SEPARACAO', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // ── Warning if no detailed items ──
  const noDetails = ordersLackDetails(orders);
  if (noDetails) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 100, 0);
    doc.text('* Detalhamento de produtos nao importado. Reimporte o arquivo ADV para gerar o romaneio.', margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // ── Consolidated Products Table (3 columns: #, Produto, Peso Total) ──
  const consolidatedProducts = consolidateProducts(orders, getUnitForProduct);

  const tableBody = consolidatedProducts.map((p, idx) => [
    String(idx + 1),
    pdfSafe(p.product),
    formatQtyWithUnit(p.qty, p.unitType),
  ]);

  // Add TOTAL row
  tableBody.push([
    '',
    'TOTAL',
    formatWeight(totalWeight),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Produto', 'Peso Total']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [80, 80, 80], fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Style the TOTAL row (last body row)
      if (data.section === 'body' && data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 10;
      }
    },
  });

  // ── Conferência section ──
  let confY = (doc as any).lastAutoTable.finalY + 14;

  // Check if we need a new page — need ~60mm for conference section
  if (confY > 220) {
    doc.addPage();
    confY = 25;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFERENCIA DE CARGA', pageWidth / 2, confY, { align: 'center' });
  confY += 12;

  // Separador + Conferente side by side
  const colWidth = (pageWidth - 2 * margin - 10) / 2;
  doc.setDrawColor(150, 150, 150);

  // Separador
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Separador:', margin, confY);
  confY += 10;
  doc.line(margin, confY, margin + colWidth, confY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Assinatura', margin + colWidth / 2, confY + 5, { align: 'center' });

  // Conferente
  const rightX = margin + colWidth + 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Conferente:', rightX, confY - 10);
  doc.line(rightX, confY, rightX + colWidth, confY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Assinatura', rightX + colWidth / 2, confY + 5, { align: 'center' });

  confY += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Data da conferencia: ___/___/______ Hora: ___:___', margin, confY);

  // ── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Gerado por Rota Certa',
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
      {(() => {
        const noItems = selectedTruck ? (ordersLackDetails(selectedTruck.orders) || consolidatedProducts.length === 0) : true;
        return (
          <div className="flex gap-2 flex-wrap">
            {noItems && onReimportItems && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={handleReimportFile}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isReimporting}
                  className="gap-2"
                  variant="destructive"
                >
                  <Upload className="h-4 w-4" />
                  {isReimporting ? 'Importando...' : 'Reimportar Detalhamento ADV'}
                </Button>
              </>
            )}
            <Button onClick={handleDownloadPDF} className="gap-2" disabled={noItems} title={noItems ? 'Reimporte o ADV antes de gerar o PDF' : ''}>
              <FileDown className="h-4 w-4" />
              Baixar PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} className="gap-2" disabled={noItems}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
            {trucks.length > 1 && (
              <Button variant="outline" onClick={handleDownloadAll} className="gap-2" disabled={noItems}>
                <FileDown className="h-4 w-4" />
                Baixar Todos
              </Button>
            )}
          </div>
        );
      })()}
      
      {/* Loading Manifest preview */}
      {selectedTruck && (
        <Card className="print:shadow-none">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">ROMANEIO DE CARGA</CardTitle>
                <CardDescription>{routeName}</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold">
                {selectedTruck.truck.plate}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Header info grid */}
            <div className="grid grid-cols-2 border-b text-sm">
              <div className="border-r px-4 py-2">
                <span className="font-bold text-muted-foreground">VEICULO: </span>
                {selectedTruck.truck.plate} - {selectedTruck.truck.model}
              </div>
              <div className="px-4 py-2">
                <span className="font-bold text-muted-foreground">DATA: </span>
                {date}
              </div>
              <div className="border-r border-t px-4 py-2">
                <span className="font-bold text-muted-foreground">CARGA TOTAL: </span>
                {formatWeight(selectedTruck.totalWeight)}
              </div>
              <div className="border-t px-4 py-2">
                <span className="font-bold text-muted-foreground">CAPACIDADE: </span>
                {formatWeight(selectedTruck.truck.capacity_kg)} ({selectedTruck.occupancyPercent}%)
              </div>
            </div>
            
            {/* Warning for missing details */}
            {(() => {
              const missingCount = countOrdersWithoutItems(selectedTruck.orders);
              const allMissing = ordersLackDetails(selectedTruck.orders) || consolidatedProducts.length === 0;
              if (missingCount === 0 && consolidatedProducts.length > 0) return null;
              return (
                <Alert variant="default" className="mx-4 mt-4 border-warning/50 bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription className="flex items-center justify-between gap-4">
                    <span>
                      {allMissing
                        ? 'Detalhamento de produtos não importado. Reimporte o arquivo ADV para gerar o romaneio.'
                        : `${missingCount} pedido(s) deste caminhão estão sem itens detalhados e foram omitidos da consolidação. Reimporte o ADV para incluí-los.`}
                    </span>
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
              );
            })()}
            
            {/* Section title */}
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-center font-bold text-sm">PRODUTOS PARA SEPARAÇÃO</h3>
            </div>

            {/* Consolidated Products Table — 3 columns */}
            <div className="px-4 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-28 text-right">Peso Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedProducts.map((product, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{product.product}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatQtyWithUnit(product.qty, product.unitType)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* TOTAL row */}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell />
                    <TableCell className="font-bold">TOTAL</TableCell>
                    <TableCell className="text-right font-bold">{formatWeight(selectedTruck.totalWeight)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            
            {/* Conferência de Carga */}
            <div className="border-t bg-muted/20 p-4">
              <h3 className="text-center font-bold text-sm mb-4">CONFERÊNCIA DE CARGA</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-3 bg-background">
                  <p className="text-xs font-bold text-muted-foreground mb-2">Separador:</p>
                  <div className="border-b border-dashed h-8" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Assinatura</p>
                </div>
                <div className="border rounded-lg p-3 bg-background">
                  <p className="text-xs font-bold text-muted-foreground mb-2">Conferente:</p>
                  <div className="border-b border-dashed h-8" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">Assinatura</p>
                </div>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Data da conferência: ____/____/______ Hora: ____:____
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
