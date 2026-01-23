import * as XLSX from 'xlsx';
import { ParsedOrder } from '@/types';
import { decodeFileContent, normalizeText } from './encoding';

// Validation constants
const MIN_WEIGHT_KG = 0.01;
const MAX_WEIGHT_KG = 50000; // 50 tons max per delivery
const MIN_ADDRESS_LENGTH = 10;
const MAX_CLIENT_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 500;

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ParseResult {
  orders: ParsedOrder[];
  errors: ValidationError[];
  warnings: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface ColumnMapping {
  clientName: number;
  address: number;
  weight: number;
  product?: number;
}

/**
 * Common column name patterns for auto-detection
 */
const COLUMN_PATTERNS = {
  clientName: [
    /cliente/i, /nome/i, /customer/i, /name/i, /razao/i, /fantasia/i, 
    /destinat[áa]rio/i, /empresa/i, /company/i
  ],
  address: [
    /endere[çc]o/i, /address/i, /logradouro/i, /local/i, /destino/i,
    /rua/i, /avenida/i, /location/i
  ],
  weight: [
    /peso/i, /weight/i, /kg/i, /kilos?/i, /massa/i, /carga/i
  ],
  product: [
    /produto/i, /product/i, /item/i, /descri[çc][ãa]o/i, /description/i,
    /mercadoria/i, /material/i, /artigo/i
  ],
};

/**
 * Detect column mapping from header row
 */
export function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const normalizedHeaders = headers.map(h => normalizeText(h?.toString() || '').toLowerCase());
  
  let clientNameIdx = -1;
  let addressIdx = -1;
  let weightIdx = -1;
  let productIdx = -1;
  
  // Try to match each column pattern
  normalizedHeaders.forEach((header, idx) => {
    if (clientNameIdx === -1) {
      for (const pattern of COLUMN_PATTERNS.clientName) {
        if (pattern.test(header)) {
          clientNameIdx = idx;
          break;
        }
      }
    }
    
    if (addressIdx === -1) {
      for (const pattern of COLUMN_PATTERNS.address) {
        if (pattern.test(header)) {
          addressIdx = idx;
          break;
        }
      }
    }
    
    if (weightIdx === -1) {
      for (const pattern of COLUMN_PATTERNS.weight) {
        if (pattern.test(header)) {
          weightIdx = idx;
          break;
        }
      }
    }
    
    if (productIdx === -1) {
      for (const pattern of COLUMN_PATTERNS.product) {
        if (pattern.test(header)) {
          productIdx = idx;
          break;
        }
      }
    }
  });
  
  // Fallback: assume first 3 columns in order if no matches
  if (clientNameIdx === -1 && addressIdx === -1 && weightIdx === -1) {
    if (headers.length >= 3) {
      return { clientName: 0, address: 1, weight: 2, product: headers.length >= 4 ? 3 : undefined };
    }
    return null;
  }
  
  // Fill in missing required columns with remaining indices
  const usedIndices = new Set([clientNameIdx, addressIdx, weightIdx, productIdx].filter(i => i !== -1));
  const availableIndices = Array.from({ length: headers.length }, (_, i) => i)
    .filter(i => !usedIndices.has(i));
  
  if (clientNameIdx === -1 && availableIndices.length > 0) {
    clientNameIdx = availableIndices.shift()!;
  }
  if (addressIdx === -1 && availableIndices.length > 0) {
    addressIdx = availableIndices.shift()!;
  }
  if (weightIdx === -1 && availableIndices.length > 0) {
    weightIdx = availableIndices.shift()!;
  }
  
  if (clientNameIdx === -1 || addressIdx === -1 || weightIdx === -1) {
    return null;
  }
  
  return { 
    clientName: clientNameIdx, 
    address: addressIdx, 
    weight: weightIdx,
    product: productIdx !== -1 ? productIdx : undefined,
  };
}

/**
 * Parse weight value from various formats
 */
