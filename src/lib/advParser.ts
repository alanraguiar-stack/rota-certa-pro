/**
 * Parser especializado para relatórios do sistema ADV
 * Formato hierárquico: Cliente → Vendas → Itens
 * 
 * Estrutura típica do PDF:
 * # Cliente: ANGELA ALVES MADEIRA BARBOSA
 *    Venda Nº: 276017    NFe Nº: 50756    Data: 23/01/2026
 *    | Código | Descrição                    | Qtde. | Unitário | Total |
 *    | 1090   | MUSSARELA - ESPLANADA - 4 KG | 12,81 | 32,99    | 422,60|
 */

import { ParsedOrder, ParsedOrderItem } from '@/types';
import { ParseResult, ValidationError } from './orderParser';
import { extractRawTextFromPDF, parsePDFFile } from './pdfParser';
import { normalizeText } from './encoding';

export interface ADVSale {
  pedido_id: string;
  nfe_id?: string;
  date?: string;
  items: ParsedOrderItem[];
}

export interface ADVClient {
  name: string;
  cpf_cnpj?: string;
  sales: ADVSale[];
}

/**
 * Registro extraído do PDF de Itinerário de Vendas
 * Contém endereços de entrega por venda
 */
export interface ItinerarioRecord {
  venda_id: string;
  client_name: string;
  address: string;      // End. Ent. (rua + número)
  neighborhood: string; // Bairro Ent.
  city: string;         // Cidade Ent.
  cep: string;          // Cep Ent.
  weight_kg: number;    // Peso Bruto
}

/**
 * Detecta se o texto é do formato ADV (relatório de vendas detalhadas)
 */
export function isADVFormat(lines: string[]): boolean {
  const text = lines.join(' ');
  
  // Padrões específicos do formato ADV
  const patterns = [
    /vendas?\s*detalhadas?\s*(por\s*cliente)?/i,
    /cliente\s*:\s*[A-ZÁÉÍÓÚÀÃÕÇ\s]+/i,
    /venda\s*n[º°]?\s*:\s*\d+/i,
    /relat[óo]rio\s*(de)?\s*vendas/i,
  ];
  
  // Precisa ter pelo menos 2 padrões correspondentes
  const matchCount = patterns.filter(p => p.test(text)).length;
  
  console.log('[ADV Parser] Detecção de formato ADV - Matches:', matchCount);
  
  return matchCount >= 2;
}

/**
 * Detecta se o PDF é do formato Itinerário de Vendas
 * Contém colunas: Venda, Cliente, End. Ent., Bairro Ent., Cidade Ent., Cep Ent., Peso Bruto
 */
export function isItinerarioFormat(text: string): boolean {
  const patterns = [
    /end\.?\s*ent\.?/i,          // End. Ent.
    /bairro\.?\s*ent\.?/i,       // Bairro Ent.
    /cidade\.?\s*ent\.?/i,       // Cidade Ent.
    /vendas?.?itiner[áa]rio/i,   // Vendas_Itinerario
    /cep\.?\s*ent\.?/i,          // Cep Ent.
    /peso\s*bruto/i,             // Peso Bruto
  ];
  
  const matchCount = patterns.filter(p => p.test(text)).length;
  
  console.log('[Itinerário Parser] Detecção de formato - Matches:', matchCount);
  
  // Se encontrar 2+ padrões, é formato itinerário
  return matchCount >= 2;
}

/**
 * Extrai informações de cliente de uma linha
 * Formato: "Cliente: NOME COMPLETO" ou "# Cliente: NOME COMPLETO 12345678901"
 */
function extractClient(line: string): { name: string; cpf_cnpj?: string } | null {
  // Padrão para extrair cliente (pode ter CPF/CNPJ no final)
  const match = line.match(/cliente\s*:\s*([A-ZÁÉÍÓÚÀÃÕÇÂÊÎÔÛÄËÏÖÜ\s\-\.]+?)(?:\s+(\d{11}|\d{14}))?\s*$/i);
  
  if (match) {
    return {
      name: normalizeText(match[1].trim()),
      cpf_cnpj: match[2] || undefined,
    };
  }
  
  return null;
}

/**
 * Extrai informações de venda de uma linha
 * Formato: "Venda Nº: 276017 NFe Nº: 50756 Data: 23/01/2026"
 */
function extractSale(line: string): { pedido_id: string; nfe_id?: string; date?: string } | null {
  const vendaMatch = line.match(/venda\s*n[º°]?\s*:\s*(\d+)/i);
  
  if (vendaMatch) {
    const nfeMatch = line.match(/nfe?\s*n[º°]?\s*:\s*(\d+)/i);
    const dateMatch = line.match(/data\s*:\s*(\d{2}\/\d{2}\/\d{2,4})/i);
    
    return {
      pedido_id: vendaMatch[1],
      nfe_id: nfeMatch?.[1],
      date: dateMatch?.[1],
    };
  }
  
  return null;
}

/**
 * Extrai item da tabela de produtos
 * Formato: "1090 MUSSARELA - ESPLANADA - 4 KG 12,81 32,99 422,60"
 * Colunas: Código | Descrição | Qtde. | Unitário | Total
 */
