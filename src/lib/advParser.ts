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
import { normalizeText, removeAccents } from './encoding';
import { inferUnitFromName } from '@/hooks/useProductUnits';

/** Strip accents, replacement chars, and lowercase for robust matching */
function normalizeForMatch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\ufffd/g, '').toLowerCase();
}

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
 * Normaliza nome do cliente para comparação
 * Remove acentos, espaços extras, converte para minúsculas
 */
function normalizeClientNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')            // Espaços múltiplos -> único
    .replace(/[^\w\s]/g, '')         // Remove pontuação
    .trim();
}

/**
 * Normaliza venda_id para comparação
 * Remove caracteres não numéricos e zeros à esquerda
 */
function normalizeVendaId(id: string): string {
  return id.replace(/\D/g, '').replace(/^0+/, '') || '0';
}

/**
 * Cruza dados do Itinerário (endereços) com o Relatório ADV (itens detalhados)
 * 
 * O ITINERÁRIO É A LISTA MESTRE — o resultado final terá exatamente o mesmo
 * número de registros do itinerário. O ADV enriquece com itens/produtos.
 * 
 * ESTRATÉGIA DE CRUZAMENTO:
 * 1. Match por venda_id normalizado (sem zeros à esquerda)
 * 2. Fallback por nome do cliente normalizado (exato)
 * Se não encontrar match, o registro do itinerário é preservado sem itens.
 */
