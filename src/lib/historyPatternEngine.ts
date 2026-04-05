/**
 * Motor de Extração de Padrões Históricos
 * Analisa bases do analista logístico para aprender decisões de roteirização.
 * Extrai CORREDORES REGIONAIS, co-ocorrência de cidades, prioridades e gera hints.
 */

import { ParsedOrder } from '@/types';

// Row from route_history_patterns table
export interface HistoryRow {
  id: string;
  truck_label: string;
  city: string | null;
  client_name: string | null;
  address: string | null;
  neighborhood: string | null;
  sequence_order: number | null;
  route_date: string | null;
  state: string | null;
  was_manually_moved?: boolean;
}

export interface RoutingHint {
  type: 'dedicate_truck' | 'combine_cities' | 'split_city' | 'priority_order';
  cities: string[];
  confidence: number; // 0-100
  reasoning: string;
}

interface CityCoOccurrence {
  cityA: string;
  cityB: string;
  togetherCount: number;
  separateCount: number;
  coOccurrenceRate: number; // 0-1
}

interface CityProfile {
  city: string;
  totalAppearances: number;
  dedicatedTruckRate: number;
  avgTrucksUsed: number;
  trucksPerRoute: Map<string, number>;
  coOccurrences: Map<string, number>;
  priorityScore: number;
}

/**
 * Regional Corridor: a recurring combination of cities that the analyst
 * groups together in the same truck across multiple route dates.
 */
export interface RegionalCorridor {
  id: string;
  coreCity: string;
  satelliteCities: string[];
  allCities: Set<string>;
  frequency: number;        // how many route-dates this corridor appeared
  avgDeliveries: number;
  confidence: number;        // 0-100
  truckLabels: string[];     // historical truck labels used
}

export interface ExtractedPatterns {
  cityProfiles: Map<string, CityProfile>;
  coOccurrences: CityCoOccurrence[];
  corridors: RegionalCorridor[];
  neighborhoodSequences: Map<string, string[]>; // city → learned neighborhood order
  routeCount: number;
  totalRecords: number;
}

const MIN_CONFIDENCE = 40;

