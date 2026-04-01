/**
 * Motor Inteligente de Leitura de Planilhas
 * 
 * O sistema deve agir como um analista logístico humano experiente:
 * 1. Ler TUDO primeiro, sem exceção
 * 2. Entender o que cada dado representa
 * 3. Validar coerência antes de decidir
 * 4. Só então tomar decisões
 * 
 * OBJETIVO INEGOCIÁVEL:
 * - Identificar corretamente peso total de cada pedido
 * - Identificar endereços de entrega
 * - Ignorar dados irrelevantes ou vazios
 * - Calcular corretamente o peso total do dia
 */

import * as XLSX from 'xlsx';
import { normalizeText } from '../encoding';
import {
  SpreadsheetRow,
  DetectedColumn,
  ColumnMapping,
  ExtractedOrder,
  SpreadsheetAnalysis,
  SpreadsheetFormat,
  ParseConfig,
  DEFAULT_PARSE_CONFIG,
  TOTALIZATION_PATTERNS,
  OBSERVATION_PATTERNS,
  ValidationResult,
} from './types';
import {
  analyzeColumn,
  findWeightColumn,
  createColumnMapping,
  superNormalize,
  standardNormalize,
  parseNumericValue,
} from './columnDetector';
import { extractWeight, formatWeight } from './weightExtractor';
import { validateCoherence, validateFinalResult, generateDiagnosticReport } from './validationEngine';

/**
 * Lê TODAS as linhas de uma planilha Excel
 * Retorna dados brutos sem nenhum processamento
 */
export async function readAllRows(file: File): Promise<(string | number | null)[][]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Pegar primeira aba ou aba "Pedidos"/"Orders"
  let sheetName = workbook.SheetNames.find(name =>
    ['pedidos', 'orders', 'dados', 'data'].includes(name.toLowerCase())
  );
  if (!sheetName) {
    sheetName = workbook.SheetNames[0];
  }
  
  if (!sheetName) {
    console.error('[IntelligentReader] Nenhuma aba encontrada');
    return [];
  }
  
  const sheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  
  console.log(`[IntelligentReader] Lidas ${rawRows.length} linhas da aba "${sheetName}"`);
  
  // Normalizar tipos
  return rawRows.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return null;
      if (typeof cell === 'number') return cell;
      return String(cell);
    })
  );
}

/**
 * Classifica cada linha (header, dados, vazia, totalização, observação)
 */
export function classifyRows(
  rawRows: (string | number | null)[][],
  config: ParseConfig = DEFAULT_PARSE_CONFIG
): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];
  let headerFound = false;
  let headerRowIndex = -1;
  
  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    
    // Verificar se linha está completamente vazia
    const isEmpty = !rawRow || rawRow.every(cell =>
      cell === null || cell === undefined || String(cell).trim() === ''
    );
    
    // Normalizar células
    const cells = rawRow.map(cell => {
      if (cell === null || cell === undefined) return null;
      if (typeof cell === 'number') return cell;
      return config.normalizeCharacters ? normalizeText(String(cell)) : String(cell);
    });
    
    // Verificar se é linha de totalização
    const rowText = cells.filter(c => c !== null).map(c => String(c)).join(' ');
    const isTotalization = TOTALIZATION_PATTERNS.some(p => p.test(rowText));
    
    // Verificar se é linha de observação
    const isObservation = OBSERVATION_PATTERNS.some(p => p.test(rowText));
    
    // Detectar header (primeira linha com texto significativo que não seja totalização)
    let isHeader = false;
    if (!headerFound && !isEmpty && !isTotalization && !isObservation) {
      // Exigir mínimo de 3 células com conteúdo para ser header
      const nonEmptyCells = cells.filter(c => c !== null && String(c).trim() !== '').length;
      if (nonEmptyCells >= 3) {
        const hasHeaderWords = cells.some(cell => {
          if (cell === null || typeof cell === 'number') return false;
          const norm = superNormalize(cell);
          return ['cliente', 'peso', 'endereco', 'venda', 'pedido', 'produto'].some(kw => norm.includes(kw));
        });
        
        if (hasHeaderWords) {
          isHeader = true;
          headerFound = true;
          headerRowIndex = i;
        }
      }
    }
    
    rows.push({
      rowIndex: i,
      cells,
      isEmpty,
      isHeader,
      isTotalization,
      isObservation,
    });
  }
  
  console.log(`[IntelligentReader] Header encontrado na linha ${headerRowIndex + 1}`);
  console.log(`[IntelligentReader] Linhas vazias: ${rows.filter(r => r.isEmpty).length}`);
  console.log(`[IntelligentReader] Linhas de totalização: ${rows.filter(r => r.isTotalization).length}`);
  
  return rows;
}

