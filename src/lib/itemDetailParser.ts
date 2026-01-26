/**
 * Parser para documento de detalhamento de itens por pedido
 * Suporta CSV, Excel, PDF e texto estruturado
 */

import * as XLSX from 'xlsx';
import { normalizeText } from './encoding';
import { parsePDFFile, isPDFFile } from './pdfParser';

export interface ParsedItemDetail {
  pedido_id: string;
  product_name: string;
  weight_kg: number;
  quantity: number;
}

export interface ItemDetailParseResult {
  items: ParsedItemDetail[];
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
  validRows: number;
}

// Column patterns for item details
const ITEM_COLUMN_PATTERNS = {
  pedido_id: /^(pedido|pedido_id|order|order_id|codigo|cod|id)$/i,
  product: /^(produto|product|item|descricao|description|mercadoria)$/i,
  weight: /^(peso|peso_kg|weight|kg|peso_item)$/i,
  quantity: /^(quantidade|qty|qtd|quantity|qtde|unidades)$/i,
};

/**
 * Detect column mapping from headers
 */
function detectItemColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  headers.forEach((header, index) => {
    const normalized = normalizeText(header.trim().toLowerCase());
    
    for (const [key, pattern] of Object.entries(ITEM_COLUMN_PATTERNS)) {
      if (pattern.test(normalized)) {
        mapping[key] = index;
        break;
      }
    }
  });
  
  return mapping;
}

/**
 * Parse Excel file with item details
 */
