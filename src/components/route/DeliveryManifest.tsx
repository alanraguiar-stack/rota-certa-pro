/**
 * Romaneio de Entrega (Delivery Manifest) - Estilo ADV
 * Cada entrega ocupa um bloco com dados + campo de assinatura
 */

import { useState } from 'react';
import { FileDown, Printer, Truck, Package, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck as TruckType, Order, DISTRIBUTION_CENTER } from '@/types';
import jsPDF from 'jspdf';

interface DeliveryManifestProps {
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
    '°': 'o', 'º': 'o', 'ª': 'a',
  };
  return text.split('').map(char => charMap[char] || char).join('');
}

function getOrderItems(order: Order): Array<{ name: string; weight: number }> {
  if (order.items && order.items.length > 0) {
    return order.items.map(item => ({
      name: item.product_name,
      weight: Number(item.weight_kg),
    }));
  }
  if (order.product_description) {
    return [{ name: order.product_description, weight: Number(order.weight_kg) }];
  }
  return [{ name: 'Mercadoria', weight: Number(order.weight_kg) }];
}

// ── Constants for PDF layout ──
const MARGIN = 12;
const BLOCK_HEIGHT = 32; // height per delivery block (data line + address + signature area)
const HEADER_HEIGHT = 50; // space for top header
const FOOTER_HEIGHT = 16; // space for page footer

/**
 * Generate delivery manifest PDF in ADV style
 */
function generateDeliveryManifestPDF(
  routeName: string,
  date: string,
  truck: TruckType,
  orders: Order[],
  totalWeight: number,
  occupancyPercent: number,
  departureTime?: string
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * MARGIN;
  let currentY = 0;
  let pageNum = 1;
  const totalPages = estimatePages(orders.length);

  function drawHeader() {
    currentY = 14;
    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Itinerario de Entregas', pageWidth / 2, currentY, { align: 'center' });

    currentY += 5;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, currentY, pageWidth - MARGIN, currentY);

    // Vehicle info
    currentY += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Entregador: ${toASCII(truck.plate)} - ${toASCII(truck.model)}`, MARGIN, currentY);

    // Route name + stats on the right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${toASCII(routeName)}`, pageWidth - MARGIN, currentY, { align: 'right' });

    currentY += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const statsText = `Entregas: ${orders.length} | Peso: ${formatWeight(totalWeight)} (${occupancyPercent}%)${departureTime ? ` | Saida: ${departureTime}` : ''}`;
    doc.text(statsText, MARGIN, currentY);

    // Column headers
    currentY += 6;
    doc.setFillColor(230, 230, 230);
    doc.rect(MARGIN, currentY - 3.5, contentWidth, 5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Ordem', MARGIN + 2, currentY);
    doc.text('Razao / Cliente', MARGIN + 20, currentY);
    doc.text('Cidade', pageWidth - MARGIN - 42, currentY);
    doc.text('Peso', pageWidth - MARGIN - 2, currentY, { align: 'right' });

    currentY += 5;
  }

  function drawPageFooter() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Data: ${dateStr} | Hora: ${timeStr} | Pag.: ${pageNum} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
    doc.setTextColor(0, 0, 0);
  }

  function estimatePages(count: number): number {
    const firstPageCapacity = Math.floor((pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT - 40) / BLOCK_HEIGHT);
    const otherPageCapacity = Math.floor((pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT) / BLOCK_HEIGHT);
    if (count <= firstPageCapacity) return 1;
    return 1 + Math.ceil((count - firstPageCapacity) / otherPageCapacity);
  }

  function ensureSpace(needed: number) {
    if (currentY + needed > pageHeight - FOOTER_HEIGHT - 10) {
      drawPageFooter();
      doc.addPage();
      pageNum++;
      drawHeader();
    }
  }

  // ── Start first page ──
  drawHeader();

  // ── Draw each delivery block ──
  orders.forEach((order, index) => {
    const addressText = toASCII(order.address);
    const addressLines = doc.splitTextToSize(addressText, contentWidth - 25);
    const blockH = 8 + (addressLines.length * 3.5) + 14; // data + address + signature area

    ensureSpace(blockH);

    // Delivery data row
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(index + 1), MARGIN + 5, currentY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    const clientName = toASCII(order.client_name);
    doc.text(clientName.substring(0, 45), MARGIN + 20, currentY);

    doc.setFont('helvetica', 'normal');
    doc.text(toASCII(order.city || ''), pageWidth - MARGIN - 42, currentY);
    doc.text(formatWeight(Number(order.weight_kg)), pageWidth - MARGIN - 2, currentY, { align: 'right' });

    // Address below
    currentY += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(addressLines, MARGIN + 20, currentY);
    currentY += addressLines.length * 3.5;

    // Signature area
    currentY += 3;
    doc.setFontSize(7);
    doc.text('Data de Recebimento: _____ /_____ /______', MARGIN + 2, currentY);

    doc.text('Identificacao e Assinatura do Recebedor', pageWidth / 2 + 5, currentY);
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 + 5, currentY + 6, pageWidth - MARGIN, currentY + 6);

    currentY += 10;

    // Separator line between blocks
    if (index < orders.length - 1) {
      doc.setDrawColor(200);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, currentY - 1, pageWidth - MARGIN, currentY - 1);
      currentY += 2;
    }
  });

  // ── Final footer: KM + Driver signature ──
  ensureSpace(30);
  currentY += 5;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, currentY, pageWidth - MARGIN, currentY);
  currentY += 7;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Km Saida: ____________', MARGIN, currentY);
  doc.text('Km Retorno: ____________', MARGIN + 55, currentY);
  doc.text('Total Km: ____________', MARGIN + 115, currentY);

  currentY += 10;
  doc.text('_'.repeat(40), MARGIN, currentY);
  doc.setFontSize(7);
  doc.text('Assinatura do Motorista', MARGIN, currentY + 4);

  doc.text('_'.repeat(25), pageWidth / 2 + 20, currentY);
  doc.text('Data / Hora de Retorno', pageWidth / 2 + 20, currentY + 4);

  // Page footer
  drawPageFooter();

  return doc;
}

