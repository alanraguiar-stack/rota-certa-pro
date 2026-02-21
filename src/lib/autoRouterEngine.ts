/**
 * Motor de Roteamento Automático
 * Substitui o roteirista humano, fazendo a composição automática de caminhões
 * baseada em geografia e peso.
 */

import { Truck, ParsedOrder, RoutingStrategy } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName, buildCityRegions, areCitiesNeighbors } from './geocoding';
import { ParsedItemDetail } from './itemDetailParser';

export interface AutoRouterConfig {
  strategy: RoutingStrategy;
  safetyMarginPercent: number; // e.g., 10 for 10% safety margin
  maxOccupancyPercent: number; // e.g., 95 for max 95% occupancy
  balanceOrders: boolean; // Try to balance order count between trucks
}

export interface TruckComposition {
  truck: Truck;
  orders: ParsedOrder[];
  totalWeight: number;
  occupancyPercent: number;
  estimatedDeliveries: number;
}

export interface AutoRouterResult {
  compositions: TruckComposition[];
  unassignedOrders: ParsedOrder[];
  totalWeight: number;
  totalOrders: number;
  trucksUsed: number;
  averageOccupancy: number;
  warnings: string[];
}

interface GeocodedOrder extends ParsedOrder {
  geocoded: GeocodedAddress;
  distanceFromCD: number;
  angle: number; // Angle from CD (for sector clustering)
}

const DEFAULT_CONFIG: AutoRouterConfig = {
  strategy: 'economy',
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
  
  // Group items by pedido_id
  const itemsByPedido = new Map<string, ParsedItemDetail[]>();
  itemDetails.forEach(item => {
    const existing = itemsByPedido.get(item.pedido_id) || [];
    existing.push(item);
    itemsByPedido.set(item.pedido_id, existing);
  });
  
  // Merge into orders
  return orders.map(order => {
    const orderItems = order.pedido_id ? itemsByPedido.get(order.pedido_id) : null;
    
    if (orderItems && orderItems.length > 0) {
      const items = orderItems.map(item => ({
        product_name: item.product_name,
        weight_kg: item.weight_kg,
        quantity: item.quantity,
      }));
      
      const totalWeight = items.reduce((sum, item) => sum + item.weight_kg, 0);
      
      return {
        ...order,
        items,
        weight_kg: totalWeight, // Override with detailed weight
      };
    }
    
    return order;
  });
}

/**
 * Calculate which trucks to use based on total weight
 * Uses bin-packing algorithm for optimal truck selection
 */
