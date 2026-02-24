/**
 * Motor de Extração de Padrões Históricos
 * Analisa bases do analista logístico para aprender decisões de roteirização.
 * Extrai co-ocorrência de cidades, cidades dedicadas, prioridades e gera hints.
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
  dedicatedTruckRate: number; // 0-1: how often city has its own truck
  avgTrucksUsed: number;
  trucksPerRoute: Map<string, number>; // routeDate -> numTrucks
  coOccurrences: Map<string, number>; // otherCity -> count together
  priorityScore: number; // higher = assigned first historically
}

export interface ExtractedPatterns {
  cityProfiles: Map<string, CityProfile>;
  coOccurrences: CityCoOccurrence[];
  routeCount: number;
  totalRecords: number;
}

const MIN_OCCURRENCES = 3;
const MIN_CONFIDENCE = 60;

function normalizeCity(city: string | null): string {
  if (!city) return 'desconhecida';
  return city.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extract patterns from historical routing data
 */
export function extractCityPatterns(patterns: HistoryRow[]): ExtractedPatterns {
  if (patterns.length === 0) {
    return { cityProfiles: new Map(), coOccurrences: [], routeCount: 0, totalRecords: 0 };
  }

  // Group by route (using route_date as route identifier)
  const routeMap = new Map<string, Map<string, Set<string>>>();
  // routeDate -> truckLabel -> Set<city>

  for (const row of patterns) {
    const routeKey = row.route_date || 'unknown';
    const city = normalizeCity(row.city);
    if (city === 'desconhecida') continue;

    if (!routeMap.has(routeKey)) routeMap.set(routeKey, new Map());
    const truckMap = routeMap.get(routeKey)!;
    if (!truckMap.has(row.truck_label)) truckMap.set(row.truck_label, new Set());
    truckMap.get(row.truck_label)!.add(city);
  }

  const routeCount = routeMap.size;

  // Build city profiles
  const cityProfiles = new Map<string, CityProfile>();

  const getOrCreateProfile = (city: string): CityProfile => {
    if (!cityProfiles.has(city)) {
      cityProfiles.set(city, {
        city,
        totalAppearances: 0,
        dedicatedTruckRate: 0,
        avgTrucksUsed: 0,
        trucksPerRoute: new Map(),
        coOccurrences: new Map(),
        priorityScore: 0,
      });
    }
    return cityProfiles.get(city)!;
  };

  // Analyze each route
  for (const [routeKey, truckMap] of routeMap) {
    // Which cities appear in which trucks for this route
    const citiesInTruck = new Map<string, string[]>(); // city -> [truckLabels]
    const truckCities = new Map<string, Set<string>>(); // truck -> cities

    for (const [truckLabel, cities] of truckMap) {
      truckCities.set(truckLabel, cities);
      for (const city of cities) {
        if (!citiesInTruck.has(city)) citiesInTruck.set(city, []);
        citiesInTruck.get(city)!.push(truckLabel);
      }
    }

    // Update city profiles
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
    // Dedicated truck rate: how often this city is the ONLY city in a truck
    let dedicatedCount = 0;
    for (const [routeKey, truckMap] of routeMap) {
      for (const [, cities] of truckMap) {
        if (cities.has(profile.city) && cities.size === 1) {
          dedicatedCount++;
        }
      }
    }
    profile.dedicatedTruckRate = profile.totalAppearances > 0
      ? dedicatedCount / profile.totalAppearances : 0;

    // Avg trucks used
    const truckCounts = Array.from(profile.trucksPerRoute.values());
    profile.avgTrucksUsed = truckCounts.length > 0
      ? truckCounts.reduce((a, b) => a + b, 0) / truckCounts.length : 1;

    // Priority score: cities that appear more often get higher priority
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

      // How many routes had both cities (in any truck)
      const bothAppearRoutes = Math.min(profileA.totalAppearances, profileB.totalAppearances);
      const separateCount = bothAppearRoutes - togetherCount;

      coOccurrences.push({
        cityA,
        cityB,
        togetherCount,
        separateCount: Math.max(0, separateCount),
        coOccurrenceRate: bothAppearRoutes > 0 ? togetherCount / bothAppearRoutes : 0,
      });
    }
  }

  coOccurrences.sort((a, b) => b.coOccurrenceRate - a.coOccurrenceRate);

  return { cityProfiles, coOccurrences, routeCount, totalRecords: patterns.length };
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
    // Jaccard similarity
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

  // Get current cities
  const currentCities = new Set<string>();
  for (const order of currentOrders) {
    const city = normalizeCity(order.city || null);
    if (city !== 'desconhecida') currentCities.add(city);
  }

  // 1. Dedicated truck hints
  for (const city of currentCities) {
    const profile = cityProfiles.get(city);
    if (!profile || profile.totalAppearances < MIN_OCCURRENCES) continue;

    if (profile.dedicatedTruckRate >= 0.7) {
      const confidence = Math.round(profile.dedicatedTruckRate * 100);
      if (confidence >= MIN_CONFIDENCE) {
        hints.push({
          type: 'dedicate_truck',
          cities: [city],
          confidence,
          reasoning: `Em ${confidence}% das ${profile.totalAppearances} rotas anteriores, ${city} teve caminhão dedicado`,
        });
      }
    }
  }

  // 2. Combine cities hints
  for (const co of coOccurrences) {
    if (!currentCities.has(co.cityA) || !currentCities.has(co.cityB)) continue;
    if (co.togetherCount < MIN_OCCURRENCES) continue;

    const confidence = Math.round(co.coOccurrenceRate * 100);
    if (confidence >= MIN_CONFIDENCE) {
      hints.push({
        type: 'combine_cities',
        cities: [co.cityA, co.cityB],
        confidence,
        reasoning: `Em ${confidence}% das rotas anteriores, ${co.cityA} e ${co.cityB} ficaram no mesmo caminhão`,
      });
    }
  }

  // 3. Split city hints (city that often needs multiple trucks)
  for (const city of currentCities) {
    const profile = cityProfiles.get(city);
    if (!profile || profile.totalAppearances < MIN_OCCURRENCES) continue;

    if (profile.avgTrucksUsed >= 1.5) {
      const confidence = Math.min(90, Math.round((profile.avgTrucksUsed / 3) * 100));
      if (confidence >= MIN_CONFIDENCE) {
        hints.push({
          type: 'split_city',
          cities: [city],
          confidence,
          reasoning: `${city} usa em média ${profile.avgTrucksUsed.toFixed(1)} caminhões por rota`,
        });
      }
    }
  }

  // 4. Priority order hint
  const citiesWithPriority = Array.from(currentCities)
    .map(city => ({ city, score: cityProfiles.get(city)?.priorityScore || 0 }))
    .filter(c => c.score >= MIN_OCCURRENCES)
    .sort((a, b) => b.score - a.score);

  if (citiesWithPriority.length >= 2) {
    hints.push({
      type: 'priority_order',
      cities: citiesWithPriority.map(c => c.city),
      confidence: Math.min(85, Math.round((citiesWithPriority[0].score / routeCount) * 100)),
      reasoning: `Ordem de prioridade baseada em ${routeCount} rotas históricas`,
    });
  }

  // Sort by confidence descending
  hints.sort((a, b) => b.confidence - a.confidence);

  return hints;
}
