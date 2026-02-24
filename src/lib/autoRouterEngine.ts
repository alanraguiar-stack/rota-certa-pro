/**
 * Motor de Roteamento Automático - Lógica de CORREDORES REGIONAIS
 * 
 * REGRA: O analista agrupa cidades em CORREDORES REGIONAIS fixos.
 * Não é uma cidade por caminhão, mas sim um CORREDOR por caminhão.
 * Barueri (CD) é distribuída entre todos os caminhões.
 */

import { Truck, ParsedOrder, RoutingStrategy } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName, areCitiesNeighbors } from './geocoding';
import { ParsedItemDetail } from './itemDetailParser';
import { RoutingHint, ExtractedPatterns, RegionalCorridor, isValidCityCombination, getCityExclusionMap, matchOrdersToCorridor, findCorridorName } from './historyPatternEngine';

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
  corridorName?: string;
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

interface CorridorCluster {
  corridorId: string | null;
  corridorName: string | null;
  coreCity: string;
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
 * Validate a composition against corridor rules and history
 */
export function validateComposition(
  compositions: TruckComposition[],
  extractedPatterns?: ExtractedPatterns
): CompositionValidation {
  const violations: string[] = [];
  
  for (const comp of compositions) {
    if (comp.orders.length === 0) continue;
    
    const cities = comp.cities.filter(c => c !== HUB_CITY);
    if (cities.length <= 1) continue;
    
    if (extractedPatterns) {
      const check = isValidCityCombination(cities, extractedPatterns);
      if (!check.valid) {
        violations.push(`Caminhão ${comp.truck.plate}: ${check.reason}`);
      }
    } else {
      if (cities.length >= 4) {
        violations.push(
          `Caminhão ${comp.truck.plate}: ${cities.length} cidades misturadas (${cities.join(', ')}). Sem histórico para validar.`
        );
      }
    }
  }
  
  return { valid: violations.length === 0, violations };
}

/**
 * Main auto-routing function - CORRIDOR-BASED LOGIC
 * 
 * Flow:
 * 1. Group all orders by city
 * 2. Match cities to historical corridors
 * 3. Build corridor-based clusters
 * 4. Distribute hub city (Barueri) across trucks
 * 5. Map clusters to trucks, validate
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
  
  // Step 2: Build corridor-based clusters
  const clusters = buildCorridorClusters(
    geocodedOrders, selectedTrucks, cfg, extractedPatterns, reasoning
  );
  
  // Step 3: Map clusters to trucks
  const compositions = mapClustersToTrucks(clusters, selectedTrucks, cfg, extractedPatterns, reasoning);
  
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
  
  const totalCapacityUsed = compositions.reduce((sum, c) => sum + c.totalWeight, 0);
  const totalCapacity = compositions.reduce((sum, c) => sum + Number(c.truck.capacity_kg), 0);
  const averageOccupancy = totalCapacity > 0 ? (totalCapacityUsed / totalCapacity) * 100 : 0;
  
  if (historyHints && historyHints.length > 0) {
    reasoning.push(`${historyHints.length} padrões históricos foram considerados nesta composição`);
  }
  
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
// CORRIDOR-BASED CLUSTERING
// ================================================================

/**
 * Build clusters based on regional corridors from history.
 * 
 * Logic:
 * 1. Group orders by city
 * 2. Separate hub city (Barueri) orders
 * 3. Match remaining cities to historical corridors
 * 4. Create one cluster per corridor, pulling all orders from corridor cities
 * 5. Orphan cities (no corridor match) get their own cluster
 * 6. Distribute hub orders proportionally across clusters
 */
function buildCorridorClusters(
  orders: GeocodedOrder[],
  trucks: Truck[],
  config: AutoRouterConfig,
  extractedPatterns?: ExtractedPatterns,
  reasoning?: string[]
): CorridorCluster[] {
  const numTrucks = trucks.length;
  const truckCapacities = trucks
    .map(t => Number(t.capacity_kg) * (config.maxOccupancyPercent / 100))
    .sort((a, b) => b - a);
  const maxTruckCapacity = truckCapacities[0] || 5000;

  // === STEP 1: Group orders by city ===
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const order of orders) {
    const city = normalizeCityName(order.geocoded.city || 'desconhecida');
    const existing = cityOrderMap.get(city) || [];
    existing.push(order);
    cityOrderMap.set(city, existing);
  }