function extractItem(line: string): ParsedOrderItem | null {
  // Limpar a linha de caracteres de tabela
  const cleanLine = line.replace(/[|│]/g, ' ').trim();
  
  // Padrão para linha de item:
  // código(número) + descrição(texto) + qtde(número,decimal) + unitário(número,decimal) + total(número,decimal)
  const match = cleanLine.match(
    /^\s*(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/
  );
  
  if (match) {
    const [, codigo, descricao, qtde, unitario, total] = match;
    
    // Converter quantidade (que representa peso em kg)
    const weight = parseFloat(qtde.replace('.', '').replace(',', '.'));
    
    if (!isNaN(weight) && weight > 0) {
      return {
        product_name: normalizeText(descricao.trim()),
        weight_kg: weight,
        quantity: 1,
      };
    }
  }
  
  // Tentar padrão alternativo mais flexível
  const altMatch = cleanLine.match(
    /^\s*(\d+)\s+(.+?)\s+([\d]+[,.][\d]+)\s+/
  );
  
  if (altMatch) {
    const [, , descricao, qtde] = altMatch;
    const weight = parseFloat(qtde.replace('.', '').replace(',', '.'));
    
    if (!isNaN(weight) && weight > 0) {
      return {
        product_name: normalizeText(descricao.trim()),
        weight_kg: weight,
        quantity: 1,
      };
    }
  }
  
  return null;
}

/**
 * Verifica se a linha é um cabeçalho de tabela
 */
function isTableHeader(line: string): boolean {
  const headerPatterns = [
    /c[óo]digo/i,
    /descri[çc][ãa]o/i,
    /qtde?\.?/i,
    /unit[áa]rio/i,
    /total/i,
  ];
  
  const matchCount = headerPatterns.filter(p => p.test(line)).length;
  return matchCount >= 2;
}

/**
 * Parser principal para relatórios ADV
 */
export async function parseADVSalesReport(file: File): Promise<ParseResult | null> {
  console.log('[ADV Parser] Iniciando processamento do arquivo:', file.name);
  
  // Extrair texto bruto do PDF
  const lines = await extractRawTextFromPDF(file);
  
  if (lines.length === 0) {
    console.log('[ADV Parser] Nenhuma linha extraída do PDF');
    return null;
  }
  
  console.log('[ADV Parser] Linhas extraídas:', lines.length);
  console.log('[ADV Parser] Primeiras 10 linhas:', lines.slice(0, 10));
  
  // Verificar se é formato ADV
  if (!isADVFormat(lines)) {
    console.log('[ADV Parser] Não é formato ADV, retornando null');
    return null;
  }
  
  console.log('[ADV Parser] Formato ADV detectado, processando...');
  
  const orders: ParsedOrder[] = [];
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  
  let currentClient: ADVClient | null = null;
  let currentSale: ADVSale | null = null;
  let inItemTable = false;
  let lineNum = 0;
  
  for (const line of lines) {
    lineNum++;
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    // Tentar extrair cliente
    const clientInfo = extractClient(trimmedLine);
    if (clientInfo) {
      // Salvar venda anterior se existir
      if (currentClient && currentSale && currentSale.items.length > 0) {
        currentClient.sales.push(currentSale);
      }
      
      // Converter cliente anterior para pedidos
      if (currentClient && currentClient.sales.length > 0) {
        for (const sale of currentClient.sales) {
          const totalWeight = sale.items.reduce((sum, item) => sum + item.weight_kg, 0);
          
          orders.push({
            pedido_id: sale.pedido_id,
            client_name: currentClient.name,
            address: '', // Endereço não disponível no relatório ADV
            weight_kg: totalWeight,
            product_description: sale.items.map(i => i.product_name).join(', '),
            items: sale.items,
            isValid: true, // Será validado posteriormente
          });
        }
      }
      
      // Iniciar novo cliente
      currentClient = {
        name: clientInfo.name,
        cpf_cnpj: clientInfo.cpf_cnpj,
        sales: [],
      };
      currentSale = null;
      inItemTable = false;
      
      console.log('[ADV Parser] Cliente encontrado:', clientInfo.name);
      continue;
    }
    
    // Tentar extrair venda
    const saleInfo = extractSale(trimmedLine);
    if (saleInfo && currentClient) {
      // Salvar venda anterior se existir
      if (currentSale && currentSale.items.length > 0) {
        currentClient.sales.push(currentSale);
      }
      
      // Iniciar nova venda
      currentSale = {
        pedido_id: saleInfo.pedido_id,
        nfe_id: saleInfo.nfe_id,
        date: saleInfo.date,
        items: [],
      };
      inItemTable = false;
      
      console.log('[ADV Parser] Venda encontrada:', saleInfo.pedido_id);
      continue;
    }
    
    // Detectar cabeçalho de tabela
    if (isTableHeader(trimmedLine)) {
      inItemTable = true;
      continue;
    }
    
    // Tentar extrair item se estamos em uma tabela e temos uma venda atual
    if (currentSale) {
      const item = extractItem(trimmedLine);
      if (item) {
        currentSale.items.push(item);
        console.log('[ADV Parser] Item encontrado:', item.product_name, item.weight_kg, 'kg');
      }
    }
  }
  
  // Processar último cliente/venda
  if (currentClient) {
    if (currentSale && currentSale.items.length > 0) {
      currentClient.sales.push(currentSale);
    }
    
    for (const sale of currentClient.sales) {
      const totalWeight = sale.items.reduce((sum, item) => sum + item.weight_kg, 0);
      
      orders.push({
        pedido_id: sale.pedido_id,
        client_name: currentClient.name,
        address: '', // Endereço não disponível
        weight_kg: totalWeight,
        product_description: sale.items.map(i => i.product_name).join(', '),
        items: sale.items,
        isValid: true,
      });
    }
  }
  
  console.log('[ADV Parser] Total de pedidos extraídos:', orders.length);
  
  // Adicionar warnings sobre endereços
  if (orders.length > 0) {
    warnings.push('Formato ADV detectado. Os endereços de entrega precisam ser adicionados manualmente ou importados de outra fonte.');
    
    // Marcar pedidos sem endereço como parcialmente válidos
    for (const order of orders) {
      if (!order.address || order.address.trim() === '') {
        order.isValid = false;
        order.error = 'Endereço não encontrado no relatório ADV';
      }
    }
  }
  
  // Estatísticas
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
 * Verifica se um arquivo PDF é do formato ADV
 */
export async function isADVPDFFile(file: File): Promise<boolean> {
  try {
    const lines = await extractRawTextFromPDF(file);
    return isADVFormat(lines);
  } catch (error) {
    console.error('[ADV Parser] Erro ao verificar formato:', error);
    return false;
  }
}

/**
 * Parser para PDF de Itinerário de Vendas
 * Formato tabular: Venda | Cliente | End. Ent. | Bairro Ent. | Cidade Ent. | Cep Ent. | Peso Bruto
 */
export async function parseItinerarioPDF(file: File): Promise<ItinerarioRecord[]> {
  console.log('[Itinerário Parser] Iniciando processamento:', file.name);
  
  const result = await parsePDFFile(file);
  
  if (result.error || result.rows.length < 2) {
    console.log('[Itinerário Parser] Erro ou sem dados:', result.error);
    return [];
  }
  
  // Verificar se é formato itinerário pelo header
  const headerText = result.rows[0].join(' ');
  if (!isItinerarioFormat(headerText)) {
    console.log('[Itinerário Parser] Não é formato itinerário');
    return [];
  }
  
  console.log('[Itinerário Parser] Formato itinerário detectado');
  console.log('[Itinerário Parser] Headers:', result.rows[0]);
  
  // Mapear colunas pelo header
  const headers = result.rows[0].map(h => normalizeText(h).toLowerCase());
  
  const columnMap = {
    venda: findColumnIndex(headers, [/^venda$/i, /n[º°]?\s*venda/i, /venda\s*n/i]),
    cliente: findColumnIndex(headers, [/cliente/i, /nome/i, /razao/i]),
    endEnt: findColumnIndex(headers, [/end\.?\s*ent\.?/i, /endere[çc]o\s*ent/i, /endere[çc]o/i]),
    bairroEnt: findColumnIndex(headers, [/bairro\.?\s*ent\.?/i, /bairro/i]),
    cidadeEnt: findColumnIndex(headers, [/cidade\.?\s*ent\.?/i, /cidade/i, /munic[íi]pio/i]),
    cepEnt: findColumnIndex(headers, [/cep\.?\s*ent\.?/i, /cep/i]),
    pesoBruto: findColumnIndex(headers, [/peso\s*bruto/i, /peso/i, /kg/i]),
  };
  
  console.log('[Itinerário Parser] Mapeamento de colunas:', columnMap);
  
  // Validar colunas mínimas
  if (columnMap.venda === -1 || columnMap.cliente === -1 || columnMap.endEnt === -1) {
    console.log('[Itinerário Parser] Colunas obrigatórias não encontradas');
    return [];
  }
  
  const records: ItinerarioRecord[] = [];
  
  // Processar linhas de dados (pular header)
  for (let i = 1; i < result.rows.length; i++) {
    const row = result.rows[i];
    
    // Pular linhas vazias
    if (!row || row.every(cell => !cell?.trim())) continue;
    
    const vendaId = columnMap.venda !== -1 ? row[columnMap.venda]?.trim() : '';
    const clientName = columnMap.cliente !== -1 ? row[columnMap.cliente]?.trim() : '';
    const address = columnMap.endEnt !== -1 ? row[columnMap.endEnt]?.trim() : '';
    const neighborhood = columnMap.bairroEnt !== -1 ? row[columnMap.bairroEnt]?.trim() : '';
    const city = columnMap.cidadeEnt !== -1 ? row[columnMap.cidadeEnt]?.trim() : '';
    const cep = columnMap.cepEnt !== -1 ? row[columnMap.cepEnt]?.trim() : '';
    const pesoStr = columnMap.pesoBruto !== -1 ? row[columnMap.pesoBruto]?.trim() : '0';
    
    // Validar dados mínimos
    if (!vendaId || !clientName) continue;
    
    // Converter peso
    const weight = parseFloat((pesoStr || '0').replace('.', '').replace(',', '.')) || 0;
    
    records.push({
      venda_id: vendaId,
      client_name: normalizeText(clientName),
      address: normalizeText(address),
      neighborhood: normalizeText(neighborhood),
      city: normalizeText(city),
      cep: cep?.replace(/\D/g, '') || '',
      weight_kg: weight,
    });
    
    console.log('[Itinerário Parser] Registro:', vendaId, clientName.substring(0, 20), address.substring(0, 30));
  }
  
  console.log('[Itinerário Parser] Total de registros:', records.length);
  
  return records;
}

/**
 * Encontra o índice de uma coluna baseado em padrões
 */
function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(headers[i])) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Formata CEP para exibição (00000-000)
 */
function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return cep;
}

