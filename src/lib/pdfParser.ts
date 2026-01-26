/**
 * Parser for PDF files - extracts tabular data from PDFs
 * Uses pdfjs-dist to extract text and reconstruct tables
 * @version 2 - Using local bundled worker
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker using local bundled file
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PDFParseResult {
  rows: string[][];
  pageCount: number;
  error?: string;
}

/**
 * Extract text items from a PDF page
 */
async function extractTextFromPage(page: any): Promise<TextItem[]> {
  const textContent = await page.getTextContent();
  const items: TextItem[] = [];
  
  for (const item of textContent.items) {
    if ('str' in item && item.str.trim()) {
      const transform = item.transform;
      items.push({
        text: item.str,
        x: transform[4],
        y: transform[5],
        width: item.width || 0,
        height: item.height || transform[0] || 12,
      });
    }
  }
  
  return items;
}

/**
 * Group text items into rows based on Y position
 */
function groupIntoRows(items: TextItem[], tolerance: number = 5): TextItem[][] {
  if (items.length === 0) return [];
  
  // Sort by Y (descending - PDF coordinates start from bottom)
  const sorted = [...items].sort((a, b) => b.y - a.y);
  
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;
  
  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    
    // If Y position is within tolerance, same row
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentRow.push(item);
    } else {
      // Sort current row by X position and add to rows
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }
  
  // Don't forget the last row
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }
  
  return rows;
}

/**
 * Detect column boundaries from all rows
 */
function detectColumns(rows: TextItem[][], minGap: number = 10): number[] {
  // Collect all X positions
  const allPositions: number[] = [];
  
  for (const row of rows) {
    for (const item of row) {
      allPositions.push(item.x);
    }
  }
  
  if (allPositions.length === 0) return [];
  
  // Sort and find clusters
  allPositions.sort((a, b) => a - b);
  
  const columnStarts: number[] = [allPositions[0]];
  let lastPos = allPositions[0];
  
  for (const pos of allPositions) {
    if (pos - lastPos > minGap) {
      // Check if this is a new column
      const existingCol = columnStarts.find(c => Math.abs(c - pos) < minGap);
      if (!existingCol) {
        columnStarts.push(pos);
      }
    }
    lastPos = pos;
  }
  
  return columnStarts.sort((a, b) => a - b);
}

/**
 * Assign text items to columns
 */
function assignToColumns(row: TextItem[], columnBoundaries: number[]): string[] {
  const result: string[] = new Array(columnBoundaries.length).fill('');
  
  for (const item of row) {
    // Find the closest column
    let bestCol = 0;
    let bestDist = Math.abs(item.x - columnBoundaries[0]);
    
    for (let i = 1; i < columnBoundaries.length; i++) {
      const dist = Math.abs(item.x - columnBoundaries[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestCol = i;
      }
    }
    
    // Append text to the column (space-separated if already has content)
    if (result[bestCol]) {
      result[bestCol] += ' ' + item.text;
    } else {
      result[bestCol] = item.text;
    }
  }
  
  return result;
}

/**
 * Parse a PDF file and extract tabular data
 */
export async function parsePDFFile(file: File): Promise<PDFParseResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const allItems: TextItem[] = [];
    
    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const pageItems = await extractTextFromPage(page);
      allItems.push(...pageItems);
    }
    
    if (allItems.length === 0) {
      return {
        rows: [],
        pageCount: pdf.numPages,
        error: 'PDF não contém texto selecionável. O arquivo pode ser uma imagem escaneada.',
      };
    }
    
    // Group into rows
    const textRows = groupIntoRows(allItems);
    
    if (textRows.length < 2) {
      return {
        rows: [],
        pageCount: pdf.numPages,
        error: 'Estrutura tabular não detectada no PDF.',
      };
    }
    
    // Detect columns
    const columnBoundaries = detectColumns(textRows);
    
    if (columnBoundaries.length < 2) {
      // Fallback: split by large spaces
      const rows = textRows.map(row => 
        row.map(item => item.text.trim()).filter(Boolean)
      );
      return { rows, pageCount: pdf.numPages };
    }
    
    // Convert to string grid
    const rows: string[][] = textRows.map(row => 
      assignToColumns(row, columnBoundaries)
    );
    
    return { rows, pageCount: pdf.numPages };
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      rows: [],
      pageCount: 0,
      error: `Erro ao processar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    };
  }
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
}

/**
 * Check if a file is an Excel file
 */
export function isExcelFile(file: File): boolean {
  return /\.xlsx?$/i.test(file.name) || 
         file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
         file.type === 'application/vnd.ms-excel';
}