  // === STEP 2: Separate hub city orders ===
  const hubOrders = cityOrderMap.get(HUB_CITY) || [];
  cityOrderMap.delete(HUB_CITY);

  const cityWeights = new Map<string, number>();
  for (const [city, cityOrders] of cityOrderMap) {
    cityWeights.set(city, cityOrders.reduce((s, o) => s + o.weight_kg, 0));
  }

  reasoning?.push(`Cidades encontradas: ${Array.from(cityOrderMap.keys()).map(c => `${c}(${((cityWeights.get(c) || 0)/1000).toFixed(1)}t)`).join(', ')}`);
  if (hubOrders.length > 0) {
    const hubWeight = hubOrders.reduce((s, o) => s + o.weight_kg, 0);
    reasoning?.push(`Hub (${HUB_CITY}): ${hubOrders.length} entregas (${(hubWeight/1000).toFixed(1)}t) - serão distribuídas entre caminhões`);
  }

  // === STEP 3: Match cities to corridors ===
  const corridors = extractedPatterns?.corridors || [];
  const clusters: CorridorCluster[] = [];
  const assignedCities = new Set<string>();

  if (corridors.length > 0) {
    // For each corridor, check if we have orders for its cities
    const availableCities = new Set(cityOrderMap.keys());

    // Sort corridors by how many of their cities are present in current orders
    const corridorMatches = corridors.map(corridor => {
      const corridorCitiesNoHub = [...corridor.allCities].filter(c => c !== HUB_CITY);
      const matchingCities = corridorCitiesNoHub.filter(c => availableCities.has(c));
      const matchWeight = matchingCities.reduce((s, c) => s + (cityWeights.get(c) || 0), 0);
      return { corridor, matchingCities, matchWeight };
    }).filter(m => m.matchingCities.length > 0)
      .sort((a, b) => b.matchWeight - a.matchWeight);

    for (const match of corridorMatches) {
      // Skip if all matching cities already assigned
      const unassignedMatchCities = match.matchingCities.filter(c => !assignedCities.has(c));
      if (unassignedMatchCities.length === 0) continue;

      // Collect all orders for unassigned cities of this corridor
      const clusterOrders: GeocodedOrder[] = [];
      let clusterWeight = 0;
      const clusterCities = new Set<string>();

      for (const city of unassignedMatchCities) {
        const orders = cityOrderMap.get(city) || [];
        clusterOrders.push(...orders);
        clusterWeight += cityWeights.get(city) || 0;
        clusterCities.add(city);
        assignedCities.add(city);
      }

      if (clusterOrders.length === 0) continue;

      // If this corridor exceeds one truck, split into sub-clusters
      const trucksNeeded = Math.ceil(clusterWeight / maxTruckCapacity);

      if (trucksNeeded <= 1) {
        const coreCap = match.corridor.coreCity.charAt(0).toUpperCase() + match.corridor.coreCity.slice(1);
        clusters.push({
          corridorId: match.corridor.id,
          corridorName: `Corredor ${coreCap}`,
          coreCity: match.corridor.coreCity,
          cities: clusterCities,
          orders: clusterOrders,
          weight: clusterWeight,
          reasoning: [`Corredor ${coreCap}: ${Array.from(clusterCities).join(', ')} (${(clusterWeight/1000).toFixed(1)}t)`],
        });
        reasoning?.push(`Corredor ${coreCap} aplicado: ${Array.from(clusterCities).join(', ')}`);
      } else {
        // Split corridor into N sub-clusters, keeping cities together when possible
        reasoning?.push(`Corredor "${match.corridor.coreCity}" dividido em ${trucksNeeded} caminhões (${(clusterWeight/1000).toFixed(1)}t total)`);

        const sorted = [...clusterOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);
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

        const coreCap = match.corridor.coreCity.charAt(0).toUpperCase() + match.corridor.coreCity.slice(1);
        for (let i = 0; i < trucksNeeded; i++) {
          const subCities = new Set(subClusters[i].map(o => normalizeCityName(o.geocoded.city || 'desconhecida')));
          clusters.push({
            corridorId: match.corridor.id,
            corridorName: `Corredor ${coreCap} ${i + 1}/${trucksNeeded}`,
            coreCity: match.corridor.coreCity,
            cities: subCities,
            orders: subClusters[i],
            weight: subWeights[i],
            reasoning: [`Corredor ${coreCap} - bloco ${i + 1}/${trucksNeeded} (${(subWeights[i]/1000).toFixed(1)}t)`],
          });
        }
      }
    }
  }