function parseWeight(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value !== 'string') {
    return null;
  }
  
  // Normalize the string
  let normalized = normalizeText(value).trim().toLowerCase();
  
  // Remove common unit suffixes
  normalized = normalized.replace(/\s*(kg|kilos?|quilos?|kgs?)\s*$/i, '');
  normalized = normalized.replace(/\s*(ton|toneladas?|t)\s*$/i, (match) => {
    // If it ends with ton, multiply by 1000
    return '';
  });
  
  // Handle tons
  const isTons = /ton|toneladas?|\st$/i.test(value);
  
  // Replace comma with dot for decimal
  normalized = normalized.replace(',', '.');
  
  // Remove any non-numeric characters except dot
  normalized = normalized.replace(/[^\d.]/g, '');
  
  const num = parseFloat(normalized);
  
  if (isNaN(num)) {
    return null;
  }
  
  // Convert tons to kg if detected
  if (isTons) {
    return num * 1000;
  }
  
  return num;
}

/**
 * Validate a single order
 */
function validateOrder(
  clientName: string,
  address: string,
  weight: number | null,
  product: string | undefined,
  row: number
): { order: ParsedOrder; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  // Normalize inputs
  const normalizedName = normalizeText(clientName || '').trim();
  const normalizedAddress = normalizeText(address || '').trim();
  const normalizedProduct = product ? normalizeText(product).trim() : undefined;
  
  // Validate client name
  if (!normalizedName) {
    errors.push({
      row,
      field: 'cliente',
      message: 'Nome do cliente é obrigatório',
    });
  } else if (normalizedName.length > MAX_CLIENT_NAME_LENGTH) {
    errors.push({
      row,
      field: 'cliente',
      message: `Nome muito longo (máx ${MAX_CLIENT_NAME_LENGTH} caracteres)`,
      value: normalizedName.substring(0, 50) + '...',
    });
  }
  
  // Validate address
  if (!normalizedAddress) {
    errors.push({
      row,
      field: 'endereço',
      message: 'Endereço é obrigatório',
    });
  } else if (normalizedAddress.length < MIN_ADDRESS_LENGTH) {
    errors.push({
      row,
      field: 'endereço',
      message: `Endereço muito curto (mín ${MIN_ADDRESS_LENGTH} caracteres)`,
      value: normalizedAddress,
    });
  } else if (normalizedAddress.length > MAX_ADDRESS_LENGTH) {
    errors.push({
      row,
      field: 'endereço',
      message: `Endereço muito longo (máx ${MAX_ADDRESS_LENGTH} caracteres)`,
      value: normalizedAddress.substring(0, 50) + '...',
    });
  }
  
  // Validate weight
  if (weight === null) {
    errors.push({
      row,
      field: 'peso',
      message: 'Peso inválido ou ausente',
    });
  } else if (weight < MIN_WEIGHT_KG) {
    errors.push({
      row,
      field: 'peso',
      message: `Peso muito baixo (mín ${MIN_WEIGHT_KG}kg)`,
      value: String(weight),
    });
  } else if (weight > MAX_WEIGHT_KG) {
    errors.push({
      row,
      field: 'peso',
      message: `Peso irreal (máx ${MAX_WEIGHT_KG / 1000} toneladas)`,
      value: String(weight),
    });
  }
  
  const isValid = errors.length === 0;
  
  return {
    order: {
      client_name: normalizedName,
      address: normalizedAddress,
      weight_kg: weight ?? 0,
      product_description: normalizedProduct,
      isValid,
      error: isValid ? undefined : errors.map(e => e.message).join('; '),
    },
    errors,
  };
}

/**
 * Parse rows of data into orders
 */