function normalizeCity(city: string | null): string {
  if (!city) return 'desconhecida';
  return city.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Hub city (CD location) - distributed across all trucks
const HUB_CITY = 'barueri';

/**
 * Extract patterns from historical routing data
 */
export function extractCityPatterns(patterns: HistoryRow[]): ExtractedPatterns {
  if (patterns.length === 0) {
    return { cityProfiles: new Map(), coOccurrences: [], corridors: [], neighborhoodSequences: new Map(), routeCount: 0, totalRecords: 0 };
  }

  // Group by route (using route_date as route identifier)
  const routeMap = new Map<string, Map<string, Set<string>>>();
  // Also track delivery counts per truck per route
  const routeTruckDeliveries = new Map<string, Map<string, number>>();

  for (const row of patterns) {
    const routeKey = row.route_date || 'unknown';
    const city = normalizeCity(row.city);
    if (city === 'desconhecida') continue;

    if (!routeMap.has(routeKey)) routeMap.set(routeKey, new Map());
    const truckMap = routeMap.get(routeKey)!;
    if (!truckMap.has(row.truck_label)) truckMap.set(row.truck_label, new Set());
    truckMap.get(row.truck_label)!.add(city);

    if (!routeTruckDeliveries.has(routeKey)) routeTruckDeliveries.set(routeKey, new Map());
    const delivMap = routeTruckDeliveries.get(routeKey)!;
    const key = row.truck_label;
    delivMap.set(key, (delivMap.get(key) || 0) + 1);
  }

  const routeCount = routeMap.size;

  // Build city profiles
  const cityProfiles = new Map<string, CityProfile>();

  const getOrCreateProfile = (city: string): CityProfile => {
    if (!cityProfiles.has(city)) {
      cityProfiles.set(city, {
        city, totalAppearances: 0, dedicatedTruckRate: 0,
        avgTrucksUsed: 0, trucksPerRoute: new Map(),
        coOccurrences: new Map(), priorityScore: 0,
      });
    }
    return cityProfiles.get(city)!;
  };

  for (const [routeKey, truckMap] of routeMap) {
    const citiesInTruck = new Map<string, string[]>();

    for (const [truckLabel, cities] of truckMap) {
      for (const city of cities) {
        if (!citiesInTruck.has(city)) citiesInTruck.set(city, []);
        citiesInTruck.get(city)!.push(truckLabel);
      }
    }

    for (const [city, trucks] of citiesInTruck) {
      const profile = getOrCreateProfile(city);
      profile.totalAppearances++;
      profile.trucksPerRoute.set(routeKey, trucks.length);
    }

    // Co-occurrence: cities in the SAME truck
    for (const [, cities] of truckMap) {
      const cityArr = Array.from(cities);
      for (let i = 0; i < cityArr.length; i++) {
        for (let j = i + 1; j < cityArr.length; j++) {
          const profileA = getOrCreateProfile(cityArr[i]);
          const profileB = getOrCreateProfile(cityArr[j]);
          profileA.coOccurrences.set(cityArr[j], (profileA.coOccurrences.get(cityArr[j]) || 0) + 1);
          profileB.coOccurrences.set(cityArr[i], (profileB.coOccurrences.get(cityArr[i]) || 0) + 1);
        }
      }
    }
  }

  // Calculate derived metrics
  for (const [, profile] of cityProfiles) {
    let dedicatedCount = 0;
    for (const [, truckMap] of routeMap) {
      for (const [, cities] of truckMap) {
        if (cities.has(profile.city) && cities.size === 1) {
          dedicatedCount++;
        }
      }
    }
    profile.dedicatedTruckRate = profile.totalAppearances > 0
      ? dedicatedCount / profile.totalAppearances : 0;

    const truckCounts = Array.from(profile.trucksPerRoute.values());
    profile.avgTrucksUsed = truckCounts.length > 0
      ? truckCounts.reduce((a, b) => a + b, 0) / truckCounts.length : 1;

    profile.priorityScore = profile.totalAppearances;
  }

  // Build co-occurrence list
  const coOccurrences: CityCoOccurrence[] = [];
  const seen = new Set<string>();

  for (const [cityA, profileA] of cityProfiles) {
    for (const [cityB, togetherCount] of profileA.coOccurrences) {
      const key = [cityA, cityB].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);

      const profileB = cityProfiles.get(cityB);
      if (!profileB) continue;

      const bothAppearRoutes = Math.min(profileA.totalAppearances, profileB.totalAppearances);
      const separateCount = bothAppearRoutes - togetherCount;

      coOccurrences.push({
        cityA, cityB, togetherCount,
        separateCount: Math.max(0, separateCount),
        coOccurrenceRate: bothAppearRoutes > 0 ? togetherCount / bothAppearRoutes : 0,
      });
    }
  }

  coOccurrences.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

  // Extract regional corridors
  const corridors = extractRegionalCorridors(routeMap, routeTruckDeliveries);

  // Extract neighborhood sequence patterns
  const neighborhoodSequences = extractNeighborhoodSequencePatterns(patterns);

  return { cityProfiles, coOccurrences, corridors, neighborhoodSequences, routeCount, totalRecords: patterns.length };
}

// ================================================================
// REGIONAL CORRIDORS - Core of the analyst's logic
// ================================================================

/**
 * Extract recurring regional corridors from history.
 * A corridor is a set of cities that repeatedly appear together in the same truck.
 */