export function mergeItinerarioWithADV(
  itinerario: ItinerarioRecord[],
  advOrders: ParsedOrder[]
): ParsedOrder[] {
  console.log('[Merge] ═══════════════════════════════════════════════');
  console.log('[Merge] Iniciando cruzamento (Itinerário = lista mestre)');
  console.log('[Merge] Itinerário:', itinerario.length, 'registros');
  console.log('[Merge] ADV:', advOrders.length, 'pedidos');
  
  // MAPA do ADV por venda_id normalizado
  const advByIdMap = new Map<string, ParsedOrder>();
  for (const order of advOrders) {
    const normalizedId = normalizeVendaId(order.pedido_id || '');
    if (normalizedId) {
      advByIdMap.set(normalizedId, order);
    }
  }
  
  // MAPA do ADV por nome do cliente normalizado (fallback)
  const advByClientMap = new Map<string, ParsedOrder>();
  for (const order of advOrders) {
    if (order.client_name) {
      const normalizedName = normalizeClientNameForMatch(order.client_name);
      if (!advByClientMap.has(normalizedName)) {
        advByClientMap.set(normalizedName, order);
      }
    }
  }
  
  console.log('[Merge] Mapa ADV por ID:', advByIdMap.size, 'entradas');
  console.log('[Merge] Mapa ADV por Cliente:', advByClientMap.size, 'entradas');
  
  let matchedById = 0;
  let matchedByClient = 0;
  let unmatchedCount = 0;
  const usedAdvIds = new Set<string>();
  
  // Iterar sobre o ITINERÁRIO (lista mestre)
  const mergedOrders: ParsedOrder[] = itinerario.map(record => {
    // Construir endereço completo a partir do itinerário
    const addressParts = [
      record.address,
      record.neighborhood,
      record.city,
    ].filter(Boolean);
    if (record.cep) {
      addressParts.push(formatCEP(record.cep));
    }
    const fullAddress = addressParts.join(', ');
    
    // NÍVEL 1: Match por venda_id normalizado
    const normalizedId = normalizeVendaId(record.venda_id);
    let advOrder = advByIdMap.get(normalizedId);
    let matchType = 'id';
    
    if (advOrder) {
      const advKey = normalizeVendaId(advOrder.pedido_id || '');
      if (usedAdvIds.has(advKey)) {
        advOrder = undefined; // Já foi usado
      } else {
        usedAdvIds.add(advKey);
      }
    }
    
    // NÍVEL 2: Fallback por nome do cliente normalizado
    if (!advOrder && record.client_name) {
      const normalizedName = normalizeClientNameForMatch(record.client_name);
      const candidate = advByClientMap.get(normalizedName);
      if (candidate) {
        const candidateKey = normalizeVendaId(candidate.pedido_id || '') || normalizeClientNameForMatch(candidate.client_name || '');
        if (!usedAdvIds.has(candidateKey)) {
          advOrder = candidate;
          usedAdvIds.add(candidateKey);
          matchType = 'client';
          console.log('[Merge] Fallback por cliente:', record.client_name, '->', candidate.pedido_id);
        }
      }
    }
    
    if (advOrder) {
      if (matchType === 'id') matchedById++;
      else matchedByClient++;
      
      console.log('[Merge] ✅ Match (' + matchType + '):', record.venda_id, '|', record.client_name?.substring(0, 20), '->', fullAddress.substring(0, 40));
      
      return {
        ...advOrder,
        pedido_id: record.venda_id || advOrder.pedido_id,
        address: fullAddress,
        city: record.city || undefined,
        // Peso do itinerário é a fonte oficial
        weight_kg: record.weight_kg > 0 ? record.weight_kg : advOrder.weight_kg,
        isValid: fullAddress.length > 0,
        error: fullAddress.length > 0 ? undefined : 'Endereço não encontrado',
      };
    }
    
    // Sem match no ADV — criar pedido só com dados do itinerário
    unmatchedCount++;
    console.log('[Merge] ⚠️ Sem match ADV:', record.venda_id, '|', record.client_name?.substring(0, 25), '- usando só itinerário');
    
    return {
      pedido_id: record.venda_id,
      client_name: record.client_name,
      address: fullAddress,
      city: record.city || undefined,
      weight_kg: record.weight_kg,
      product_description: 'Sem itens detalhados',
      items: [],
      isValid: fullAddress.length > 0,
      error: fullAddress.length > 0 ? undefined : 'Endereço não encontrado',
    };
  });
  
  // Log de pedidos ADV que não encontraram correspondência no itinerário (informativo)
  const unmatchedAdv = advOrders.filter(o => {
    const key = normalizeVendaId(o.pedido_id || '');
    return key && !usedAdvIds.has(key);
  });
  if (unmatchedAdv.length > 0) {
    console.log('[Merge] ℹ️ Pedidos ADV sem correspondência no itinerário:', unmatchedAdv.length);
    unmatchedAdv.forEach(o => {
      console.log('[Merge]   -', o.pedido_id, '|', o.client_name?.substring(0, 25));
    });
  }

  console.log('[Merge] ═══════════════════════════════════════════════');
  console.log('[Merge] RESULTADO:');
  console.log('[Merge]   Cruzados por ID:', matchedById);
  console.log('[Merge]   Cruzados por Cliente:', matchedByClient);
  console.log('[Merge]   Sem match ADV (só itinerário):', unmatchedCount);
  console.log('[Merge]   Total final:', mergedOrders.length, '(= itinerário:', itinerario.length, ')');
  console.log('[Merge] ═══════════════════════════════════════════════');
  
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
      city: record.city || undefined,
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
 * Normalização SUPER AGRESSIVA para encontrar headers
 * Remove TODOS os caracteres não-alfanuméricos
 * "Peso  Bruto" -> "pesobruto"
 * "Peso\u00A0Bruto" -> "pesobruto"
 * "Peso Bruto " -> "pesobruto"
 */
function superNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '');      // Remove tudo que não é letra/número
}

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
  
  // SUPER normalização para fallback
  const superNormalizedHeaders = headers.map(h => superNormalize(h));
  
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
  
  // Segundo: correspondência por super normalização (remove todos caracteres especiais)
  for (const exact of exactMatches) {
    const superNormalizedExact = superNormalize(exact);
    
    for (let i = 0; i < superNormalizedHeaders.length; i++) {
      if (superNormalizedHeaders[i] === superNormalizedExact) {
        console.log('[findExactOrPattern] Match super-normalizado: "' + headers[i] + '" -> "' + superNormalizedHeaders[i] + '" no índice ' + i);
        return i;
      }
    }
  }
  
  // Terceiro: correspondência por padrão regex
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
  
  // Também testar com super normalização
  const superNormalizedText = headers.map(h => superNormalize(String(h ?? ''))).join(' ');
  
  // Padrões obrigatórios do formato MB
  const hasCliente = /cliente/i.test(headerText);
  const hasPesoBruto = /peso\s*bruto/i.test(headerText) || superNormalizedText.includes('pesobruto');
  
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
 * 
 * IMPORTANTE: Esta função detecta formatos hierárquicos que NÃO devem ser
 * processados pelo motor inteligente linha-por-linha.
 */
