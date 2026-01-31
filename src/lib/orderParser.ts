import * as XLSX from 'xlsx';
import { ParsedOrder, ParsedOrderItem } from '@/types';
import { decodeFileContent, normalizeText } from './encoding';
import { parsePDFFile, isPDFFile, isExcelFile } from './pdfParser';
import { parseADVSalesReport } from './advParser';

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
  pedidoId?: number;
  clientName: number;
  rua?: number;
  numero?: number;
  bairro?: number;
  cidade?: number;
  estado?: number;
  cep?: number;
  address: number;
  weight: number;
  product?: number;
}

// Template required columns (new structured format)
export const TEMPLATE_COLUMNS = [
  'Pedido_ID',
  'Cliente',
  'Rua',
  'Numero',
  'Bairro',
  'Cidade',
  'Estado',
  'Produto',
  'Peso_kg',
] as const;

export type TemplateColumn = typeof TEMPLATE_COLUMNS[number];

// Validation result for template structure
export interface TemplateValidation {
  isValid: boolean;
  missingColumns: string[];
  renamedColumns: string[];
  message?: string;
}

/**
 * Common column name patterns for auto-detection
 * PRIORITY: Patterns with "Ent." (delivery) suffix come FIRST to be matched before generic ones
 */
const COLUMN_PATTERNS = {
  pedidoId: [
    /^venda$/i, /n[º°]?\s*venda/i,  // Itinerary format FIRST
    /pedido.?id/i, /pedido/i, /order.?id/i, /id.?pedido/i, /numero.?pedido/i,
  ],
  clientName: [
    /^cliente$/i,  // Exact match first
    /cliente/i, /nome/i, /customer/i, /name/i, /razao/i, 
    /destinat[áa]rio/i, /empresa/i, /company/i
    // NOTE: "fantasia" removed - we want "Cliente" not "Fantasia" for itinerary
  ],
  rua: [
    /end\.?\s*ent\.?/i, /endereco\s*ent/i,  // Itinerary: End. Ent. FIRST (priority)
    /^rua$/i, /logradouro/i, /street/i,
  ],
  numero: [
    /^n[uú]mero$/i, /^num$/i, /number/i
    // NOTE: /^n[º°]?$/i removed as it conflicts with NF number
  ],
  bairro: [
    /bairro\.?\s*ent\.?/i,  // Itinerary: Bairro Ent. FIRST (priority)
    /^bairro$/i, /neighborhood/i, /distrito/i,
  ],
  cidade: [
    /cidade\.?\s*ent\.?/i,  // Itinerary: Cidade Ent. FIRST (priority)
    /^cidade$/i, /city/i, /munic[íi]pio/i,
  ],
  estado: [
    /uf\.?\s*ent\.?/i,  // Itinerary: UF Ent. FIRST (priority)
    /^estado$/i, /^uf$/i, /state/i,
  ],
  cep: [
    /cep\.?\s*ent\.?/i,  // Itinerary: Cep Ent. FIRST (priority)
    /^cep$/i, /codigo\s*postal/i, /postal/i,
  ],
  address: [
    /endere[çc]o/i, /address/i, /local/i, /destino/i, /location/i
  ],
  weight: [
    /peso\s*bruto/i,  // Itinerary: Peso Bruto FIRST (priority)
    /peso/i, /weight/i, /kg/i, /kilos?/i, /massa/i, /carga/i,
  ],
  product: [
    /produto/i, /product/i, /item/i, /descri[çc][ãa]o/i, /description/i,
    /mercadoria/i, /material/i, /artigo/i
  ],
};

/**
 * Detect if file is in Itinerary format (has "Ent." suffix columns)
 */
function detectItineraryFormat(headers: string[]): boolean {
  const headerText = headers.join(' ').toLowerCase();
  return /end\.?\s*ent|bairro\.?\s*ent|cidade\.?\s*ent|cep\.?\s*ent/i.test(headerText);
}

