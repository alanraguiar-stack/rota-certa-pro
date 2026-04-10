/**
 * Regras Operacionais por TERRITÓRIO (Cidade Âncora)
 * 
 * O sistema atribui automaticamente caminhões disponíveis a cada território.
 * Não há mais vínculo fixo placa→cidade.
 * 
 * Agrupamentos operacionais:
 * 1. Barueri + Jandira + Itapevi + Santana de Parnaíba + Pirapora + Cajamar
 * 2. Cotia + Vargem Grande + Embu/Embu das Artes + Taboão da Serra
 * 3. Osasco (+ bairros SP: Parque Imperial, Jaguaré, Rio Pequeno, Santa Maria)
 * 4. Caieiras (+ Perus de SP)
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
  /** Bairros da cidade âncora que devem ser sequenciados PRIMEIRO (entrada da cidade) */
  earlyNeighborhoods?: { neighborhood: string; city: string }[];
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
  // ── Osasco — entrada (Leste, divisa SP) ──
  'km 18': ['quitauna', 'bonfim', 'rochdale', 'jardim das flores', 'bussocaba'],
  'quitauna': ['km 18', 'bonfim', 'rochdale', 'cidade das flores', 'munhoz junior', 'umuarama'],
  'bonfim': ['km 18', 'quitauna', 'i.a.p.i.', 'rochdale'],
  'iapi': ['bonfim', 'rochdale', 'umuarama'],
  'i.a.p.i.': ['bonfim', 'rochdale', 'umuarama'],
  'cidade das flores': ['quitauna', 'km 18', 'jardim das flores'],
  'jardim das flores': ['km 18', 'rochdale', 'cidade das flores'],
  'rochdale': ['km 18', 'quitauna', 'bonfim', 'i.a.p.i.', 'bela vista', 'helena maria', 'jaguare'],
  // ── Osasco — centro ──
  'umuarama': ['quitauna', 'i.a.p.i.', 'veloso', 'centro'],
  'centro': ['umuarama', 'presidente altino', 'bussocaba', 'vila osasco', 'munhoz junior', 'vila yara'],
  'presidente altino': ['centro', 'bussocaba', 'vila yara'],
  'bussocaba': ['presidente altino', 'centro', 'km 18'],
  'munhoz junior': ['quitauna', 'helena maria', 'centro'],
  'helena maria': ['munhoz junior', 'bela vista', 'rochdale'],
  'bela vista': ['helena maria', 'rochdale'],
  // ── Osasco — sul (divisa Carapicuíba) ──
  'veloso': ['umuarama', 'santa maria', 'baronesa', 'conceicao'],
  'santa maria': ['veloso', 'alianca', 'conceicao', 'metalurgicos', 'metalurgico'],
  'alianca': ['santa maria', 'baronesa', 'conceicao'],
  'baronesa': ['alianca', 'veloso', 'santa maria'],
  'vila osasco': ['centro', 'remedio'],
  'remedio': ['vila osasco', 'conceicao'],
  'conceicao': ['remedio', 'santa maria', 'veloso', 'alianca'],
  'metalurgicos': ['santa maria', 'conceicao'],
  'metalurgico': ['santa maria', 'conceicao'],
  // ── Osasco — saída (Vila Yara → SP) ──
  'vila yara': ['presidente altino', 'centro', 'jaguare', 'rio pequeno'],
  'jaguare': ['vila yara', 'rio pequeno', 'rochdale', 'parque imperial'],
  'rio pequeno': ['jaguare', 'vila yara', 'jardim d\'abril'],
  'parque imperial': ['jaguare', 'rio pequeno'],
  // ── SP — zona oeste (Raposo Tavares) ──
  'jardim adelfiore': ['jardim d\'abril', 'parque imperial'],
  'jardim d\'abril': ['jardim adelfiore', 'conjunto promorar raposo tavares', 'rio pequeno'],
  'conjunto promorar raposo tavares': ['jardim d\'abril', 'rio pequeno'],
  // ── Barueri ──
  'vila universal': ['vila engenho novo', 'jardim mutinga'],
  'vila engenho novo': ['vila universal', 'parque viana', 'jardim mutinga'],
  'jardim mutinga': ['vila engenho novo', 'vila universal', 'jd silveira', 'parque viana', 'vila do conde'],
  'alphaville': ['tambore', 'centro comercial'],
  'tambore': ['alphaville', 'centro comercial'],
  'vila do conde': ['jardim mutinga', 'parque viana'],
  'parque viana': ['jardim mutinga', 'vila do conde', 'jd silveira', 'vila engenho novo'],
  'jd silveira': ['jardim mutinga', 'parque viana'],
  // ── Carapicuíba — norte (divisa Barueri/Osasco) ──
  'centro de carapicuiba': ['vila maria helena', 'jardim santa brigida'],
  'vila maria helena': ['centro de carapicuiba', 'jardim santa brigida', 'jardim novo horizonte'],
  'jardim santa brigida': ['vila maria helena', 'centro de carapicuiba', 'jardim novo horizonte'],
  // ── Carapicuíba — centro-norte ──
  'jardim novo horizonte': ['jardim santa brigida', 'vila maria helena', 'jardim helena'],
  'jardim helena': ['jardim novo horizonte', 'jardim marilu'],
  'jardim marilu': ['jardim helena', 'pousada dos bandeirantes'],
  // ── Carapicuíba — centro-sul ──
  'pousada dos bandeirantes': ['jardim marilu', 'jardim yaya', 'vila da oportunidade', 'parque sampaio viana'],
  'parque sampaio viana': ['pousada dos bandeirantes', 'vila silviania'],
  'vila da oportunidade': ['jardim yaya', 'pousada dos bandeirantes'],
  'jardim yaya': ['vila da oportunidade', 'pousada dos bandeirantes'],
  // ── Carapicuíba — sul (divisa Cotia/Jandira) ──
  'vila silviania': ['parque sampaio viana', 'vila capriotti'],
  'vila capriotti': ['vila silviania', 'recanto campy'],
  'recanto campy': ['vila capriotti', 'parque roseira'],
  'parque roseira': ['recanto campy', 'cidade ariston'],
  'cidade ariston': ['parque roseira'],
  // ── Cotia ──
  'centro de cotia': ['jardim nomura', 'parque san remo'],
  'jardim nomura': ['centro de cotia'],
  'parque san remo': ['centro de cotia'],
  // ── Caieiras ↔ Perus ──
  'perus': ['caieiras'],
  'caieiras': ['perus'],
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
 * Agrupamento 1: Barueri (âncora) + Jandira + Itapevi + Santana de Parnaíba + Pirapora + Cajamar
 * Agrupamento 2: Cotia (âncora) + Vargem Grande + Embu + Embu das Artes + Taboão
 * Agrupamento 3: Osasco (âncora) + bairros SP (Parque Imperial, Jaguaré, Rio Pequeno)
 * Agrupamento 4: Caieiras (âncora) + Perus (SP)
 * Apoio: São Paulo (restante) + excedentes
 */