export function recommendTrucks(
  availableTrucks: Truck[],
  totalWeight: number,
  totalOrders: number,
  config: Partial<AutoRouterConfig> = {}
): Truck[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const weightWithMargin = totalWeight * (1 + cfg.safetyMarginPercent / 100);
  
  // Sort trucks by capacity descending
  const sortedTrucks = [...availableTrucks].sort(
    (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
  );
  
  const selected: Truck[] = [];
  let remainingWeight = weightWithMargin;
  let remainingOrders = totalOrders;
  
  // First pass: select trucks based on weight
  for (const truck of sortedTrucks) {
    if (remainingWeight <= 0) break;
    
    const effectiveCapacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    
    // Check if truck has max deliveries limit
    if (truck.max_deliveries && remainingOrders > 0) {
      const ordersThisTruck = Math.min(
        remainingOrders,
        truck.max_deliveries
      );
      
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
  
  // If we still have weight, add more trucks
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
 * Main auto-routing function - composes trucks and assigns orders
 * This replaces the human router's decision-making process
 */
export function autoComposeRoute(
  orders: ParsedOrder[],
  availableTrucks: Truck[],
  config: Partial<AutoRouterConfig> = {}
): AutoRouterResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  
  if (orders.length === 0) {
    return {
      compositions: [],
      unassignedOrders: [],
      totalWeight: 0,
      totalOrders: 0,
      trucksUsed: 0,
      averageOccupancy: 0,
      warnings: ['Nenhum pedido para roteirizar'],
    };
  }
  
  const validOrders = orders.filter(o => o.isValid);
  const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
  const totalOrders = validOrders.length;
  
  // Step 1: Determine which trucks to use
  const selectedTrucks = recommendTrucks(availableTrucks, totalWeight, totalOrders, cfg);
  
  if (selectedTrucks.length === 0) {
    return {
      compositions: [],
      unassignedOrders: validOrders,
      totalWeight,
      totalOrders,
      trucksUsed: 0,
      averageOccupancy: 0,
      warnings: ['Nenhum caminhão disponível para a carga'],
    };
  }
  
  // Step 2: Geocode orders and calculate geographic metrics
  const cd = getDistributionCenterCoords();
  const geocodedOrders: GeocodedOrder[] = validOrders.map(order => {
    const geocoded = parseAddress(order.address);
    const distanceFromCD = calculateDistance(
      cd.lat, cd.lng,
      geocoded.estimatedLat, geocoded.estimatedLng
    );
    const angle = Math.atan2(
      geocoded.estimatedLat - cd.lat,
      geocoded.estimatedLng - cd.lng
    ) * (180 / Math.PI);
    
    return {
      ...order,
      geocoded,
      distanceFromCD,
      angle,
    };
  });
  
  // Step 3: Cluster orders by CITY (regionalization) instead of angle
  const clusters = clusterOrdersByCity(geocodedOrders, selectedTrucks.length, cfg.strategy);
  
  // Step 4: Assign clusters to trucks respecting capacity
  const compositions = assignClustersToTrucks(clusters, selectedTrucks, cfg);
  
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
  
  return {
    compositions,
    unassignedOrders,
    totalWeight,
    totalOrders,
    trucksUsed: compositions.filter(c => c.orders.length > 0).length,
    averageOccupancy: Math.round(averageOccupancy),
    warnings,
  };
}

/**
 * Cluster orders by connected city regions using adjacency graph.
 * Neighboring cities go to the same truck. Within each cluster,
 * nearest-neighbor with proximity bonuses for geographic continuity.
 */
function clusterOrdersByCity(
  orders: GeocodedOrder[],
  numClusters: number,
  strategy: RoutingStrategy
): GeocodedOrder[][] {
  if (orders.length === 0 || numClusters <= 0) return [];

  // Group orders by city
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const order of orders) {
    const city = (order.geocoded.city || 'desconhecida').toLowerCase().trim();
    const existing = cityOrderMap.get(city) || [];
    existing.push(order);
    cityOrderMap.set(city, existing);
  }

  // Build connected regions using BFS on adjacency graph
  const citiesPresent = Array.from(cityOrderMap.keys());
  const regions = buildCityRegions(citiesPresent);

  // Collect orders per region
  const regionOrders: { cities: string[]; orders: GeocodedOrder[]; weight: number }[] = [];
  for (const region of regions) {
    const regionOrdrs: GeocodedOrder[] = [];
    for (const city of region) {
      const cityOrders = cityOrderMap.get(city);
      if (cityOrders) regionOrdrs.push(...cityOrders);
    }
    regionOrders.push({
      cities: region,
      orders: regionOrdrs,
      weight: regionOrdrs.reduce((s, o) => s + o.weight_kg, 0),
    });
  }

  // Sort regions by weight descending for bin-packing
  regionOrders.sort((a, b) => b.weight - a.weight);

  // Distribute regions to clusters
  const clusters: GeocodedOrder[][] = Array.from({ length: numClusters }, () => []);
  const clusterWeights = new Array(numClusters).fill(0);

  for (const region of regionOrders) {
    let minIdx = 0;
    let minWeight = clusterWeights[0];
    for (let i = 1; i < numClusters; i++) {
      if (clusterWeights[i] < minWeight) {
        minWeight = clusterWeights[i];
        minIdx = i;
      }
    }
    clusters[minIdx].push(...region.orders);
    clusterWeights[minIdx] += region.weight;
  }

  // Sort within each cluster using nearest-neighbor with proximity bonuses
  const cd = getDistributionCenterCoords();
  clusters.forEach(cluster => {
    optimizeClusterByProximity(cluster, cd.lat, cd.lng, strategy);
  });

  return clusters;
}

/**
 * Optimize cluster sequence using nearest-neighbor with proximity bonuses.
 * Allows natural city-border crossings.
 */
function optimizeClusterByProximity(
  cluster: GeocodedOrder[], 
  startLat: number, 
  startLng: number,
  strategy: RoutingStrategy
): void {
  if (cluster.length <= 1) return;

  let curLat = startLat;
  let curLng = startLng;

  // For start_far, begin from farthest point
  if (strategy === 'start_far' || strategy === 'end_near_cd') {
    const farthest = [...cluster].sort((a, b) => b.distanceFromCD - a.distanceFromCD)[0];
    if (farthest) {
      curLat = farthest.geocoded.estimatedLat;
      curLng = farthest.geocoded.estimatedLng;
    }
  }

  const result: GeocodedOrder[] = [];
  const remaining = [...cluster];
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

  cluster.length = 0;
  cluster.push(...result);
}

/**
 * Assign geographic clusters to trucks respecting capacity constraints
 */
function assignClustersToTrucks(
  clusters: GeocodedOrder[][],
  trucks: Truck[],
  config: AutoRouterConfig
): TruckComposition[] {
  const compositions: TruckComposition[] = trucks.map(truck => ({
    truck,
    orders: [],
    totalWeight: 0,
    occupancyPercent: 0,
    estimatedDeliveries: 0,
  }));
  
  // Sort clusters by total weight descending for better bin-packing
  const clustersWithWeight = clusters.map((cluster, index) => ({
    cluster,
    index,
    totalWeight: cluster.reduce((sum, o) => sum + o.weight_kg, 0),
  })).sort((a, b) => b.totalWeight - a.totalWeight);
  
  // Assign each cluster to the truck with most remaining capacity
  for (const { cluster } of clustersWithWeight) {
    const remainingOrders = [...cluster];
    
    while (remainingOrders.length > 0) {
      // Find truck with most remaining capacity
      let bestComposition: TruckComposition | null = null;
      let bestRemainingCapacity = -1;
      
      for (const comp of compositions) {
        const maxCapacity = Number(comp.truck.capacity_kg) * (config.maxOccupancyPercent / 100);
        const remainingCapacity = maxCapacity - comp.totalWeight;
        
        const canFitMoreOrders = !comp.truck.max_deliveries || 
          comp.orders.length < comp.truck.max_deliveries;
        
        if (canFitMoreOrders && remainingCapacity > bestRemainingCapacity) {
          bestComposition = comp;
          bestRemainingCapacity = remainingCapacity;
        }
      }
      
      if (!bestComposition || bestRemainingCapacity <= 0) {
        // No truck can fit more orders
        break;
      }
      
      // Add orders that fit
      const ordersToAdd: GeocodedOrder[] = [];
      const stillRemaining: GeocodedOrder[] = [];
      
      for (const order of remainingOrders) {
        const maxCapacity = Number(bestComposition.truck.capacity_kg) * (config.maxOccupancyPercent / 100);
        const canFitWeight = bestComposition.totalWeight + order.weight_kg <= maxCapacity;
        const canFitOrders = !bestComposition.truck.max_deliveries || 
          (bestComposition.orders.length + ordersToAdd.length) < bestComposition.truck.max_deliveries;
        
        if (canFitWeight && canFitOrders) {
          ordersToAdd.push(order);
          bestComposition.totalWeight += order.weight_kg;
        } else {
          stillRemaining.push(order);
        }
      }
      
      // Add orders to composition
      for (const order of ordersToAdd) {
        bestComposition.orders.push(order);
      }
      
      remainingOrders.length = 0;
      remainingOrders.push(...stillRemaining);
      
      // If no orders were added, force add one to prevent infinite loop
      if (ordersToAdd.length === 0 && remainingOrders.length > 0) {
        const forced = remainingOrders.shift()!;
        bestComposition.orders.push(forced);
        bestComposition.totalWeight += forced.weight_kg;
      }
    }
  }
  
  // Calculate final metrics
  for (const comp of compositions) {
    comp.occupancyPercent = Math.round(
      (comp.totalWeight / Number(comp.truck.capacity_kg)) * 100
    );
    comp.estimatedDeliveries = comp.orders.length;
  }
  
  return compositions;
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