/**
 * Cruza dados do Itinerário (endereços) com o Relatório ADV (itens detalhados)
 * A chave de cruzamento é o número da venda (pedido_id / venda_id)
 */
export function mergeItinerarioWithADV(
  itinerario: ItinerarioRecord[],
  advOrders: ParsedOrder[]
): ParsedOrder[] {
  console.log('[Merge] Iniciando cruzamento de dados');
  console.log('[Merge] Itinerário:', itinerario.length, 'registros');
  console.log('[Merge] ADV:', advOrders.length, 'pedidos');
  
  // Criar mapa de itinerário por venda_id para busca rápida
  const itinerarioMap = new Map<string, ItinerarioRecord>();
  for (const record of itinerario) {
    itinerarioMap.set(record.venda_id, record);
  }
  
  let matchedCount = 0;
  let unmatchedCount = 0;
  
  const mergedOrders = advOrders.map(order => {
    // Buscar endereço pelo número da venda
    const enderecoData = itinerarioMap.get(order.pedido_id || '');
    
    if (enderecoData) {
      matchedCount++;
      
      // Construir endereço completo
      const addressParts = [
        enderecoData.address,
        enderecoData.neighborhood,
        enderecoData.city,
      ].filter(Boolean);
      
      // Adicionar CEP formatado se disponível
      if (enderecoData.cep) {
        addressParts.push(formatCEP(enderecoData.cep));
      }
      
      const fullAddress = addressParts.join(', ');
      
      console.log('[Merge] Match:', order.pedido_id, '->', fullAddress.substring(0, 50));
      
      return {
        ...order,
        address: fullAddress,
        isValid: true,
        error: undefined,
      };
    }
    
    unmatchedCount++;
    console.log('[Merge] Sem match:', order.pedido_id, order.client_name?.substring(0, 20));
    
    // Mantém o pedido sem endereço
    return {
      ...order,
      isValid: false,
      error: 'Endereço não encontrado no itinerário',
    };
  });
  
  console.log('[Merge] Resultado:', matchedCount, 'cruzados,', unmatchedCount, 'sem endereço');
  
  return mergedOrders;
}