/**
 * Print via hidden iframe (sandbox-safe)
 */
function printPDF(doc: jsPDF) {
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
}

export function DeliveryManifest({ routeName, date, trucks }: DeliveryManifestProps) {
  const [selectedTruckIndex, setSelectedTruckIndex] = useState(0);
  const selectedTruck = trucks[selectedTruckIndex];

  const buildPDF = () => {
    if (!selectedTruck) return null;
    return generateDeliveryManifestPDF(
      routeName, date, selectedTruck.truck, selectedTruck.orders,
      selectedTruck.totalWeight, selectedTruck.occupancyPercent, selectedTruck.departureTime
    );
  };

  const handleDownloadPDF = () => {
    const doc = buildPDF();
    if (!doc) return;
    doc.save(`romaneio-entrega-${selectedTruck.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
  };

  const handlePrint = () => {
    const doc = buildPDF();
    if (!doc) return;
    printPDF(doc);
  };

  const handleDownloadAll = () => {
    trucks.forEach((truckData, index) => {
      setTimeout(() => {
        const doc = generateDeliveryManifestPDF(
          routeName, date, truckData.truck, truckData.orders,
          truckData.totalWeight, truckData.occupancyPercent, truckData.departureTime
        );
        doc.save(`romaneio-entrega-${truckData.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
      }, index * 500);
    });
  };

  if (trucks.length === 0 || !selectedTruck) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>Nenhum caminhao com entregas atribuidas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Truck selector */}
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
            <Badge variant="secondary" className="ml-1">{t.orders.length}</Badge>
          </Button>
        ))}
      </div>

      {/* Actions */}
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

      {/* Preview */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5" />
                Itinerario de Entregas
              </CardTitle>
              <CardDescription>{routeName} • {date}</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg font-bold">{selectedTruck.truck.plate}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 border-b p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Entregas</p>
              <p className="text-xl font-bold">{selectedTruck.orders.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peso Total</p>
              <p className="text-xl font-bold">{formatWeight(selectedTruck.totalWeight)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saida</p>
              <p className="text-xl font-bold">{selectedTruck.departureTime || '--:--'}</p>
            </div>
          </div>

          {/* Delivery list preview */}
          <div className="max-h-[500px] overflow-y-auto">
            {selectedTruck.orders.map((order, idx) => {
              const items = getOrderItems(order);
              return (
                <div key={order.id} className="border-b last:border-b-0">
                  <div className="flex items-center gap-3 bg-muted/50 px-4 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{order.client_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.city}</p>
                    </div>
                    <Badge>{formatWeight(Number(order.weight_kg))}</Badge>
                  </div>
                  <div className="px-4 py-2 space-y-1">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{order.address}</span>
                    </div>
                    {items.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-6">
                        {items.map((item, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {item.name} ({formatWeight(item.weight)})
                          </Badge>
                        ))}
                      </div>
                    )}
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