/**
 * Detect column mapping from header row (legacy format - combined address)
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
 * Supports both Brazilian (1.234,56) and US (1,234.56) formats
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
  
  // Handle tons
  const isTons = /ton|toneladas?|\st$/i.test(value);
  normalized = normalized.replace(/\s*(ton|toneladas?|t)\s*$/i, '');
  
  // Detect format: Brazilian (1.234,56) vs US (1,234.56) vs simple decimal (224.55)
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  
  if (hasComma && hasDot) {
    // Both present: determine which is decimal separator
    const commaPos = normalized.lastIndexOf(',');
    const dotPos = normalized.lastIndexOf('.');
    
    if (commaPos > dotPos) {
      // Format: 1.234,56 (Brazilian) - comma is decimal
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      // Format: 1,234.56 (US) - dot is decimal
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only comma: check if it's thousands or decimal separator
    const commaMatch = normalized.match(/,(\d+)$/);
    if (commaMatch && commaMatch[1].length === 3) {
      // Comma followed by 3 digits: thousand separator (ex: 1,000)
      normalized = normalized.replace(/,/g, '');
    } else {
      // Comma as decimal separator (ex: 12,50)
      normalized = normalized.replace(',', '.');
    }
  }
  // If only dot: could be either (224.55 is simple decimal, 1.234 is thousands)
  else if (hasDot) {
    const dotMatch = normalized.match(/\.(\d+)$/);
    if (dotMatch && dotMatch[1].length === 3 && normalized.match(/^\d+\.\d{3}$/)) {
      // Format: 1.234 (Brazilian thousands, no decimal)
      normalized = normalized.replace(/\./g, '');
    }
    // Otherwise keep dot as decimal (224.55)
  }
  
  // Remove any remaining non-numeric characters except dot
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
      items: normalizedProduct ? [{ product_name: normalizedProduct, weight_kg: weight ?? 0, quantity: 1 }] : [],
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
  const testItems = [
    { client: 'Padaria Central Barueri', addr: 'Rua Campos Sales 150 - Centro Barueri SP', items: [{ product_name: 'Mussarela', weight_kg: 30, quantity: 1 }, { product_name: 'Presunto', weight_kg: 20, quantity: 1 }] },
    { client: 'Mercado Jardim Paulista', addr: 'Rua Espírito Santo 200 - Jardim Paulista Barueri SP', items: [{ product_name: 'Mussarela', weight_kg: 50, quantity: 1 }, { product_name: 'Mortadela', weight_kg: 30, quantity: 1 }] },
    { client: 'Restaurante Sabor do Centro', addr: 'Rua da Prata 500 - Centro Barueri SP', items: [{ product_name: 'Presunto', weight_kg: 80, quantity: 1 }, { product_name: 'Mussarela', weight_kg: 40, quantity: 1 }] },
    { client: 'Empório Vila São Silvestre', addr: 'Rua Irene 75 - Vila São Silvestre Barueri SP', items: [{ product_name: 'Mortadela', weight_kg: 45, quantity: 1 }] },
    { client: 'Açougue Bom Corte', addr: 'Rua Benedita Guerra Zendron 300 - Belval Barueri SP', items: [{ product_name: 'Mussarela', weight_kg: 100, quantity: 1 }, { product_name: 'Presunto', weight_kg: 60, quantity: 1 }, { product_name: 'Mortadela', weight_kg: 40, quantity: 1 }] },
    { client: 'Padaria Doce Pão', addr: 'Rua da Prata 850 - Centro Barueri SP', items: [{ product_name: 'Pão de Forma', weight_kg: 30, quantity: 1 }] },
    { client: 'Mini Mercado Belval', addr: 'Rua Benedita Guerra Zendron 150 - Belval Barueri SP', items: [{ product_name: 'Presunto', weight_kg: 40, quantity: 1 }, { product_name: 'Mussarela', weight_kg: 20, quantity: 1 }] },
    { client: 'Restaurante Bella Massa', addr: 'Alameda Araguaia 1200 - Alphaville Barueri SP', items: [{ product_name: 'Mussarela', weight_kg: 60, quantity: 1 }, { product_name: 'Mortadela', weight_kg: 30, quantity: 1 }] },
    { client: 'Hamburgueria Prime Grill', addr: 'Alameda Rio Negro 500 - Alphaville Barueri SP', items: [{ product_name: 'Hambúrguer', weight_kg: 75, quantity: 1 }] },
    { client: 'Mercado Alpha Plus', addr: 'Alameda Madeira 800 - Alphaville Barueri SP', items: [{ product_name: 'Mortadela', weight_kg: 80, quantity: 1 }, { product_name: 'Mussarela', weight_kg: 70, quantity: 1 }] },
  ];
  
  return testItems.map(({ client, addr, items }) => ({
    client_name: client,
    address: addr,
    weight_kg: items.reduce((sum, i) => sum + i.weight_kg, 0),
    product_description: items.map(i => i.product_name).join(', '),
    items,
    isValid: true,
  }));
}

/**
 * Validate if file follows the template structure
 */
