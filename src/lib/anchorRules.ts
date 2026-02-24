/**
 * Regras Operacionais Fixas — Caminhões Âncora por Território
 * 
 * Estas regras NÃO são inferidas pelo sistema.
 * São regras de negócio explícitas da operação.
 */

export interface AnchorRule {
  /** Prefixo da placa (3 primeiras letras) para match */
  platePrefix: string;
  /** Cidade âncora obrigatória */
  anchorCity: string;
  /** Limite máximo de entregas */
  maxDeliveries: number;
  /** Cidades permitidas para encaixe (além da âncora) */
  allowedFillCities: string[];
  /** Exceções de bairro: bairros de OUTRAS cidades que podem ser encaixados */
  neighborhoodExceptions: NeighborhoodException[];
  /** Rótulo amigável */
  label: string;
  /** É caminhão de apoio? */
  isSupport: boolean;
}

export interface NeighborhoodException {
  /** Bairro permitido */
  neighborhood: string;
  /** Cidade de origem do bairro (OBRIGATÓRIO para evitar homônimos) */
  city: string;
  /** Máximo de entregas desse bairro */
  maxDeliveries: number;
  /** Posição especial na sequência (após qual bairro?) */
  insertAfterNeighborhood?: string;
}

/**
 * Regras fixas dos caminhões âncora.
 * Match por prefixo de placa (3 primeiras letras, case-insensitive).
 */
export const ANCHOR_RULES: AnchorRule[] = [
  {
    platePrefix: 'EUR',
    anchorCity: 'barueri',
    maxDeliveries: 22,
    allowedFillCities: ['jandira', 'itapevi', 'cotia', 'vargem grande paulista'],
    neighborhoodExceptions: [],
    label: 'Caminhão A — Barueri',
    isSupport: false,
  },
  {
    platePrefix: 'CYR',
    anchorCity: 'osasco',
    maxDeliveries: 24,
    allowedFillCities: [],
    neighborhoodExceptions: [
      { neighborhood: 'jaguare', city: 'sao paulo', maxDeliveries: 2 },
      { neighborhood: 'parque imperial', city: 'sao paulo', maxDeliveries: 2 },
    ],
    label: 'Caminhão B — Osasco',
    isSupport: false,
  },
  {
    platePrefix: 'FKD',
    anchorCity: 'carapicuiba',
    maxDeliveries: 24,
    allowedFillCities: [],
    neighborhoodExceptions: [
      { neighborhood: 'metalurgicos', city: 'osasco', maxDeliveries: 2, insertAfterNeighborhood: 'jardim novo horizonte' },
      { neighborhood: 'vila do conde', city: 'barueri', maxDeliveries: 2 },
    ],
    label: 'Caminhão C — Carapicuíba',
    isSupport: false,
  },
  {
    platePrefix: 'EEF',
    anchorCity: '',  // Sem cidade âncora — recebe demais + excedentes
    maxDeliveries: 99,
    allowedFillCities: [
      'pirapora do bom jesus', 'santana de parnaiba',
      'taboao da serra', 'embu', 'embu das artes', 'sao paulo',
    ],
    neighborhoodExceptions: [],
    label: 'Caminhão D — Apoio / Excedentes',
    isSupport: true,
  },
];

/**
 * Encontra a regra âncora para um caminhão pela placa.
 */
export function findAnchorRule(plate: string): AnchorRule | null {
  const prefix = plate.replace(/[\s-]/g, '').toUpperCase().substring(0, 3);
  return ANCHOR_RULES.find(r => r.platePrefix === prefix) || null;
}

/**
 * Normaliza nome de bairro para comparação.
 */
export function normalizeNeighborhood(neighborhood: string): string {
  return neighborhood
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