  // === STEP 4: Orphan cities (not in any corridor) ===
  for (const [city, cityOrders] of cityOrderMap) {
    if (assignedCities.has(city)) continue;

    const weight = cityWeights.get(city) || 0;
    const cityCap = city.charAt(0).toUpperCase() + city.slice(1);

    // Try to merge with a compatible existing cluster
    let merged = false;
    if (extractedPatterns) {
      for (const cluster of clusters) {
        if (cluster.weight + weight > maxTruckCapacity) continue;

        const testCities = [...cluster.cities, city];
        const check = isValidCityCombination(testCities, extractedPatterns);
        if (check.valid) {
          cluster.orders.push(...cityOrders);
          cluster.weight += weight;
          cluster.cities.add(city);
          cluster.reasoning.push(`"${cityCap}" adicionada (compatível historicamente)`);
          reasoning?.push(`"${cityCap}" adicionada ao corredor "${cluster.coreCity}"`);
          merged = true;
          break;
        }
      }
    }

    if (!merged) {
      // Own cluster
      const trucksNeeded = Math.ceil(weight / maxTruckCapacity);
      if (trucksNeeded <= 1) {
        clusters.push({
          corridorId: null,
          corridorName: null,
          coreCity: city,
          cities: new Set([city]),
          orders: [...cityOrders],
          weight,
          reasoning: [`Cidade avulsa: ${cityCap} (${(weight/1000).toFixed(1)}t)`],
        });
      } else {
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
            corridorId: null,
            corridorName: null,
            coreCity: city,
            cities: new Set([city]),
            orders: subClusters[i],
            weight: subWeights[i],
            reasoning: [`${cityCap} - bloco ${i + 1}/${trucksNeeded}`],
          });
        }
      }
    }

    assignedCities.add(city);
  }

  // === STEP 5: Distribute hub orders (Barueri) ===
  if (hubOrders.length > 0) {
    // Sort hub orders by proximity to each cluster's geographic center
    // Then distribute proportionally
    const hubWeight = hubOrders.reduce((s, o) => s + o.weight_kg, 0);
    reasoning?.push(`Distribuindo ${hubOrders.length} entregas do hub (${HUB_CITY}) entre ${clusters.length} corredores`);

    // Sort hub orders by distance from CD so closer ones go to closer clusters
    const sortedHub = [...hubOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);

    for (const order of sortedHub) {
      // Find cluster with most remaining capacity
      let bestIdx = 0;
      let bestRemaining = -Infinity;
      for (let i = 0; i < clusters.length; i++) {
        const remaining = maxTruckCapacity - clusters[i].weight;
        if (remaining > bestRemaining) {
          bestRemaining = remaining;
          bestIdx = i;
        }
      }

      if (bestRemaining >= order.weight_kg) {
        clusters[bestIdx].orders.push(order);
        clusters[bestIdx].weight += order.weight_kg;
        clusters[bestIdx].cities.add(HUB_CITY);
      }
      // else: hub order can't fit anywhere, will be unassigned
    }
  }

  // === STEP 6: Consolidate if more clusters than trucks ===
  if (clusters.length > numTrucks) {
    reasoning?.push(`${clusters.length} clusters para ${numTrucks} caminhões - consolidando`);

    while (clusters.length > numTrucks) {
      // Find smallest cluster
      clusters.sort((a, b) => a.weight - b.weight);
      const smallest = clusters[0];

      let merged = false;
      for (let i = 1; i < clusters.length; i++) {
        const target = clusters[i];
        if (target.weight + smallest.weight > maxTruckCapacity) continue;

        // Check historical compatibility
        if (extractedPatterns) {
          const allCities = [...target.cities, ...smallest.cities].filter(c => c !== HUB_CITY);
          const check = isValidCityCombination(allCities, extractedPatterns);
          if (!check.valid) continue;
        }

        target.orders.push(...smallest.orders);
        target.weight += smallest.weight;
        for (const c of smallest.cities) target.cities.add(c);
        target.reasoning.push(`Consolidada com "${smallest.coreCity}" (${(smallest.weight/1000).toFixed(1)}t)`);
        reasoning?.push(`"${smallest.coreCity}" consolidada com "${target.coreCity}"`);
        clusters.splice(0, 1);
        merged = true;
        break;
      }

      if (!merged) {
        // Force merge
        clusters.sort((a, b) => a.weight - b.weight);
        const target = clusters[1] || clusters[0];
        if (target !== smallest) {
          target.orders.push(...smallest.orders);
          target.weight += smallest.weight;
          for (const c of smallest.cities) target.cities.add(c);
          target.reasoning.push(`FORÇADO: "${smallest.coreCity}" (falta de caminhões)`);
          reasoning?.push(`⚠️ "${smallest.coreCity}" forçada para "${target.coreCity}"`);
          clusters.splice(clusters.indexOf(smallest), 1);
        } else {
          break;
        }
      }
    }
  }

  return clusters;
}