export function validateTemplateStructure(headers: string[]): TemplateValidation {
  const normalizedHeaders = headers.map(h => normalizeText(h?.toString() || '').toLowerCase().trim());
  const expectedHeaders = TEMPLATE_COLUMNS.map(c => c.toLowerCase());
  
  const missingColumns: string[] = [];
  const renamedColumns: string[] = [];
  
  // Check for required columns
  const requiredColumns = ['cliente', 'peso_kg'];
  const addressColumns = ['rua', 'numero', 'bairro', 'cidade', 'estado'];
  
  for (const required of requiredColumns) {
    const found = normalizedHeaders.some(h => h.includes(required) || required.includes(h));
    if (!found) {
      missingColumns.push(required.charAt(0).toUpperCase() + required.slice(1));
    }
  }
  
  // Check if using structured address OR combined address
  const hasStructuredAddress = addressColumns.every(col => 
    normalizedHeaders.some(h => h.includes(col) || col.includes(h))
  );
  const hasCombinedAddress = normalizedHeaders.some(h => 
    h.includes('endereco') || h.includes('address') || h.includes('local')
  );
  
  if (!hasStructuredAddress && !hasCombinedAddress) {
    missingColumns.push('Endereço (Rua, Número, Bairro, Cidade, Estado)');
  }
  
  // Detect potentially renamed columns
  for (const expected of expectedHeaders) {
    const exactMatch = normalizedHeaders.includes(expected);
    const similarMatch = normalizedHeaders.some(h => 
      h.includes(expected) || expected.includes(h)
    );
    
    if (!exactMatch && similarMatch) {
      const foundHeader = headers[normalizedHeaders.findIndex(h => 
        h.includes(expected) || expected.includes(h)
      )];
      if (foundHeader) {
        renamedColumns.push(`"${foundHeader}" → "${TEMPLATE_COLUMNS.find(c => c.toLowerCase() === expected)}"`);
      }
    }
  }
  
  const isValid = missingColumns.length === 0;
  
  return {
    isValid,
    missingColumns,
    renamedColumns,
    message: !isValid 
      ? `Colunas faltando: ${missingColumns.join(', ')}. Baixe o template modelo para ver o formato correto.`
      : renamedColumns.length > 0 
        ? `Colunas renomeadas detectadas: ${renamedColumns.join(', ')}`
        : undefined,
  };
}

/**
 * Detect column mapping from header row (supports both structured and combined formats)
 */