/**
 * Cria pedidos apenas a partir do itinerário (sem itens detalhados)
 * Usado quando só o arquivo de itinerário está disponível
 */
export function createOrdersFromItinerario(itinerario: ItinerarioRecord[]): ParsedOrder[] {
  return itinerario.map(record => {
    // Construir endereço completo
    const addressParts = [
      record.address,
      record.neighborhood,
      record.city,
    ].filter(Boolean);
    
    if (record.cep) {
      addressParts.push(formatCEP(record.cep));
    }
    
    return {
      pedido_id: record.venda_id,
      client_name: record.client_name,
      address: addressParts.join(', '),
      weight_kg: record.weight_kg,
      product_description: undefined,
      items: [],
      isValid: true,
    };
  });
}

/**
 * Detecta automaticamente o tipo de PDF e retorna os dados apropriados
 */
export interface PDFDetectionResult {
  type: 'adv' | 'itinerario' | 'generic' | 'unknown';
  advOrders?: ParsedOrder[];
  itinerarioRecords?: ItinerarioRecord[];
}

export async function detectAndParsePDF(file: File): Promise<PDFDetectionResult> {
  console.log('[Auto Detect] Analisando PDF:', file.name);
  
  // Extrair texto bruto para detecção
  const lines = await extractRawTextFromPDF(file);
  const fullText = lines.join(' ');
  
  // Testar formato Itinerário primeiro (mais específico)
  if (isItinerarioFormat(fullText)) {
    console.log('[Auto Detect] Detectado: Itinerário de Vendas');
    const records = await parseItinerarioPDF(file);
    return {
      type: 'itinerario',
      itinerarioRecords: records,
    };
  }
  
  // Testar formato ADV
  if (isADVFormat(lines)) {
    console.log('[Auto Detect] Detectado: Relatório ADV');
    const result = await parseADVSalesReport(file);
    return {
      type: 'adv',
      advOrders: result?.orders || [],
    };
  }
  
  console.log('[Auto Detect] Formato não reconhecido');
  return { type: 'unknown' };
}

// ============================================================================
// EXCEL PARSING FUNCTIONS FOR MB FORMAT
// ============================================================================

/**
 * Encontra correspondência exata ou por padrão em array de headers
 * Normalização agressiva: remove espaços extras, caracteres invisíveis, etc.
 */
