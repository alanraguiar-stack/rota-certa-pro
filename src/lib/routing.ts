import { Order, RoutingStrategy, TruckDistribution, DISTRIBUTION_CENTER } from '@/types';
import { 
  parseAddress, 
  calculateDistance, 
  estimateTravelTime, 
  distanceFromCD, 
  getDistributionCenterCoords,
  getCityDistanceFromCD,
  normalizeCityName,
  GeocodedAddress 
} from './geocoding';

export interface OptimizedRoute {
  orderedDeliveries: OrderWithRouteInfo[];
  totalDistance: number;
  estimatedMinutes: number;
  startAddress: string;
  endAddress: string;
}

export interface OrderWithRouteInfo {
  order: Order;
  geocoded: GeocodedAddress;
  sequence: number;
  distanceFromPrevious: number;
  cumulativeDistance: number;
  estimatedArrivalMinutes: number;
}

interface GeocodedOrderItem {
  order: Order;
  geocoded: GeocodedAddress;
  distanceFromCD: number;
  city: string;
}

/**
 * Optimize delivery order using hierarchical sequencing:
 * 1. Group by city (never mix cities)
 * 2. Order cities by distance from CD (per strategy)
 * 3. Within each city, nearest-neighbor with CEP/neighborhood bonuses
 */
export function optimizeDeliveryOrder(
  orders: Order[],
  strategy: RoutingStrategy
): OptimizedRoute {
  if (orders.length === 0) {
    return {
      orderedDeliveries: [],
      totalDistance: 0,
      estimatedMinutes: 0,
      startAddress: DISTRIBUTION_CENTER.address,
      endAddress: DISTRIBUTION_CENTER.address,
    };
  }

  // Geocode all orders and extract city
  const geocodedOrders: GeocodedOrderItem[] = orders.map(order => {
    const geocoded = parseAddress(order.address);
    
    // Override with real coordinates if available
    if (order.latitude != null && order.longitude != null && 
        order.geocoding_status === 'success') {
      geocoded.estimatedLat = Number(order.latitude);
      geocoded.estimatedLng = Number(order.longitude);
    }
    
    return {
      order,
      geocoded,
      distanceFromCD: 0,
      city: normalizeCityName(geocoded.city || ''),
    };
  });

  geocodedOrders.forEach(item => {
    item.distanceFromCD = distanceFromCD(item.geocoded);
  });

  // === LEVEL 1: Group by city ===
  const cityGroups = new Map<string, GeocodedOrderItem[]>();
  for (const item of geocodedOrders) {
    const cityKey = item.city || '__unknown__';
    if (!cityGroups.has(cityKey)) {
      cityGroups.set(cityKey, []);
    }
    cityGroups.get(cityKey)!.push(item);
  }

  // === LEVEL 2: Order cities by distance from CD ===
  const cityEntries = Array.from(cityGroups.entries()).map(([city, items]) => ({
    city,
    items,
    distFromCD: getCityDistanceFromCD(city),
  }));

  switch (strategy) {
    case 'start_near':
    case 'economy':
    case 'speed':
      // Start near CD, go outward
      cityEntries.sort((a, b) => a.distFromCD - b.distFromCD);
      break;
    case 'start_far':
    case 'end_near_cd':
      // Start far, come back to CD
      cityEntries.sort((a, b) => b.distFromCD - a.distFromCD);
      break;
    default:
      cityEntries.sort((a, b) => a.distFromCD - b.distFromCD);
  }

  // === LEVEL 3: Within each city, sequence by CEP > neighborhood > nearest-neighbor ===
  const finalSequence: GeocodedOrderItem[] = [];
  
  let prevLat = getDistributionCenterCoords().lat;
  let prevLng = getDistributionCenterCoords().lng;

  for (const { items } of cityEntries) {
    const sequenced = sequenceWithinCity(items, prevLat, prevLng);
    finalSequence.push(...sequenced);
    
    if (sequenced.length > 0) {
      const last = sequenced[sequenced.length - 1];
      prevLat = last.geocoded.estimatedLat;
      prevLng = last.geocoded.estimatedLng;
    }
  }

  return buildRouteWithMetrics(finalSequence);
}

/**
 * Sequence deliveries within a single city.
 * Groups by CEP prefix first, then uses nearest-neighbor with neighborhood bonuses.
 */
function sequenceWithinCity(
  items: GeocodedOrderItem[],
  startLat: number,
  startLng: number
): GeocodedOrderItem[] {
  if (items.length <= 1) return items;

  // Group by CEP prefix (first 5 digits = same postal region)
  const cepGroups = new Map<string, GeocodedOrderItem[]>();
  for (const item of items) {
    const cepKey = item.geocoded.zipCode ? item.geocoded.zipCode.substring(0, 5) : '__nocep__';
    if (!cepGroups.has(cepKey)) {
      cepGroups.set(cepKey, []);
    }
    cepGroups.get(cepKey)!.push(item);
  }

  // Order CEP groups by proximity to current position using nearest-group
  const result: GeocodedOrderItem[] = [];
  const remainingGroups = Array.from(cepGroups.values());
  
  let currentLat = startLat;
  let currentLng = startLng;

  while (remainingGroups.length > 0) {
    // Find nearest CEP group
    let bestGroupIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remainingGroups.length; i++) {
      const group = remainingGroups[i];
      // Use average position of group
      const avgLat = group.reduce((s, g) => s + g.geocoded.estimatedLat, 0) / group.length;
      const avgLng = group.reduce((s, g) => s + g.geocoded.estimatedLng, 0) / group.length;
      const dist = calculateDistance(currentLat, currentLng, avgLat, avgLng);
      if (dist < bestDist) {
        bestDist = dist;
        bestGroupIdx = i;
      }
    }

    const group = remainingGroups.splice(bestGroupIdx, 1)[0];
    
    // Within CEP group, nearest-neighbor with neighborhood bonus
    const sequenced = nearestNeighborWithBonus(group, currentLat, currentLng);
    result.push(...sequenced);

    if (sequenced.length > 0) {
      const last = sequenced[sequenced.length - 1];
      currentLat = last.geocoded.estimatedLat;
      currentLng = last.geocoded.estimatedLng;
    }
  }

  return result;
}

