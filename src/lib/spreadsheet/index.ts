/**
 * Motor Inteligente de Leitura de Planilhas
 * 
 * Exportações públicas do módulo
 */

// Tipos principais
export type {
  SpreadsheetRow,
  DetectedColumn,
  SemanticColumnType,
  ColumnMapping,
  ExtractedOrder,
  ExtractedProduct,
  ValidationResult,
  ValidationWarning,
  ValidationError,
  SpreadsheetAnalysis,
  SpreadsheetFormat,
  ParseConfig,
} from './types';

export { DEFAULT_PARSE_CONFIG, SEMANTIC_KEYWORDS } from './types';

// Funções do leitor inteligente
export {
  readAllRows,
  classifyRows,
  detectFormat,
  analyzeAllColumns,
  extractOrders,
  analyzeSpreadsheet,
  convertToLegacyFormat,
} from './intelligentReader';

// Funções de detecção de colunas
export {
  superNormalize,
  standardNormalize,
  detectSemanticType,
  isLikelyMonetaryColumn,
  isLikelyWeightColumn,
  parseNumericValue,
  analyzeColumn,
  findWeightColumn,
  createColumnMapping,
} from './columnDetector';

// Funções de extração de peso
export {
  extractWeight,
  sumWeights,
  isValidDeliveryWeight,
  formatWeight,
} from './weightExtractor';

// Funções de validação
export {
  validateCoherence,
  validateFinalResult,
  generateDiagnosticReport,
} from './validationEngine';