function findExactOrPattern(headers: string[], exactMatches: string[], patterns: RegExp[]): number {
  // Normalizar todos os headers de forma agressiva
  const normalizedHeaders = headers.map(h => 
    h.replace(/\s+/g, ' ')      // Múltiplos espaços -> 1 espaço
     .replace(/[\u00A0\u200B\uFEFF]/g, ' ')  // Espaços unicode invisíveis
     .trim()
  );
  
  // Primeiro: correspondência exata (lowercase) com normalização
  for (const exact of exactMatches) {
    const normalizedExact = exact.toLowerCase().replace(/\s+/g, ' ').trim();
    
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (normalizedHeaders[i] === normalizedExact) {
        console.log('[findExactOrPattern] Match exato: "' + normalizedHeaders[i] + '" no índice ' + i);
        return i;
      }
    }
  }
  
  // Segundo: correspondência por padrão regex
  for (let i = 0; i < normalizedHeaders.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedHeaders[i])) {
        console.log('[findExactOrPattern] Match regex: "' + normalizedHeaders[i] + '" no índice ' + i);
        return i;
      }
    }
  }
  
  return -1;
}

/**
 * Detecta se Excel é formato de Relatório de Vendas MB (Itinerário)
 * Headers esperados: Cliente, Peso Bruto, End. Ent., Bairro Ent., Cidade Ent., Cep Ent.
 * 
 * IMPORTANTE: Esta função aceita o formato MB sem exigir template padrão.
 * Basta ter: Cliente + Peso Bruto + pelo menos 1 campo de endereço
 */
export function isItinerarioExcelFormat(headers: string[]): boolean {
  const headerText = headers.map(h => String(h ?? '').toLowerCase()).join(' ');
  
  // Padrões obrigatórios do formato MB
  const hasCliente = /cliente/i.test(headerText);
  const hasPesoBruto = /peso\s*bruto/i.test(headerText);
  
  // Padrões de endereço (pelo menos 1 é obrigatório)
  const addressPatterns = [
    /end\.?\s*ent\.?/i,          // End. Ent.
    /bairro\.?\s*ent\.?/i,       // Bairro Ent.
    /cidade\.?\s*ent\.?/i,       // Cidade Ent.
    /cep\.?\s*ent\.?/i,          // Cep Ent.
  ];
  
  const addressMatchCount = addressPatterns.filter(p => p.test(headerText)).length;
  
  // Formato MB: Cliente + Peso Bruto + pelo menos 1 campo de endereço
  const isMBFormat = hasCliente && hasPesoBruto && addressMatchCount >= 1;
  
  console.log('[Itinerary Excel] Detection:', { 
    hasCliente, 
    hasPesoBruto, 
    addressMatchCount,
    isMBFormat,
    headers: headers.slice(0, 12).join(', ')
  });
  
  return isMBFormat;
}

/**
 * Detecta se Excel é formato de Detalhe das Vendas MB (ADV hierárquico)
 * Padrões: linhas com "Cliente:", "Venda Nº:", e colunas Qtde./Descrição
 */
export function isADVExcelFormat(rows: unknown[][]): boolean {
  const text = rows.map(r => r.map(c => String(c ?? '')).join(' ')).join('\n');
  
  const hasCliente = /cliente\s*:/i.test(text);
  const hasVenda = /venda\s*n[º°]?\s*:/i.test(text);
  const hasQtde = /qtde\.?/i.test(text) || /quantidade/i.test(text);
  const hasDescricao = /descri[çc][ãa]o/i.test(text);
  
  console.log('[ADV Excel] Detecção:', { hasCliente, hasVenda, hasQtde, hasDescricao });
  
  // Precisa ter Cliente + Venda + (Qtde ou Descrição)
  return hasCliente && hasVenda && (hasQtde || hasDescricao);
}

/**
 * Parse Excel do Relatório de Vendas MB (Itinerário)
 * Formato tabular com colunas: Venda, Cliente, Peso Bruto, End. Ent., etc
 * 
 * Mapeamento MB:
 * - Cliente: coluna "Cliente"
 * - Peso: coluna "Peso Bruto"
 * - Endereço: coluna "End. Ent."
 * - Bairro: coluna "Bairro Ent."
 * - Cidade: coluna "Cidade Ent."
 * - CEP: coluna "Cep Ent."
 */
