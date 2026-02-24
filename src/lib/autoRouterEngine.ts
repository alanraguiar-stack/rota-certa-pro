/**
 * Motor de Roteamento Automático - Lógica Territorial Rígida
 * 
 * REGRA ABSOLUTA: Roteirização é TERRITORIAL, não geométrica.
 * Uma cidade por caminhão. Esgotar volume antes de passar para a próxima.
 * Mistura de cidades SÓ é permitida quando o histórico do analista confirma.
 */

import { Truck, ParsedOrder, RoutingStrategy } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName, areCitiesNeighbors, getCityDistanceFromCD } from './geocoding';
import { ParsedItemDetail } from './itemDetailParser';
import { RoutingHint, ExtractedPatterns, isValidCityCombination, getCityExclusionMap } from './historyPatternEngine';

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
  /** Cities assigned to this truck (for validation) */
  cities: string[];
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

/** A territorial cluster: one logical truck load, ideally one city */
interface TerritorialCluster {
  primaryCity: string;
  cities: Set<string>;
  orders: GeocodedOrder[];
  weight: number;
  reasoning: string[];
}

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
 * Validate a composition against territorial rules and history
 */
export function validateComposition(
  compositions: TruckComposition[],
  extractedPatterns?: ExtractedPatterns
): CompositionValidation {
  const violations: string[] = [];
  
  for (const comp of compositions) {
    if (comp.orders.length === 0) continue;
    
    const cities = comp.cities;
    if (cities.length <= 1) continue;
    
    // Check if this city mixture is historically valid
    if (extractedPatterns) {
      const check = isValidCityCombination(cities, extractedPatterns);
      if (!check.valid) {
        violations.push(
          `Caminhão ${comp.truck.plate}: ${check.reason}`
        );
      }
      
      // Check exclusion map
      const exclusions = getCityExclusionMap(extractedPatterns);
      for (const cityA of cities) {
        const excluded = exclusions.get(cityA);
        if (!excluded) continue;
        for (const cityB of cities) {
          if (cityA !== cityB && excluded.has(cityB)) {
            violations.push(
              `Caminhão ${comp.truck.plate}: "${cityA}" e "${cityB}" NUNCA ficam juntas no histórico`
            );
          }
        }
      }
    } else {
      // No history available - flag any truck with 3+ cities as suspicious
      if (cities.length >= 3) {
        violations.push(
          `Caminhão ${comp.truck.plate}: ${cities.length} cidades misturadas (${cities.join(', ')}). Sem histórico para validar.`
        );
      }
    }
  }
  
  return { valid: violations.length === 0, violations };
}

/**
 * Main auto-routing function - TERRITORIAL LOGIC
 * 
 * Flow:
 * 1. Group ALL orders by city
 * 2. Order cities by volume (largest first)
 * 3. Allocate trucks city-by-city, exhausting each city before moving on
 * 4. Controlled overflow: only mix cities if history confirms the pattern
 * 5. Validate result against historical patterns
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
  
  // Step 2: Build territorial clusters (CITY-FIRST logic)
  const clusters = buildTerritorialClusters(
    geocodedOrders, selectedTrucks, cfg, historyHints, extractedPatterns, reasoning
  );
  
  // Step 3: Map clusters directly to trucks (NO bin-packing)
  const compositions = mapClustersToTrucks(clusters, selectedTrucks, cfg, reasoning);
  
  // Step 4: Optimize delivery sequence within each truck
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
    warnings.push(`${unassignedOrders.length} pedidos não puderam ser atribuídos por excesso de capacidade`);
  }
  
  // Calculate average occupancy
  const totalCapacityUsed = compositions.reduce((sum, c) => sum + c.totalWeight, 0);
  const totalCapacity = compositions.reduce((sum, c) => sum + Number(c.truck.capacity_kg), 0);
  const averageOccupancy = totalCapacity > 0 ? (totalCapacityUsed / totalCapacity) * 100 : 0;
  
  if (historyHints && historyHints.length > 0) {
    reasoning.push(`${historyHints.length} padrões históricos foram considerados nesta composição`);
  }
  
  // Step 5: Validate composition against territorial rules
  const validation = validateComposition(compositions, extractedPatterns);
  if (!validation.valid) {
    warnings.push('⚠️ Composição contém misturas de cidades fora do padrão operacional');
  }
  
  return {
    compositions, unassignedOrders, totalWeight, totalOrders,
    trucksUsed: compositions.filter(c => c.orders.length > 0).length,
    averageOccupancy: Math.round(averageOccupancy),
    warnings, reasoning, validation,
  };
}

// ================================================================
// TERRITORIAL CLUSTERING - City-First, Capacity-Bounded
// ================================================================

/**
 * Build territorial clusters following strict city-first logic:
 * 1. Group all orders by city
 * 2. Sort cities by volume (largest first), with history priority
 * 3. Create exclusive clusters per city
 * 4. If a city needs multiple trucks, split into sub-clusters
 * 5. Controlled overflow only if history permits
 */