function extractRegionalCorridors(
  routeMap: Map<string, Map<string, Set<string>>>,
  routeTruckDeliveries: Map<string, Map<string, number>>
): RegionalCorridor[] {
  // Collect all truck-route city sets
  interface TruckSnapshot {
    truckLabel: string;
    routeDate: string;
    cities: Set<string>;
    deliveryCount: number;
  }

  const snapshots: TruckSnapshot[] = [];

  for (const [routeDate, truckMap] of routeMap) {
    for (const [truckLabel, cities] of truckMap) {
      const delivMap = routeTruckDeliveries.get(routeDate);
      const deliveryCount = delivMap?.get(truckLabel) || cities.size;
      snapshots.push({ truckLabel, routeDate, cities: new Set(cities), deliveryCount });
    }
  }

  if (snapshots.length === 0) return [];

  // Cluster snapshots into corridors using Jaccard similarity
  // Two snapshots belong to the same corridor if Jaccard >= 0.4
  // (ignoring hub city for comparison)
  const JACCARD_THRESHOLD = 0.35;

  const corridorGroups: TruckSnapshot[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < snapshots.length; i++) {
    if (assigned.has(i)) continue;

    const group = [snapshots[i]];
    assigned.add(i);

    for (let j = i + 1; j < snapshots.length; j++) {
      if (assigned.has(j)) continue;

      // Calculate Jaccard WITHOUT hub city
      const citiesA = new Set([...snapshots[i].cities].filter(c => c !== HUB_CITY));
      const citiesB = new Set([...snapshots[j].cities].filter(c => c !== HUB_CITY));

      if (citiesA.size === 0 || citiesB.size === 0) continue;

      const intersection = new Set([...citiesA].filter(c => citiesB.has(c)));
      const union = new Set([...citiesA, ...citiesB]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;

      if (jaccard >= JACCARD_THRESHOLD) {
        group.push(snapshots[j]);
        assigned.add(j);
      }
    }

    corridorGroups.push(group);
  }

  // Build corridor from each group
  const corridors: RegionalCorridor[] = [];

  for (const group of corridorGroups) {
    // Count city frequency within the group
    const cityFreq = new Map<string, number>();
    const truckLabels = new Set<string>();
    const routeDates = new Set<string>();
    let totalDeliveries = 0;

    for (const snap of group) {
      truckLabels.add(snap.truckLabel);
      routeDates.add(snap.routeDate);
      totalDeliveries += snap.deliveryCount;

      for (const city of snap.cities) {
        cityFreq.set(city, (cityFreq.get(city) || 0) + 1);
      }
    }

    // Core city = most frequent non-hub city
    let coreCity = '';
    let maxFreq = 0;
    for (const [city, freq] of cityFreq) {
      if (city === HUB_CITY) continue;
      if (freq > maxFreq) {
        maxFreq = freq;
        coreCity = city;
      }
    }

    if (!coreCity) continue;

    // Satellite cities = all others (excluding hub if it's always present)
    const allCities = new Set<string>();
    const satelliteCities: string[] = [];
    for (const [city] of cityFreq) {
      allCities.add(city);
      if (city !== coreCity && city !== HUB_CITY) {
        satelliteCities.push(city);
      }
    }

    // Always include hub in allCities
    allCities.add(HUB_CITY);

    const frequency = routeDates.size;
    const confidence = Math.min(100, Math.round((frequency / Math.max(1, routeDates.size)) * 50 + group.length * 15));

    corridors.push({
      id: `${coreCity}-corridor`,
      coreCity,
      satelliteCities,
      allCities,
      frequency,
      avgDeliveries: Math.round(totalDeliveries / group.length),
      confidence: Math.min(100, confidence),
      truckLabels: Array.from(truckLabels),
    });
  }

  // Sort by frequency * confidence
  corridors.sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence));

  return corridors;
}

/**
 * Match a set of order cities to the best historical corridor.
 * Returns corridors ranked by Jaccard similarity.
 */
