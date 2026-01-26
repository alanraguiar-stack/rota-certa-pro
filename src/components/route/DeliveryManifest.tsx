/**
 * Romaneio de Entrega (Delivery Manifest)
 * Documento detalhado para uso em campo pelos motoristas
 * Inclui itens específicos por cliente
 */

import { useState } from 'react';
import { FileDown, Printer, Truck, Package, MapPin, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Truck as TruckType, Order, OrderItem, DISTRIBUTION_CENTER } from '@/types';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

/**
 * Convert accented characters to ASCII for PDF compatibility
 */
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
 * Get items display for an order
 */
function getOrderItems(order: Order): Array<{ name: string; weight: number }> {
  if (order.items && order.items.length > 0) {
    return order.items.map(item => ({
      name: item.product_name,
      weight: Number(item.weight_kg),
    }));
  }
  
  if (order.product_description) {
    return [{
      name: order.product_description,
      weight: Number(order.weight_kg),
    }];
  }
  
  return [{
    name: 'Mercadoria',
    weight: Number(order.weight_kg),
  }];
}

/**
 * Generate delivery manifest PDF with detailed items per client
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
  
  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE ENTREGA', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(toASCII(routeName), pageWidth / 2, 26, { align: 'center' });
  
  // Info box
  doc.setFillColor(245, 245, 245);
  doc.rect(15, 32, pageWidth - 30, 24, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 32, pageWidth - 30, 24, 'S');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VEICULO:', 20, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`${truck.plate} - ${toASCII(truck.model)}`, 42, 40);
  
  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', 110, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(date, 125, 40);
  
  if (departureTime) {
    doc.setFont('helvetica', 'bold');
    doc.text('SAIDA:', 155, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(departureTime, 172, 40);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGAS:', 20, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(String(orders.length), 45, 50);
  
  doc.setFont('helvetica', 'bold');
  doc.text('PESO TOTAL:', 60, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatWeight(totalWeight)} (${occupancyPercent}%)`, 90, 50);
  
  // Origin
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Origem: ${toASCII(DISTRIBUTION_CENTER.address)}`, 20, 62);
  
  // Delivery table with items
  let currentY = 70;
  
  orders.forEach((order, index) => {
    const items = getOrderItems(order);
    const itemsText = items.map(i => `${toASCII(i.name)} (${formatWeight(i.weight)})`).join(', ');
    
    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    
    // Delivery header
    doc.setFillColor(80, 80, 80);
    doc.rect(15, currentY, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${toASCII(order.client_name)}`, 20, currentY + 5.5);
    doc.text(formatWeight(Number(order.weight_kg)), pageWidth - 25, currentY + 5.5, { align: 'right' });
    
    currentY += 10;
    
    // Address
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(toASCII(order.address), pageWidth - 40);
    doc.text(addressLines, 20, currentY + 4);
    currentY += addressLines.length * 4 + 2;
    
    // Items
    if (items.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Itens:', 20, currentY + 4);
      doc.setFont('helvetica', 'normal');
      const itemLines = doc.splitTextToSize(itemsText, pageWidth - 50);
      doc.text(itemLines, 35, currentY + 4);
      currentY += itemLines.length * 3.5 + 4;
    }
    
    // Signature line
    doc.setDrawColor(180, 180, 180);
    doc.line(20, currentY + 8, pageWidth / 2 - 10, currentY + 8);
    doc.line(pageWidth / 2 + 10, currentY + 8, pageWidth - 20, currentY + 8);
    
    doc.setFontSize(7);
    doc.text('Assinatura do Cliente', 35, currentY + 12);
    doc.text('Observacoes', pageWidth / 2 + 30, currentY + 12);
    
    currentY += 20;
    
    // Separator
    if (index < orders.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.line(15, currentY - 5, pageWidth - 15, currentY - 5);
    }
  });
  
  // Footer with KM fields
  const footerY = Math.max(currentY + 10, 260);
  
  if (footerY > 280) {
    doc.addPage();
  }
  
  const kmY = footerY > 280 ? 20 : footerY;
  
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('Km Saida: ____________', 20, kmY);
  doc.text('Km Retorno: ____________', 75, kmY);
  doc.text('Total Km: ____________', 135, kmY);
  
  // Driver signature
  doc.setFontSize(8);
  doc.text('Motorista: ________________________________', 20, kmY + 12);
  doc.text('Hora Retorno: ________', 130, kmY + 12);
  
  // Timestamp
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} - Rota Certa`,
    pageWidth / 2,
    kmY + 22,
    { align: 'center' }
  );
  
  return doc;
}

export function DeliveryManifest({ routeName, date, trucks }: DeliveryManifestProps) {
  const [selectedTruckIndex, setSelectedTruckIndex] = useState(0);
  const selectedTruck = trucks[selectedTruckIndex];
  
  const handleDownloadPDF = () => {
    if (!selectedTruck) return;
    
    const doc = generateDeliveryManifestPDF(
      routeName,
      date,
      selectedTruck.truck,
      selectedTruck.orders,
      selectedTruck.totalWeight,
      selectedTruck.occupancyPercent,
      selectedTruck.departureTime
    );
    
    doc.save(`romaneio-entrega-${selectedTruck.truck.plate}-${date.replace(/\//g, '-')}.pdf`);
  };
  
  const handlePrint = () => {
    if (!selectedTruck) return;
    
    const doc = generateDeliveryManifestPDF(
      routeName,
      date,
      selectedTruck.truck,
      selectedTruck.orders,
      selectedTruck.totalWeight,
      selectedTruck.occupancyPercent,
      selectedTruck.departureTime
    );
    
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };
  
  const handleDownloadAll = () => {
    trucks.forEach((truckData, index) => {
      setTimeout(() => {
        const doc = generateDeliveryManifestPDF(
          routeName,
          date,
          truckData.truck,
          truckData.orders,
          truckData.totalWeight,
          truckData.occupancyPercent,
          truckData.departureTime
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
          <p>Nenhum caminhão com entregas atribuídas</p>
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
            <Badge variant="secondary" className="ml-1">
              {t.orders.length}
            </Badge>
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
                Romaneio de Entrega
              </CardTitle>
              <CardDescription>{routeName} • {date}</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg font-bold">
              {selectedTruck.truck.plate}
            </Badge>
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
              <p className="text-xs text-muted-foreground">Saída</p>
              <p className="text-xl font-bold">{selectedTruck.departureTime || '--:--'}</p>
            </div>
          </div>
          
          {/* Delivery list */}
          <div className="max-h-[500px] overflow-y-auto">
            {selectedTruck.orders.map((order, idx) => {
              const items = getOrderItems(order);
              
              return (
                <div key={order.id} className="border-b last:border-b-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 bg-muted/50 px-4 py-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{order.client_name}</p>
                    </div>
                    <Badge>{formatWeight(Number(order.weight_kg))}</Badge>
                  </div>
                  
                  {/* Details */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{order.address}</span>
                    </div>
                    
                    {items.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {items.map((item, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {item.name} ({formatWeight(item.weight)})
                            </Badge>
                          ))}
                        </div>
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