export function detectStructuredMapping(headers: string[]): ColumnMapping | null {
  const normalizedHeaders = headers.map(h => normalizeText(h?.toString() || '').toLowerCase());
  
  // Check if this is itinerary format (has "Ent." columns)
  const isItineraryFormat = detectItineraryFormat(headers);
  
  /**
   * Find column index with priority for "Ent." suffix in itinerary format
   * This ensures we use "Bairro Ent." instead of "Bairro" when both exist
   */
  const findColumnWithPriority = (patterns: RegExp[]): number => {
    let bestMatch = -1;
    let isEntMatch = false;
    
    for (let idx = 0; idx < normalizedHeaders.length; idx++) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedHeaders[idx])) {
          const hasEnt = /ent\.?$/i.test(normalizedHeaders[idx]);
          
          // If this is an "Ent." match (delivery), or we don't have any match yet
          if (bestMatch === -1 || (hasEnt && !isEntMatch)) {
            bestMatch = idx;
            isEntMatch = hasEnt;
          }
          
          // If we found an "Ent." match, stop looking for this pattern
          if (hasEnt) break;
        }
      }
    }
    return bestMatch;
  };
  
  const pedidoIdIdx = findColumnWithPriority(COLUMN_PATTERNS.pedidoId);
  const clientNameIdx = findColumnWithPriority(COLUMN_PATTERNS.clientName);
  const ruaIdx = findColumnWithPriority(COLUMN_PATTERNS.rua);
  const numeroIdx = findColumnWithPriority(COLUMN_PATTERNS.numero);
  const bairroIdx = findColumnWithPriority(COLUMN_PATTERNS.bairro);
  const cidadeIdx = findColumnWithPriority(COLUMN_PATTERNS.cidade);
  const estadoIdx = findColumnWithPriority(COLUMN_PATTERNS.estado);
  const cepIdx = findColumnWithPriority(COLUMN_PATTERNS.cep);
  const addressIdx = findColumnWithPriority(COLUMN_PATTERNS.address);
  const weightIdx = findColumnWithPriority(COLUMN_PATTERNS.weight);
  const productIdx = findColumnWithPriority(COLUMN_PATTERNS.product);
  
  // Debug log for mapping (helps diagnose issues)
  if (isItineraryFormat) {
    console.log('[Itinerary Parser] Formato de itinerário detectado');
    console.log('[Itinerary Parser] Mapeamento:', {
      pedidoId: pedidoIdIdx !== -1 ? headers[pedidoIdIdx] : 'N/A',
      cliente: clientNameIdx !== -1 ? headers[clientNameIdx] : 'N/A',
      rua: ruaIdx !== -1 ? headers[ruaIdx] : 'N/A',
      bairro: bairroIdx !== -1 ? headers[bairroIdx] : 'N/A',
      cidade: cidadeIdx !== -1 ? headers[cidadeIdx] : 'N/A',
      estado: estadoIdx !== -1 ? headers[estadoIdx] : 'N/A',
      cep: cepIdx !== -1 ? headers[cepIdx] : 'N/A',
      peso: weightIdx !== -1 ? headers[weightIdx] : 'N/A',
    });
  }
  
  // Must have at least client and weight
  if (clientNameIdx === -1 || weightIdx === -1) {
    return null;
  }
  
  // Must have either structured address OR combined address
  // Itinerary format: has rua (End. Ent. which contains street+number), bairro, cidade
  const hasStructured = ruaIdx !== -1 && cidadeIdx !== -1;
  const hasCombined = addressIdx !== -1;
  
  if (!hasStructured && !hasCombined) {
    return null;
  }
  
  return {
    pedidoId: pedidoIdIdx !== -1 ? pedidoIdIdx : undefined,
    clientName: clientNameIdx,
    rua: ruaIdx !== -1 ? ruaIdx : undefined,
    numero: numeroIdx !== -1 ? numeroIdx : undefined,
    bairro: bairroIdx !== -1 ? bairroIdx : undefined,
    cidade: cidadeIdx !== -1 ? cidadeIdx : undefined,
    estado: estadoIdx !== -1 ? estadoIdx : undefined,
    cep: cepIdx !== -1 ? cepIdx : undefined,
    address: hasCombined ? addressIdx : -1, // Will be built from structured
    weight: weightIdx,
    product: productIdx !== -1 ? productIdx : undefined,
  };
}

/**
 * Build full address from structured columns
 */
