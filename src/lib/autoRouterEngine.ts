/**
 * Motor de Roteamento Automático - Lógica CIDADE-PRIMEIRO
 * 
 * REGRA: Cidade como unidade primária. Volume como critério.
 * Encaixe inteligente só com vizinhas. Sem force merge.
 * Barueri (CD) é distribuída entre todos os caminhões.
 * Sequenciamento: cidade > CEP > bairro > rua (blocos contínuos).
 */

import { Truck, ParsedOrder, RoutingStrategy } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName, areCitiesNeighbors } from './geocoding';
import { ParsedItemDetail } from './itemDetailParser';
import { RoutingHint, ExtractedPatterns, isValidCityCombination } from './historyPatternEngine';

export interface AutoRouterConfig {
  strategy: RoutingStrategy;
  safetyMarginPercent: number;
  maxOccupancyPercent: number;
  balanceOrders: boolean;
}

export interface TruckComposition {
  truck: Truck;
  orders: ParsedOrder[];
  totalWeight: number;
  occupancyPercent: number;
  estimatedDeliveries: number;
  cities: string[];
  primaryCity?: string;
  complementCities?: string[];
}

export interface CompositionValidation {
  valid: boolean;
  violations: string[];
}

export interface AutoRouterResult {
  compositions: TruckComposition[];
  unassignedOrders: ParsedOrder[];
  totalWeight: number;
  totalOrders: number;
  trucksUsed: number;
  averageOccupancy: number;
  warnings: string[];
  reasoning: string[];
  validation: CompositionValidation;
}

interface GeocodedOrder extends ParsedOrder {
  geocoded: GeocodedAddress;
  distanceFromCD: number;
  angle: number;
}

interface CityCluster {
  primaryCity: string;
  complementCities: string[];
  cities: Set<string>;
  orders: GeocodedOrder[];
  weight: number;
  reasoning: string[];
}

const HUB_CITY = 'barueri';

const DEFAULT_CONFIG: AutoRouterConfig = {
  strategy: 'padrao',
  safetyMarginPercent: 10,
  maxOccupancyPercent: 95,
  balanceOrders: true,
};

/**
 * Merge item details into orders
 */
export function mergeItemsIntoOrders(
  orders: ParsedOrder[],
  itemDetails: ParsedItemDetail[]
): ParsedOrder[] {
  if (itemDetails.length === 0) return orders;
  
  const itemsByPedido = new Map<string, ParsedItemDetail[]>();
  itemDetails.forEach(item => {
    const existing = itemsByPedido.get(item.pedido_id) || [];
    existing.push(item);
    itemsByPedido.set(item.pedido_id, existing);
  });
  
  return orders.map(order => {
    const orderItems = order.pedido_id ? itemsByPedido.get(order.pedido_id) : null;
    
    if (orderItems && orderItems.length > 0) {
      const items = orderItems.map(item => ({
        product_name: item.product_name,
        weight_kg: item.weight_kg,
        quantity: item.quantity,
      }));
      
      const totalWeight = items.reduce((sum, item) => sum + item.weight_kg, 0);
      return { ...order, items, weight_kg: totalWeight };
    }
    
    return order;
  });
}

/**
 * Calculate which trucks to use based on total weight
 */