export async function parseItemDetailExcel(file: File): Promise<ItemDetailParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Use first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to array of arrays
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          resolve({
            items: [],
            errors: [{ row: 0, message: 'Arquivo vazio ou sem dados' }],
            totalRows: 0,
            validRows: 0,
          });
          return;
        }
        
        // Detect column mapping from headers
        const headers = rows[0].map(h => String(h || ''));
        const mapping = detectItemColumnMapping(headers);
        
        // Check for required columns
        if (mapping.pedido_id === undefined) {
          resolve({
            items: [],
            errors: [{ row: 1, message: 'Coluna Pedido_ID não encontrada' }],
            totalRows: rows.length - 1,
            validRows: 0,
          });
          return;
        }
        
        if (mapping.product === undefined) {
          resolve({
            items: [],
            errors: [{ row: 1, message: 'Coluna Produto não encontrada' }],
            totalRows: rows.length - 1,
            validRows: 0,
          });
          return;
        }
        
        const items: ParsedItemDetail[] = [];
        const errors: Array<{ row: number; message: string }> = [];
        
        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every(cell => !cell && cell !== 0)) continue;
          
          const pedidoId = String(row[mapping.pedido_id] || '').trim();
          const product = normalizeText(String(row[mapping.product] || '').trim());
          
          // Parse weight
          let weight = 0;
          if (mapping.weight !== undefined) {
            const weightVal = row[mapping.weight];
            weight = typeof weightVal === 'number' ? weightVal : parseFloat(String(weightVal).replace(',', '.'));
          }
          
          // Parse quantity
          let quantity = 1;
          if (mapping.quantity !== undefined) {
            const qtyVal = row[mapping.quantity];
            quantity = typeof qtyVal === 'number' ? qtyVal : parseInt(String(qtyVal), 10);
          }
          
          if (!pedidoId) {
            errors.push({ row: i + 1, message: 'Pedido_ID vazio' });
            continue;
          }
          
          if (!product) {
            errors.push({ row: i + 1, message: 'Produto vazio' });
            continue;
          }
          
          if (isNaN(weight) || weight <= 0) {
            errors.push({ row: i + 1, message: `Peso inválido para item "${product}"` });
            continue;
          }
          
          items.push({
            pedido_id: pedidoId,
            product_name: product,
            weight_kg: weight,
            quantity: isNaN(quantity) || quantity < 1 ? 1 : quantity,
          });
        }
        
        resolve({
          items,
          errors,
          totalRows: rows.length - 1,
          validRows: items.length,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse CSV/text with item details
 */
export function parseItemDetailText(text: string): ItemDetailParseResult {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    return {
      items: [],
      errors: [{ row: 0, message: 'Texto vazio ou sem dados' }],
      totalRows: 0,
      validRows: 0,
    };
  }
  
  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : 
                   firstLine.includes(';') ? ';' : ',';
  
  const headers = firstLine.split(delimiter).map(h => h.trim());
  const mapping = detectItemColumnMapping(headers);
  
  if (mapping.pedido_id === undefined || mapping.product === undefined) {
    return {
      items: [],
      errors: [{ row: 1, message: 'Colunas Pedido_ID e Produto são obrigatórias' }],
      totalRows: lines.length - 1,
      validRows: 0,
    };
  }
  
  const items: ParsedItemDetail[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    
    const pedidoId = cells[mapping.pedido_id]?.trim() || '';
    const product = normalizeText(cells[mapping.product]?.trim() || '');
    
    let weight = 0;
    if (mapping.weight !== undefined) {
      weight = parseFloat(cells[mapping.weight]?.replace(',', '.') || '0');
    }
    
    let quantity = 1;
    if (mapping.quantity !== undefined) {
      quantity = parseInt(cells[mapping.quantity] || '1', 10);
    }
    
    if (!pedidoId || !product || isNaN(weight) || weight <= 0) {
      errors.push({ row: i + 1, message: 'Dados incompletos ou inválidos' });
      continue;
    }
    
    items.push({
      pedido_id: pedidoId,
      product_name: product,
      weight_kg: weight,
      quantity: isNaN(quantity) || quantity < 1 ? 1 : quantity,
    });
  }
  
  return {
    items,
    errors,
    totalRows: lines.length - 1,
    validRows: items.length,
  };
}

/**
 * Parse PDF file with item details
 */
export async function parseItemDetailPDF(file: File): Promise<ItemDetailParseResult> {
  const pdfResult = await parsePDFFile(file);
  
  if (pdfResult.error) {
    return {
      items: [],
      errors: [{ row: 0, message: pdfResult.error }],
      totalRows: 0,
      validRows: 0,
    };
  }
  
  if (pdfResult.rows.length < 2) {
    return {
      items: [],
      errors: [{ row: 0, message: 'Nenhum dado tabular encontrado no PDF' }],
      totalRows: 0,
      validRows: 0,
    };
  }
  
  // Detect column mapping
  const headers = pdfResult.rows[0];
  const mapping = detectItemColumnMapping(headers);
  
  if (mapping.pedido_id === undefined || mapping.product === undefined) {
    return {
      items: [],
      errors: [{ row: 1, message: 'Colunas Pedido_ID e Produto são obrigatórias' }],
      totalRows: pdfResult.rows.length - 1,
      validRows: 0,
    };
  }
  
  const items: ParsedItemDetail[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  
  for (let i = 1; i < pdfResult.rows.length; i++) {
    const row = pdfResult.rows[i];
    
    const pedidoId = row[mapping.pedido_id]?.trim() || '';
    const product = normalizeText(row[mapping.product]?.trim() || '');
    
    let weight = 0;
    if (mapping.weight !== undefined) {
      weight = parseFloat(row[mapping.weight]?.replace(',', '.') || '0');
    }
    
    let quantity = 1;
    if (mapping.quantity !== undefined) {
      quantity = parseInt(row[mapping.quantity] || '1', 10);
    }
    
    if (!pedidoId || !product || isNaN(weight) || weight <= 0) {
      errors.push({ row: i + 1, message: 'Dados incompletos ou inválidos' });
      continue;
    }
    
    items.push({
      pedido_id: pedidoId,
      product_name: product,
      weight_kg: weight,
      quantity: isNaN(quantity) || quantity < 1 ? 1 : quantity,
    });
  }
  
  return {
    items,
    errors,
    totalRows: pdfResult.rows.length - 1,
    validRows: items.length,
  };
}

/**
 * Parse item detail file (Excel or PDF)
 */
export async function parseItemDetailFile(file: File): Promise<ItemDetailParseResult> {
  if (isPDFFile(file)) {
    return parseItemDetailPDF(file);
  }
  return parseItemDetailExcel(file);
}

/**
 * Generate template for item details
 */
export function generateItemDetailTemplate(): void {
  const wb = XLSX.utils.book_new();
  
  // Data sheet
  const headers = ['Pedido_ID', 'Produto', 'Peso_kg', 'Quantidade'];
  const sampleData = [
    ['001', 'Mussarela', 50, 1],
    ['001', 'Presunto', 30, 1],
    ['002', 'Mussarela', 80, 1],
    ['002', 'Mortadela', 25, 1],
    ['003', 'Queijo Prato', 40, 1],
  ];
  
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Itens');
  
  // Instructions sheet
  const instructions = [
    ['INSTRUÇÕES - Detalhamento de Itens'],
    [''],
    ['Esta planilha contém o detalhamento de cada item vendido.'],
    ['Os itens serão associados aos pedidos pelo Pedido_ID.'],
    [''],
    ['COLUNAS:'],
    ['Pedido_ID: Código do pedido (deve corresponder à planilha de vendas)'],
    ['Produto: Nome do produto'],
    ['Peso_kg: Peso do item em quilogramas'],
    ['Quantidade: Quantidade de unidades (padrão: 1)'],
    [''],
    ['IMPORTANTE:'],
    ['- O Pedido_ID deve ser idêntico ao informado na planilha de vendas'],
    ['- Cada linha representa um item do pedido'],
    ['- Um pedido pode ter múltiplas linhas (múltiplos itens)'],
    [''],
    ['FORMATOS ACEITOS:'],
    ['- Excel (.xlsx, .xls)'],
    ['- PDF (com texto selecionável e estrutura tabular)'],
  ];
  
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções');
  
  XLSX.writeFile(wb, 'template_itens_detalhados.xlsx');
}