export function isADVExcelFormat(rows: unknown[][]): boolean {
  // Analisar apenas as primeiras 50 linhas para performance
  const sampleRows = rows.slice(0, 50);
  const text = sampleRows.map(r => r.map(c => String(c ?? '')).join(' ')).join('\n');
  
  // Padrões de estrutura hierárquica
  const hasClienteMarker = /cliente\s*:/i.test(text);
  const hasVendaMarker = /venda\s*n[º°]?\s*:/i.test(text);
  
  // Padrões de tabela de itens
  const hasQtde = /qtde\.?/i.test(text) || /quantidade/i.test(text);
  const hasDescricao = /descri[çc][ãa]o/i.test(text);
  const hasProduto = /produto/i.test(text);
  const hasCodigo = /c[óo]digo/i.test(text);
  
  // Padrões adicionais de detalhe de vendas
  const hasNFe = /nfe?\s*n[º°]?\s*:/i.test(text);
  const hasData = /data\s*:/i.test(text);
  
  // Contar quantas linhas têm marcadores hierárquicos
  let clienteMarkerCount = 0;
  let vendaMarkerCount = 0;
  for (const row of sampleRows) {
    const rowText = row.map(c => String(c ?? '')).join(' ');
    if (/cliente\s*:/i.test(rowText)) clienteMarkerCount++;
    if (/venda\s*n[º°]?\s*:/i.test(rowText)) vendaMarkerCount++;
  }
  
  console.log('[ADV Excel] Detecção de formato hierárquico:', { 
    hasClienteMarker, 
    hasVendaMarker, 
    hasQtde, 
    hasDescricao,
    hasProduto,
    hasCodigo,
    hasNFe,
    hasData,
    clienteMarkerCount,
    vendaMarkerCount
  });
  
  // DETECÇÃO PRINCIPAL: Cliente + Venda + (Qtde ou Descrição ou Produto)
  const isHierarchical = hasClienteMarker && hasVendaMarker && (hasQtde || hasDescricao || hasProduto);
  
  // DETECÇÃO ALTERNATIVA: Múltiplos marcadores de cliente/venda indicam estrutura hierárquica
  const hasMultipleMarkers = clienteMarkerCount >= 2 || vendaMarkerCount >= 2;
  
  const isADV = isHierarchical || (hasMultipleMarkers && (hasQtde || hasDescricao));
  
  console.log('[ADV Excel] Resultado:', isADV ? '✅ É formato ADV hierárquico' : '❌ Não é ADV');
  
  return isADV;
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
    const superNormalizedRow = rows[i].map(c => superNormalize(String(c ?? ''))).join(' ');
    
    // Header precisa ter "cliente" E ("peso bruto" OU "end. ent.")
    const hasCliente = /cliente/i.test(rowText);
    const hasPeso = /peso\s*bruto/i.test(rowText) || superNormalizedRow.includes('pesobruto');
    const hasEnd = /end\.?\s*ent\.?/i.test(rowText);
    
    if (hasCliente && (hasPeso || hasEnd)) {
      headerRowIdx = i;
      break;
    }
  }
  
  if (headerRowIdx === -1) {
    console.log('[Itinerary Excel] Header row not found');
    return [];
  }
  
  const headerRow = rows[headerRowIdx].map(c => normalizeText(String(c ?? '')).toLowerCase().trim());
  
  // DEBUG: Mostrar cada header com seu índice e valor raw
  console.log('[Itinerary Excel] Header row index:', headerRowIdx);
  console.log('[Itinerary Excel] ===== HEADERS COM ÍNDICES =====');
  headerRow.forEach((h, idx) => {
    const rawValue = rows[headerRowIdx][idx];
    const superNorm = superNormalize(h);
    console.log(`[Itinerary Excel] Header[${idx}] = "${h}" | super="${superNorm}" | raw=${typeof rawValue === 'string' ? '"' + rawValue + '"' : rawValue}`);
  });
  console.log('[Itinerary Excel] ================================');
  
  // Detectar se é formato MB (para priorizar índice 5)
  const isMBFormat = headerRow.some(h => h.includes('cliente')) && 
                     headerRow.some(h => superNormalize(h).includes('pesobruto') || h.includes('peso'));
  
  console.log('[Itinerary Excel] Formato MB detectado:', isMBFormat);
  
  // Mapear colunas usando correspondência EXATA primeiro, depois regex
  let columnMap = {
    venda: findExactOrPattern(headerRow, ['venda'], [/^venda$/i]),
    cliente: findExactOrPattern(headerRow, ['cliente'], [/^cliente$/i, /nome/i, /razao/i]),
    pesoBruto: findExactOrPattern(headerRow, ['peso bruto', 'pesobruto'], [/peso\s*bruto/i]),
    endEnt: findExactOrPattern(headerRow, ['end. ent.', 'end ent', 'end. ent'], [/end\.?\s*ent\.?/i]),
    bairroEnt: findExactOrPattern(headerRow, ['bairro ent.', 'bairro ent', 'bairro ent.'], [/bairro\.?\s*ent\.?/i]),
    cidadeEnt: findExactOrPattern(headerRow, ['cidade ent.', 'cidade ent', 'cidade ent.'], [/cidade\.?\s*ent\.?/i]),
    cepEnt: findExactOrPattern(headerRow, ['cep ent.', 'cep ent', 'cep ent.'], [/cep\.?\s*ent\.?/i]),
  };
  
  // ========================================================================
  // SISTEMA DE 5 NÍVEIS PARA DETECÇÃO DE COLUNA DE PESO BRUTO
  // ========================================================================
  
  // NÍVEL 1: Já foi encontrado pelo nome? (linha anterior)
  if (columnMap.pesoBruto !== -1) {
    console.log('[Itinerary Excel] ✅ NÍVEL 1: Peso Bruto encontrado pelo nome no índice', columnMap.pesoBruto);
  }
  
  // NÍVEL 1.5: Procurar por super normalização (pesobruto)
  if (columnMap.pesoBruto === -1) {
    console.log('[Itinerary Excel] ⚠️ NÍVEL 1 falhou. Tentando super-normalização...');
    for (let i = 0; i < headerRow.length; i++) {
      if (superNormalize(headerRow[i]) === 'pesobruto') {
        columnMap.pesoBruto = i;
        console.log('[Itinerary Excel] ✅ NÍVEL 1.5: Encontrou "pesobruto" via super-normalização no índice', i);
        break;
      }
    }
  }
  
  // NÍVEL 2: Procurar por qualquer coluna contendo "peso"
  if (columnMap.pesoBruto === -1) {
    console.warn('[Itinerary Excel] ⚠️ NÍVEL 1.5 falhou. Tentando NÍVEL 2: busca por "peso"...');
    const pesoIdx = headerRow.findIndex(h => h && h.includes('peso'));
    if (pesoIdx !== -1) {
      columnMap.pesoBruto = pesoIdx;
      console.log('[Itinerary Excel] ✅ NÍVEL 2: Encontrou coluna com "peso" no índice', pesoIdx);
    }
  }
  
  // NÍVEL 3: PRIORIDADE para formato MB - usar índice 5 (Coluna F) ANTES da heurística
  if (columnMap.pesoBruto === -1 && isMBFormat && headerRow.length > 5) {
    console.warn('[Itinerary Excel] ⚠️ NÍVEL 2 falhou. Tentando NÍVEL 3: índice 5 (Coluna F do formato MB)...');
    
    // Coletar valores da coluna 5 para validação
    const col5Values: number[] = [];
    for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 15, rows.length); i++) {
      const val = parseExcelWeight(rows[i]?.[5] as string | number | null | undefined);
      if (val > 0) col5Values.push(val);
    }
    
    console.log('[Itinerary Excel] Coluna 5 - Valores encontrados:', col5Values.length);
    console.log('[Itinerary Excel] Coluna 5 - Primeiros valores:', col5Values.slice(0, 5));
    
    if (col5Values.length >= 5) {
      const avgCol5 = col5Values.reduce((a, b) => a + b, 0) / col5Values.length;
      const minVal = Math.min(...col5Values);
      const maxVal = Math.max(...col5Values);
      
      console.log('[Itinerary Excel] Coluna 5 - Média:', avgCol5.toFixed(2), 'Min:', minVal.toFixed(2), 'Max:', maxVal.toFixed(2));
      
      // Validar: valores devem estar entre 1 e 2000 kg (realistas para entregas)
      if (avgCol5 >= 1 && avgCol5 <= 1500 && minVal >= 0.1 && maxVal <= 5000) {
        columnMap.pesoBruto = 5;
        console.log('[Itinerary Excel] ✅ NÍVEL 3: Forçando índice 5 como Peso Bruto - média:', avgCol5.toFixed(2), 'kg');
      } else {
        console.log('[Itinerary Excel] ⚠️ Coluna 5 tem valores fora do range esperado de peso (1-1500 kg)');
      }
    }
  }
  
  // NÍVEL 4: ÚLTIMO RECURSO - Encontrar coluna numérica com maior soma
  // MAS EXCLUIR colunas que parecem ser valores monetários!
  if (columnMap.pesoBruto === -1) {
    console.warn('[Itinerary Excel] ⚠️ NÍVEL 3 falhou. Tentando NÍVEL 4: detecção heurística...');
    
    // Headers que indicam valores MONETÁRIOS (não são peso!)
    const monetaryHeaders = ['total', 'valor', 'preco', 'preço', 'r$', 'reais', 'subtotal', 'unitario', 'unitário'];
    
    let maxSum = 0;
    let maxSumIdx = -1;
    const columnAnalysis: Array<{idx: number, header: string, sum: number, count: number, avg: number}> = [];
    
    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const header = headerRow[colIdx] || '';
      
      // IMPORTANTE: Pular colunas que parecem ser valores monetários!
      if (monetaryHeaders.some(m => header.includes(m))) {
        console.log('[Itinerary Excel] NÍVEL 4: Pulando coluna', colIdx, '("' + header + '") - parece ser valor monetário');
        continue;
      }
      
      let colSum = 0;
      let numericCount = 0;
      
      for (let rowIdx = headerRowIdx + 1; rowIdx < Math.min(rows.length, headerRowIdx + 50); rowIdx++) {
        const val = rows[rowIdx]?.[colIdx];
        if (typeof val === 'number' && val > 0 && val < 5000) {
          colSum += val;
          numericCount++;
        } else if (typeof val === 'string') {
          const num = parseExcelWeight(val);
          // Filtrar valores que parecem monetários (muito altos para peso individual)
          if (num > 0 && num < 5000) {
            colSum += num;
            numericCount++;
          }
        }
      }
      
      if (numericCount > 5) {
        const avg = colSum / numericCount;
        columnAnalysis.push({ idx: colIdx, header, sum: colSum, count: numericCount, avg });
        
        // Preferir colunas com média realista de peso (1-1500 kg)
        // E que tenham muitos valores numéricos
        if (numericCount >= 10 && avg >= 1 && avg <= 1500 && colSum > maxSum) {
          maxSum = colSum;
          maxSumIdx = colIdx;
        }
      }
    }
    
    console.log('[Itinerary Excel] NÍVEL 4 - Análise de colunas numéricas (excluindo monetárias):');
    columnAnalysis.forEach(c => {
      console.log(`  [${c.idx}] "${c.header}": soma=${c.sum.toFixed(2)}, count=${c.count}, média=${c.avg.toFixed(2)}kg`);
    });
    
    if (maxSumIdx !== -1) {
      columnMap.pesoBruto = maxSumIdx;
      const selected = columnAnalysis.find(c => c.idx === maxSumIdx);
      console.log('[Itinerary Excel] ✅ NÍVEL 4: Coluna', maxSumIdx, 'selecionada (header:', headerRow[maxSumIdx], ', soma:', maxSum.toFixed(2), ', média:', selected?.avg.toFixed(2) + 'kg)');
    } else {
      console.error('[Itinerary Excel] ❌ TODOS OS NÍVEIS FALHARAM! Não foi possível encontrar coluna de peso.');
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
  
  // VALIDAÇÃO: Verificar se o peso médio faz sentido
  if (records.length > 0) {
    if (avgWeight < 10) {
      console.error('⚠️ PESO MÉDIO SUSPEITO:', avgWeight.toFixed(2), 'kg - muito baixo!');
      console.error('   Isso pode indicar coluna errada ou formato de número incorreto');
      console.error('   Esperado: entre 50-500 kg por entrega');
    } else if (avgWeight > 2000) {
      console.error('⚠️ PESO MÉDIO SUSPEITO:', avgWeight.toFixed(2), 'kg - muito alto!');
      console.error('   Isso pode indicar que a coluna "Total" (R$) foi selecionada em vez de "Peso Bruto"');
      console.error('   Esperado: entre 50-500 kg por entrega');
    } else {
      console.log('✅ Peso médio OK:', avgWeight.toFixed(2), 'kg/entrega');
    }
  }
  
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
 * 
 * ROBUSTO: Mapeia múltiplas colunas candidatas (código, descrição, unidade, qtde, unitário, total)
 * e usa fallbacks quando a coluna principal de quantidade está vazia ou inválida.
 */
export function parseADVDetailExcel(rows: unknown[][]): ParsedOrder[] {
  console.log('[ADV Excel] Parsing', rows.length, 'rows');
  
  const orders: ParsedOrder[] = [];
  const seenVendaIds = new Set<string>();
  
  let currentClient = '';
  let currentVendaId = '';
  let currentItems: { product_name: string; weight_kg: number; quantity: number }[] = [];
  let inItemTable = false;
  let itemColumnMap: {
    codigo: number;
    descricao: number;
    unidade: number;
    qtde: number;
    unitario: number;
    total: number;
  } | null = null;
  
  // Helper: salva o pedido atual se tiver venda válida
  const flushCurrentOrder = () => {
    if (currentVendaId) {
      const totalWeight = currentItems.reduce((sum, item) => sum + item.weight_kg, 0);
      if (currentItems.length === 0) {
        console.log('[ADV Excel] ⚠️ Venda sem itens válidos:', currentVendaId, '- Cliente:', currentClient);
      }
      // Deduplicar: se a mesma venda já foi registrada, agregar itens
      const existingIdx = orders.findIndex(o => o.pedido_id === currentVendaId);
      if (existingIdx !== -1) {
        console.log('[ADV Excel] ℹ️ Venda duplicada:', currentVendaId, '- agregando itens ao pedido existente');
        const existing = orders[existingIdx];
        const mergedItems = [...(existing.items || []), ...currentItems];
        const mergedWeight = mergedItems.reduce((sum, item) => sum + item.weight_kg, 0);
        orders[existingIdx] = {
          ...existing,
          weight_kg: mergedWeight,
          product_description: mergedItems.length > 0 ? mergedItems.map(i => i.product_name).join(', ') : 'Sem itens detalhados',
          items: mergedItems,
        };
      } else {
        orders.push({
          pedido_id: currentVendaId,
          client_name: currentClient,
          address: '',
          weight_kg: totalWeight,
          product_description: currentItems.length > 0 ? currentItems.map(i => i.product_name).join(', ') : 'Sem itens detalhados',
          items: [...currentItems],
          isValid: false,
          error: 'Aguardando cruzamento com Relatório de Vendas',
        });
      }
      seenVendaIds.add(currentVendaId);
    }
  };
  
  // Helper: check if a row looks like a footer/subtotal/total
  const isFooterOrTotal = (text: string): boolean => {
    const norm = text.toLowerCase();
    return /^\s*(total|sub\s*total|observa|obs\s*:|---)/i.test(norm) ||
           /total\s*(geral|cliente|venda)/i.test(norm);
  };

  // Helper: check if row is a repeated header
  const isRepeatedHeader = (text: string): boolean => {
    const norm = normalizeForMatch(text);
    return /descri.?[ao]/.test(norm) && /qtde\.?|quantidade/.test(norm);
  };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    
    const rowText = row.map(c => String(c ?? '')).join(' ').trim();
    if (!rowText) continue;
    
    // Detectar linha de Cliente
    const normalizedRowText = normalizeForMatch(rowText);
    
    const clientMatch = normalizedRowText.match(/cliente\s*:\s*([a-z\s\-\.]+?)(?:\s+\d{11,14})?$/i);
    if (clientMatch) {
      flushCurrentOrder();
      const origMatch = rowText.match(/[Cc]liente\s*:\s*(.+?)(?:\s+\d{11,14})?$/);
      const clientName = origMatch ? origMatch[1].trim() : clientMatch[1].trim();
      currentClient = normalizeText(clientName);
      currentVendaId = '';
      currentItems = [];
      inItemTable = false;
      itemColumnMap = null;
      console.log('[ADV Excel] Cliente:', currentClient);
      continue;
    }
    
    // Detectar linha de Venda — PRIORIZAR coluna F (índice 5)
    let vendaDetected = false;
    
    // MÉTODO 1: Coluna F (índice 5) contém número de venda puro
    if (row.length > 5) {
      const colF = String(row[5] ?? '').trim();
      const col0 = String(row[0] ?? '').toLowerCase();
      if (/^\d{5,}$/.test(colF) && /venda/i.test(col0)) {
        flushCurrentOrder();
        currentVendaId = colF;
        currentItems = [];
        inItemTable = false;
        itemColumnMap = null;
        vendaDetected = true;
        console.log('[ADV Excel] Venda (col F):', currentVendaId);
      }
    }
    
    // MÉTODO 2: Fallback — regex no texto concatenado
    if (!vendaDetected) {
      const vendaMatch = normalizedRowText.match(/venda\s*n[o]?\s*:?\s*(\d+)/i) || rowText.match(/venda\s*n[º°]?\s*:\s*(\d+)/i);
      if (vendaMatch) {
        flushCurrentOrder();
        currentVendaId = vendaMatch[1];
        currentItems = [];
        inItemTable = false;
        itemColumnMap = null;
        vendaDetected = true;
        console.log('[ADV Excel] Venda (regex):', currentVendaId);
      }
    }
    
    if (vendaDetected) continue;
    
    // Detectar header de tabela de itens — map ALL candidate columns
    if (/descri.?[ao]/i.test(normalizedRowText) && (/qtde\.?|quantidade/i.test(normalizedRowText) || /total/i.test(normalizedRowText))) {
      inItemTable = true;
      const cells = row.map(c => normalizeForMatch(String(c ?? '')));
      itemColumnMap = {
        codigo: cells.findIndex(c => /^cod(igo)?$/.test(c) || /codigo/.test(c)),
        descricao: cells.findIndex(c => /descri.?[ao]/.test(c)),
        unidade: cells.findIndex(c => /^un(id(ade)?)?\.?$/.test(c) || /unidade/.test(c)),
        qtde: cells.findIndex(c => /qtde\.?|quantidade/.test(c)),
        unitario: cells.findIndex(c => /unit[aá]rio/.test(c) || /vlr?\s*unit/.test(c)),
        total: cells.findIndex(c => /^total$/.test(c) || /vlr?\s*total/.test(c)),
      };
      console.log('[ADV Excel] Item columns (full map):', itemColumnMap);
      console.log('[ADV Excel] Header cells:', cells.filter(c => c).join(' | '));
      continue;
    }
    
    // Extrair item se estamos em uma tabela
    if (currentVendaId && inItemTable && itemColumnMap) {
      // Skip footers/totals/repeated headers
      if (isFooterOrTotal(rowText) || isRepeatedHeader(rowText)) {
        console.log('[ADV Excel] Skipping footer/header line:', rowText.substring(0, 50));
        continue;
      }
      
      const descricao = itemColumnMap.descricao !== -1 ? String(row[itemColumnMap.descricao] ?? '').trim() : '';
      
      // Skip empty/short descriptions or rows that are clearly not items
      if (!descricao || descricao.length < 3) {
        // Check if all cells are empty — means end of table section
        const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
        if (nonEmpty.length <= 1) {
          console.log('[ADV Excel] Empty row in item table at line', i, '- continuing');
          continue;
        }
        console.log('[ADV Excel] ⏭ Skipped line', i, '- no valid description. Row:', rowText.substring(0, 60));
        continue;
      }
      
      // ===================================================================
      // ROBUST QUANTITY/WEIGHT EXTRACTION with multiple fallbacks
      // ===================================================================
      let qty = 0;
      let extractionSource = '';
      
      // ATTEMPT 1: Primary qtde column
      if (itemColumnMap.qtde !== -1) {
        qty = parseExcelWeight(row[itemColumnMap.qtde] as string | number | null | undefined);
        if (qty > 0) extractionSource = 'qtde';
      }
      
      // ATTEMPT 2: Try total column (often has the total weight/value)
      if (qty === 0 && itemColumnMap.total !== -1) {
        const totalVal = parseExcelWeight(row[itemColumnMap.total] as string | number | null | undefined);
        if (totalVal > 0) {
          qty = totalVal;
          extractionSource = 'total';
        }
      }
      
      // ATTEMPT 3: Scan ALL numeric cells adjacent to description
      if (qty === 0) {
        const numericValues: { idx: number; val: number }[] = [];
        for (let ci = 0; ci < row.length; ci++) {
          if (ci === itemColumnMap.descricao || ci === itemColumnMap.codigo) continue;
          const val = parseExcelWeight(row[ci] as string | number | null | undefined);
          if (val > 0) {
            numericValues.push({ idx: ci, val });
          }
        }
        // Pick the first plausible numeric value (usually quantity comes before price)
        if (numericValues.length > 0) {
          qty = numericValues[0].val;
          extractionSource = `fallback-col-${numericValues[0].idx}`;
        }
      }
      
      // ATTEMPT 4: Regex on concatenated row text (reuse PDF extractItem logic)
      if (qty === 0) {
        const cleanLine = rowText.replace(/[|│]/g, ' ').trim();
        const regexMatch = cleanLine.match(/\s+([\d]+[,.][\d]+)\s+/);
        if (regexMatch) {
          qty = parseExcelWeight(regexMatch[1]);
          extractionSource = 'regex-line';
        }
      }
      
      // FINAL: Accept item even with qty=0 if we have a description (use qty=1 as fallback)
      if (qty === 0) {
        qty = 1; // Default: at least 1 unit
        extractionSource = 'default-1';
        console.log('[ADV Excel] ⚠️ No numeric value found for item, defaulting to qty=1:', descricao.substring(0, 40));
      }
      
      // Determine if this is weight or unit-count based
      // If we have a unidade column, use it to decide; otherwise infer from product name
      let unitType = '';
      if (itemColumnMap.unidade !== -1) {
        unitType = String(row[itemColumnMap.unidade] ?? '').trim().toLowerCase();
      }
      
      // If no unit column or empty, infer from product name
      if (!unitType) {
        unitType = inferUnitFromName(descricao);
      }
      
      // Decide weight_kg vs quantity based on unit
      const isWeightBased = /^(kg|g|kilo|quilo)s?$/i.test(unitType);
      const itemWeightKg = isWeightBased ? qty : 0;
      const itemQuantity = isWeightBased ? 1 : qty;
      
      currentItems.push({
        product_name: normalizeText(descricao),
        weight_kg: itemWeightKg,
        quantity: isWeightBased ? 1 : (itemQuantity > 0 ? itemQuantity : 1),
      });
      console.log('[ADV Excel] ✅ Item:', descricao.substring(0, 35), '| qty:', qty, '| source:', extractionSource, '| unit:', unitType || 'N/A');
      continue;
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
          console.log('[ADV Excel] ✅ Item (fallback regex):', descricao.substring(0, 35), weight, 'kg');
        }
      }
    }
  }
  
  // Processar último pedido
  flushCurrentOrder();
  
  // Summary stats
  const totalItems = orders.reduce((s, o) => s + (o.items?.length || 0), 0);
  const ordersWithItems = orders.filter(o => o.items && o.items.length > 0).length;
  const ordersWithoutItems = orders.length - ordersWithItems;
  console.log('[ADV Excel] ═══════════════════════════════════════');
  console.log('[ADV Excel] RESULTADO FINAL:');
  console.log('[ADV Excel]   Pedidos:', orders.length, '(vendas únicas:', seenVendaIds.size, ')');
  console.log('[ADV Excel]   Total itens:', totalItems);
  console.log('[ADV Excel]   Com itens:', ordersWithItems, '| Sem itens:', ordersWithoutItems);
  console.log('[ADV Excel] ═══════════════════════════════════════');
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