export function recommendTrucks(
  availableTrucks: Truck[],
  totalWeight: number,
  totalOrders: number,
  config: Partial<AutoRouterConfig> = {}
): Truck[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const weightWithMargin = totalWeight * (1 + cfg.safetyMarginPercent / 100);
  
  const sortedTrucks = [...availableTrucks].sort(
    (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
  );
  
  const selected: Truck[] = [];
  let remainingWeight = weightWithMargin;
  let remainingOrders = totalOrders;
  
  for (const truck of sortedTrucks) {
    if (remainingWeight <= 0) break;
    
    const effectiveCapacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    
    if (truck.max_deliveries && remainingOrders > 0) {
      const ordersThisTruck = Math.min(remainingOrders, truck.max_deliveries);
      if (ordersThisTruck > 0) {
        selected.push(truck);
        remainingWeight -= effectiveCapacity;
        remainingOrders -= ordersThisTruck;
      }
    } else {
      selected.push(truck);
      remainingWeight -= effectiveCapacity;
    }
  }
  
  while (remainingWeight > 0 && selected.length < sortedTrucks.length) {
    for (const truck of sortedTrucks) {
      if (!selected.find(t => t.id === truck.id)) {
        selected.push(truck);
        remainingWeight -= Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
        break;
      }
    }
  }
  
  return selected;
}

/**
 * Validate composition: check for city alternation and invalid mixtures
 */
export function validateComposition(
  compositions: TruckComposition[],
  extractedPatterns?: ExtractedPatterns
): CompositionValidation {
  const violations: string[] = [];
  
  for (const comp of compositions) {
    if (comp.orders.length === 0) continue;
    
    const cities = comp.cities.filter(c => c !== HUB_CITY);
    
    // Check city alternation in sequence
    if (comp.orders.length > 2) {
      const citySequence = comp.orders.map(o => {
        const parsed = parseAddress(o.address);
        return normalizeCityName(parsed.city || 'desconhecida');
      }).filter(c => c !== HUB_CITY && c !== 'desconhecida');

      let hasAlternation = false;
      const visitedCities = new Set<string>();
      let lastCity = '';
      for (const city of citySequence) {
        if (city !== lastCity) {
          if (visitedCities.has(city)) {
            hasAlternation = true;
            break;
          }
          if (lastCity) visitedCities.add(lastCity);
          lastCity = city;
        }
      }
      if (hasAlternation) {
        violations.push(`Caminhão ${comp.truck.plate}: Alternância de cidades na sequência de entregas`);
      }
    }
    
    if (cities.length <= 1) continue;
    
    // Check non-neighbor cities without history
    if (cities.length > 2) {
      let nonNeighborCount = 0;
      for (let i = 0; i < cities.length; i++) {
        for (let j = i + 1; j < cities.length; j++) {
          if (!areCitiesNeighbors(cities[i], cities[j])) {
            nonNeighborCount++;
          }
        }
      }
      if (nonNeighborCount > 1 && !extractedPatterns) {
        violations.push(
          `Caminhão ${comp.truck.plate}: ${cities.length} cidades não-vizinhas misturadas (${cities.join(', ')})`
        );
      }
    }
    
    // Historical validation
    if (extractedPatterns) {
      const check = isValidCityCombination(cities, extractedPatterns);
      if (!check.valid) {
        violations.push(`Caminhão ${comp.truck.plate}: ${check.reason}`);
      }
    }
  }
  
  return { valid: violations.length === 0, violations };
}

/**
 * Main auto-routing function - CITY-FIRST LOGIC
 */
export function autoComposeRoute(
  orders: ParsedOrder[],
  availableTrucks: Truck[],
  config: Partial<AutoRouterConfig> = {},
  historyHints?: RoutingHint[],
  extractedPatterns?: ExtractedPatterns
): AutoRouterResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const reasoning: string[] = [];
  
  if (orders.length === 0) {
    return {
      compositions: [], unassignedOrders: [], totalWeight: 0,
      totalOrders: 0, trucksUsed: 0, averageOccupancy: 0,
      warnings: ['Nenhum pedido para roteirizar'], reasoning: [],
      validation: { valid: true, violations: [] },
    };
  }
  
  const validOrders = orders.filter(o => o.isValid);
  const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
  const totalOrders = validOrders.length;
  
  const selectedTrucks = recommendTrucks(availableTrucks, totalWeight, totalOrders, cfg);
  
  if (selectedTrucks.length === 0) {
    return {
      compositions: [], unassignedOrders: validOrders, totalWeight,
      totalOrders, trucksUsed: 0, averageOccupancy: 0,
      warnings: ['Nenhum caminhão disponível para a carga'], reasoning: [],
      validation: { valid: true, violations: [] },
    };
  }
  
  // Step 1: Geocode orders
  const cd = getDistributionCenterCoords();
  const geocodedOrders: GeocodedOrder[] = validOrders.map(order => {
    const geocoded = parseAddress(order.address);
    const distanceFromCD = calculateDistance(
      cd.lat, cd.lng, geocoded.estimatedLat, geocoded.estimatedLng
    );
    const angle = Math.atan2(
      geocoded.estimatedLat - cd.lat,
      geocoded.estimatedLng - cd.lng
    ) * (180 / Math.PI);
    return { ...order, geocoded, distanceFromCD, angle };
  });
  
  // Step 2: Build city-first clusters
  const clusters = buildCityFirstClusters(
    geocodedOrders, selectedTrucks, cfg, extractedPatterns, reasoning
  );
  
  // Step 3: Map clusters to trucks
  const compositions = mapClustersToTrucks(clusters, selectedTrucks, cfg, reasoning);
  
  // Step 4: Optimize delivery sequence (city > CEP > bairro > rua)
  compositions.forEach(comp => {
    if (comp.orders.length > 1) {
      optimizeDeliverySequence(
        comp.orders as GeocodedOrder[], cd.lat, cd.lng, cfg.strategy
      );
    }
  });
  
  // Collect unassigned orders
  const assignedOrderIds = new Set(
    compositions.flatMap(c => c.orders.map(o => o.pedido_id || `${o.client_name}::${o.address}`))
  );
  const unassignedOrders = validOrders.filter(
    o => !assignedOrderIds.has(o.pedido_id || `${o.client_name}::${o.address}`)
  );
  
  if (unassignedOrders.length > 0) {
    warnings.push(`${unassignedOrders.length} pedidos não puderam ser atribuídos — frota insuficiente para manter coerência territorial`);
  }
  
  const totalCapacityUsed = compositions.reduce((sum, c) => sum + c.totalWeight, 0);
  const totalCapacity = compositions.reduce((sum, c) => sum + Number(c.truck.capacity_kg), 0);
  const averageOccupancy = totalCapacity > 0 ? (totalCapacityUsed / totalCapacity) * 100 : 0;
  
  if (historyHints && historyHints.length > 0) {
    reasoning.push(`${historyHints.length} padrões históricos foram considerados nesta composição`);
  }
  
  const validation = validateComposition(compositions, extractedPatterns);
  if (!validation.valid) {
    warnings.push('⚠️ Composição contém violações de coerência territorial');
  }
  
  return {
    compositions, unassignedOrders, totalWeight, totalOrders,
    trucksUsed: compositions.filter(c => c.orders.length > 0).length,
    averageOccupancy: Math.round(averageOccupancy),
    warnings, reasoning, validation,
  };
}