function buildAddressFromStructured(
  row: unknown[],
  mapping: ColumnMapping
): string {
  const parts: string[] = [];
  
  if (mapping.rua !== undefined) {
    const rua = String(row[mapping.rua] ?? '').trim();
    // If numero column exists, combine them; otherwise rua may already contain street+number (itinerary format)
    const numero = mapping.numero !== undefined ? String(row[mapping.numero] ?? '').trim() : '';
    if (rua) {
      parts.push(numero ? `${rua}, ${numero}` : rua);
    }
  }
  
  if (mapping.bairro !== undefined) {
    const bairro = String(row[mapping.bairro] ?? '').trim();
    if (bairro) parts.push(bairro);
  }
  
  // Build city-state part
  const cidade = mapping.cidade !== undefined ? String(row[mapping.cidade] ?? '').trim() : '';
  const estado = mapping.estado !== undefined ? String(row[mapping.estado] ?? '').trim() : '';
  
  if (cidade && estado) {
    parts.push(`${cidade} - ${estado}`);
  } else if (cidade) {
    parts.push(cidade);
  } else if (estado) {
    parts.push(estado);
  }
  
  // Add CEP if available
  if (mapping.cep !== undefined) {
    const cep = String(row[mapping.cep] ?? '').trim();
    if (cep) parts.push(cep);
  }
  
  return parts.join(', ');
}

/**
 * Generate professional template Excel file with two sheets
 * Now supports multiple items per order - same Pedido_ID groups items together
 */
