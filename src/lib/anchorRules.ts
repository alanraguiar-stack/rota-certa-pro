/**
 * Regras Operacionais por TERRITÓRIO (Cidade Âncora)
 * 
 * O sistema atribui automaticamente caminhões disponíveis a cada território.
 * Não há mais vínculo fixo placa→cidade.
 */

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

export interface NeighborhoodFill {
  /** Bairro permitido para fill */
  neighborhood: string;
  /** Cidade do bairro */
  city: string;
}

export interface TerritoryRule {
  /** Identificador do território */
  id: string;
  /** Rótulo amigável */
  label: string;
  /** Cidade âncora obrigatória (vazia para apoio) */
  anchorCity: string;
  /** Limite máximo de entregas */
  maxDeliveries: number;
  /** Cidades permitidas para encaixe (além da âncora) */
  allowedFillCities: string[];
  /** Bairros específicos de OUTRAS cidades para fill (nível bairro, não cidade inteira) */
  neighborhoodFills: NeighborhoodFill[];
  /** Exceções de bairro: bairros de OUTRAS cidades que podem ser encaixados com limite */
  neighborhoodExceptions: NeighborhoodException[];
  /** Bairros a EXCLUIR da cidade âncora (reservados para outro território) */
  excludedNeighborhoods: { neighborhood: string; city: string }[];
  /** Bairros de OUTRA cidade que entram PRIMEIRO na sequência (antes da cidade âncora) */
  priorityNeighborhoods: { neighborhood: string; city: string }[];
  /** É caminhão de apoio? */
  isSupport: boolean;
  /** Prioridade para atribuição (menor = atribuído primeiro) */
  priority: number;
  /** Placa fixa — quando definida, este caminhão é reservado para o território */
  fixedPlate?: string;
}

/**
 * Regras de território — o motor seleciona automaticamente o caminhão.
 */
export const TERRITORY_RULES: TerritoryRule[] = [
  {
    id: 'barueri',
    label: 'Âncora Barueri',
    anchorCity: 'barueri',
    maxDeliveries: 25,
    allowedFillCities: ['cotia', 'vargem grande paulista'],
    neighborhoodFills: [],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [
      { neighborhood: 'jardim mutinga', city: 'barueri' },
      { neighborhood: 'imperial', city: 'barueri' },
    ],
    priorityNeighborhoods: [],
    isSupport: false,
    priority: 1,
  },
  {
    id: 'osasco',
    label: 'Âncora Osasco',
    anchorCity: 'osasco',
    maxDeliveries: 25,
    allowedFillCities: [],
    neighborhoodFills: [],
    neighborhoodExceptions: [
      { neighborhood: 'jaguare', city: 'sao paulo', maxDeliveries: 2, insertAfterNeighborhood: 'rochdale' },
      { neighborhood: 'parque imperial', city: 'sao paulo', maxDeliveries: 2 },
    ],
    excludedNeighborhoods: [],
    // Jardim Mutinga e Imperial (Barueri) entram PRIMEIRO, antes das entregas de Osasco
    priorityNeighborhoods: [
      { neighborhood: 'jardim mutinga', city: 'barueri' },
      { neighborhood: 'imperial', city: 'barueri' },
    ],
    isSupport: false,
    priority: 2,
    fixedPlate: 'TRC1Z00',
  },
  {
    id: 'carapicuiba',
    label: 'Âncora Carapicuíba',
    anchorCity: 'carapicuiba',
    maxDeliveries: 25,
    allowedFillCities: [],
    neighborhoodFills: [],
    neighborhoodExceptions: [
      { neighborhood: 'metalurgicos', city: 'osasco', maxDeliveries: 2, insertAfterNeighborhood: 'jardim novo horizonte' },
      { neighborhood: 'vila do conde', city: 'barueri', maxDeliveries: 2 },
    ],
    excludedNeighborhoods: [],
    priorityNeighborhoods: [],
    isSupport: false,
    priority: 3,
  },
  {
    id: 'jandira',
    label: 'Âncora Jandira',
    anchorCity: 'jandira',
    maxDeliveries: 25,
    allowedFillCities: ['itapevi'],
    neighborhoodFills: [],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    priorityNeighborhoods: [],
    isSupport: false,
    priority: 4,
  },
  {
    id: 'embu',
    label: 'Âncora Embu',
    anchorCity: 'embu',
    maxDeliveries: 25,
    allowedFillCities: ['embu das artes'],
    neighborhoodFills: [
      // Bairros específicos de Osasco
      { neighborhood: 'conceicao', city: 'osasco' },
      { neighborhood: 'metalurgico', city: 'osasco' },
      { neighborhood: 'santa maria', city: 'osasco' },
      // Bairros específicos de Carapicuíba
      { neighborhood: 'vila da oportunidade', city: 'carapicuiba' },
      { neighborhood: 'jardim yaya', city: 'carapicuiba' },
      { neighborhood: 'pousada dos bandeirantes', city: 'carapicuiba' },
    ],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    priorityNeighborhoods: [],
    isSupport: false,
    priority: 5,
  },
  {
    id: 'apoio',
    label: 'Apoio / Excedentes',
    anchorCity: '',
    maxDeliveries: 25,
    allowedFillCities: [
      'pirapora do bom jesus', 'santana de parnaiba',
      'taboao da serra', 'sao paulo',
    ],
    neighborhoodFills: [],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    priorityNeighborhoods: [],
    isSupport: true,
    priority: 99,
  },
];