export const TERRITORY_RULES: TerritoryRule[] = [
  // ── Agrupamento 1: Barueri + Jandira + Itapevi + Santana de Parnaíba + Pirapora + Cajamar ──
  {
    id: 'barueri',
    label: 'Âncora Barueri',
    anchorCity: 'barueri',
    maxDeliveries: 25,
    allowedFillCities: ['jandira', 'itapevi', 'santana de parnaiba', 'pirapora do bom jesus', 'cajamar'],
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
    allowedFillCities: ['vargem grande paulista', 'embu', 'embu das artes', 'carapicuiba'],
    neighborhoodFills: [],
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
    allowedFillCities: ['taboao da serra'],
    neighborhoodFills: [
      // Bairros de SP que entram no caminhão de Osasco
      { neighborhood: 'parque imperial', city: 'sao paulo' },
      { neighborhood: 'jaguare', city: 'sao paulo' },
      { neighborhood: 'rio pequeno', city: 'sao paulo' },
      { neighborhood: 'jardim adelfiore', city: 'sao paulo' },
      { neighborhood: 'jardim d\'abril', city: 'sao paulo' },
      { neighborhood: 'conjunto promorar raposo tavares', city: 'sao paulo' },
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
    // KM 18 e Quitaúna são a "entrada" de Osasco — sequenciados primeiro
    earlyNeighborhoods: [
      { neighborhood: 'km 18', city: 'osasco' },
      { neighborhood: 'quitauna', city: 'osasco' },
    ],
    isSupport: false,
    priority: 3,
    fixedPlate: 'TRC1Z00',
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
