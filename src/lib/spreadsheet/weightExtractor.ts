/**
 * Extrator Robusto de Peso
 * 
 * Especializado em extrair valores de peso de células, tratando:
 * - Formatos numéricos BR e US
 * - Valores com unidades (kg, g, toneladas)
 * - Células mescladas ou com formatação estranha
 * - Valores vazios ou inválidos
 */

import { parseNumericValue } from './columnDetector';

export interface WeightExtractionResult {
  value: number;
  originalValue: string | number | null;
  format: 'number' | 'string_br' | 'string_us' | 'string_simple' | 'invalid';
  unit: 'kg' | 'g' | 't' | 'unknown';
  confidence: number; // 0-100
}

/**
 * Extrai peso de uma célula com análise detalhada
 */
export function extractWeight(cellValue: string | number | null | undefined): WeightExtractionResult {
  if (cellValue === null || cellValue === undefined) {
    return {
      value: 0,
      originalValue: null,
      format: 'invalid',
      unit: 'unknown',
      confidence: 0,
    };
  }
  
  // Se já é número, retornar diretamente
  if (typeof cellValue === 'number') {
    if (isNaN(cellValue) || cellValue <= 0) {
      return {
        value: 0,
        originalValue: cellValue,
        format: 'invalid',
        unit: 'unknown',
        confidence: 0,
      };
    }
    
    return {
      value: cellValue,
      originalValue: cellValue,
      format: 'number',
      unit: 'kg',
      confidence: 100,
    };
  }
  
  const str = String(cellValue).trim();
  if (!str) {
    return {
      value: 0,
      originalValue: cellValue,
      format: 'invalid',
      unit: 'unknown',
      confidence: 0,
    };
  }
  
  // Detectar unidade
  let unit: 'kg' | 'g' | 't' | 'unknown' = 'kg';
  let multiplier = 1;
  
  if (/toneladas?|ton\.?|\st$/i.test(str)) {
    unit = 't';
    multiplier = 1000;
  } else if (/gramas?|g$/i.test(str)) {
    unit = 'g';
    multiplier = 0.001;
  } else if (/kilos?|quilos?|kg/i.test(str)) {
    unit = 'kg';
    multiplier = 1;
  }
  
  // Detectar formato
  let format: WeightExtractionResult['format'] = 'string_simple';
  let numericStr = str;
  
  // Remover unidades
  numericStr = numericStr.replace(/\s*(kg|kilos?|quilos?|g|gramas?|ton\.?|toneladas?)\s*$/i, '');
  numericStr = numericStr.trim();
  
  const hasComma = numericStr.includes(',');
  const hasDot = numericStr.includes('.');
  
  if (hasComma && hasDot) {
    const commaPos = numericStr.lastIndexOf(',');
    const dotPos = numericStr.lastIndexOf('.');
    
    if (commaPos > dotPos) {
      format = 'string_br';
      numericStr = numericStr.replace(/\./g, '').replace(',', '.');
    } else {
      format = 'string_us';
      numericStr = numericStr.replace(/,/g, '');
    }
  } else if (hasComma) {
    const match = numericStr.match(/,(\d+)$/);
    if (match && match[1].length === 3 && !numericStr.includes(' ')) {
      // 1,234 - vírgula é separador de milhares
      format = 'string_us';
      numericStr = numericStr.replace(/,/g, '');
    } else {
      // 123,45 - vírgula é decimal
      format = 'string_br';
      numericStr = numericStr.replace(',', '.');
    }
  } else if (hasDot) {
    // Verificar se é separador de milhares (1.234) ou decimal (12.34)
    const match = numericStr.match(/\.(\d+)$/);
    if (match && match[1].length === 3 && /^\d+\.\d{3}$/.test(numericStr)) {
      // 1.234 - ponto é separador de milhares (sem decimal)
      format = 'string_br';
      numericStr = numericStr.replace(/\./g, '');
    } else {
      // 12.34 ou 1.234.567,89 (já tratado acima)
      format = 'string_simple';
    }
  }
  
  // Remover caracteres não numéricos restantes
  numericStr = numericStr.replace(/[^\d.]/g, '');
  
  const num = parseFloat(numericStr);
  
  if (isNaN(num) || num <= 0) {
    return {
      value: 0,
      originalValue: cellValue,
      format: 'invalid',
      unit: 'unknown',
      confidence: 0,
    };
  }
  
  const finalValue = num * multiplier;
  
  // Calcular confiança baseado em quão "limpo" era o valor original
  let confidence = 80;
  if (typeof cellValue === 'number') confidence = 100;
  if (format === 'string_simple' && !hasComma && !hasDot) confidence = 95;
  if (unit !== 'kg') confidence -= 10; // Conversões diminuem confiança
  
  return {
    value: finalValue,
    originalValue: cellValue,
    format,
    unit,
    confidence,
  };
}

/**
 * Soma todos os pesos de um array de células
 */
export function sumWeights(cells: (string | number | null | undefined)[]): {
  total: number;
  validCount: number;
  invalidCount: number;
  details: WeightExtractionResult[];
} {
  const details: WeightExtractionResult[] = [];
  let total = 0;
  let validCount = 0;
  let invalidCount = 0;
  
  for (const cell of cells) {
    const result = extractWeight(cell);
    details.push(result);
    
    if (result.value > 0) {
      total += result.value;
      validCount++;
    } else {
      invalidCount++;
    }
  }
  
  return { total, validCount, invalidCount, details };
}

/**
 * Valida se um peso faz sentido para uma entrega individual
 * (entre 1 kg e 5000 kg)
 */
export function isValidDeliveryWeight(weight: number): { valid: boolean; reason?: string } {
  if (weight <= 0) {
    return { valid: false, reason: 'Peso deve ser maior que zero' };
  }
  
  if (weight < 0.01) {
    return { valid: false, reason: 'Peso muito baixo (mínimo 10g)' };
  }
  
  if (weight > 5000) {
    return { valid: false, reason: 'Peso muito alto (máximo 5 toneladas por entrega)' };
  }
  
  return { valid: true };
}

/**
 * Formata peso para exibição
 */
export function formatWeight(weightKg: number): string {
  if (weightKg >= 1000) {
    return `${(weightKg / 1000).toFixed(2).replace('.', ',')} t`;
  }
  return `${weightKg.toFixed(2).replace('.', ',')} kg`;
}