/**
 * Detecta o formato da planilha
 */
export function detectFormat(rows: SpreadsheetRow[]): SpreadsheetFormat {
  const headerRow = rows.find(r => r.isHeader);
  if (!headerRow) return 'unknown';
  
  const headerText = headerRow.cells
    .filter(c => c !== null)
    .map(c => String(c).toLowerCase())
    .join(' ');
  
  const superNormText = headerRow.cells
    .filter(c => c !== null)
    .map(c => superNormalize(String(c)))
    .join(' ');
  
  // Formato MB Itinerário: Cliente + Peso Bruto + End. Ent.
  const hasPesoBruto = headerText.includes('peso bruto') || superNormText.includes('pesobruto');
  const hasEndEnt = /end\.?\s*ent\.?/i.test(headerText);
  const hasCliente = headerText.includes('cliente');
  
  if (hasCliente && hasPesoBruto && hasEndEnt) {
    console.log('[IntelligentReader] Formato detectado: MB Itinerário');
    return 'mb_itinerario';
  }
  
  // Formato MB Detalhe: Cliente: + Venda Nº:
  const allText = rows.slice(0, 20).map(r => r.cells.join(' ')).join('\n');
  if (/cliente\s*:/i.test(allText) && /venda\s*n[º°]?\s*:/i.test(allText)) {
    console.log('[IntelligentReader] Formato detectado: MB Detalhe (hierárquico)');
    return 'mb_detalhe';
  }
  
  // Formato Itinerário Genérico: tem End. Ent. mas não necessariamente Peso Bruto
  if (hasEndEnt || /bairro\.?\s*ent\.?/i.test(headerText)) {
    console.log('[IntelligentReader] Formato detectado: Itinerário Genérico');
    return 'itinerario_generic';
  }
  
  // Template Padrão: Pedido_ID, Cliente, Rua, Cidade, Peso_kg
  if (headerText.includes('pedido_id') && headerText.includes('peso_kg')) {
    console.log('[IntelligentReader] Formato detectado: Template Padrão');
    return 'template_standard';
  }
  
  // Genérico: tem Cliente e alguma forma de peso
  if (hasCliente && (headerText.includes('peso') || headerText.includes('kg'))) {
    console.log('[IntelligentReader] Formato detectado: Tabular Genérico');
    return 'generic_tabular';
  }
  
  console.log('[IntelligentReader] Formato não identificado');
  return 'unknown';
}

/**
 * Analisa todas as colunas da planilha
 */
export function analyzeAllColumns(
  rows: SpreadsheetRow[],
  config: ParseConfig = DEFAULT_PARSE_CONFIG
): DetectedColumn[] {
  const headerRow = rows.find(r => r.isHeader);
  if (!headerRow) {
    console.error('[IntelligentReader] Header não encontrado');
    return [];
  }
  
  const dataRows = rows.filter(r => !r.isEmpty && !r.isHeader && !r.isTotalization && !r.isObservation);
  const columns: DetectedColumn[] = [];
  
  for (let i = 0; i < headerRow.cells.length; i++) {
    const column = analyzeColumn(i, headerRow.cells, dataRows, config.sampleSize);
    columns.push(column);
    
    // Log detalhado
    if (column.semanticType !== 'unknown') {
      console.log(`[IntelligentReader] Coluna [${i}] "${column.rawHeader}" → ${column.semanticType} (${column.confidence}%)`);
    }
  }
  
  return columns;
}

/**
 * Extrai pedidos da planilha usando o mapeamento de colunas
 */
