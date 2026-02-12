import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Truck, Order, DISTRIBUTION_CENTER } from '@/types';
import { OptimizedRoute, OrderWithRouteInfo } from './routing';
import { normalizeText } from './encoding';

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
 * Convert special characters to ASCII equivalents for PDF compatibility
 * jsPDF's default Helvetica font doesn't support all Unicode characters
 */
function convertToASCII(text: string): string {
  if (!text) return '';
  
  // First normalize the text
  const normalized = normalizeText(text);
  
  // Map of Portuguese accented characters to their ASCII equivalents
  const charMap: Record<string, string> = {
    'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c',
    'ñ': 'n',
    'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'Ç': 'C',
    'Ñ': 'N',
    '°': 'o',
    'º': 'o',
    'ª': 'a',
  };
  
  return normalized.split('').map(char => charMap[char] || char).join('');
}

/**
 * Prepare text for PDF with proper character handling
 * Uses WinAnsiEncoding compatible characters
 */
function prepareTextForPDF(text: string): string {
  if (!text) return '';
  
  // Normalize the text first
  const normalized = normalizeText(text);
  
  // jsPDF with Helvetica supports WinAnsiEncoding (Windows-1252)
  // which includes most Western European characters including Portuguese
  // We need to ensure the text is properly encoded
  
  // Replace any problematic characters
  let result = normalized;
  
  // Replace smart quotes with regular quotes
  result = result.replace(/[""]/g, '"');
  result = result.replace(/['']/g, "'");
  
  // Replace em/en dashes with regular dash
  result = result.replace(/[–—]/g, '-');
  
  // Replace ellipsis with three dots
  result = result.replace(/…/g, '...');
  
  return result;
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
  doc.text(prepareTextForPDF(data.routeName), pageWidth / 2, currentY, { align: 'center' });

  // Truck and route info box
  currentY += 10;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 42, 2, 2, 'FD');

  currentY += 7;
  doc.setFontSize(9);
  
  // Row 1: Vehicle and Date
  doc.setFont('helvetica', 'bold');
  doc.text('VEICULO:', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(prepareTextForPDF(`${data.truck.plate} - ${data.truck.model}`), margin + 25, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('DATA:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(prepareTextForPDF(data.date), pageWidth / 2 + 27, currentY);

  // Row 2: Origin
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGEM (CD):', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  const originText = prepareTextForPDF(DISTRIBUTION_CENTER.address);
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
  doc.text('OCUPACAO:', pageWidth / 2 + 10, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.occupancyPercent}%`, pageWidth / 2 + 35, currentY);

  // Row 4: Distance and Time
  currentY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('DISTANCIA:', margin + 4, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.route.totalDistance} km`, margin + 28, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('TEMPO EST.:', margin + 55, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatTime(data.route.estimatedMinutes), margin + 80, currentY);

  // Deliveries table
  currentY += 16;
  
  const tableData = data.route.orderedDeliveries.map((delivery, index) => {
    return [
      (index + 1).toString(),
      prepareTextForPDF(delivery.order.client_name),
      prepareTextForPDF(delivery.order.address),
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
      'Endereco Completo',
      'Peso',
      'Assinatura',
      'Obs.',
    ]],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
      font: 'helvetica',
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
  doc.text('Km Saida: ____________', margin, kmY);
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