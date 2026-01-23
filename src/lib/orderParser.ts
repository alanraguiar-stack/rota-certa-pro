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
  pedidoId?: number;
  clientName: number;
  rua?: number;
  numero?: number;
  bairro?: number;
  cidade?: number;
  estado?: number;
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
 */
const COLUMN_PATTERNS = {
  pedidoId: [
    /pedido.?id/i, /pedido/i, /order.?id/i, /id.?pedido/i, /numero.?pedido/i
  ],
  clientName: [
    /cliente/i, /nome/i, /customer/i, /name/i, /razao/i, /fantasia/i, 
    /destinat[áa]rio/i, /empresa/i, /company/i
  ],
  rua: [
    /^rua$/i, /logradouro/i, /street/i
  ],
  numero: [
    /^n[uú]mero$/i, /^num$/i, /^n[º°]?$/i, /number/i
  ],
  bairro: [
    /bairro/i, /neighborhood/i, /distrito/i
  ],
  cidade: [
    /cidade/i, /city/i, /munic[íi]pio/i
  ],
  estado: [
    /^estado$/i, /^uf$/i, /state/i
  ],
  address: [
    /endere[çc]o/i, /address/i, /local/i, /destino/i, /location/i
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
  
  const findColumn = (patterns: RegExp[]): number => {
    for (let idx = 0; idx < normalizedHeaders.length; idx++) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedHeaders[idx])) {
          return idx;
        }
      }
    }
    return -1;
  };
  
  const pedidoIdIdx = findColumn(COLUMN_PATTERNS.pedidoId);
  const clientNameIdx = findColumn(COLUMN_PATTERNS.clientName);
  const ruaIdx = findColumn(COLUMN_PATTERNS.rua);
  const numeroIdx = findColumn(COLUMN_PATTERNS.numero);
  const bairroIdx = findColumn(COLUMN_PATTERNS.bairro);
  const cidadeIdx = findColumn(COLUMN_PATTERNS.cidade);
  const estadoIdx = findColumn(COLUMN_PATTERNS.estado);
  const addressIdx = findColumn(COLUMN_PATTERNS.address);
  const weightIdx = findColumn(COLUMN_PATTERNS.weight);
  const productIdx = findColumn(COLUMN_PATTERNS.product);
  
  // Must have at least client and weight
  if (clientNameIdx === -1 || weightIdx === -1) {
    return null;
  }
  
  // Must have either structured address OR combined address
  const hasStructured = ruaIdx !== -1 && numeroIdx !== -1 && cidadeIdx !== -1;
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
    const numero = mapping.numero !== undefined ? String(row[mapping.numero] ?? '').trim() : '';
    if (rua) {
      parts.push(numero ? `${rua}, ${numero}` : rua);
    }
  }
  
  if (mapping.bairro !== undefined) {
    const bairro = String(row[mapping.bairro] ?? '').trim();
    if (bairro) parts.push(bairro);
  }
  
  if (mapping.cidade !== undefined) {
    const cidade = String(row[mapping.cidade] ?? '').trim();
    if (cidade) parts.push(cidade);
  }
  
  if (mapping.estado !== undefined) {
    const estado = String(row[mapping.estado] ?? '').trim();
    if (estado) parts.push(estado);
  }
  
  return parts.join(' - ');
}

/**
 * Generate professional template Excel file with two sheets
 */