function buildTerritorialClusters(
  orders: GeocodedOrder[],
  trucks: Truck[],
  config: AutoRouterConfig,
  historyHints?: RoutingHint[],
  extractedPatterns?: ExtractedPatterns,
  reasoning?: string[]
): TerritorialCluster[] {
  const numTrucks = trucks.length;
  // Use max truck capacity as reference for cluster sizing
  const truckCapacities = trucks
    .map(t => Number(t.capacity_kg) * (config.maxOccupancyPercent / 100))
    .sort((a, b) => b - a);
  const maxTruckCapacity = truckCapacities[0] || 5000;

  // === STEP 1: Group ALL orders by city ===
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const order of orders) {
    const city = normalizeCityName(order.geocoded.city || 'desconhecida');
    const existing = cityOrderMap.get(city) || [];
    existing.push(order);
    cityOrderMap.set(city, existing);
  }

  // === STEP 2: Build city info and sort ===
  interface CityBlock {
    city: string;
    orders: GeocodedOrder[];
    weight: number;
    assigned: boolean;
  }

  const cityBlocks: CityBlock[] = [];
  for (const [city, cityOrders] of cityOrderMap) {
    const weight = cityOrders.reduce((s, o) => s + o.weight_kg, 0);
    cityBlocks.push({ city, orders: cityOrders, weight, assigned: false });
  }

  // Parse history hints
  const dedicatedCities = new Set<string>();
  const combinePairs = new Map<string, Set<string>>();

  if (historyHints) {
    for (const hint of historyHints) {
      if (hint.confidence < 60) continue;
      if (hint.type === 'dedicate_truck') {
        for (const c of hint.cities) dedicatedCities.add(normalizeCityName(c));
        reasoning?.push(hint.reasoning);
      } else if (hint.type === 'combine_cities' && hint.cities.length >= 2) {
        const normCities = hint.cities.map(c => normalizeCityName(c));
        for (const c of normCities) {
          if (!combinePairs.has(c)) combinePairs.set(c, new Set());
          for (const other of normCities) {
            if (other !== c) combinePairs.get(c)!.add(other);
          }
        }
        reasoning?.push(hint.reasoning);
      }
    }
  }

  // Sort: dedicated cities first, then by weight descending
  cityBlocks.sort((a, b) => {
    const aDed = dedicatedCities.has(a.city) ? 1 : 0;
    const bDed = dedicatedCities.has(b.city) ? 1 : 0;
    if (aDed !== bDed) return bDed - aDed;
    return b.weight - a.weight;
  });

  reasoning?.push(`Mapa territorial: ${cityBlocks.map(c => `${c.city}(${(c.weight/1000).toFixed(1)}t)`).join(', ')}`);

  // === STEP 3: Create EXCLUSIVE clusters, one city at a time ===
  const clusters: TerritorialCluster[] = [];

  for (const block of cityBlocks) {
    if (block.assigned) continue;

    // How many trucks does this city need?
    const trucksNeeded = Math.ceil(block.weight / maxTruckCapacity);

    if (trucksNeeded <= 1) {
      // Single cluster for this city
      clusters.push({
        primaryCity: block.city,
        cities: new Set([block.city]),
        orders: [...block.orders],
        weight: block.weight,
        reasoning: [`Cidade exclusiva: ${block.city} (${(block.weight/1000).toFixed(1)}t)`],
      });
    } else {
      // Split city into N sub-clusters, balanced by weight
      reasoning?.push(`"${block.city}" dividida em ${trucksNeeded} caminhões (${(block.weight/1000).toFixed(1)}t total)`);
      
      // Sort orders by distance from CD for geographic coherence within city
      const sorted = [...block.orders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);
      const subClusters: GeocodedOrder[][] = Array.from({ length: trucksNeeded }, () => []);
      const subWeights = new Array(trucksNeeded).fill(0);

      for (const order of sorted) {
        // Find sub-cluster with least weight
        let minIdx = 0;
        for (let i = 1; i < trucksNeeded; i++) {
          if (subWeights[i] < subWeights[minIdx]) minIdx = i;
        }
        subClusters[minIdx].push(order);
        subWeights[minIdx] += order.weight_kg;
      }

      for (let i = 0; i < trucksNeeded; i++) {
        clusters.push({
          primaryCity: block.city,
          cities: new Set([block.city]),
          orders: subClusters[i],
          weight: subWeights[i],
          reasoning: [`${block.city} - bloco ${i + 1}/${trucksNeeded} (${(subWeights[i]/1000).toFixed(1)}t)`],
        });
      }
    }

    block.assigned = true;
  }

  // === STEP 4: CONTROLLED OVERFLOW ===
  // Only for clusters with significant remaining capacity AND historical permission
  const exclusionMap = extractedPatterns ? getCityExclusionMap(extractedPatterns) : new Map();
  
  // Find small unassigned cities that could complement existing clusters
  // But ONLY if they're too small for their own truck AND history permits
  const smallOrphans = cityBlocks.filter(b => !b.assigned);
  // (All cities should be assigned at this point since Step 3 creates clusters for ALL)
  // This handles any edge case

  for (const orphan of smallOrphans) {
    if (orphan.assigned) continue;

    let bestCluster: TerritorialCluster | null = null;
    let bestReason = '';

    // Try to find a cluster where this city historically belongs
    for (const cluster of clusters) {
      const historySet = combinePairs.get(orphan.city);
      if (historySet && historySet.has(cluster.primaryCity)) {
        // Check exclusion
        const excluded = exclusionMap.get(orphan.city);
        if (excluded && Array.from(cluster.cities).some(c => excluded.has(c))) continue;

        // Check weight
        if (cluster.weight + orphan.weight <= maxTruckCapacity) {
          bestCluster = cluster;
          bestReason = `combinada com "${cluster.primaryCity}" (padrão histórico)`;
          break;
        }
      }
    }

    if (bestCluster) {
      bestCluster.orders.push(...orphan.orders);
      bestCluster.weight += orphan.weight;
      bestCluster.cities.add(orphan.city);
      bestCluster.reasoning.push(`"${orphan.city}" ${bestReason}`);
      reasoning?.push(`"${orphan.city}" ${bestReason}`);
      orphan.assigned = true;
    }
    // If no historical match: the city already has its own cluster from Step 3
  }

  // Limit clusters to available trucks
  if (clusters.length > numTrucks) {
    reasoning?.push(`${clusters.length} clusters para ${numTrucks} caminhões - consolidando menores`);
    // Merge smallest clusters into compatible ones
    while (clusters.length > numTrucks) {
      // Find smallest cluster
      clusters.sort((a, b) => a.weight - b.weight);
      const smallest = clusters[0];
      
      // Find best merge target (historically compatible, has capacity)
      let merged = false;
      for (let i = 1; i < clusters.length; i++) {
        const target = clusters[i];
        const combinedWeight = target.weight + smallest.weight;
        if (combinedWeight > maxTruckCapacity) continue;

        // Check if combination is historically valid
        const allCities = [...target.cities, ...smallest.cities];
        if (extractedPatterns) {
          const check = isValidCityCombination(allCities, extractedPatterns);
          if (!check.valid) continue;
        }

        // Check exclusion
        let excluded = false;
        for (const cityA of smallest.cities) {
          const excl = exclusionMap.get(cityA);
          if (excl && Array.from(target.cities).some(c => excl.has(c))) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;

        // Merge
        target.orders.push(...smallest.orders);
        target.weight += smallest.weight;
        for (const c of smallest.cities) target.cities.add(c);
        target.reasoning.push(`Consolidada com "${smallest.primaryCity}" (${(smallest.weight/1000).toFixed(1)}t)`);
        reasoning?.push(`"${smallest.primaryCity}" consolidada com "${target.primaryCity}" por limite de caminhões`);
        clusters.splice(0, 1);
        merged = true;
        break;
      }

      if (!merged) {
        // Force merge into least-loaded cluster (last resort)
        clusters.sort((a, b) => a.weight - b.weight);
        const target = clusters[1] || clusters[0];
        if (target !== smallest) {
          target.orders.push(...smallest.orders);
          target.weight += smallest.weight;
          for (const c of smallest.cities) target.cities.add(c);
          target.reasoning.push(`FORÇADO: "${smallest.primaryCity}" consolidada (falta de caminhões)`);
          reasoning?.push(`⚠️ "${smallest.primaryCity}" forçada para "${target.primaryCity}" (falta de caminhões)`);
          clusters.splice(clusters.indexOf(smallest), 1);
        } else {
          break; // Can't merge with itself
        }
      }
    }
  }

  return clusters;
}