export function parseItinerarioExcel(rows: unknown[][]): ItinerarioRecord[] {
  if (rows.length < 2) return [];
  
  console.log('[Itinerary Excel] =====================================');
  console.log('[Itinerary Excel] Iniciando parsing de', rows.length, 'linhas');
  
  // Encontrar header row - procurar em até 10 primeiras linhas
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowText = rows[i].map(c => String(c ?? '').toLowerCase()).join(' ');
    // Header precisa ter "cliente" E ("peso bruto" OU "end. ent.")
    if (/cliente/i.test(rowText) && (/peso\s*bruto/i.test(rowText) || /end\.?\s*ent\.?/i.test(rowText))) {
      headerRowIdx = i;
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    console.log('[Itinerary Excel] Header row not found');
    return [];
  }
  
  const headerRow = rows[headerRowIdx].map(c => normalizeText(String(c ?? '')).toLowerCase().trim());
  
  // DEBUG: Mostrar cada header com seu índice
  console.log('[Itinerary Excel] Header row index:', headerRowIdx);
  headerRow.forEach((h, idx) => {
    if (h) console.log('[Itinerary Excel] Header[' + idx + '] = "' + h + '"');
  });
  
  // Mapear colunas usando correspondência EXATA primeiro, depois regex
  let columnMap = {
    venda: findExactOrPattern(headerRow, ['venda'], [/^venda$/i]),
    cliente: findExactOrPattern(headerRow, ['cliente'], [/^cliente$/i, /nome/i, /razao/i]),
    pesoBruto: findExactOrPattern(headerRow, ['peso bruto'], [/peso\s*bruto/i]),
    endEnt: findExactOrPattern(headerRow, ['end. ent.', 'end ent', 'end. ent'], [/end\.?\s*ent\.?/i]),
    bairroEnt: findExactOrPattern(headerRow, ['bairro ent.', 'bairro ent', 'bairro ent.'], [/bairro\.?\s*ent\.?/i]),
    cidadeEnt: findExactOrPattern(headerRow, ['cidade ent.', 'cidade ent', 'cidade ent.'], [/cidade\.?\s*ent\.?/i]),
    cepEnt: findExactOrPattern(headerRow, ['cep ent.', 'cep ent', 'cep ent.'], [/cep\.?\s*ent\.?/i]),
  };
  
  // ========================================================================
  // FALLBACK CRÍTICO PARA PESO BRUTO - COLUNA G (Índice 5)
  // Se não encontrou "Peso Bruto" pelo nome, tentar índice conhecido do formato MB
  // ========================================================================
  if (columnMap.pesoBruto === -1) {
    console.warn('[Itinerary Excel] ⚠️ Peso Bruto NÃO encontrado pelo nome do header!');
    console.warn('[Itinerary Excel] Tentando fallback para COLUNA G (índice 5)...');
    
    // Verificar se coluna 5 existe e contém dados numéricos
    if (headerRow.length > 5) {
      const col5Header = headerRow[5];
      const col5FirstData = rows[headerRowIdx + 1]?.[5];
      
      console.log('[Itinerary Excel] Coluna 5 - Header raw:', col5Header);
      console.log('[Itinerary Excel] Coluna 5 - Primeiro dado:', col5FirstData, '(tipo:', typeof col5FirstData + ')');
      
      // Aceitar se o dado parece ser numérico (peso em kg)
      const isNumericData = typeof col5FirstData === 'number' || 
                            /^[\d.,]+$/.test(String(col5FirstData ?? '').trim());
      
      if (isNumericData) {
        columnMap.pesoBruto = 5;
        console.log('[Itinerary Excel] ✅ FALLBACK ATIVADO: Usando índice 5 como Peso Bruto');
      } else {
        console.error('[Itinerary Excel] ❌ Coluna 5 não parece conter pesos numéricos');
      }
    }
  }
  
  console.log('[Itinerary Excel] =====================================');
  console.log('[Itinerary Excel] MAPEAMENTO FINAL DE COLUNAS:');
  console.log('[Itinerary Excel]   Venda: índice', columnMap.venda, '-> valor do header:', headerRow[columnMap.venda] || '(não encontrado)');
  console.log('[Itinerary Excel]   Cliente: índice', columnMap.cliente, '-> valor do header:', headerRow[columnMap.cliente] || '(não encontrado)');
  console.log('[Itinerary Excel]   🎯 Peso Bruto: índice', columnMap.pesoBruto, '-> valor do header:', headerRow[columnMap.pesoBruto] || '(não encontrado)');
  console.log('[Itinerary Excel]   End. Ent.: índice', columnMap.endEnt, '-> valor do header:', headerRow[columnMap.endEnt] || '(não encontrado)');
  console.log('[Itinerary Excel]   Bairro Ent.: índice', columnMap.bairroEnt, '-> valor do header:', headerRow[columnMap.bairroEnt] || '(não encontrado)');
  console.log('[Itinerary Excel] =====================================');
  
  // Validar colunas mínimas: Cliente é obrigatório, e precisa ter Peso OU Endereço
  if (columnMap.cliente === -1) {
    console.log('[Itinerary Excel] ERRO: Missing Cliente column');
    return [];
  }
  
  if (columnMap.pesoBruto === -1 && columnMap.endEnt === -1) {
    console.log('[Itinerary Excel] ERRO: Missing both Peso Bruto and End. Ent.');
    return [];
  }
  
  const records: ItinerarioRecord[] = [];
  let totalWeightDebug = 0;
  let rowsProcessed = 0;
  
  // Processar linhas de dados (após header)
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Pular linhas vazias ou quase vazias
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
      continue;
    }
    
    const vendaId = columnMap.venda !== -1 ? String(row[columnMap.venda] ?? '').trim() : '';
    const clientName = columnMap.cliente !== -1 ? String(row[columnMap.cliente] ?? '').trim() : '';
    
    // Validar dados mínimos - precisa ter cliente
    if (!clientName) continue;
    
    rowsProcessed++;
    
    const address = columnMap.endEnt !== -1 ? String(row[columnMap.endEnt] ?? '').trim() : '';
    const neighborhood = columnMap.bairroEnt !== -1 ? String(row[columnMap.bairroEnt] ?? '').trim() : '';
    const city = columnMap.cidadeEnt !== -1 ? String(row[columnMap.cidadeEnt] ?? '').trim() : '';
    const cep = columnMap.cepEnt !== -1 ? String(row[columnMap.cepEnt] ?? '').trim() : '';
    
    // Obter valor raw do peso para debug
    const pesoRaw = columnMap.pesoBruto !== -1 ? row[columnMap.pesoBruto] : 0;
    
    // Converter peso (suporta formato BR e US)
    // Fazer cast para aceitar unknown do Excel
    const weight = parseExcelWeight(pesoRaw as string | number | null | undefined);
    totalWeightDebug += weight;
    
    // DEBUG: Log primeiros 10 registros com todos os detalhes
    if (rowsProcessed <= 10) {
      console.log('[Peso] Linha ' + i + ': raw="' + pesoRaw + '" (tipo=' + typeof pesoRaw + ') -> converted=' + weight + 'kg');
    }
    
    // Aceitar registros mesmo com peso 0 se tiver endereço válido
    if (weight <= 0 && !address) continue;
    
    records.push({
      venda_id: vendaId,
      client_name: normalizeText(clientName),
      address: normalizeText(address),
      neighborhood: normalizeText(neighborhood),
      city: normalizeText(city),
      cep: cep.replace(/\D/g, ''),
      weight_kg: weight,
    });
  }
  
  // VALIDAÇÃO CRÍTICA: Calcular e exibir peso total
  const calculatedTotalWeight = records.reduce((sum, r) => sum + r.weight_kg, 0);
  const avgWeight = records.length > 0 ? calculatedTotalWeight / records.length : 0;
  
  console.log('=====================================');
  console.log('🎯 VALIDAÇÃO FINAL DO PESO:');
  console.log('   Registros: ' + records.length);
  console.log('   PESO TOTAL: ' + calculatedTotalWeight.toFixed(2) + ' kg');
  console.log('   Peso em toneladas: ' + (calculatedTotalWeight / 1000).toFixed(2) + ' t');
  console.log('   Peso médio/registro: ' + avgWeight.toFixed(2) + ' kg');
  console.log('   Índice da coluna Peso Bruto: ' + columnMap.pesoBruto);
  console.log('=====================================');
  
  // ALERTA CRÍTICO se peso parecer errado
  if (records.length > 50 && calculatedTotalWeight < 1000) {
    console.error('❌ ERRO CRÍTICO: Peso total MUITO baixo!');
    console.error('   Isso indica que a coluna Peso Bruto não foi mapeada corretamente.');
    console.error('   Índice atual:', columnMap.pesoBruto);
    console.error('   Headers disponíveis:', headerRow.filter(h => h).join(', '));
  }
  
  // Alerta se peso parecer muito baixo para a quantidade de registros
  if (records.length > 10 && calculatedTotalWeight < 1000) {
    console.warn('[Itinerary Excel] ⚠️ ATENÇÃO: Peso total muito baixo para', records.length, 'registros!');
    console.warn('[Itinerary Excel] Verifique se a coluna Peso Bruto está mapeada corretamente.');
    console.warn('[Itinerary Excel] Índice atual do Peso Bruto:', columnMap.pesoBruto);
  }
  
  return records;
}

