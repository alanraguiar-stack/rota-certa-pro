/**
 * Detector Inteligente de Colunas
 * 
 * Identifica colunas pelo SIGNIFICADO do nome, não pela posição.
 * Procura ativamente por padrões semânticos relacionados a peso, cliente, endereço, etc.
 */

import { normalizeText } from '../encoding';
import {
  DetectedColumn,
  SemanticColumnType,
  ColumnMapping,
  SEMANTIC_KEYWORDS,
  SpreadsheetRow,
} from './types';

/**
 * Normalização super agressiva para encontrar headers
 * Remove TODOS os caracteres não-alfanuméricos
 * 
 * "Peso  Bruto" -> "pesobruto"
 * "Peso\u00A0Bruto" -> "pesobruto"
 * "End. Ent." -> "endent"
 */
export function superNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '');      // Remove tudo que não é letra/número
}

/**
 * Normalização padrão para comparação
 */
export function standardNormalize(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u00A0\u200B\uFEFF]/g, ' ')
    .trim();
}

/**
 * Detecta o tipo semântico de uma coluna pelo nome do header
 */
export function detectSemanticType(header: string): { type: SemanticColumnType; confidence: number } {
  const normalized = standardNormalize(header);
  const superNorm = superNormalize(header);
  
  // Verificar cada tipo semântico
  for (const [type, keywords] of Object.entries(SEMANTIC_KEYWORDS)) {
    for (const keyword of keywords) {
      const keywordNorm = standardNormalize(keyword);
      const keywordSuper = superNormalize(keyword);
      
      // Match exato
      if (normalized === keywordNorm) {
        return { type: type as SemanticColumnType, confidence: 100 };
      }
      
      // Match por super normalização
      if (superNorm === keywordSuper) {
        return { type: type as SemanticColumnType, confidence: 95 };
      }
      
      // Match por substring (ex: "peso bruto total" contém "peso bruto")
      if (normalized.includes(keywordNorm) || keywordNorm.includes(normalized)) {
        return { type: type as SemanticColumnType, confidence: 80 };
      }
      
      // Match por super normalização parcial
      if (superNorm.includes(keywordSuper) || keywordSuper.includes(superNorm)) {
        return { type: type as SemanticColumnType, confidence: 70 };
      }
    }
  }
  
  return { type: 'unknown', confidence: 0 };
}

/**
 * Detecta se uma coluna contém valores que parecem monetários
 * (valores altos com formato típico de dinheiro)
 */
export function isLikelyMonetaryColumn(values: (string | number)[]): boolean {
  let monetaryCount = 0;
  let totalCount = 0;
  
  for (const val of values) {
    if (val === null || val === undefined) continue;
    
    const str = String(val);
    totalCount++;
    
    // Padrões monetários: R$ 123,45 ou 1.234,56 (valores > 100 com 2 decimais)
    if (/R\$/.test(str) || /^\d{1,3}(\.\d{3})+,\d{2}$/.test(str)) {
      monetaryCount++;
      continue;
    }
    
    // Valores numéricos muito altos (> 1000) são provavelmente monetários
    const num = parseNumericValue(str);
    if (num > 1000 && num < 100000) {
      // Verificar se tem padrão de decimal típico de dinheiro
      if (/\d+[,\.]\d{2}$/.test(str)) {
        monetaryCount++;
      }
    }
  }
  
  return totalCount > 0 && (monetaryCount / totalCount) > 0.5;
}

/**
 * Detecta se uma coluna contém valores que parecem pesos válidos
 * (valores entre 1 e 5000 kg por linha)
 */
export function isLikelyWeightColumn(values: (string | number)[]): { isWeight: boolean; stats: { count: number; sum: number; average: number; min: number; max: number } } {
  const numericValues: number[] = [];
  
  for (const val of values) {
    if (val === null || val === undefined) continue;
    
    const num = parseNumericValue(String(val));
    if (num > 0 && num < 5000) { // Peso realista: 1g a 5 toneladas
      numericValues.push(num);
    }
  }
  
  if (numericValues.length < 5) {
    return { 
      isWeight: false, 
      stats: { count: 0, sum: 0, average: 0, min: 0, max: 0 } 
    };
  }
  
  const sum = numericValues.reduce((a, b) => a + b, 0);
  const average = sum / numericValues.length;
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  
  // Peso médio esperado: 10-500 kg por entrega
  const isWeight = average >= 1 && average <= 1500 && min >= 0.1 && max <= 5000;
  
  return {
    isWeight,
    stats: {
      count: numericValues.length,
      sum,
      average,
      min,
      max,
    },
  };
}

