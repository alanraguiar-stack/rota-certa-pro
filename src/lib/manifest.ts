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
  const margin = 15;
  let currentY = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ROMANEIO DE ENTREGAS', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.routeName, pageWidth / 2, currentY, { align: 'center' });

  // Truck and route info box
  currentY += 12;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 35, 2, 2, 'FD');

  currentY += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VEÍCULO:', margin + 5, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.truck.plate} - ${data.truck.model}`, margin + 30, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', pageWidth / 2, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.date, pageWidth / 2 + 20, currentY);

  currentY += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGEM:', margin + 5, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(DISTRIBUTION_CENTER.address, margin + 25, currentY);

  currentY += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGAS:', margin + 5, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.route.orderedDeliveries.length}`, margin + 32, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('PESO TOTAL:', margin + 50, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatWeight(data.totalWeight), margin + 80, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('OCUPAÇÃO:', pageWidth / 2 + 20, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.occupancyPercent}%`, pageWidth / 2 + 50, currentY);

  currentY += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('DISTÂNCIA:', margin + 5, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.route.totalDistance} km`, margin + 32, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('TEMPO EST.:', margin + 60, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatTime(data.route.estimatedMinutes), margin + 90, currentY);

  // Deliveries table
  currentY += 18;
  
  const tableData = data.route.orderedDeliveries.map((delivery, index) => [
    (index + 1).toString(),
    delivery.order.client_name,
    delivery.order.address,
    formatWeight(Number(delivery.order.weight_kg)),
    '', // Signature column
    '', // Observations column
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[
      'Seq.',
      'Cliente',
      'Endereço',
      'Peso',
      'Assinatura',
      'Obs.',
    ]],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [245, 130, 32], // Orange color from theme
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 60 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')} - Rota Certa`,
    pageWidth / 2,
    finalY,
    { align: 'center' }
  );

  // Driver signature section
  const signatureY = finalY + 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  doc.text('_'.repeat(40), margin, signatureY);
  doc.text('Assinatura do Motorista', margin, signatureY + 5);

  doc.text('_'.repeat(40), pageWidth / 2 + 10, signatureY);
  doc.text('Data / Hora de Retorno', pageWidth / 2 + 10, signatureY + 5);

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