export function matchOrdersToCorridor(
  orderCities: Set<string>,
  corridors: RegionalCorridor[]
): { corridor: RegionalCorridor; score: number }[] {
  const normalizedOrderCities = new Set(
    [...orderCities].map(c => normalizeCity(c)).filter(c => c !== 'desconhecida' && c !== HUB_CITY)
  );

  if (normalizedOrderCities.size === 0) return [];

  const results: { corridor: RegionalCorridor; score: number }[] = [];

  for (const corridor of corridors) {
    const corridorCities = new Set(
      [...corridor.allCities].filter(c => c !== HUB_CITY)
    );

    const intersection = new Set([...normalizedOrderCities].filter(c => corridorCities.has(c)));
    const union = new Set([...normalizedOrderCities, ...corridorCities]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    // Also check: what % of the order's cities are covered by this corridor?
    const coverage = normalizedOrderCities.size > 0
      ? intersection.size / normalizedOrderCities.size
      : 0;

    // Combined score: weighted Jaccard + coverage
    const score = jaccard * 0.5 + coverage * 0.5;

    if (score > 0.1) {
      results.push({ corridor, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Get city exclusion map: pairs of cities that NEVER appeared together in any truck
 */
export function getCityExclusionMap(
  patterns: ExtractedPatterns
): Map<string, Set<string>> {
  const exclusions = new Map<string, Set<string>>();
  
  // Build set of all city pairs that DID appear together
  const coOccurred = new Set<string>();
  for (const co of patterns.coOccurrences) {
    if (co.togetherCount > 0) {
      coOccurred.add([co.cityA, co.cityB].sort().join('::'));
    }
  }

  // Also check corridors - cities in same corridor are always allowed
  const corridorPairs = new Set<string>();
  for (const corridor of patterns.corridors) {
    const cities = Array.from(corridor.allCities);
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        corridorPairs.add([cities[i], cities[j]].sort().join('::'));
      }
    }
  }

  // Only exclude pairs that NEVER co-occurred AND are not in any corridor together
  // AND both cities have enough history data
  const allCities = Array.from(patterns.cityProfiles.keys());
  for (let i = 0; i < allCities.length; i++) {
    for (let j = i + 1; j < allCities.length; j++) {
      const cityA = allCities[i];
      const cityB = allCities[j];
      if (cityA === HUB_CITY || cityB === HUB_CITY) continue;

      const key = [cityA, cityB].sort().join('::');
      const profileA = patterns.cityProfiles.get(cityA);
      const profileB = patterns.cityProfiles.get(cityB);

      // Both must have sufficient history
      if (!profileA || !profileB) continue;
      if (profileA.totalAppearances < 2 || profileB.totalAppearances < 2) continue;

      if (!coOccurred.has(key) && !corridorPairs.has(key)) {
        if (!exclusions.has(cityA)) exclusions.set(cityA, new Set());
        if (!exclusions.has(cityB)) exclusions.set(cityB, new Set());
        exclusions.get(cityA)!.add(cityB);
        exclusions.get(cityB)!.add(cityA);
      }
    }
  }

  return exclusions;
}

/**
 * Validate if a combination of cities is acceptable.
 * Simple logic: neighbors OR historical co-occurrence.
 */
export function isValidCityCombination(
  cities: string[],
  patterns: ExtractedPatterns
): { valid: boolean; reason: string } {
  if (cities.length <= 1) return { valid: true, reason: '' };

  const normalized = cities.map(c => normalizeCity(c)).filter(c => c !== HUB_CITY && c !== 'desconhecida');
  if (normalized.length <= 1) return { valid: true, reason: '' };

  // Import areCitiesNeighbors lazily to avoid circular deps
  const { areCitiesNeighbors } = require('./geocoding');

  // Check each pair: must be neighbors OR have co-occurrence > 0
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const cityA = normalized[i];
      const cityB = normalized[j];

      // If neighbors, always allow
      if (areCitiesNeighbors(cityA, cityB)) continue;

      // Check co-occurrence
      const profileA = patterns.cityProfiles.get(cityA);
      if (!profileA) continue; // new city, no history — allow

      const coCount = profileA.coOccurrences.get(cityB) || 0;
      if (coCount > 0) continue; // historical co-occurrence — allow

      const profileB = patterns.cityProfiles.get(cityB);

      // Only flag if BOTH cities have sufficient history AND never co-occurred AND not neighbors
      if (profileB && profileA.totalAppearances >= 2 && profileB.totalAppearances >= 2) {
        return {
          valid: false,
          reason: `"${cityA}" e "${cityB}" não são vizinhas e nunca foram combinadas no histórico`,
        };
      }
    }
  }

  return { valid: true, reason: '' };
}

/**
 * Find the corridor name for a given set of cities
 */
export function findCorridorName(
  cities: string[],
  patterns: ExtractedPatterns
): string | null {
  const normalized = new Set(cities.map(c => normalizeCity(c)).filter(c => c !== HUB_CITY && c !== 'desconhecida'));
  if (normalized.size === 0) return null;

  const matches = matchOrdersToCorridor(normalized, patterns.corridors);
  if (matches.length > 0 && matches[0].score >= 0.3) {
    const corridor = matches[0].corridor;
    const coreCap = corridor.coreCity.charAt(0).toUpperCase() + corridor.coreCity.slice(1);
    return `Corredor ${coreCap}`;
  }

  return null;
}

/**
 * Find the most similar historical scenario
 */
export function findSimilarScenario(
  currentCities: string[],
  currentWeight: number,
  patterns: HistoryRow[]
): { similarity: number; routeDate: string | null } {
  const routeMap = new Map<string, { cities: Set<string>; weight: number }>();

  for (const row of patterns) {
    const routeKey = row.route_date || 'unknown';
    if (!routeMap.has(routeKey)) routeMap.set(routeKey, { cities: new Set(), weight: 0 });
    const entry = routeMap.get(routeKey)!;
    const city = normalizeCity(row.city);
    if (city !== 'desconhecida') entry.cities.add(city);
  }

  const normalizedCurrent = new Set(currentCities.map(c => normalizeCity(c)));
  let bestSimilarity = 0;
  let bestDate: string | null = null;

  for (const [routeDate, { cities }] of routeMap) {
    const intersection = new Set([...normalizedCurrent].filter(c => cities.has(c)));
    const union = new Set([...normalizedCurrent, ...cities]);
    const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestDate = routeDate;
    }
  }

  return { similarity: Math.round(bestSimilarity), routeDate: bestDate };
}

/**
 * Generate actionable routing hints from extracted patterns
 */
export function generateRoutingHints(
  extractedPatterns: ExtractedPatterns,
  currentOrders: ParsedOrder[]
): RoutingHint[] {
  const hints: RoutingHint[] = [];
  const { cityProfiles, coOccurrences, routeCount } = extractedPatterns;

  if (routeCount < 1) return hints;

  const currentCities = new Set<string>();
  for (const order of currentOrders) {
    const city = normalizeCity(order.city || null);
    if (city !== 'desconhecida') currentCities.add(city);
  }

  // 1. Combine cities hints (from corridors)
  for (const co of coOccurrences) {
    if (!currentCities.has(co.cityA) || !currentCities.has(co.cityB)) continue;
    if (co.togetherCount < 1) continue;

    const confidence = Math.round(co.coOccurrenceRate * 100);
    if (confidence >= MIN_CONFIDENCE) {
      hints.push({
        type: 'combine_cities', cities: [co.cityA, co.cityB], confidence,
        reasoning: `Em ${confidence}% das rotas, ${co.cityA} e ${co.cityB} ficaram no mesmo caminhão`,
      });
    }
  }

  // 2. Split city hints
  for (const city of currentCities) {
    const profile = cityProfiles.get(city);
    if (!profile || profile.totalAppearances < 2) continue;

    if (profile.avgTrucksUsed >= 1.5) {
      const confidence = Math.min(90, Math.round((profile.avgTrucksUsed / 3) * 100));
      if (confidence >= MIN_CONFIDENCE) {
        hints.push({
          type: 'split_city', cities: [city], confidence,
          reasoning: `${city} usa em média ${profile.avgTrucksUsed.toFixed(1)} caminhões por rota`,
        });
      }
    }
  }

  // 3. Priority order hint
  const citiesWithPriority = Array.from(currentCities)
    .map(city => ({ city, score: cityProfiles.get(city)?.priorityScore || 0 }))
    .filter(c => c.score >= 1)
    .sort((a, b) => b.score - a.score);

  if (citiesWithPriority.length >= 2) {
    hints.push({
      type: 'priority_order',
      cities: citiesWithPriority.map(c => c.city),
      confidence: Math.min(85, Math.round((citiesWithPriority[0].score / routeCount) * 100)),
      reasoning: `Ordem de prioridade baseada em ${routeCount} rotas históricas`,
    });
  }

  hints.sort((a, b) => b.confidence - a.confidence);
  return hints;
}