export function extractOrders(
  rows: SpreadsheetRow[],
  mapping: ColumnMapping,
  config: ParseConfig = DEFAULT_PARSE_CONFIG
): ExtractedOrder[] {
  const orders: ExtractedOrder[] = [];
  
  // Filtrar apenas linhas de dados válidas
  const dataRows = rows.filter(r =>
    !r.isEmpty && !r.isHeader && !r.isTotalization && !r.isObservation
  );
  
  console.log(`[IntelligentReader] Processando ${dataRows.length} linhas de dados`);
  
  for (const row of dataRows) {
    const cells = row.cells;
    
    // Extrair cliente (obrigatório)
    const clientName = String(cells[mapping.clientName] ?? '').trim();
    if (!clientName) continue;
    
    // Extrair peso
    const weightResult = extractWeight(cells[mapping.weightGross]);
    const weight = weightResult.value;
    
    // Extrair ID do pedido
    const orderId = mapping.orderId !== undefined
      ? String(cells[mapping.orderId] ?? '').trim()
      : '';
    
    // Construir endereço
    const addressParts: ExtractedOrder['address_parts'] = {};
    let address = '';
    
    if (mapping.addressStreet !== undefined) {
      addressParts.street = String(cells[mapping.addressStreet] ?? '').trim();
    }
    if (mapping.addressNumber !== undefined) {
      addressParts.number = String(cells[mapping.addressNumber] ?? '').trim();
    }
    if (mapping.addressNeighborhood !== undefined) {
      addressParts.neighborhood = String(cells[mapping.addressNeighborhood] ?? '').trim();
    }
    if (mapping.addressCity !== undefined) {
      addressParts.city = String(cells[mapping.addressCity] ?? '').trim();
    }
    if (mapping.addressState !== undefined) {
      addressParts.state = String(cells[mapping.addressState] ?? '').trim();
    }
    if (mapping.addressCep !== undefined) {
      const cepRaw = String(cells[mapping.addressCep] ?? '');
      addressParts.cep = cepRaw.replace(/\D/g, '');
    }
    
    // Limpar instruções entre parênteses de cada parte do endereço
    const stripParens = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim();
    if (addressParts.street) addressParts.street = stripParens(addressParts.street);
    if (addressParts.neighborhood) addressParts.neighborhood = stripParens(addressParts.neighborhood);
    if (addressParts.city) addressParts.city = stripParens(addressParts.city);

    // Montar endereço completo
    if (mapping.addressCombined !== undefined) {
      address = String(cells[mapping.addressCombined] ?? '').replace(/\s*\([^)]*\)/g, '').trim();
    } else {
      const parts: string[] = [];
      if (addressParts.street) {
        if (addressParts.number) {
          parts.push(`${addressParts.street}, ${addressParts.number}`);
        } else {
          parts.push(addressParts.street);
        }
      }
      if (addressParts.neighborhood) parts.push(addressParts.neighborhood);
      if (addressParts.city) {
        if (addressParts.state) {
          parts.push(`${addressParts.city} - ${addressParts.state}`);
        } else {
          parts.push(addressParts.city);
        }
      }
      if (addressParts.cep && addressParts.cep.length === 8) {
        parts.push(`${addressParts.cep.slice(0, 5)}-${addressParts.cep.slice(5)}`);
      }
      address = parts.join(', ');
    }
    
    // Extrair produtos (se disponível)
    const products: ExtractedOrder['products'] = [];
    if (mapping.productName !== undefined) {
      const productName = String(cells[mapping.productName] ?? '').trim();
      if (productName) {
        products.push({
          name: productName,
          weight_kg: weight,
          quantity: mapping.quantity !== undefined
            ? parseNumericValue(cells[mapping.quantity]) || 1
            : 1,
        });
      }
    }
    
    // Calcular confiança do registro
    let confidence = 50;
    if (clientName.length > 3) confidence += 15;
    if (weight > 0) confidence += 20;
    if (address.length > 10) confidence += 15;
    if (orderId) confidence += 10;
    
    orders.push({
      pedido_id: orderId || `${clientName}::${row.rowIndex}`,
      client_name: clientName,
      weight_kg: weight,
      address,
      address_parts: addressParts,
      products,
      source_row: row.rowIndex + 1, // 1-indexed para exibição
      confidence: Math.min(confidence, 100),
    });
  }
  
  console.log(`[IntelligentReader] Extraídos ${orders.length} pedidos`);
  
  // Validar peso total
  const totalWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
  console.log(`[IntelligentReader] Peso total: ${formatWeight(totalWeight)}`);
  
  return orders;
}

/**
 * Função principal: Análise completa inteligente de planilha
 * 
 * 1. Lê TODAS as linhas
 * 2. Classifica cada linha
 * 3. Detecta formato
 * 4. Analisa colunas
 * 5. Cria mapeamento
 * 6. Valida coerência
 */
