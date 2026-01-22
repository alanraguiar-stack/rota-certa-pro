import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Truck, Order, DISTRIBUTION_CENTER } from '@/types';
import { OptimizedRoute, OrderWithRouteInfo } from './routing';

export interface ManifestData {
  routeName: string;
  date: string;
  truck: Truck;
  route: OptimizedRoute;
  totalWeight: number;
  occupancyPercent: number;
}

/**
 * Format weight for display
 */
function formatWeight(weightKg: number): string {
  if (weightKg >= 1000) {
    return `${(weightKg / 1000).toFixed(1)} t`;
  }
  return `${weightKg.toFixed(0)} kg`;
}

/**
 * Format time in hours and minutes
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins} min`;
}

/**
 * Generate manifest PDF for a truck
 */
export function generateManifestPDF(data: ManifestData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let currentY = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE ENTREGAS', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.routeName, pageWidth / 2, currentY, { align: 'center' });

  // Truck and route info box
  currentY += 10;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 42, 2, 2, 'FD');

  currentY += 7;
  doc.setFontSize(9);
  
  // Row 1: Vehicle and Date
  doc.setFont('helvetica', 'bold');
  doc.text('VEÍCULO:', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.truck.plate} - ${data.truck.model}`, margin + 25, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date, pageWidth / 2 + 27, currentY);

  // Row 2: Origin
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGEM (CD):', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  const originText = DISTRIBUTION_CENTER.address;
  doc.text(originText.substring(0, 70), margin + 30, currentY);
  if (originText.length > 70) {
    doc.text(originText.substring(70), margin + 30, currentY + 4);
    currentY += 4;
  }

  // Row 3: Stats
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGAS:', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.route.orderedDeliveries.length}`, margin + 28, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('PESO TOTAL:', margin + 45, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatWeight(data.totalWeight), margin + 70, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('OCUPAÇÃO:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.occupancyPercent}%`, pageWidth / 2 + 35, currentY);

  // Row 4: Distance and Time
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('DISTÂNCIA:', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.route.totalDistance} km`, margin + 28, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('TEMPO EST.:', margin + 55, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatTime(data.route.estimatedMinutes), margin + 80, currentY);

  // Deliveries table
  currentY += 16;
  
  const tableData = data.route.orderedDeliveries.map((delivery, index) => {
    // Parse address for structured display
    const addr = delivery.order.address;
    const zipMatch = addr.match(/(\d{5}-?\d{3})/);
    const zipCode = zipMatch ? zipMatch[1] : '-';
    
    return [
      (index + 1).toString(),
      delivery.order.client_name,
      delivery.order.address,
      formatWeight(Number(delivery.order.weight_kg)),
      '', // Signature column
      '', // Observations column
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [[
      'Seq.',
      'Cliente',
      'Endereço Completo',
      'Peso',
      'Assinatura',
      'Obs.',
    ]],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [245, 130, 32], // Orange color from theme
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 65 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  
  // Driver signature section
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  // Left signature
  doc.text('_'.repeat(35), margin, finalY);
  doc.setFontSize(8);
  doc.text('Assinatura do Motorista', margin, finalY + 4);

  // Right signature  
  doc.setFontSize(9);
  doc.text('_'.repeat(35), pageWidth / 2 + 15, finalY);
  doc.setFontSize(8);
  doc.text('Data / Hora de Retorno', pageWidth / 2 + 15, finalY + 4);

  // Vehicle km section
  const kmY = finalY + 15;
  doc.setFontSize(8);
  doc.text('Km Saída: ____________', margin, kmY);
  doc.text('Km Retorno: ____________', margin + 50, kmY);
  doc.text('Total Km: ____________', margin + 105, kmY);

  // Footer timestamp
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')} - Rota Certa`,
    pageWidth / 2,
    kmY + 10,
    { align: 'center' }
  );

  return doc;
}

/**
 * Download manifest as PDF
 */
export function downloadManifestPDF(data: ManifestData): void {
  const doc = generateManifestPDF(data);
  const fileName = `romaneio_${data.truck.plate}_${data.date.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}

/**
 * Open manifest PDF in new window for printing
 */
export function printManifestPDF(data: ManifestData): void {
  const doc = generateManifestPDF(data);
  const pdfUrl = doc.output('bloburl');
  window.open(pdfUrl as unknown as string, '_blank');
}

/**
 * Generate all manifests for a route
 */
export function generateAllManifests(
  routeName: string,
  date: string,
  trucks: Array<{
    truck: Truck;
    route: OptimizedRoute;
    totalWeight: number;
    occupancyPercent: number;
  }>
): void {
  trucks.forEach(truckData => {
    downloadManifestPDF({
      routeName,
      date,
      truck: truckData.truck,
      route: truckData.route,
      totalWeight: truckData.totalWeight,
      occupancyPercent: truckData.occupancyPercent,
    });
  });
}