export function generateTemplateExcel(): Blob {
  const wb = XLSX.utils.book_new();
  
  // ============ Sheet 1: Pedidos (Orders with Multiple Items) ============
  const ordersData = [
    TEMPLATE_COLUMNS.slice(), // Header row
    // Example: Multiple items for same client (PED001)
    ['PED001', 'Padaria Central', 'Rua Campos Sales', '150', 'Centro', 'Barueri', 'SP', 'Mussarela', 30],
    ['PED001', 'Padaria Central', 'Rua Campos Sales', '150', 'Centro', 'Barueri', 'SP', 'Presunto', 20],
    // Single item orders
    ['PED002', 'Mercado Jardim', 'Rua Espírito Santo', '200', 'Jardim Paulista', 'Barueri', 'SP', 'Mortadela', 80],
    // Multiple items (PED003)
    ['PED003', 'Restaurante Sabor', 'Rua da Prata', '500', 'Centro', 'Barueri', 'SP', 'Mussarela', 60],
    ['PED003', 'Restaurante Sabor', 'Rua da Prata', '500', 'Centro', 'Barueri', 'SP', 'Presunto', 40],
    ['PED003', 'Restaurante Sabor', 'Rua da Prata', '500', 'Centro', 'Barueri', 'SP', 'Mortadela', 20],
    // More examples
    ['PED004', 'Açougue Bom Corte', 'Rua Benedita Guerra Zendron', '300', 'Belval', 'Barueri', 'SP', 'Mussarela', 150],
    ['PED004', 'Açougue Bom Corte', 'Rua Benedita Guerra Zendron', '300', 'Belval', 'Barueri', 'SP', 'Hambúrguer', 50],
    ['PED005', 'Hamburgueria Prime', 'Alameda Rio Negro', '500', 'Alphaville', 'Barueri', 'SP', 'Hambúrguer', 75],
  ];
  
  const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
  
  // Set column widths
  wsOrders['!cols'] = [
    { wch: 12 }, // Pedido_ID
    { wch: 25 }, // Cliente
    { wch: 30 }, // Rua
    { wch: 8 },  // Numero
    { wch: 18 }, // Bairro
    { wch: 15 }, // Cidade
    { wch: 6 },  // Estado
    { wch: 15 }, // Produto
    { wch: 10 }, // Peso_kg
  ];
  
  // Add data validation for Estado (dropdown) and Peso_kg (numbers only)
  wsOrders['!dataValidation'] = [
    {
      sqref: 'G2:G1000', // Estado column
      type: 'list',
      formula1: '"SP,RJ,MG,RS,PR,SC,BA,PE,CE,GO,DF,ES,PA,MA,MT,MS,PB,RN,PI,AL,SE,TO,RO,AC,AP,AM,RR"',
    },
    {
      sqref: 'I2:I1000', // Peso_kg column
      type: 'decimal',
      operator: 'greaterThan',
      formula1: '0',
    },
  ];
  
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos');
  
  // ============ Sheet 2: Instruções (Instructions) ============
  const instructionsData = [
    ['📋 INSTRUÇÕES DE PREENCHIMENTO - ROTA CERTA'],
    [''],
    ['Este arquivo é o modelo oficial para importação de pedidos no sistema Rota Certa.'],
    ['Por favor, siga as orientações abaixo para evitar erros na importação.'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['🔄 MÚLTIPLOS ITENS POR PEDIDO:'],
    [''],
    ['Para pedidos com vários produtos, repita o mesmo Pedido_ID em linhas diferentes:'],
    [''],
    ['PED001 | Padaria Central | Rua Campos Sales | 150 | Centro | Barueri | SP | Mussarela | 30'],
    ['PED001 | Padaria Central | Rua Campos Sales | 150 | Centro | Barueri | SP | Presunto | 20'],
    [''],
    ['O sistema irá agrupar todos os itens com o mesmo Pedido_ID em uma única entrega.'],
    ['O peso total do pedido será a soma dos pesos de todos os itens.'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['COLUNAS E SUAS DESCRIÇÕES:'],
    [''],
    ['Coluna', 'Obrigatório', 'Descrição', 'Exemplo'],
    ['Pedido_ID', 'Recomendado', 'Identificador para agrupar itens do mesmo pedido', 'PED001'],
    ['Cliente', 'Sim', 'Nome do cliente ou estabelecimento', 'Padaria Central'],
    ['Rua', 'Sim', 'Nome da rua/avenida/logradouro', 'Rua das Flores'],
    ['Numero', 'Sim', 'Número do endereço', '150'],
    ['Bairro', 'Sim', 'Nome do bairro', 'Centro'],
    ['Cidade', 'Sim', 'Nome da cidade', 'Barueri'],
    ['Estado', 'Sim', 'Sigla do estado (2 letras)', 'SP'],
    ['Produto', 'Sim', 'Nome do produto (usado no Romaneio de Carga)', 'Mussarela'],
    ['Peso_kg', 'Sim', 'Peso do item em quilogramas', '50'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['⚠️  REGRAS IMPORTANTES:'],
    [''],
    ['1. Use o mesmo Pedido_ID para agrupar itens do mesmo cliente'],
    ['2. NÃO altere os nomes das colunas'],
    ['3. O campo Peso_kg deve conter apenas números (sem "kg" ou texto)'],
    ['4. Use a sigla do estado com 2 letras maiúsculas (SP, RJ, MG, etc.)'],
    ['5. Cada linha representa um ITEM do pedido'],
    ['6. O Produto é obrigatório para gerar o Romaneio de Carga corretamente'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['📦 FLUXO OPERACIONAL:'],
    [''],
    ['1. Importar pedidos (esta planilha)'],
    ['2. Sistema consolida itens por produto (Romaneio de Carga)'],
    ['3. Separação e conferência no CD'],
    ['4. Validação da carga'],
    ['5. Roteirização'],
    ['6. Romaneio de Entrega (itens por cliente)'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['Versão do template: 3.0 (Múltiplos Itens)'],
    ['Última atualização: ' + new Date().toLocaleDateString('pt-BR')],
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  
  // Set column widths for instructions
  wsInstructions['!cols'] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 50 },
    { wch: 20 },
  ];
  
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Download template file (Excel only for structured format)
 */
export function downloadTemplate(format: 'csv' | 'xlsx' = 'xlsx'): void {
  const blob = generateTemplateExcel();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_pedidos_rota_certa.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse rows with structured address support and group by Pedido_ID
 */
export function parseRowsStructured(
  rows: unknown[][],
  mapping: ColumnMapping,
  hasHeader: boolean = true
): ParseResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  
  const startIdx = hasHeader ? 1 : 0;
  const dataRows = rows.slice(startIdx);
  
  if (dataRows.length === 0) {
    warnings.push('Nenhuma linha de dados encontrada');
    return { orders: [], errors, warnings, totalRows: 0, validRows: 0, invalidRows: 0 };
  }
  
  // First pass: collect all items, grouped by Pedido_ID or client+address
  const orderMap = new Map<string, { 
    pedidoId?: string;
    clientName: string; 
    address: string; 
    items: ParsedOrderItem[];
    rowNumbers: number[];
  }>();
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + startIdx + 1;
    
    // Skip empty rows
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
      continue;
    }
    
    // Get Pedido_ID if available
    const pedidoId = mapping.pedidoId !== undefined 
      ? normalizeText(String(row[mapping.pedidoId] ?? '')).trim()
      : '';
    
    const clientName = normalizeText(String(row[mapping.clientName] ?? '')).trim();
    
    // Build address from structured columns or use combined
    let address: string;
    if (mapping.rua !== undefined && mapping.cidade !== undefined) {
      address = buildAddressFromStructured(row, mapping);
    } else {
      address = normalizeText(String(row[mapping.address] ?? '')).trim();
    }
    
    const weightRaw = row[mapping.weight];
    const weight = parseWeight(weightRaw);
    const product = mapping.product !== undefined 
      ? normalizeText(String(row[mapping.product] ?? '')).trim() 
      : '';
    
    // Validate individual row
    if (!clientName) {
      errors.push({ row: rowNum, field: 'cliente', message: 'Nome do cliente é obrigatório' });
      continue;
    }
    if (!address || address.length < 10) {
      errors.push({ row: rowNum, field: 'endereço', message: 'Endereço inválido ou muito curto' });
      continue;
    }
    if (weight === null || weight <= 0) {
      errors.push({ row: rowNum, field: 'peso', message: 'Peso inválido' });
      continue;
    }
    
    // Create grouping key: prefer Pedido_ID, fallback to client+address
    const groupKey = pedidoId || `${clientName}::${address}`.toLowerCase();
    
    const item: ParsedOrderItem = {
      product_name: product || 'Produto não especificado',
      weight_kg: weight,
      quantity: 1,
    };
    
    if (orderMap.has(groupKey)) {
      const existing = orderMap.get(groupKey)!;
      existing.items.push(item);
      existing.rowNumbers.push(rowNum);
    } else {
      orderMap.set(groupKey, {
        pedidoId: pedidoId || undefined,
        clientName,
        address,
        items: [item],
        rowNumbers: [rowNum],
      });
    }
  }
  
  // Second pass: create ParsedOrder objects from grouped items
  const orders: ParsedOrder[] = [];
  
  for (const [, data] of orderMap) {
    const totalWeight = data.items.reduce((sum, item) => sum + item.weight_kg, 0);
    const productList = data.items.map(i => i.product_name).join(', ');
    
    orders.push({
      pedido_id: data.pedidoId,
      client_name: data.clientName,
      address: data.address,
      weight_kg: totalWeight,
      product_description: productList,
      items: data.items,
      isValid: true,
    });
  }
  
  const validRows = orders.length;
  const invalidRows = errors.length;
  
  // Add warning if items were grouped
  const groupedCount = Array.from(orderMap.values()).filter(o => o.items.length > 1).length;
  if (groupedCount > 0) {
    warnings.push(`${groupedCount} pedidos com múltiplos itens foram agrupados automaticamente.`);
  }
  
  return {
    orders,
    errors,
    warnings,
    totalRows: dataRows.filter(r => r && !r.every(cell => !cell || String(cell).trim() === '')).length,
    validRows,
    invalidRows,
  };
}

/**
 * Parse PDF file with sales data
 * Supports both tabular format and ADV hierarchical format
 */
export async function parseSalesPDF(file: File): Promise<ParseResult> {
  console.log('[Order Parser] Iniciando processamento de PDF:', file.name);
  
  // Primeiro, tentar o parser ADV especializado
  try {
    const advResult = await parseADVSalesReport(file);
    
    if (advResult && advResult.orders.length > 0) {
      console.log('[Order Parser] PDF processado como formato ADV:', advResult.orders.length, 'pedidos');
      return advResult;
    }
  } catch (error) {
    console.log('[Order Parser] Parser ADV não aplicável:', error);
  }
  
  // Fallback: parser genérico tabular
  console.log('[Order Parser] Tentando parser genérico tabular');
  
  const pdfResult = await parsePDFFile(file);
  
  if (pdfResult.error) {
    return {
      orders: [],
      errors: [{ row: 0, field: 'arquivo', message: pdfResult.error }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  if (pdfResult.rows.length < 2) {
    return {
      orders: [],
      errors: [{ row: 0, field: 'arquivo', message: 'Nenhum dado tabular encontrado no PDF' }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  // Detect column mapping from first row (header)
  const headers = pdfResult.rows[0];
  
  console.log('[Order Parser] PDF Headers para mapeamento:', headers);
  console.log('[Order Parser] Headers normalizados:', headers.map(h => normalizeText(h?.toString() || '').toLowerCase()));
  
  let mapping = detectStructuredMapping(headers);
  console.log('[Order Parser] Mapeamento estruturado:', mapping);
  
  if (!mapping) {
    mapping = detectColumnMapping(headers);
    console.log('[Order Parser] Mapeamento legacy:', mapping);
  }
  
  if (!mapping) {
    console.warn('[Order Parser] Nenhum mapeamento encontrado!');
    console.warn('[Order Parser] Primeira linha de dados:', pdfResult.rows[1]);
    
    return {
      orders: [],
      errors: [{
        row: 1,
        field: 'colunas',
        message: `Não foi possível detectar as colunas no PDF. Headers encontrados: ${headers.join(', ')}`,
      }],
      warnings: [`PDF contém ${pdfResult.pageCount} página(s)`],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
    };
  }
  
  const result = parseRowsStructured(pdfResult.rows, mapping, true);
  result.warnings.push(`PDF processado: ${pdfResult.pageCount} página(s)`);
  
  return result;
}

/**
 * Parse Excel file with template validation
 */
export async function parseExcelWithValidation(file: File): Promise<ParseResult & { templateValidation: TemplateValidation }> {
  // Handle PDF files
  if (isPDFFile(file)) {
    const result = await parseSalesPDF(file);
    return {
      ...result,
      templateValidation: { 
        isValid: result.validRows > 0, 
        missingColumns: [], 
        renamedColumns: [],
        message: 'PDF processado - validação de template não aplicável',
      },
    };
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Look for "Pedidos" sheet first, then fall back to first sheet
  let sheetName = workbook.SheetNames.find(name => 
    name.toLowerCase() === 'pedidos' || name.toLowerCase() === 'orders'
  );
  if (!sheetName) {
    sheetName = workbook.SheetNames[0];
  }
  
  if (!sheetName) {
    return {
      orders: [],
      errors: [],
      warnings: ['Arquivo Excel vazio'],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      templateValidation: { isValid: false, missingColumns: ['Todas'], renamedColumns: [] },
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
      templateValidation: { isValid: false, missingColumns: ['Dados'], renamedColumns: [] },
    };
  }
  
  const headers = rows[0].map(cell => String(cell ?? ''));
  
  // Validate template structure
  const templateValidation = validateTemplateStructure(headers);
  
  // Try structured mapping first, then fall back to auto-detection
  let mapping = detectStructuredMapping(headers);
  if (!mapping) {
    mapping = detectColumnMapping(headers);
  }
  
  if (!mapping) {
    return {
      orders: [],
      errors: [{
        row: 1,
        field: 'colunas',
        message: templateValidation.message || 'Estrutura inválida. Baixe o template modelo.',
      }],
      warnings: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      templateValidation,
    };
  }
  
  const result = parseRowsStructured(rows, mapping, true);
  
  return {
    ...result,
    templateValidation,
  };
}
