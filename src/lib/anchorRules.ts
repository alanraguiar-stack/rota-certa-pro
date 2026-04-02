/**
 * Regras Operacionais por TERRITÓRIO (Cidade Âncora)
 * 
 * O sistema atribui automaticamente caminhões disponíveis a cada território.
 * Não há mais vínculo fixo placa→cidade.
 * 
 * Agrupamentos operacionais:
 * 1. Barueri + Jandira + Itapevi
 * 2. Cotia + Vargem Grande + Embu/Embu das Artes + Taboão da Serra
 * 3. Osasco (+ bairros SP: Parque Imperial, Jaguaré, Rio Pequeno, Santa Maria)
 * 4. Santana de Parnaíba + Pirapora + Cajamar
 * 5. Caieiras (+ Perus de SP)
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
  /** Bairros que devem ir para o FINAL da sequência da rota */
  lateNeighborhoods?: { neighborhood: string; city: string }[];
  /** É caminhão de apoio? */
  isSupport: boolean;
  /** Prioridade para atribuição (menor = atribuído primeiro) */
  priority: number;
  /** Placa fixa — quando definida, este caminhão é reservado para o território */
  fixedPlate?: string;
}

/**
 * Mapa de adjacência entre bairros — usado pelo sequenciamento para dar
 * bônus de proximidade na transição entre bairros vizinhos.
 * 
 * Chave: nome do bairro normalizado (sem acento, lowercase).
 * Valor: lista de bairros vizinhos.
 */
export const NEIGHBORHOOD_NEIGHBORS: Record<string, string[]> = {
  // Osasco
  'vila yara': ['jaguare', 'rio pequeno', 'presidente altino', 'centro'],
  'rochdale': ['jaguare', 'km 18', 'bela vista'],
  'presidente altino': ['vila yara', 'centro', 'bussocaba'],
  'bussocaba': ['presidente altino', 'centro', 'km 18'],
  'centro': ['presidente altino', 'vila yara', 'bussocaba', 'vila osasco'],
  'km 18': ['rochdale', 'bussocaba', 'jardim das flores'],
  'jardim das flores': ['km 18', 'rochdale'],
  'vila osasco': ['centro', 'remedio'],
  'remedio': ['vila osasco', 'conceicao'],
  'conceicao': ['remedio', 'santa maria'],
  'santa maria': ['conceicao', 'metalurgicos', 'metalurgico'],
  'metalurgicos': ['santa maria', 'conceicao'],
  'metalurgico': ['santa maria', 'conceicao'],
  // Transição Osasco → SP
  'jaguare': ['vila yara', 'rio pequeno', 'rochdale'],
  'rio pequeno': ['jaguare', 'vila yara'],
  'parque imperial': ['jaguare', 'rio pequeno'],
  // Barueri
  'jardim mutinga': ['jd silveira', 'parque viana', 'vila do conde'],
  'alphaville': ['tambore', 'centro comercial'],
  'tambore': ['alphaville', 'centro comercial'],
  'vila do conde': ['jardim mutinga', 'parque viana'],
  'parque viana': ['jardim mutinga', 'vila do conde', 'jd silveira'],
  'jd silveira': ['jardim mutinga', 'parque viana'],
  // Cotia
  'centro de cotia': ['jardim nomura', 'parque san remo'],
  'jardim nomura': ['centro de cotia'],
  'parque san remo': ['centro de cotia'],
  // Carapicuíba
  'vila da oportunidade': ['jardim yaya', 'pousada dos bandeirantes'],
  'jardim yaya': ['vila da oportunidade', 'pousada dos bandeirantes'],
  'pousada dos bandeirantes': ['jardim yaya', 'vila da oportunidade'],
};

/**
 * Verifica se dois bairros são vizinhos conforme o mapa de adjacência.
 */
export function areNeighborhoodsAdjacent(nhA: string, nhB: string): boolean {
  const a = normalizeNeighborhood(nhA);
  const b = normalizeNeighborhood(nhB);
  if (a === b) return true;
  const neighbors = NEIGHBORHOOD_NEIGHBORS[a];
  return neighbors ? neighbors.includes(b) : false;
}