// ================================================================
// CITY-FIRST CLUSTERING
// ================================================================

/**
 * Build clusters with CITY as primary unit.
 * 
 * 1. Group orders by city, normalize names
 * 2. Order cities by volume (count desc, weight desc)
 * 3. Allocate exclusive trucks per city (largest first)
 * 4. Intelligent fitting: small cities -> trucks with spare capacity
 *    ONLY if neighbor + historical co-occurrence
 * 5. NO force merge. Excess clusters -> unassigned with warning.
 */
function buildCityFirstClusters(
  orders: GeocodedOrder[],
  trucks: Truck[],
  config: AutoRouterConfig,
  extractedPatterns?: ExtractedPatterns,
  reasoning?: string[]
): CityCluster[] {
  const numTrucks = trucks.length;
  const truckCapacities = trucks
    .map(t => Number(t.capacity_kg) * (config.maxOccupancyPercent / 100))
    .sort((a, b) => b - a);
  const maxTruckCapacity = truckCapacities[0] || 5000;

  // === ETAPA 1: Agrupar pedidos por cidade ===
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const order of orders) {
    const city = normalizeCityName(order.geocoded.city || 'desconhecida');
    const existing = cityOrderMap.get(city) || [];
    existing.push(order);
    cityOrderMap.set(city, existing);
  }

  // === ETAPA 1b: Separar hub (Barueri) ===
  const hubOrders = cityOrderMap.get(HUB_CITY) || [];
  cityOrderMap.delete(HUB_CITY);

  // === ETAPA 2: Ordenar cidades por volume ===
  const cityStats: { city: string; count: number; weight: number; orders: GeocodedOrder[] }[] = [];
  for (const [city, cityOrders] of cityOrderMap) {
    const weight = cityOrders.reduce((s, o) => s + o.weight_kg, 0);
    cityStats.push({ city, count: cityOrders.length, weight, orders: cityOrders });
  }
  // Sort: count desc, then weight desc
  cityStats.sort((a, b) => b.count - a.count || b.weight - a.weight);

  reasoning?.push(`Cidades por volume: ${cityStats.map(c => `${c.city}(${c.count}ped/${(c.weight/1000).toFixed(1)}t)`).join(', ')}`);
  if (hubOrders.length > 0) {
    const hubWeight = hubOrders.reduce((s, o) => s + o.weight_kg, 0);
    reasoning?.push(`Hub (${HUB_CITY}): ${hubOrders.length} entregas (${(hubWeight/1000).toFixed(1)}t) — serão distribuídas entre caminhões`);
  }

  // === ETAPA 3: Alocar caminhões exclusivos por cidade ===
  const clusters: CityCluster[] = [];
  const allocatedCities = new Set<string>();

  for (const cityStat of cityStats) {
    const { city, weight: cityWeight, orders: cityOrders } = cityStat;
    
    // How many trucks does this city need?
    const trucksNeeded = Math.max(1, Math.ceil(cityWeight / maxTruckCapacity));
    const cityCap = city.charAt(0).toUpperCase() + city.slice(1);

    if (trucksNeeded === 1) {
      clusters.push({
        primaryCity: city,
        complementCities: [],
        cities: new Set([city]),
        orders: [...cityOrders],
        weight: cityWeight,
        reasoning: [`${cityCap}: ${cityOrders.length} entregas (${(cityWeight/1000).toFixed(1)}t)`],
      });
    } else {
      // Split city into N blocks by proximity to CD
      reasoning?.push(`${cityCap} dividida em ${trucksNeeded} caminhões (${(cityWeight/1000).toFixed(1)}t total)`);
      const sorted = [...cityOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);
      const subClusters: GeocodedOrder[][] = Array.from({ length: trucksNeeded }, () => []);
      const subWeights = new Array(trucksNeeded).fill(0);

      for (const order of sorted) {
        let minIdx = 0;
        for (let i = 1; i < trucksNeeded; i++) {
          if (subWeights[i] < subWeights[minIdx]) minIdx = i;
        }
        subClusters[minIdx].push(order);
        subWeights[minIdx] += order.weight_kg;
      }

      for (let i = 0; i < trucksNeeded; i++) {
        clusters.push({
          primaryCity: city,
          complementCities: [],
          cities: new Set([city]),
          orders: subClusters[i],
          weight: subWeights[i],
          reasoning: [`${cityCap} bloco ${i + 1}/${trucksNeeded} (${(subWeights[i]/1000).toFixed(1)}t)`],
        });
      }
    }

    allocatedCities.add(city);
  }

  // === ETAPA 4: Encaixe inteligente de cidades pequenas ===
  // For small cities: try to fit into existing clusters with spare capacity
  // ONLY if neighbor AND (historical co-occurrence OR no history data)
  
  // Identify which clusters are "small" (could be absorbed)
  // Sort clusters by weight to find small ones
  const smallThreshold = maxTruckCapacity * 0.25; // Cities using <25% of a truck
  
  // Separate small clusters that could be absorbed
  const mainClusters: CityCluster[] = [];
  const smallClusters: CityCluster[] = [];
  
  for (const cluster of clusters) {
    if (cluster.weight < smallThreshold && cluster.orders.length <= 5) {
      smallClusters.push(cluster);
    } else {
      mainClusters.push(cluster);
    }
  }

  // Try to fit each small cluster into a main cluster
  const absorbedSmall = new Set<number>();
  
  for (let si = 0; si < smallClusters.length; si++) {
    const small = smallClusters[si];
    let fitted = false;

    for (const main of mainClusters) {
      // Check capacity
      if (main.weight + small.weight > maxTruckCapacity) continue;

      // Check neighbor
      const isNeighbor = areCitiesNeighbors(main.primaryCity, small.primaryCity);
      if (!isNeighbor) continue;

      // Check historical compatibility
      if (extractedPatterns) {
        const testCities = [...main.cities, ...small.cities].filter(c => c !== HUB_CITY);
        const check = isValidCityCombination(Array.from(new Set(testCities)), extractedPatterns);
        if (!check.valid) continue;
      }

      // Fit!
      main.orders.push(...small.orders);
      main.weight += small.weight;
      for (const c of small.cities) main.cities.add(c);
      main.complementCities.push(small.primaryCity);
      const smallCap = small.primaryCity.charAt(0).toUpperCase() + small.primaryCity.slice(1);
      main.reasoning.push(`+ Complemento: ${smallCap} (${small.orders.length} entregas, vizinha)`);
      reasoning?.push(`${smallCap} encaixada em ${main.primaryCity} (vizinha, cabe no peso)`);
      fitted = true;
      absorbedSmall.add(si);
      break;
    }
  }

  // Rebuild final cluster list: main + unabsorbed small
  const finalClusters: CityCluster[] = [...mainClusters];
  for (let si = 0; si < smallClusters.length; si++) {
    if (!absorbedSmall.has(si)) {
      finalClusters.push(smallClusters[si]);
    }
  }

  // === ETAPA 4b: If still more clusters than trucks, try compatible merges (NO force merge) ===
  if (finalClusters.length > numTrucks) {
    reasoning?.push(`${finalClusters.length} clusters para ${numTrucks} caminhões — tentando consolidação compatível`);

    // Sort by weight asc to try merging smallest first
    finalClusters.sort((a, b) => a.weight - b.weight);

    let attempts = 0;
    while (finalClusters.length > numTrucks && attempts < finalClusters.length * 2) {
      attempts++;
      const smallest = finalClusters[0];

      let merged = false;
      for (let i = 1; i < finalClusters.length; i++) {
        const target = finalClusters[i];
        if (target.weight + smallest.weight > maxTruckCapacity) continue;

        // Must be neighbor
        if (!areCitiesNeighbors(target.primaryCity, smallest.primaryCity)) continue;

        // Must be historically compatible
        if (extractedPatterns) {
          const allCities = [...target.cities, ...smallest.cities].filter(c => c !== HUB_CITY);
          const check = isValidCityCombination(Array.from(new Set(allCities)), extractedPatterns);
          if (!check.valid) continue;
        }

        target.orders.push(...smallest.orders);
        target.weight += smallest.weight;
        for (const c of smallest.cities) target.cities.add(c);
        target.complementCities.push(smallest.primaryCity);
        target.reasoning.push(`Consolidada com "${smallest.primaryCity}" (${(smallest.weight/1000).toFixed(1)}t, vizinha)`);
        reasoning?.push(`"${smallest.primaryCity}" consolidada com "${target.primaryCity}" (vizinhas)`);
        finalClusters.splice(0, 1);
        merged = true;
        break;
      }

      if (!merged) {
        // NO FORCE MERGE — move smallest to end and try next
        // If we've cycled through all, stop
        const moved = finalClusters.shift()!;
        finalClusters.push(moved);
        
        // Check if we've rotated all the way around
        if (attempts >= finalClusters.length * 2) break;
      }
    }

    if (finalClusters.length > numTrucks) {
      const excess = finalClusters.length - numTrucks;
      reasoning?.push(`⚠️ ${excess} cluster(s) excedente(s) — pedidos serão marcados como não atribuídos`);
    }
  }

  // === ETAPA 5: Distribuir hub orders (Barueri) proporcionalmente ===
  if (hubOrders.length > 0 && finalClusters.length > 0) {
    reasoning?.push(`Distribuindo ${hubOrders.length} entregas do hub (${HUB_CITY}) entre ${Math.min(finalClusters.length, numTrucks)} caminhões`);
    
    const sortedHub = [...hubOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);

    for (const order of sortedHub) {
      // Find cluster with most remaining capacity (only consider first N clusters that will get trucks)
      const eligibleClusters = finalClusters.slice(0, numTrucks);
      let bestIdx = 0;
      let bestRemaining = -Infinity;
      for (let i = 0; i < eligibleClusters.length; i++) {
        const remaining = maxTruckCapacity - eligibleClusters[i].weight;
        if (remaining > bestRemaining) {
          bestRemaining = remaining;
          bestIdx = i;
        }
      }

      if (bestRemaining >= order.weight_kg) {
        eligibleClusters[bestIdx].orders.push(order);
        eligibleClusters[bestIdx].weight += order.weight_kg;
        eligibleClusters[bestIdx].cities.add(HUB_CITY);
      }
    }
  }

  return finalClusters;
}