/**
 * Parse valor numérico de uma célula
 * Suporta formatos BR (1.234,56) e US (1,234.56)
 */
export function parseNumericValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  let str = String(value).trim();
  if (!str) return 0;
  
  // Remove sufixos de unidade
  str = str.replace(/\s*(kg|kilos?|quilos?|g|gramas?)\s*$/i, '');
  str = str.replace(/\s*(R\$|reais?)\s*/gi, '');
  
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    const commaPos = str.lastIndexOf(',');
    const dotPos = str.lastIndexOf('.');
    
    if (commaPos > dotPos) {
      // Formato BR: 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const match = str.match(/,(\d+)$/);
    if (match && match[1].length === 3) {
      // Vírgula é separador de milhares
      str = str.replace(/,/g, '');
    } else {
      // Vírgula é decimal
      str = str.replace(',', '.');
    }
  }
  
  // Remove caracteres não numéricos restantes (exceto ponto)
  str = str.replace(/[^\d.]/g, '');
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Analisa uma coluna e retorna informações detalhadas sobre ela
 */
export function analyzeColumn(
  index: number,
  headerRow: (string | number | null)[],
  dataRows: SpreadsheetRow[],
  sampleSize: number = 50
): DetectedColumn {
  const rawHeader = String(headerRow[index] ?? '');
  const normalizedHeader = standardNormalize(rawHeader);
  
  // Detectar tipo semântico pelo nome
  const { type: semanticType, confidence } = detectSemanticType(rawHeader);
  
  // Coletar valores de amostra
  const sampleValues: (string | number)[] = [];
  const sampleRows = dataRows.slice(0, sampleSize);
  
  for (const row of sampleRows) {
    if (!row.isEmpty && !row.isHeader && !row.isTotalization) {
      const cell = row.cells[index];
      if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
        sampleValues.push(cell);
      }
    }
  }
  
  // Calcular estatísticas numéricas se aplicável
  let numericStats: DetectedColumn['numericStats'];
  
  const weightAnalysis = isLikelyWeightColumn(sampleValues);
  if (weightAnalysis.stats.count > 0) {
    numericStats = weightAnalysis.stats;
  }
  
  return {
    index,
    rawHeader,
    normalizedHeader,
    semanticType,
    confidence,
    sampleValues,
    numericStats,
  };
}

/**
 * Encontra a melhor coluna de peso bruto
 * Usa múltiplos níveis de detecção com fallback progressivo
 */
