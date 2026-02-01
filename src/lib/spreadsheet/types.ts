/**
 * Tipos para o Motor Inteligente de Leitura de Planilhas
 * 
 * O sistema opera como um analista logístico humano:
 * - Lê tudo primeiro
 * - Entende o significado dos dados
 * - Valida coerência antes de decidir
 */

export interface SpreadsheetRow {
  rowIndex: number;
  cells: (string | number | null)[];
  isEmpty: boolean;
  isHeader: boolean;
  isTotalization: boolean;
  isObservation: boolean;
}

export interface DetectedColumn {
  index: number;
  rawHeader: string;
  normalizedHeader: string;
  semanticType: SemanticColumnType;
  confidence: number; // 0-100
  sampleValues: (string | number)[];
  numericStats?: {
    count: number;
    sum: number;
    average: number;
    min: number;
    max: number;
  };
}

export type SemanticColumnType =
  | 'order_id'
  | 'client_name'
  | 'weight_gross'
  | 'weight_net'
  | 'weight_unit'
  | 'monetary_value'
  | 'address_street'
  | 'address_number'
  | 'address_neighborhood'
  | 'address_city'
  | 'address_state'
  | 'address_cep'
  | 'address_combined'
  | 'product_name'
  | 'product_code'
  | 'quantity'
  | 'unit_price'
  | 'total_value'
  | 'date'
  | 'nfe_number'
  | 'unknown';

export interface ColumnMapping {
  orderId?: number;
  clientName: number;
  weightGross: number;
  addressStreet?: number;
  addressNumber?: number;
  addressNeighborhood?: number;
  addressCity?: number;
  addressState?: number;
  addressCep?: number;
  addressCombined?: number;
  productName?: number;
  quantity?: number;
}

export interface ExtractedOrder {
  pedido_id: string;
  client_name: string;
  weight_kg: number;
  address: string;
  address_parts: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  };
  products: ExtractedProduct[];
  source_row: number;
  confidence: number;
}

export interface ExtractedProduct {
  name: string;
  weight_kg: number;
  quantity: number;
}

export interface ValidationResult {
  isValid: boolean;
  totalWeight: number;
  totalOrders: number;
  averageWeight: number;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  suggestions: string[];
}

export interface ValidationWarning {
  code: string;
  message: string;
  details?: string;
  affectedRows?: number[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error' | 'warning';
  details?: string;
  affectedRows?: number[];
  suggestion?: string;
}

export interface SpreadsheetAnalysis {
  format: SpreadsheetFormat;
  headerRowIndex: number;
  totalRows: number;
  dataRows: number;
  emptyRows: number;
  columns: DetectedColumn[];
  mapping: ColumnMapping | null;
  weightColumn: DetectedColumn | null;
  validation: ValidationResult;
}

export type SpreadsheetFormat =
  | 'mb_itinerario'      // Relatório Geral de Vendas MB
  | 'mb_detalhe'         // Detalhe das Vendas MB
  | 'itinerario_generic' // Itinerário genérico
  | 'adv_hierarchical'   // Formato hierárquico ADV
  | 'template_standard'  // Template padrão Rota Certa
  | 'generic_tabular'    // Tabular genérico
  | 'unknown';

export interface ParseConfig {
  // Se deve ignorar linhas em branco automaticamente
  skipEmptyRows: boolean;
  // Se deve ignorar linhas de totalização (ex: "TOTAL GERAL")
  skipTotalizationRows: boolean;
  // Se deve normalizar caracteres especiais
  normalizeCharacters: boolean;
  // Se deve tratar vírgulas como decimal (formato BR)
  brazilianNumberFormat: boolean;
  // Número máximo de linhas para análise de amostra
  sampleSize: number;
}

export const DEFAULT_PARSE_CONFIG: ParseConfig = {
  skipEmptyRows: true,
  skipTotalizationRows: true,
  normalizeCharacters: true,
  brazilianNumberFormat: true,
  sampleSize: 50,
};

// Palavras-chave para detecção semântica de colunas
export const SEMANTIC_KEYWORDS = {
  weight_gross: [
    'peso bruto', 'pesobruto', 'peso total', 'peso pedido', 'total kg',
    'peso kg', 'peso da entrega', 'peso', 'weight', 'kg', 'kilos',
  ],
  weight_net: [
    'peso liquido', 'peso líquido', 'net weight',
  ],
  client_name: [
    'cliente', 'razao social', 'razão social', 'nome', 'fantasia',
    'destinatario', 'destinatário', 'empresa', 'customer', 'name',
  ],
  order_id: [
    'venda', 'pedido', 'order', 'numero pedido', 'nº venda', 'n venda',
    'pedido id', 'order id', 'id pedido',
  ],
  address_street: [
    'end. ent.', 'end ent', 'endereco ent', 'endereço ent', 'rua',
    'logradouro', 'street', 'avenida', 'av.',
  ],
  address_number: [
    'numero', 'número', 'num', 'nº', 'number', 'no.',
  ],
  address_neighborhood: [
    'bairro ent.', 'bairro ent', 'bairro', 'neighborhood', 'distrito',
  ],
  address_city: [
    'cidade ent.', 'cidade ent', 'cidade', 'city', 'municipio', 'município',
  ],
  address_state: [
    'uf ent.', 'uf ent', 'estado', 'uf', 'state',
  ],
  address_cep: [
    'cep ent.', 'cep ent', 'cep', 'codigo postal', 'código postal', 'postal',
  ],
  address_combined: [
    'endereco', 'endereço', 'address', 'local', 'destino', 'location',
  ],
  monetary_value: [
    'total', 'valor', 'preco', 'preço', 'r$', 'reais', 'subtotal',
    'unitario', 'unitário', 'valor total', 'total geral',
  ],
  product_name: [
    'produto', 'product', 'item', 'descricao', 'descrição', 'description',
    'mercadoria', 'material', 'artigo',
  ],
  quantity: [
    'qtde', 'quantidade', 'qty', 'quant',
  ],
  nfe_number: [
    'nfe', 'nota fiscal', 'nf-e', 'nf',
  ],
  date: [
    'data', 'date', 'emissao', 'emissão',
  ],
} as const;

// Padrões para detectar linhas de totalização (a serem ignoradas)
export const TOTALIZATION_PATTERNS = [
  /^total\s*(geral)?$/i,
  /^soma$/i,
  /^subtotal$/i,
  /^grand total$/i,
  /^\*+\s*total/i,
  /^---+$/,
  /^===+$/,
];

// Padrões para detectar linhas de observação (a serem ignoradas)
export const OBSERVATION_PATTERNS = [
  /^obs\.?:/i,
  /^observa[çc][aã]o/i,
  /^nota:/i,
  /^\*+$/,
];