// ================================================================
// DIRECT CLUSTER-TO-TRUCK MAPPING (NO BIN-PACKING)
// ================================================================

/**
 * Map territorial clusters directly to trucks.
 * Heaviest cluster -> largest truck. NO order shuffling between clusters.
 */
function mapClustersToTrucks(
  clusters: TerritorialCluster[],
  trucks: Truck[],
  config: AutoRouterConfig,
  reasoning?: string[]
): TruckComposition[] {
  // Sort clusters by weight descending
  const sortedClusters = [...clusters].sort((a, b) => b.weight - a.weight);
  
  // Sort trucks by capacity descending
  const sortedTrucks = [...trucks].sort(
    (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
  );

  const compositions: TruckComposition[] = [];
  const usedTruckIds = new Set<string>();

  for (let i = 0; i < sortedClusters.length; i++) {
    const cluster = sortedClusters[i];
    
    // Find best available truck (largest remaining that fits)
    let selectedTruck: Truck | null = null;
    for (const truck of sortedTrucks) {
      if (usedTruckIds.has(truck.id)) continue;
      selectedTruck = truck;
      break;
    }

    if (!selectedTruck) {
      // No more trucks available - orders become unassigned
      reasoning?.push(`⚠️ Sem caminhão para cluster de "${cluster.primaryCity}" (${(cluster.weight/1000).toFixed(1)}t)`);
      continue;
    }

    usedTruckIds.add(selectedTruck.id);

    const capacity = Number(selectedTruck.capacity_kg);
    const maxWeight = capacity * (config.maxOccupancyPercent / 100);

    // Add orders that fit (respect capacity)
    const fittingOrders: ParsedOrder[] = [];
    let currentWeight = 0;
    const overflowOrders: ParsedOrder[] = [];

    for (const order of cluster.orders) {
      if (currentWeight + order.weight_kg <= maxWeight) {
        fittingOrders.push(order);
        currentWeight += order.weight_kg;
      } else {
        overflowOrders.push(order);
      }
    }

    if (overflowOrders.length > 0) {
      reasoning?.push(`⚠️ ${overflowOrders.length} pedidos de "${cluster.primaryCity}" excederam capacidade do caminhão ${selectedTruck.plate}`);
    }

    compositions.push({
      truck: selectedTruck,
      orders: fittingOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / capacity) * 100),
      estimatedDeliveries: fittingOrders.length,
      cities: Array.from(cluster.cities),
    });
  }

  // Add empty compositions for remaining trucks
  for (const truck of sortedTrucks) {
    if (!usedTruckIds.has(truck.id)) {
      compositions.push({
        truck,
        orders: [],
        totalWeight: 0,
        occupancyPercent: 0,
        estimatedDeliveries: 0,
        cities: [],
      });
    }
  }

  return compositions;
}

