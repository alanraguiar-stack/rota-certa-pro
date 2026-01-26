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
import { extractRawTextFromPDF } from './pdfParser';
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
  
  console.log('[ADV Parser] Detecção de formato - Matches:', matchCount);
  
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
