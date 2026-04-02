import { Order, RoutingStrategy, TruckDistribution, DISTRIBUTION_CENTER } from '@/types';
import { 
  parseAddress, 
  calculateDistance, 
  estimateTravelTime, 
  distanceFromCD, 
  getDistributionCenterCoords,
  getCityDistanceFromCD,
  normalizeCityName,
  areCitiesNeighbors,
  GeocodedAddress 
} from './geocoding';
import { optimizeWithORS } from './orsOptimizer';
import { areNeighborhoodsAdjacent, normalizeNeighborhood } from './anchorRules';

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
 * Optimize delivery order using proximity-based nearest-neighbor
 * with strong bonuses for same street/neighborhood/city/neighbor-city.
 * 
 * This replicates how the human analyst thinks: geographic continuity,
 * allowing border crossings between neighboring cities when it makes sense.
 */
export async function optimizeDeliveryOrder(
  orders: Order[],
  strategy: RoutingStrategy
): Promise<OptimizedRoute> {
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

  // Pick starting point based on strategy
  const cd = getDistributionCenterCoords();
  let startLat = cd.lat;
  let startLng = cd.lng;

  if (strategy === 'finalizacao_proxima') {
    // Start from the farthest point
    const farthest = [...geocodedOrders].sort((a, b) => b.distanceFromCD - a.distanceFromCD)[0];
    if (farthest) {
      startLat = farthest.geocoded.estimatedLat;
      startLng = farthest.geocoded.estimatedLng;
    }
  }

  // Try ORS optimization first (real driving distances)
  const orsOrder = await optimizeWithORS(orders);
  
  if (orsOrder && orsOrder.length === orders.length) {
    // Reorder geocodedOrders based on ORS result
    const orderMap = new Map(geocodedOrders.map(g => [g.order.id, g]));
    const orsSequence = orsOrder
      .map(id => orderMap.get(id))
      .filter((g): g is GeocodedOrderItem => g !== undefined);
    
    if (orsSequence.length === geocodedOrders.length) {
      console.log('[routing] Using ORS-optimized sequence');
      return buildRouteWithMetrics(orsSequence);
    }
  }

  // Fallback: nearest-neighbor with proximity bonuses
  const finalSequence = nearestNeighborWithProximityBonuses(
    geocodedOrders, startLat, startLng
  );

  return buildRouteWithMetrics(finalSequence);
}

/**
 * Nearest-neighbor that uses proximity bonuses to maintain geographic continuity.
 * This allows natural city-boundary crossings when neighbors are closer.
 * 
 * Bonus structure (multiplied on distance):
 * - Same street: ×0.10 (90% discount)
 * - Same neighborhood: ×0.20 (80% discount)
 * - Same city: ×0.35 (65% discount)
 * - Neighbor city: ×0.80 (20% discount)
 * - Different region: ×1.0 (no discount)
 */
function nearestNeighborWithProximityBonuses(
  items: GeocodedOrderItem[],
  startLat: number,
  startLng: number
): GeocodedOrderItem[] {
  if (items.length <= 1) return [...items];

  const result: GeocodedOrderItem[] = [];
  const remaining = [...items];
  let currentLat = startLat;
  let currentLng = startLng;
  let currentCity = '';
  let currentNeighborhood = '';
  let currentStreet = '';

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let dist = calculateDistance(
        currentLat, currentLng,
        candidate.geocoded.estimatedLat, candidate.geocoded.estimatedLng
      );

      // Apply proximity bonuses based on relationship to current position
      if (currentStreet && candidate.geocoded.street &&
          currentStreet === candidate.geocoded.street &&
          currentCity === candidate.city) {
        dist *= 0.10; // 90% discount - same street
      } else if (currentNeighborhood && candidate.geocoded.neighborhood &&
          currentNeighborhood === candidate.geocoded.neighborhood.toLowerCase() &&
          currentCity === candidate.city) {
        dist *= 0.20; // 80% discount - same neighborhood
      } else if (currentNeighborhood && candidate.geocoded.neighborhood &&
          areNeighborhoodsAdjacent(currentNeighborhood, normalizeNeighborhood(candidate.geocoded.neighborhood))) {
        dist *= 0.60; // 40% discount - adjacent neighborhoods (even across cities)
      } else if (currentCity && currentCity === candidate.city) {
        dist *= 0.35; // 65% discount - same city
      } else if (currentCity && areCitiesNeighbors(currentCity, candidate.city)) {
        dist *= 0.80; // 20% discount - neighboring city
      }
      // else: no discount (different region)

      if (dist < bestScore) {
        bestScore = dist;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    result.push(chosen);
    currentLat = chosen.geocoded.estimatedLat;
    currentLng = chosen.geocoded.estimatedLng;
    currentCity = chosen.city;
    currentNeighborhood = (chosen.geocoded.neighborhood || '').toLowerCase();
    currentStreet = chosen.geocoded.street || '';
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
export async function optimizeMultiTruckRoutes(
  distributions: TruckDistribution[],
  allOrders: Order[],
  strategy: RoutingStrategy
): Promise<Map<string, OptimizedRoute>> {
  const ordersMap = new Map(allOrders.map(o => [o.id, o]));
  const routes = new Map<string, OptimizedRoute>();

  for (const dist of distributions) {
    const truckOrders = dist.orders
      .map(o => ordersMap.get(o.orderId))
      .filter((o): o is Order => o !== undefined);

    const optimizedRoute = await optimizeDeliveryOrder(truckOrders, strategy);
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
