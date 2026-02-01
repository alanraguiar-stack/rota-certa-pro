/**
 * Motor de Validação de Coerência
 * 
 * Valida se os dados extraídos fazem sentido logístico:
 * - O peso total é realista?
 * - A quantidade de caminhões sugerida faz sentido?
 * - Todos os clientes têm endereço?
 * - A soma bate?
 */

import { 
  ValidationResult, 
  ValidationWarning, 
  ValidationError,
  ExtractedOrder,
  SpreadsheetAnalysis,
  ColumnMapping,
} from './types';
import { formatWeight } from './weightExtractor';

export interface CoherenceCheckResult {
  isCoherent: boolean;
  issues: string[];
  suggestions: string[];
  weightAnalysis: {
    total: number;
    average: number;
    min: number;
    max: number;
    expectedTrucks: number;
  };
}

/**
 * Valida coerência geral dos dados antes de processar
 */
export function validateCoherence(
  orders: ExtractedOrder[],
  analysis: SpreadsheetAnalysis
): CoherenceCheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  if (orders.length === 0) {
    return {
      isCoherent: false,
      issues: ['Nenhum pedido válido encontrado'],
      suggestions: ['Verifique se o arquivo está no formato correto'],
      weightAnalysis: { total: 0, average: 0, min: 0, max: 0, expectedTrucks: 0 },
    };
  }
  
  // Calcular estatísticas de peso
  const weights = orders.map(o => o.weight_kg);
  const total = weights.reduce((a, b) => a + b, 0);
  const average = total / orders.length;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  
  // Assumindo caminhões de 3.5 toneladas com 90% de ocupação
  const truckCapacity = 3500 * 0.9;
  const expectedTrucks = Math.ceil(total / truckCapacity);
  
  // Validação 1: Peso médio faz sentido?
  if (average < 1) {
    issues.push(`Peso médio muito baixo: ${formatWeight(average)}. Possível erro na coluna de peso.`);
    suggestions.push('Verifique se a coluna correta foi identificada como Peso Bruto');
  } else if (average > 2000) {
    issues.push(`Peso médio muito alto: ${formatWeight(average)}. Pode ser valor monetário.`);
    suggestions.push('A coluna "Total" (R$) pode ter sido confundida com "Peso Bruto"');
  }
  
  // Validação 2: Peso total é realista para a quantidade de pedidos?
  if (orders.length > 50 && total < 1000) {
    issues.push(`Peso total ${formatWeight(total)} muito baixo para ${orders.length} pedidos`);
    suggestions.push('Verifique se a coluna de peso está mapeada corretamente');
  }
  
  // Validação 3: Variação de peso é razoável?
  if (max > 0 && min > 0 && max / min > 100) {
    issues.push(`Grande variação de peso: de ${formatWeight(min)} a ${formatWeight(max)}`);
    suggestions.push('Verifique se há valores incorretos ou unidades diferentes');
  }
  
  // Validação 4: Pedidos sem endereço
  const ordersWithoutAddress = orders.filter(o => !o.address || o.address.length < 10);
  if (ordersWithoutAddress.length > 0) {
    if (ordersWithoutAddress.length === orders.length) {
      issues.push('Nenhum pedido tem endereço válido');
      suggestions.push('Este pode ser um arquivo de "Detalhe das Vendas" que precisa ser cruzado com o "Relatório Geral"');
    } else {
      issues.push(`${ordersWithoutAddress.length} pedidos sem endereço válido`);
    }
  }
  
  // Validação 5: Peso total vs coluna identificada
  if (analysis.weightColumn) {
    const columnSum = analysis.weightColumn.numericStats?.sum || 0;
    const diff = Math.abs(total - columnSum);
    
    if (columnSum > 0 && diff > 100 && diff / columnSum > 0.1) {
      issues.push(`Diferença entre peso calculado (${formatWeight(total)}) e soma da coluna (${formatWeight(columnSum)})`);
      suggestions.push('Algumas linhas podem ter sido ignoradas incorretamente');
    }
  }
  
  const isCoherent = issues.length === 0;
  
  if (isCoherent) {
    suggestions.push(`✅ Peso total: ${formatWeight(total)} (${orders.length} pedidos)`);
    suggestions.push(`✅ Caminhões estimados: ${expectedTrucks} (capacidade 3.5t)`);
  }
  
  return {
    isCoherent,
    issues,
    suggestions,
    weightAnalysis: { total, average, min, max, expectedTrucks },
  };
}

/**
 * Valida resultado final antes de gerar romaneios
 */