// ================================================================
// Legacy interface kept for backward compatibility
// ================================================================

export interface AnchorRule {
  platePrefix: string;
  anchorCity: string;
  maxDeliveries: number;
  allowedFillCities: string[];
  neighborhoodExceptions: NeighborhoodException[];
  label: string;
  isSupport: boolean;
}

/** Runtime map: truck plate → territory rule (set during autoCompose) */
const truckTerritoryMap = new Map<string, TerritoryRule>();

export function setTruckTerritory(plate: string, rule: TerritoryRule): void {
  truckTerritoryMap.set(plate.replace(/[\s-]/g, '').toUpperCase(), rule);
}

export function clearTruckTerritories(): void {
  truckTerritoryMap.clear();
}

/**
 * Legacy: find anchor rule for a truck by plate.
 * Now returns the territory assigned during composition.
 */
export function findAnchorRule(plate: string): AnchorRule | null {
  const normalized = plate.replace(/[\s-]/g, '').toUpperCase();
  const territory = truckTerritoryMap.get(normalized);
  if (!territory) return null;

  return {
    platePrefix: normalized.substring(0, 3),
    anchorCity: territory.anchorCity,
    maxDeliveries: territory.maxDeliveries,
    allowedFillCities: territory.allowedFillCities,
    neighborhoodExceptions: territory.neighborhoodExceptions,
    label: territory.label,
    isSupport: territory.isSupport,
  };
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

/**
 * Assign trucks to territories automatically.
 * Returns a map: territory id → truck
 */
export function assignTrucksToTerritories(
  trucks: { plate: string; capacity_kg: number; max_deliveries: number | null }[],
  citiesInOrders: Set<string>,
  customRules?: TerritoryRule[]
): Map<string, typeof trucks[number]> {
  clearTruckTerritories();

  const rules = customRules || TERRITORY_RULES;
  // Sort territories by priority
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  // Sort trucks by capacity (best first)
  const availableTrucks = [...trucks].sort((a, b) => {
    const aMax = a.max_deliveries ?? 25;
    const bMax = b.max_deliveries ?? 25;
    if (bMax !== aMax) return bMax - aMax;
    return Number(b.capacity_kg) - Number(a.capacity_kg);
  });

  const usedTrucks = new Set<string>();
  const assignments = new Map<string, typeof trucks[number]>();

  // Phase 1: assign territories with fixedPlate first
  for (const rule of sortedRules) {
    if (!rule.fixedPlate) continue;
    if (!rule.isSupport && rule.anchorCity && !citiesInOrders.has(rule.anchorCity)) continue;

    const normalizedFixed = rule.fixedPlate.replace(/[\s-]/g, '').toUpperCase();
    const truck = availableTrucks.find(
      t => t.plate.replace(/[\s-]/g, '').toUpperCase() === normalizedFixed && !usedTrucks.has(t.plate)
    );
    if (!truck) continue;

    usedTrucks.add(truck.plate);
    assignments.set(rule.id, truck);
    setTruckTerritory(truck.plate, rule);
  }

  // Collect all cities covered by non-support territories
  const coveredCities = new Set<string>();
  for (const rule of sortedRules) {
    if (rule.isSupport) continue;
    if (rule.anchorCity) coveredCities.add(rule.anchorCity);
    for (const fc of rule.allowedFillCities) coveredCities.add(fc);
    for (const nf of rule.neighborhoodFills) coveredCities.add(nf.city);
    for (const ne of rule.neighborhoodExceptions) coveredCities.add(ne.city);
  }

  // Phase 2: assign remaining territories automatically
  for (const rule of sortedRules) {
    if (rule.fixedPlate) continue; // already handled

    if (rule.isSupport) {
      // Only assign support truck if there are orphan cities not covered by any territory
      const hasOrphanCities = [...citiesInOrders].some(c => !coveredCities.has(c));
      if (!hasOrphanCities) continue;
    } else {
      if (rule.anchorCity && !citiesInOrders.has(rule.anchorCity)) continue;
    }

    const truck = availableTrucks.find(t => !usedTrucks.has(t.plate));
    if (!truck) continue;

    usedTrucks.add(truck.plate);
    assignments.set(rule.id, truck);
    setTruckTerritory(truck.plate, rule);
  }

  return assignments;
}