// ================================================================
// CLUSTER-TO-TRUCK MAPPING
// ================================================================

function mapClustersToTrucks(
  clusters: CorridorCluster[],
  trucks: Truck[],
  config: AutoRouterConfig,
  extractedPatterns?: ExtractedPatterns,
  reasoning?: string[]
): TruckComposition[] {
  const sortedClusters = [...clusters].sort((a, b) => b.weight - a.weight);
  const sortedTrucks = [...trucks].sort(
    (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
  );

  const compositions: TruckComposition[] = [];
  const usedTruckIds = new Set<string>();

  for (const cluster of sortedClusters) {
    let selectedTruck: Truck | null = null;
    for (const truck of sortedTrucks) {
      if (usedTruckIds.has(truck.id)) continue;
      selectedTruck = truck;
      break;
    }

    if (!selectedTruck) {
      reasoning?.push(`⚠️ Sem caminhão para cluster de "${cluster.coreCity}"`);
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

    // Determine corridor name
    let corridorName = cluster.corridorName;
    if (!corridorName && extractedPatterns) {
      corridorName = findCorridorName(Array.from(cluster.cities), extractedPatterns);
    }

    compositions.push({
      truck: selectedTruck,
      orders: fittingOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / capacity) * 100),
      estimatedDeliveries: fittingOrders.length,
      cities: Array.from(cluster.cities),
      corridorName: corridorName || undefined,
    });
  }

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
// DELIVERY SEQUENCE OPTIMIZATION
// ================================================================

function optimizeDeliverySequence(
  orders: GeocodedOrder[],
  startLat: number,
  startLng: number,
  strategy: RoutingStrategy
): void {
  if (orders.length <= 1) return;

  let curLat = startLat;
  let curLng = startLng;

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