export function findWeightColumn(columns: DetectedColumn[]): DetectedColumn | null {
  console.log('[ColumnDetector] Buscando coluna de peso...');
  
  // NÍVEL 1: Coluna com tipo semântico "weight_gross" e alta confiança
  const weightGrossColumns = columns.filter(
    c => c.semanticType === 'weight_gross' && c.confidence >= 70
  );
  
  if (weightGrossColumns.length > 0) {
    // Se houver múltiplas, escolher a com melhor estatística
    const sorted = weightGrossColumns.sort((a, b) => {
      // Preferir a com estatísticas de peso válidas
      if (a.numericStats && b.numericStats) {
        // Preferir média entre 50 e 500 kg
        const aScore = Math.abs(a.numericStats.average - 200);
        const bScore = Math.abs(b.numericStats.average - 200);
        return aScore - bScore;
      }
      return b.confidence - a.confidence;
    });
    
    console.log('[ColumnDetector] ✅ NÍVEL 1: Encontrada coluna "' + sorted[0].rawHeader + '" (índice ' + sorted[0].index + ')');
    return sorted[0];
  }
  
  // NÍVEL 2: Coluna cujo super-normalize contenha "peso" mas não seja monetária
  const pesoColumns = columns.filter(c => {
    const superNorm = superNormalize(c.rawHeader);
    if (!superNorm.includes('peso')) return false;
    
    // Excluir se parecer monetária
    if (c.sampleValues.length > 0 && isLikelyMonetaryColumn(c.sampleValues)) {
      console.log('[ColumnDetector] NÍVEL 2: Excluindo "' + c.rawHeader + '" - parece monetária');
      return false;
    }
    
    return true;
  });
  
  if (pesoColumns.length > 0) {
    console.log('[ColumnDetector] ✅ NÍVEL 2: Encontrada coluna "' + pesoColumns[0].rawHeader + '" (índice ' + pesoColumns[0].index + ')');
    return pesoColumns[0];
  }
  
  // NÍVEL 3: Buscar índice 5 (Coluna F) se formato MB
  const col5 = columns.find(c => c.index === 5);
  if (col5 && col5.numericStats) {
    const avg = col5.numericStats.average;
    if (avg >= 1 && avg <= 1500) {
      console.log('[ColumnDetector] ✅ NÍVEL 3: Usando índice 5 como peso (média: ' + avg.toFixed(2) + ' kg)');
      return col5;
    }
  }
  
  // NÍVEL 4: Encontrar coluna numérica com melhor perfil de peso
  // Excluir colunas monetárias e com headers monetários
  const candidates = columns.filter(c => {
    // Excluir colunas obviamente monetárias pelo nome
    if (c.semanticType === 'monetary_value') return false;
    if (c.semanticType === 'unit_price') return false;
    if (c.semanticType === 'total_value') return false;
    
    // Precisa ter estatísticas numéricas
    if (!c.numericStats) return false;
    
    // Excluir se parecer monetária pelos valores
    if (c.sampleValues.length > 0 && isLikelyMonetaryColumn(c.sampleValues)) return false;
    
    // Média deve estar em faixa realista de peso
    const avg = c.numericStats.average;
    return avg >= 1 && avg <= 1500;
  });
  
  if (candidates.length > 0) {
    // Ordenar por melhor perfil de peso (média mais próxima de 150 kg)
    const sorted = candidates.sort((a, b) => {
      const aScore = Math.abs(a.numericStats!.average - 150);
      const bScore = Math.abs(b.numericStats!.average - 150);
      return aScore - bScore;
    });
    
    console.log('[ColumnDetector] ✅ NÍVEL 4: Coluna heurística "' + sorted[0].rawHeader + '" (índice ' + sorted[0].index + ', média: ' + sorted[0].numericStats?.average.toFixed(2) + ' kg)');
    return sorted[0];
  }
  
  console.log('[ColumnDetector] ❌ Nenhuma coluna de peso encontrada');
  return null;
}

/**
 * Cria o mapeamento completo de colunas
 */
export function createColumnMapping(columns: DetectedColumn[]): ColumnMapping | null {
  // Encontrar coluna de cliente (obrigatório)
  const clientColumn = columns.find(c => 
    c.semanticType === 'client_name' && c.confidence >= 50
  );
  
  if (!clientColumn) {
    console.log('[ColumnDetector] ❌ Coluna de cliente não encontrada');
    return null;
  }
  
  // Encontrar coluna de peso (obrigatório)
  const weightColumn = findWeightColumn(columns);
  
  if (!weightColumn) {
    console.log('[ColumnDetector] ❌ Coluna de peso não encontrada');
    return null;
  }
  
  // Encontrar colunas de endereço (pelo menos uma é necessária)
  const findByType = (type: SemanticColumnType) =>
    columns.find(c => c.semanticType === type && c.confidence >= 50);
  
  const addressStreet = findByType('address_street');
  const addressNumber = findByType('address_number');
  const addressNeighborhood = findByType('address_neighborhood');
  const addressCity = findByType('address_city');
  const addressState = findByType('address_state');
  const addressCep = findByType('address_cep');
  const addressCombined = findByType('address_combined');
  
  const hasAddress = addressStreet || addressCombined;
  
  if (!hasAddress) {
    console.log('[ColumnDetector] ⚠️ Nenhuma coluna de endereço encontrada');
    // Continuar mesmo assim - pode ser um arquivo de detalhe que será cruzado
  }
  
  // Colunas opcionais
  const orderIdColumn = findByType('order_id');
  const productColumn = findByType('product_name');
  const quantityColumn = findByType('quantity');
  
  const mapping: ColumnMapping = {
    clientName: clientColumn.index,
    weightGross: weightColumn.index,
    orderId: orderIdColumn?.index,
    addressStreet: addressStreet?.index,
    addressNumber: addressNumber?.index,
    addressNeighborhood: addressNeighborhood?.index,
    addressCity: addressCity?.index,
    addressState: addressState?.index,
    addressCep: addressCep?.index,
    addressCombined: addressCombined?.index,
    productName: productColumn?.index,
    quantity: quantityColumn?.index,
  };
  
  console.log('[ColumnDetector] ✅ Mapeamento criado:', mapping);
  
  return mapping;
}