/**
 * Nearest-neighbor with strong bonuses for same neighborhood/street
 */
function nearestNeighborWithBonus(
  items: GeocodedOrderItem[],
  startLat: number,
  startLng: number
): GeocodedOrderItem[] {
  if (items.length <= 1) return items;

  const result: GeocodedOrderItem[] = [];
  const remaining = [...items];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let dist = calculateDistance(
        currentLat, currentLng,
        candidate.geocoded.estimatedLat, candidate.geocoded.estimatedLng
      );

      // Neighborhood bonus
      if (result.length > 0) {
        const prev = result[result.length - 1];
        if (prev.geocoded.neighborhood && candidate.geocoded.neighborhood &&
            prev.geocoded.neighborhood.toLowerCase() === candidate.geocoded.neighborhood.toLowerCase()) {
          dist *= 0.5; // 50% discount for same neighborhood
        }
        if (prev.geocoded.street && candidate.geocoded.street &&
            prev.geocoded.street === candidate.geocoded.street) {
          dist *= 0.3; // 70% discount for same street
        }
      }

      if (dist < bestScore) {
        bestScore = dist;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    result.push(chosen);
    currentLat = chosen.geocoded.estimatedLat;
    currentLng = chosen.geocoded.estimatedLng;
  }

  return result;
}

/**
 * Build route metrics (distances, times, etc.)
 */
function buildRouteWithMetrics(
  orderedList: GeocodedOrderItem[]
): OptimizedRoute {
  const cd = getDistributionCenterCoords();
  const orderedDeliveries: OrderWithRouteInfo[] = [];
  
  let cumulativeDistance = 0;
  let cumulativeMinutes = 0;
  let prevLat = cd.lat;
  let prevLng = cd.lng;

  for (let i = 0; i < orderedList.length; i++) {
    const item = orderedList[i];
    const distFromPrev = calculateDistance(
      prevLat, prevLng,
      item.geocoded.estimatedLat, item.geocoded.estimatedLng
    );

    cumulativeDistance += distFromPrev;
    cumulativeMinutes += estimateTravelTime(distFromPrev);
    cumulativeMinutes += 5; // delivery stop time

    orderedDeliveries.push({
      order: item.order,
      geocoded: item.geocoded,
      sequence: i + 1,
      distanceFromPrevious: Math.round(distFromPrev * 10) / 10,
      cumulativeDistance: Math.round(cumulativeDistance * 10) / 10,
      estimatedArrivalMinutes: cumulativeMinutes,
    });

    prevLat = item.geocoded.estimatedLat;
    prevLng = item.geocoded.estimatedLng;
  }

  const returnDistance = orderedDeliveries.length > 0
    ? calculateDistance(prevLat, prevLng, cd.lat, cd.lng)
    : 0;

  return {
    orderedDeliveries,
    totalDistance: Math.round((cumulativeDistance + returnDistance) * 10) / 10,
    estimatedMinutes: cumulativeMinutes + estimateTravelTime(returnDistance),
    startAddress: DISTRIBUTION_CENTER.address,
    endAddress: orderedDeliveries.length > 0 
      ? orderedDeliveries[orderedDeliveries.length - 1].order.address
      : DISTRIBUTION_CENTER.address,
  };
}

/**
 * Group and optimize orders for multiple trucks
 */
export function optimizeMultiTruckRoutes(
  distributions: TruckDistribution[],
  allOrders: Order[],
  strategy: RoutingStrategy
): Map<string, OptimizedRoute> {
  const ordersMap = new Map(allOrders.map(o => [o.id, o]));
  const routes = new Map<string, OptimizedRoute>();

  for (const dist of distributions) {
    const truckOrders = dist.orders
      .map(o => ordersMap.get(o.orderId))
      .filter((o): o is Order => o !== undefined);

    const optimizedRoute = optimizeDeliveryOrder(truckOrders, strategy);
    routes.set(dist.routeTruckId, optimizedRoute);
  }

  return routes;
}

/**
 * Calculate route statistics
 */
export function calculateRouteStats(routes: Map<string, OptimizedRoute>) {
  let totalDistance = 0;
  let totalMinutes = 0;
  let totalDeliveries = 0;

  routes.forEach(route => {
    totalDistance += route.totalDistance;
    totalMinutes += route.estimatedMinutes;
    totalDeliveries += route.orderedDeliveries.length;
  });

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalMinutes,
    totalDeliveries,
    avgDistancePerDelivery: totalDeliveries > 0 
      ? Math.round((totalDistance / totalDeliveries) * 10) / 10 
      : 0,
  };
}