/**
 * Parse Excel do Detalhe das Vendas MB (ADV hierárquico)
 * Formato: linhas com "Cliente:", "Venda Nº:", seguidas de itens
 */
export function parseADVDetailExcel(rows: unknown[][]): ParsedOrder[] {
  console.log('[ADV Excel] Parsing', rows.length, 'rows');
  
  const orders: ParsedOrder[] = [];
  
  let currentClient = '';
  let currentVendaId = '';
  let currentItems: { product_name: string; weight_kg: number; quantity: number }[] = [];
  let inItemTable = false;
  let itemColumnMap: { descricao: number; qtde: number } | null = null;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    const rowText = row.map(c => String(c ?? '')).join(' ').trim();
    if (!rowText) continue;
    
    // Detectar linha de Cliente
    const clientMatch = rowText.match(/cliente\s*:\s*([A-ZÁÉÍÓÚÀÃÕÇÂÊÎÔÛÄËÏÖÜ\s\-\.]+?)(?:\s+\d{11,14})?$/i);
    if (clientMatch) {
      // Salvar pedido anterior se existir
      if (currentVendaId && currentItems.length > 0) {
        const totalWeight = currentItems.reduce((sum, item) => sum + item.weight_kg, 0);
        orders.push({
          pedido_id: currentVendaId,
          client_name: currentClient,
          address: '', // Será preenchido pelo cruzamento
          weight_kg: totalWeight,
          product_description: currentItems.map(i => i.product_name).join(', '),
          items: [...currentItems],
          isValid: false, // Sem endereço até cruzar
          error: 'Aguardando cruzamento com Relatório de Vendas',
        });
      }
      
      currentClient = normalizeText(clientMatch[1].trim());
      currentVendaId = '';
      currentItems = [];
      inItemTable = false;
      itemColumnMap = null;
      console.log('[ADV Excel] Cliente:', currentClient);
      continue;
    }
    
    // Detectar linha de Venda
    const vendaMatch = rowText.match(/venda\s*n[º°]?\s*:\s*(\d+)/i);
    if (vendaMatch) {
      // Salvar venda anterior do mesmo cliente
      if (currentVendaId && currentItems.length > 0) {
        const totalWeight = currentItems.reduce((sum, item) => sum + item.weight_kg, 0);
        orders.push({
          pedido_id: currentVendaId,
          client_name: currentClient,
          address: '',
          weight_kg: totalWeight,
          product_description: currentItems.map(i => i.product_name).join(', '),
          items: [...currentItems],
          isValid: false,
          error: 'Aguardando cruzamento com Relatório de Vendas',
        });
      }
      
      currentVendaId = vendaMatch[1];
      currentItems = [];
      inItemTable = false;
      itemColumnMap = null;
      console.log('[ADV Excel] Venda:', currentVendaId);
      continue;
    }
    
    // Detectar header de tabela de itens
    if (/descri[çc][ãa]o/i.test(rowText) && /qtde\.?|quantidade/i.test(rowText)) {
      inItemTable = true;
      // Mapear colunas de item
      const cells = row.map(c => String(c ?? '').toLowerCase());
      itemColumnMap = {
        descricao: cells.findIndex(c => /descri[çc][ãa]o/i.test(c)),
        qtde: cells.findIndex(c => /qtde\.?|quantidade/i.test(c)),
      };
      console.log('[ADV Excel] Item columns:', itemColumnMap);
      continue;
    }
    
    // Extrair item se estamos em uma tabela
    if (currentVendaId && inItemTable && itemColumnMap) {
      const descricao = itemColumnMap.descricao !== -1 ? String(row[itemColumnMap.descricao] ?? '').trim() : '';
      const qtdeStr = itemColumnMap.qtde !== -1 ? String(row[itemColumnMap.qtde] ?? '0') : '0';
      
      if (descricao && descricao.length > 2) {
        const weight = parseExcelWeight(qtdeStr);
        if (weight > 0) {
          currentItems.push({
            product_name: normalizeText(descricao),
            weight_kg: weight,
            quantity: 1,
          });
          console.log('[ADV Excel] Item:', descricao.substring(0, 30), weight, 'kg');
        }
      }
    }
    
    // Fallback: tentar extrair item por padrão de código + descrição + número
    if (currentVendaId && !itemColumnMap) {
      const itemMatch = rowText.match(/^\s*(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)/);
      if (itemMatch) {
        const [, , descricao, qtde] = itemMatch;
        const weight = parseExcelWeight(qtde);
        if (weight > 0) {
          currentItems.push({
            product_name: normalizeText(descricao.trim()),
            weight_kg: weight,
            quantity: 1,
          });
        }
      }
    }
  }
  
  // Processar último pedido
  if (currentVendaId && currentItems.length > 0) {
    const totalWeight = currentItems.reduce((sum, item) => sum + item.weight_kg, 0);
    orders.push({
      pedido_id: currentVendaId,
      client_name: currentClient,
      address: '',
      weight_kg: totalWeight,
      product_description: currentItems.map(i => i.product_name).join(', '),
      items: [...currentItems],
      isValid: false,
      error: 'Aguardando cruzamento com Relatório de Vendas',
    });
  }
  
  console.log('[ADV Excel] Total orders:', orders.length);
  return orders;
}