export function validateFinalResult(
  orders: ExtractedOrder[],
  expectedTotalWeight: number
): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];
  const suggestions: string[] = [];
  
  if (orders.length === 0) {
    errors.push({
      code: 'NO_ORDERS',
      message: 'Nenhum pedido válido para processar',
      severity: 'critical',
    });
    
    return {
      isValid: false,
      totalWeight: 0,
      totalOrders: 0,
      averageWeight: 0,
      warnings,
      errors,
      suggestions: ['Verifique se o arquivo está no formato correto'],
    };
  }
  
  const totalWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
  const totalOrders = orders.length;
  const averageWeight = totalWeight / totalOrders;
  
  // Verificar peso total
  if (expectedTotalWeight > 0) {
    const diff = Math.abs(totalWeight - expectedTotalWeight);
    const diffPercent = (diff / expectedTotalWeight) * 100;
    
    if (diffPercent > 5) {
      warnings.push({
        code: 'WEIGHT_MISMATCH',
        message: `Peso calculado (${formatWeight(totalWeight)}) difere ${diffPercent.toFixed(1)}% do esperado (${formatWeight(expectedTotalWeight)})`,
        details: 'Algumas linhas podem ter sido ignoradas ou a coluna errada foi selecionada',
      });
    }
  }
  
  // Verificar pedidos sem endereço
  const ordersWithoutAddress = orders.filter(o => !o.address || o.address.length < 10);
  if (ordersWithoutAddress.length > 0) {
    if (ordersWithoutAddress.length === orders.length) {
      errors.push({
        code: 'NO_ADDRESSES',
        message: 'Nenhum pedido tem endereço válido',
        severity: 'critical',
        suggestion: 'Faça o upload do "Relatório Geral de Vendas" para obter os endereços',
      });
    } else {
      warnings.push({
        code: 'MISSING_ADDRESSES',
        message: `${ordersWithoutAddress.length} pedidos sem endereço`,
        affectedRows: ordersWithoutAddress.map(o => o.source_row),
      });
    }
  }
  
  // Verificar pesos individuais suspeitos
  const suspiciousWeights = orders.filter(o => o.weight_kg < 0.1 || o.weight_kg > 3000);
  if (suspiciousWeights.length > 0) {
    warnings.push({
      code: 'SUSPICIOUS_WEIGHTS',
      message: `${suspiciousWeights.length} pedidos com peso suspeito`,
      details: 'Pesos muito baixos (<100g) ou muito altos (>3t) podem indicar erro',
      affectedRows: suspiciousWeights.map(o => o.source_row),
    });
  }
  
  // Sugestões finais
  if (totalWeight >= 1000) {
    const trucks = Math.ceil(totalWeight / 3150); // 3.5t * 90%
    suggestions.push(`Recomendado: ${trucks} caminhões para ${formatWeight(totalWeight)}`);
  }
  
  const isValid = errors.filter(e => e.severity === 'critical').length === 0;
  
  return {
    isValid,
    totalWeight,
    totalOrders,
    averageWeight,
    warnings,
    errors,
    suggestions,
  };
}

/**
 * Gera relatório de diagnóstico do parsing
 */
export function generateDiagnosticReport(
  analysis: SpreadsheetAnalysis,
  orders: ExtractedOrder[]
): string[] {
  const report: string[] = [];
  
  report.push('═══════════════════════════════════════════════════════');
  report.push('📊 RELATÓRIO DE DIAGNÓSTICO DO PARSING');
  report.push('═══════════════════════════════════════════════════════');
  report.push('');
  
  // Informações do arquivo
  report.push(`📁 Formato detectado: ${analysis.format}`);
  report.push(`📝 Total de linhas: ${analysis.totalRows}`);
  report.push(`📋 Linhas de dados: ${analysis.dataRows}`);
  report.push(`⬜ Linhas vazias ignoradas: ${analysis.emptyRows}`);
  report.push(`📍 Linha do header: ${analysis.headerRowIndex + 1}`);
  report.push('');
  
  // Colunas identificadas
  report.push('🔍 COLUNAS IDENTIFICADAS:');
  for (const col of analysis.columns.filter(c => c.semanticType !== 'unknown')) {
    report.push(`   [${col.index}] ${col.rawHeader} → ${col.semanticType} (${col.confidence}%)`);
    if (col.numericStats) {
      report.push(`       Estatísticas: ${col.numericStats.count} valores, soma=${col.numericStats.sum.toFixed(2)}, média=${col.numericStats.average.toFixed(2)}`);
    }
  }
  report.push('');
  
  // Coluna de peso
  if (analysis.weightColumn) {
    report.push('⚖️ COLUNA DE PESO BRUTO:');
    report.push(`   Índice: ${analysis.weightColumn.index}`);
    report.push(`   Header: "${analysis.weightColumn.rawHeader}"`);
    report.push(`   Confiança: ${analysis.weightColumn.confidence}%`);
    if (analysis.weightColumn.numericStats) {
      const stats = analysis.weightColumn.numericStats;
      report.push(`   Soma: ${formatWeight(stats.sum)}`);
      report.push(`   Média: ${formatWeight(stats.average)}`);
      report.push(`   Min/Max: ${formatWeight(stats.min)} - ${formatWeight(stats.max)}`);
    }
  } else {
    report.push('⚠️ COLUNA DE PESO NÃO ENCONTRADA!');
  }
  report.push('');
  
  // Resultado do parsing
  report.push('📦 RESULTADO DO PARSING:');
  report.push(`   Pedidos válidos: ${orders.length}`);
  const totalWeight = orders.reduce((sum, o) => sum + o.weight_kg, 0);
  report.push(`   Peso total: ${formatWeight(totalWeight)}`);
  report.push(`   Peso médio: ${formatWeight(totalWeight / (orders.length || 1))}`);
  
  const withAddress = orders.filter(o => o.address && o.address.length >= 10).length;
  report.push(`   Com endereço: ${withAddress}/${orders.length}`);
  report.push('');
  
  // Validação
  const validation = analysis.validation;
  if (validation.errors.length > 0) {
    report.push('❌ ERROS:');
    for (const err of validation.errors) {
      report.push(`   [${err.severity}] ${err.message}`);
    }
    report.push('');
  }
  
  if (validation.warnings.length > 0) {
    report.push('⚠️ AVISOS:');
    for (const warn of validation.warnings) {
      report.push(`   ${warn.message}`);
    }
    report.push('');
  }
  
  if (validation.suggestions.length > 0) {
    report.push('💡 SUGESTÕES:');
    for (const sug of validation.suggestions) {
      report.push(`   ${sug}`);
    }
  }
  
  report.push('');
  report.push('═══════════════════════════════════════════════════════');
  
  return report;
}