export function generateTemplateExcel(): Blob {
  const wb = XLSX.utils.book_new();
  
  // ============ Sheet 1: Pedidos (Orders) ============
  const ordersData = [
    TEMPLATE_COLUMNS.slice(), // Header row
    // Example rows (can be deleted by user)
    ['PED001', 'Padaria Central', 'Rua Campos Sales', '150', 'Centro', 'Barueri', 'SP', 'Mussarela', 50],
    ['PED002', 'Mercado Jardim', 'Rua Espírito Santo', '200', 'Jardim Paulista', 'Barueri', 'SP', 'Presunto', 80],
    ['PED003', 'Restaurante Sabor', 'Rua da Prata', '500', 'Centro', 'Barueri', 'SP', 'Mortadela', 120],
    ['PED004', 'Açougue Bom Corte', 'Rua Benedita Guerra Zendron', '300', 'Belval', 'Barueri', 'SP', 'Mussarela', 200],
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
  
  // Highlight header row (requires styling support)
  // XLSX basic doesn't support full styling, but we set the structure
  
  // Add data validation for Estado (dropdown) and Peso_kg (numbers only)
  // Note: XLSX library has limited validation support, but we define the structure
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
    ['📋 INSTRUÇÕES DE PREENCHIMENTO'],
    [''],
    ['Este arquivo é o modelo oficial para importação de pedidos no sistema Rota Certa.'],
    ['Por favor, siga as orientações abaixo para evitar erros na importação.'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['COLUNAS E SUAS DESCRIÇÕES:'],
    [''],
    ['Coluna', 'Obrigatório', 'Descrição', 'Exemplo'],
    ['Pedido_ID', 'Não', 'Identificador único do pedido (opcional)', 'PED001'],
    ['Cliente', 'Sim', 'Nome do cliente ou estabelecimento', 'Padaria Central'],
    ['Rua', 'Sim', 'Nome da rua/avenida/logradouro', 'Rua das Flores'],
    ['Numero', 'Sim', 'Número do endereço', '150'],
    ['Bairro', 'Sim', 'Nome do bairro', 'Centro'],
    ['Cidade', 'Sim', 'Nome da cidade', 'Barueri'],
    ['Estado', 'Sim', 'Sigla do estado (2 letras)', 'SP'],
    ['Produto', 'Não', 'Descrição do produto (para romaneio)', 'Mussarela'],
    ['Peso_kg', 'Sim', 'Peso em quilogramas (número positivo)', '50'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['⚠️  REGRAS IMPORTANTES:'],
    [''],
    ['1. NÃO altere os nomes das colunas na aba "Pedidos"'],
    ['2. NÃO remova ou reordene as colunas'],
    ['3. O campo Peso_kg deve conter apenas números (sem "kg" ou texto)'],
    ['4. Use a sigla do estado com 2 letras maiúsculas (SP, RJ, MG, etc.)'],
    ['5. Apague as linhas de exemplo antes de inserir seus dados'],
    ['6. Cada linha representa um pedido/entrega'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['✅ EXEMPLOS VÁLIDOS:'],
    [''],
    ['PED001 | Padaria Central | Rua Campos Sales | 150 | Centro | Barueri | SP | Mussarela | 50'],
    ['PED002 | Mercado ABC | Av. Brasil | 1200 | Jardim | São Paulo | SP | Presunto | 120'],
    [''],
    ['❌ EXEMPLOS INVÁLIDOS:'],
    [''],
    ['• Peso com texto: "50kg" → Use apenas: 50'],
    ['• Estado por extenso: "São Paulo" → Use apenas: SP'],
    ['• Endereço incompleto: Faltando número ou bairro'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════'],
    [''],
    ['📞 Em caso de dúvidas, entre em contato com o suporte.'],
    [''],
    ['Versão do template: 2.0'],
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
 * Parse rows with structured address support
 */
export function parseRowsStructured(
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
    const rowNum = i + startIdx + 1;
    
    // Skip empty rows
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
      continue;
    }
    
    const clientName = String(row[mapping.clientName] ?? '');
    
    // Build address from structured columns or use combined
    let address: string;
    if (mapping.rua !== undefined && mapping.cidade !== undefined) {
      address = buildAddressFromStructured(row, mapping);
    } else {
      address = String(row[mapping.address] ?? '');
    }
    
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
 * Parse Excel file with template validation
 */
export async function parseExcelWithValidation(file: File): Promise<ParseResult & { templateValidation: TemplateValidation }> {
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