/**
 * Encontra o índice de uma coluna baseado em padrões (para Excel)
 */
function findExcelColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    for (const pattern of patterns) {
      if (pattern.test(headers[i])) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Parse peso de célula Excel (suporta formatos BR e US)
 * 
 * IMPORTANTE: O Excel pode retornar valores numéricos diretamente.
 * Esta função trata tanto números quanto strings.
 * 
 * Formatos suportados:
 * - Número direto: 224.55 (retorna como está)
 * - String BR: "1.234,56" -> 1234.56
 * - String US: "1,234.56" -> 1234.56
 * - String simples: "224,55" -> 224.55 ou "224.55" -> 224.55
 */
function parseExcelWeight(value: string | number | null | undefined): number {
  // Se é null ou undefined, retorna 0
  if (value === null || value === undefined) return 0;
  
  // Se já é número válido, retornar diretamente
  if (typeof value === 'number') {
    if (isNaN(value)) return 0;
    return value;
  }
  
  let str = String(value).trim();
  if (!str) return 0;
  
  // Remove sufixos de unidade
  str = str.replace(/\s*(kg|kilos?|quilos?)\s*$/i, '');
  
  // Detectar formato baseado em pontos e vírgulas
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    // Ambos presentes - determinar qual é o decimal
    const commaPos = str.lastIndexOf(',');
    const dotPos = str.lastIndexOf('.');
    
    if (commaPos > dotPos) {
      // Formato BR: 1.234,56 -> vírgula é decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56 -> ponto é decimal
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Apenas vírgula - verificar contexto
    const match = str.match(/,(\d+)$/);
    if (match && match[1].length === 3) {
      // Vírgula é separador de milhares: 1,234 -> 1234
      str = str.replace(/,/g, '');
    } else {
      // Vírgula é decimal: 224,55 -> 224.55
      str = str.replace(',', '.');
    }
  }
  // Se só tem ponto, parseFloat já trata corretamente
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