// ================================================================
// CLUSTER-TO-TRUCK MAPPING
// ================================================================

function mapClustersToTrucks(
  clusters: CityCluster[],
  trucks: Truck[],
  config: AutoRouterConfig,
  reasoning?: string[]
): TruckComposition[] {
  // Only map up to numTrucks clusters; excess become unassigned
  const sortedClusters = [...clusters].sort((a, b) => b.weight - a.weight);
  const sortedTrucks = [...trucks].sort(
    (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
  );

  const compositions: TruckComposition[] = [];
  const usedTruckIds = new Set<string>();

  for (let i = 0; i < Math.min(sortedClusters.length, sortedTrucks.length); i++) {
    const cluster = sortedClusters[i];
    let selectedTruck: Truck | null = null;
    for (const truck of sortedTrucks) {
      if (usedTruckIds.has(truck.id)) continue;
      selectedTruck = truck;
      break;
    }

    if (!selectedTruck) {
      reasoning?.push(`⚠️ Sem caminhão para cluster de "${cluster.primaryCity}"`);
      continue;
    }

    usedTruckIds.add(selectedTruck.id);

    const capacity = Number(selectedTruck.capacity_kg);
    const maxWeight = capacity * (config.maxOccupancyPercent / 100);

    const fittingOrders: ParsedOrder[] = [];
    let currentWeight = 0;

    for (const order of cluster.orders) {
      if (currentWeight + order.weight_kg <= maxWeight) {
        fittingOrders.push(order);
        currentWeight += order.weight_kg;
      }
    }

    compositions.push({
      truck: selectedTruck,
      orders: fittingOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / capacity) * 100),
      estimatedDeliveries: fittingOrders.length,
      cities: Array.from(cluster.cities),
      primaryCity: cluster.primaryCity,
      complementCities: cluster.complementCities.length > 0 ? cluster.complementCities : undefined,
    });
  }

  // If there are excess clusters beyond truck count, those orders become unassigned
  // (they won't appear in compositions, so they'll be caught by the unassigned check)

  // Empty compositions for remaining trucks
  for (const truck of sortedTrucks) {
    if (!usedTruckIds.has(truck.id)) {
      compositions.push({
        truck, orders: [], totalWeight: 0, occupancyPercent: 0,
        estimatedDeliveries: 0, cities: [],
      });
    }
  }

  return compositions;
}