export function parseRows(
  rows: unknown[][],
  mapping: ColumnMapping,
  hasHeader: boolean = true
): ParseResult {
  const orders: ParsedOrder[] = [];
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  
  const startIdx = hasHeader ? 1 : 0;
  const dataRows = rows.slice(startIdx);
  
  if (dataRows.length === 0) {
    warnings.push('Nenhuma linha de dados encontrada');
    return { orders, errors, warnings, totalRows: 0, validRows: 0, invalidRows: 0 };
  }
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + startIdx + 1; // 1-indexed for user display
    
    // Skip empty rows
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
      continue;
    }
    
    const clientName = String(row[mapping.clientName] ?? '');
    const address = String(row[mapping.address] ?? '');
    const weightRaw = row[mapping.weight];
    const weight = parseWeight(weightRaw);
    const product = mapping.product !== undefined ? String(row[mapping.product] ?? '') : undefined;
    
    const result = validateOrder(clientName, address, weight, product, rowNum);
    orders.push(result.order);
    errors.push(...result.errors);
  }
  
  const validRows = orders.filter(o => o.isValid).length;
  const invalidRows = orders.filter(o => !o.isValid).length;
  
  return {
    orders,
    errors,
    warnings,
    totalRows: orders.length,
    validRows,
    invalidRows,
  };
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): ParseResult {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return {
      orders: [],
      errors: [],
      warnings: ['Arquivo vazio'],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Parse lines into rows
  const rows: string[][] = lines.map(line => {
    // Handle both comma and semicolon separators
    const separator = line.includes(';') ? ';' : ',';
    return line.split(separator).map(cell => 
      cell.trim().replace(/^["']|["']$/g, '')
    );
  });
  
  // Detect column mapping from header
  const mapping = detectColumnMapping(rows[0]);
  
  if (!mapping) {
    return {
      orders: [],
      errors: [{
        row: 1,
        field: 'colunas',
        message: 'Não foi possível detectar as colunas. Verifique se o arquivo possui Cliente, Endereço e Peso.',
      }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Check if first row looks like a header
  const firstRowIsHeader = COLUMN_PATTERNS.clientName.some(p => 
    p.test(rows[0][mapping.clientName] || '')
  ) || COLUMN_PATTERNS.address.some(p => 
    p.test(rows[0][mapping.address] || '')
  );
  
  return parseRows(rows, mapping, firstRowIsHeader);
}

/**
 * Parse Excel file
 */
export async function parseExcel(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      orders: [],
      errors: [],
      warnings: ['Arquivo Excel vazio'],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  if (rows.length === 0) {
    return {
      orders: [],
      errors: [],
      warnings: ['Planilha vazia'],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Detect column mapping
  const headers = rows[0].map(cell => String(cell ?? ''));
  const mapping = detectColumnMapping(headers);
  
  if (!mapping) {
    return {
      orders: [],
      errors: [{
        row: 1,
        field: 'colunas',
        message: 'Não foi possível detectar as colunas. Use o template padrão.',
      }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Check if first row looks like a header
  const firstRowIsHeader = COLUMN_PATTERNS.clientName.some(p => 
    p.test(headers[mapping.clientName] || '')
  ) || COLUMN_PATTERNS.address.some(p => 
    p.test(headers[mapping.address] || '')
  );
  
  return parseRows(rows, mapping, firstRowIsHeader);
}

/**
 * Parse file (CSV or Excel)
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') {
    const content = await decodeFileContent(file);
    return parseCSV(content);
  }
  
  if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  }
  
  return {
    orders: [],
    errors: [{
      row: 0,
      field: 'arquivo',
      message: `Formato não suportado: .${extension}. Use .csv, .xlsx ou .xls`,
    }],
    warnings: [],
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
  };
}

/**
 * Parse pasted data (from Excel/Google Sheets copy)
 */
export function parsePastedData(text: string): ParseResult {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return {
      orders: [],
      errors: [],
      warnings: ['Nenhum dado colado'],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Pasted data from Excel/Sheets typically uses tab as separator
  const rows: string[][] = lines.map(line => {
    // Try tab first, then comma/semicolon
    if (line.includes('\t')) {
      return line.split('\t').map(cell => cell.trim());
    }
    const separator = line.includes(';') ? ';' : ',';
    return line.split(separator).map(cell => 
      cell.trim().replace(/^["']|["']$/g, '')
    );
  });
  
  // Detect column mapping
  const mapping = detectColumnMapping(rows[0]);
  
  if (!mapping) {
    // Try without header detection for pasted data
    if (rows[0].length >= 3) {
      return parseRows(rows, { clientName: 0, address: 1, weight: 2 }, false);
    }
    
    return {
      orders: [],
      errors: [{
        row: 1,
        field: 'colunas',
        message: 'Formato inválido. Cole dados com 3 colunas: Cliente, Endereço, Peso',
      }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Check if first row looks like a header
  const firstRowIsHeader = COLUMN_PATTERNS.clientName.some(p => 
    p.test(rows[0][mapping.clientName] || '')
  ) || COLUMN_PATTERNS.address.some(p => 
    p.test(rows[0][mapping.address] || '')
  );
  
  return parseRows(rows, mapping, firstRowIsHeader);
}

/**
 * Generate test data for E2E testing
 * Returns orders with real addresses near Barueri CD
 */
export function generateTestData(): ParsedOrder[] {
  return [
    { client_name: 'Padaria Central Barueri', address: 'Rua Campos Sales 150 - Centro Barueri SP', weight_kg: 50, product_description: 'Mussarela', isValid: true },
    { client_name: 'Mercado Jardim Paulista', address: 'Rua Espírito Santo 200 - Jardim Paulista Barueri SP', weight_kg: 80, product_description: 'Mussarela', isValid: true },
    { client_name: 'Restaurante Sabor do Centro', address: 'Rua da Prata 500 - Centro Barueri SP', weight_kg: 120, product_description: 'Presunto', isValid: true },
    { client_name: 'Empório Vila São Silvestre', address: 'Rua Irene 75 - Vila São Silvestre Barueri SP', weight_kg: 45, product_description: 'Mortadela', isValid: true },
    { client_name: 'Açougue Bom Corte', address: 'Rua Benedita Guerra Zendron 300 - Belval Barueri SP', weight_kg: 200, product_description: 'Mussarela', isValid: true },
    { client_name: 'Padaria Doce Pão', address: 'Rua da Prata 850 - Centro Barueri SP', weight_kg: 30, product_description: 'Pão de Forma', isValid: true },
    { client_name: 'Mini Mercado Belval', address: 'Rua Benedita Guerra Zendron 150 - Belval Barueri SP', weight_kg: 60, product_description: 'Presunto', isValid: true },
    { client_name: 'Restaurante Bella Massa', address: 'Alameda Araguaia 1200 - Alphaville Barueri SP', weight_kg: 90, product_description: 'Mussarela', isValid: true },
    { client_name: 'Hamburgueria Prime Grill', address: 'Alameda Rio Negro 500 - Alphaville Barueri SP', weight_kg: 75, product_description: 'Hambúrguer', isValid: true },
    { client_name: 'Mercado Alpha Plus', address: 'Alameda Madeira 800 - Alphaville Barueri SP', weight_kg: 150, product_description: 'Mortadela', isValid: true },
  ];
}

/**
 * Generate template CSV content
 */
export function generateTemplateCSV(): string {
  const header = 'Cliente,Endereço,Peso (kg),Produto';
  const examples = [
    'Padaria Central Barueri,"Rua Campos Sales 150 - Centro Barueri SP",50,Mussarela',
    'Mercado Jardim Paulista,"Rua Espírito Santo 200 - Jardim Paulista Barueri SP",80,Mussarela',
    'Restaurante Sabor do Centro,"Rua da Prata 500 - Centro Barueri SP",120,Presunto',
    'Açougue Bom Corte,"Rua Benedita Guerra Zendron 300 - Belval Barueri SP",200,Mussarela',
    'Hamburgueria Prime Grill,"Alameda Rio Negro 500 - Alphaville Barueri SP",75,Hambúrguer',
  ];
  
  return [header, ...examples].join('\n');
}

/**
 * Generate template Excel file
 */
export function generateTemplateExcel(): Blob {
  const data = [
    ['Cliente', 'Endereço', 'Peso (kg)', 'Produto'],
    ['Padaria Central Barueri', 'Rua Campos Sales 150 - Centro Barueri SP', 50, 'Mussarela'],
    ['Mercado Jardim Paulista', 'Rua Espírito Santo 200 - Jardim Paulista Barueri SP', 80, 'Mussarela'],
    ['Restaurante Sabor do Centro', 'Rua da Prata 500 - Centro Barueri SP', 120, 'Presunto'],
    ['Açougue Bom Corte', 'Rua Benedita Guerra Zendron 300 - Belval Barueri SP', 200, 'Mussarela'],
    ['Hamburgueria Prime Grill', 'Alameda Rio Negro 500 - Alphaville Barueri SP', 75, 'Hambúrguer'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 30 }, // Cliente
    { wch: 55 }, // Endereço
    { wch: 12 }, // Peso
    { wch: 15 }, // Produto
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Download template file
 */
export function downloadTemplate(format: 'csv' | 'xlsx'): void {
  if (format === 'csv') {
    const content = generateTemplateCSV();
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }); // BOM for Excel UTF-8
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_pedidos.csv';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const blob = generateTemplateExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_pedidos.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