// ================================================================
// DELIVERY SEQUENCE OPTIMIZATION (within single truck territory)
// ================================================================

/**
 * Optimize delivery sequence using nearest-neighbor with proximity bonuses.
 * "Closest" is always RELATIVE to the truck's territory.
 */
function optimizeDeliverySequence(
  orders: GeocodedOrder[],
  startLat: number,
  startLng: number,
  strategy: RoutingStrategy
): void {
  if (orders.length <= 1) return;

  let curLat = startLat;
  let curLng = startLng;

  // For finalizacao_proxima, start from farthest point
  if (strategy === 'finalizacao_proxima') {
    const farthest = [...orders].sort((a, b) => b.distanceFromCD - a.distanceFromCD)[0];
    if (farthest) {
      curLat = farthest.geocoded.estimatedLat;
      curLng = farthest.geocoded.estimatedLng;
    }
  }

  const result: GeocodedOrder[] = [];
  const remaining = [...orders];
  let curCity = '';
  let curNeighborhood = '';
  let curStreet = '';

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      let dist = calculateDistance(
        curLat, curLng,
        c.geocoded.estimatedLat, c.geocoded.estimatedLng
      );

      const cCity = (c.geocoded.city || '').toLowerCase().trim();
      const cNeighborhood = (c.geocoded.neighborhood || '').toLowerCase();
      const cStreet = c.geocoded.street || '';

      // Proximity bonuses (within truck's territory)
      if (curStreet && cStreet && curStreet === cStreet && curCity === cCity) {
        dist *= 0.15;
      } else if (curNeighborhood && cNeighborhood && curNeighborhood === cNeighborhood && curCity === cCity) {
        dist *= 0.30;
      } else if (curCity && curCity === cCity) {
        dist *= 0.70;
      } else if (curCity && areCitiesNeighbors(curCity, cCity)) {
        dist *= 0.85;
      }

      if (dist < bestScore) {
        bestScore = dist;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    result.push(chosen);
    curLat = chosen.geocoded.estimatedLat;
    curLng = chosen.geocoded.estimatedLng;
    curCity = (chosen.geocoded.city || '').toLowerCase().trim();
    curNeighborhood = (chosen.geocoded.neighborhood || '').toLowerCase();
    curStreet = chosen.geocoded.street || '';
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