/**
 * Regras de território — o motor seleciona automaticamente o caminhão.
 * 
 * Agrupamento 1: Barueri (âncora) + Jandira + Itapevi
 * Agrupamento 2: Cotia (âncora) + Vargem Grande + Embu + Embu das Artes + Taboão
 * Agrupamento 3: Osasco (âncora) + bairros SP (Parque Imperial, Jaguaré, Rio Pequeno)
 * Agrupamento 4: Santana de Parnaíba (âncora) + Pirapora + Cajamar
 * Agrupamento 5: Caieiras (âncora) + Perus (SP)
 * Apoio: São Paulo (restante) + excedentes
 */
export const TERRITORY_RULES: TerritoryRule[] = [
  // ── Agrupamento 1: Barueri + Jandira + Itapevi ──
  {
    id: 'barueri',
    label: 'Âncora Barueri',
    anchorCity: 'barueri',
    maxDeliveries: 25,
    allowedFillCities: ['jandira', 'itapevi'],
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
  // ── Agrupamento 2: Cotia + Vargem Grande + Embu + Taboão ──
  {
    id: 'cotia',
    label: 'Âncora Cotia',
    anchorCity: 'cotia',
    maxDeliveries: 25,
    allowedFillCities: ['vargem grande paulista', 'embu', 'embu das artes', 'taboao da serra'],
    neighborhoodFills: [
      // Bairros específicos de Carapicuíba que entram neste agrupamento
      { neighborhood: 'vila da oportunidade', city: 'carapicuiba' },
      { neighborhood: 'jardim yaya', city: 'carapicuiba' },
      { neighborhood: 'pousada dos bandeirantes', city: 'carapicuiba' },
    ],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    // Centro de Cotia deve ser sequenciado primeiro na rota
    priorityNeighborhoods: [
      { neighborhood: 'centro', city: 'cotia' },
      { neighborhood: 'centro de cotia', city: 'cotia' },
    ],
    isSupport: false,
    priority: 2,
  },
  // ── Agrupamento 3: Osasco ──
  {
    id: 'osasco',
    label: 'Âncora Osasco',
    anchorCity: 'osasco',
    maxDeliveries: 25,
    allowedFillCities: ['carapicuiba'],
    neighborhoodFills: [
      // Bairros de SP que entram no caminhão de Osasco
      { neighborhood: 'parque imperial', city: 'sao paulo' },
      { neighborhood: 'jaguare', city: 'sao paulo' },
      { neighborhood: 'rio pequeno', city: 'sao paulo' },
    ],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    // Jardim Mutinga e Imperial (Barueri) entram PRIMEIRO, antes das entregas de Osasco
    priorityNeighborhoods: [
      { neighborhood: 'jardim mutinga', city: 'barueri' },
      { neighborhood: 'imperial', city: 'barueri' },
    ],
    // Vila Yara vai pro final da rota de Osasco
    lateNeighborhoods: [
      { neighborhood: 'vila yara', city: 'osasco' },
    ],
    isSupport: false,
    priority: 3,
    fixedPlate: 'TRC1Z00',
  },
  // ── Agrupamento 4: Santana de Parnaíba + Pirapora + Cajamar ──
  {
    id: 'santana',
    label: 'Âncora Santana de Parnaíba',
    anchorCity: 'santana de parnaiba',
    maxDeliveries: 25,
    allowedFillCities: ['pirapora do bom jesus', 'cajamar'],
    neighborhoodFills: [],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    priorityNeighborhoods: [],
    isSupport: false,
    priority: 4,
  },
  // ── Agrupamento 5: Caieiras + Perus (SP) ──
  {
    id: 'caieiras',
    label: 'Âncora Caieiras',
    anchorCity: 'caieiras',
    maxDeliveries: 25,
    allowedFillCities: [],
    neighborhoodFills: [
      { neighborhood: 'perus', city: 'sao paulo' },
    ],
    neighborhoodExceptions: [],
    excludedNeighborhoods: [],
    priorityNeighborhoods: [],
    isSupport: false,
    priority: 5,
  },
  // ── Apoio / Excedentes ──
  {
    id: 'apoio',
    label: 'Apoio / Excedentes',
    anchorCity: '',
    maxDeliveries: 25,
    allowedFillCities: [
      'sao paulo',
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