export async function analyzeSpreadsheet(
  file: File,
  config: ParseConfig = DEFAULT_PARSE_CONFIG
): Promise<{ analysis: SpreadsheetAnalysis; orders: ExtractedOrder[] }> {
  console.log('[IntelligentReader] ═══════════════════════════════════════════════════════');
  console.log('[IntelligentReader] INICIANDO ANÁLISE INTELIGENTE');
  console.log('[IntelligentReader] Arquivo:', file.name);
  console.log('[IntelligentReader] ═══════════════════════════════════════════════════════');
  
  // PASSO 1: Ler TODAS as linhas
  const rawRows = await readAllRows(file);
  console.log(`[IntelligentReader] Total de linhas lidas: ${rawRows.length}`);
  
  if (rawRows.length === 0) {
    const emptyAnalysis: SpreadsheetAnalysis = {
      format: 'unknown',
      headerRowIndex: -1,
      totalRows: 0,
      dataRows: 0,
      emptyRows: 0,
      columns: [],
      mapping: null,
      weightColumn: null,
      validation: {
        isValid: false,
        totalWeight: 0,
        totalOrders: 0,
        averageWeight: 0,
        warnings: [],
        errors: [{ code: 'EMPTY_FILE', message: 'Arquivo vazio', severity: 'critical' }],
        suggestions: [],
      },
    };
    return { analysis: emptyAnalysis, orders: [] };
  }
  
  // PASSO 2: Classificar linhas
  const rows = classifyRows(rawRows, config);
  const headerRow = rows.find(r => r.isHeader);
  const headerRowIndex = headerRow?.rowIndex ?? -1;
  
  // PASSO 3: Detectar formato
  const format = detectFormat(rows);
  
  // PASSO 4: Analisar colunas
  const columns = analyzeAllColumns(rows, config);
  
  // PASSO 5: Encontrar coluna de peso
  const weightColumn = findWeightColumn(columns);
  
  // PASSO 6: Criar mapeamento
  const mapping = createColumnMapping(columns);
  
  // Estatísticas
  const emptyRows = rows.filter(r => r.isEmpty).length;
  const dataRows = rows.filter(r => !r.isEmpty && !r.isHeader && !r.isTotalization && !r.isObservation).length;
  
  // PASSO 7: Extrair pedidos (se tiver mapeamento)
  let orders: ExtractedOrder[] = [];
  if (mapping) {
    orders = extractOrders(rows, mapping, config);
  }
  
  // PASSO 8: Validar coerência
  const coherence = mapping ? validateCoherence(orders, {
    format,
    headerRowIndex,
    totalRows: rawRows.length,
    dataRows,
    emptyRows,
    columns,
    mapping,
    weightColumn,
    validation: { isValid: true, totalWeight: 0, totalOrders: 0, averageWeight: 0, warnings: [], errors: [], suggestions: [] },
  }) : null;
  
  // Criar resultado de validação
  const validation = validateFinalResult(orders, weightColumn?.numericStats?.sum || 0);
  
  // Se houve problemas de coerência, adicionar aos avisos
  if (coherence && !coherence.isCoherent) {
    for (const issue of coherence.issues) {
      validation.warnings.push({ code: 'COHERENCE', message: issue });
    }
    validation.suggestions.push(...coherence.suggestions);
  }
  
  const analysis: SpreadsheetAnalysis = {
    format,
    headerRowIndex,
    totalRows: rawRows.length,
    dataRows,
    emptyRows,
    columns,
    mapping,
    weightColumn,
    validation,
  };
  
  // Log do diagnóstico
  const diagnosticReport = generateDiagnosticReport(analysis, orders);
  console.log('[IntelligentReader] ' + diagnosticReport.join('\n[IntelligentReader] '));
  
  return { analysis, orders };
}

/**
 * Converte ExtractedOrder para o formato ParsedOrder usado pelo resto do app
 */
export function convertToLegacyFormat(orders: ExtractedOrder[]): import('@/types').ParsedOrder[] {
  return orders.map(order => ({
    pedido_id: order.pedido_id,
    client_name: order.client_name,
    address: order.address,
    city: order.address_parts?.city || undefined,
    weight_kg: order.weight_kg,
    product_description: order.products.map(p => p.name).join(', ') || undefined,
    items: order.products.map(p => ({
      product_name: p.name,
      weight_kg: p.weight_kg,
      quantity: p.quantity,
    })),
    isValid: order.address.length >= 10 && order.weight_kg > 0,
    error: order.address.length < 10 ? 'Endereço incompleto' : undefined,
  }));
}