// ================================================================
// DELIVERY SEQUENCE: CITY > CEP > BAIRRO > RUA (blocos contínuos)
// ================================================================

/**
 * Optimizes delivery sequence ensuring:
 * 1. All deliveries of same city in continuous block
 * 2. Cities ordered by proximity to CD (or farthest first for finalizacao_proxima)
 * 3. Within each city block: CEP (5 digits) > neighborhood > street
 * 4. NO city alternation allowed
 */
function optimizeDeliverySequence(
  orders: GeocodedOrder[],
  startLat: number,
  startLng: number,
  strategy: RoutingStrategy
): void {
  if (orders.length <= 1) return;

  // Step 1: Group by city
  const cityGroups = new Map<string, GeocodedOrder[]>();
  for (const order of orders) {
    const city = normalizeCityName(order.geocoded.city || 'desconhecida');
    const existing = cityGroups.get(city) || [];
    existing.push(order);
    cityGroups.set(city, existing);
  }

  // Step 2: Order cities
  // Calculate average distance from CD for each city group
  const cityDistances: { city: string; avgDist: number; orders: GeocodedOrder[] }[] = [];
  for (const [city, cityOrders] of cityGroups) {
    const avgDist = cityOrders.reduce((s, o) => s + o.distanceFromCD, 0) / cityOrders.length;
    cityDistances.push({ city, avgDist, orders: cityOrders });
  }

  if (strategy === 'finalizacao_proxima') {
    // Start from farthest, end closest (closest to CD last)
    cityDistances.sort((a, b) => b.avgDist - a.avgDist);
  } else {
    // Default: closest to CD first
    cityDistances.sort((a, b) => a.avgDist - b.avgDist);
  }

  // Step 3: Within each city block, sort by CEP > neighborhood > street
  const result: GeocodedOrder[] = [];
  
  for (const cityGroup of cityDistances) {
    const cityOrders = cityGroup.orders;
    
    // Sort within city: CEP prefix (5 digits) -> neighborhood -> street -> nearest neighbor
    cityOrders.sort((a, b) => {
      const cepA = (a.geocoded.zipCode || '').replace(/\D/g, '').substring(0, 5);
      const cepB = (b.geocoded.zipCode || '').replace(/\D/g, '').substring(0, 5);
      if (cepA !== cepB) return cepA.localeCompare(cepB);
      
      const neighborhoodA = (a.geocoded.neighborhood || '').toLowerCase();
      const neighborhoodB = (b.geocoded.neighborhood || '').toLowerCase();
      if (neighborhoodA !== neighborhoodB) return neighborhoodA.localeCompare(neighborhoodB);
      
      const streetA = (a.geocoded.street || '').toLowerCase();
      const streetB = (b.geocoded.street || '').toLowerCase();
      if (streetA !== streetB) return streetA.localeCompare(streetB);
      
      return a.distanceFromCD - b.distanceFromCD;
    });
    
    result.push(...cityOrders);
  }

  orders.length = 0;
  orders.push(...result);
}

/**
 * Get summary statistics for display
 */
export function getRoutingSummary(result: AutoRouterResult): {
  trucksActive: number;
  totalDeliveries: number;
  totalWeight: string;
  avgOccupancy: string;
  efficiency: 'excellent' | 'good' | 'fair' | 'poor';
} {
  const trucksActive = result.compositions.filter(c => c.orders.length > 0).length;
  const totalDeliveries = result.compositions.reduce((sum, c) => sum + c.orders.length, 0);
  
  const formatWeight = (w: number) => w >= 1000 ? `${(w / 1000).toFixed(1)}t` : `${w.toFixed(0)}kg`;
  
  let efficiency: 'excellent' | 'good' | 'fair' | 'poor';
  if (result.averageOccupancy >= 80) efficiency = 'excellent';
  else if (result.averageOccupancy >= 65) efficiency = 'good';
  else if (result.averageOccupancy >= 50) efficiency = 'fair';
  else efficiency = 'poor';
  
  return {
    trucksActive,
    totalDeliveries,
    totalWeight: formatWeight(result.totalWeight),
    avgOccupancy: `${result.averageOccupancy}%`,
    efficiency,
  };
}
