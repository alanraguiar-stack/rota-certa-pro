import { Order, RoutingStrategy, TruckDistribution, DISTRIBUTION_CENTER } from '@/types';
import { 
  parseAddress, 
  calculateDistance, 
  estimateTravelTime, 
  distanceFromCD, 
  getDistributionCenterCoords,
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

/**
 * Optimize delivery order for a list of orders based on routing strategy
 * Uses nearest neighbor algorithm with strategy-specific modifications
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

  // Geocode all orders
  const geocodedOrders = orders.map(order => ({
    order,
    geocoded: parseAddress(order.address),
    distanceFromCD: 0,
  }));

  // Calculate distance from CD for each order
  geocodedOrders.forEach(item => {
    item.distanceFromCD = distanceFromCD(item.geocoded);
  });

  let orderedList: typeof geocodedOrders;

  switch (strategy) {
    case 'economy':
      // Nearest neighbor from CD for minimum total distance
      orderedList = nearestNeighborRoute(geocodedOrders);
      break;

    case 'speed':
      // Optimize for minimal backtracking (similar to economy but prefers main routes)
      orderedList = nearestNeighborRoute(geocodedOrders);
      break;

    case 'end_near_cd':
      // Start with farthest, progressively get closer to CD
      orderedList = [...geocodedOrders].sort((a, b) => b.distanceFromCD - a.distanceFromCD);
      break;

    case 'start_far':
      // Start far from CD, come back gradually
      orderedList = [...geocodedOrders].sort((a, b) => b.distanceFromCD - a.distanceFromCD);
      break;

    case 'start_near':
      // Start near CD, go outward
      orderedList = [...geocodedOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);
      break;

    default:
      orderedList = nearestNeighborRoute(geocodedOrders);
  }

  // Build final route with distances
  return buildRouteWithMetrics(orderedList);
}

/**
 * Nearest neighbor algorithm with backtrack penalty
 * Prioritizes geographic continuity over simple distance
 */
function nearestNeighborRoute(
  orders: Array<{ order: Order; geocoded: GeocodedAddress; distanceFromCD: number }>
): typeof orders {
  if (orders.length <= 1) return orders;

  const cd = getDistributionCenterCoords();
  const result: typeof orders = [];
  const remaining = [...orders];

  let currentLat = cd.lat;
  let currentLng = cd.lng;
  let lastDirection = { lat: 0, lng: 0 };

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const dist = calculateDistance(
        currentLat, currentLng,
        candidate.geocoded.estimatedLat,
        candidate.geocoded.estimatedLng
      );

      // Calculate direction to candidate
      const newDirection = {
        lat: candidate.geocoded.estimatedLat - currentLat,
        lng: candidate.geocoded.estimatedLng - currentLng,
      };

      // Calculate backtrack penalty (going back in direction)
      let backtrackPenalty = 0;
      if (result.length > 0) {
        // Dot product: negative = going backwards
        const dotProduct = lastDirection.lat * newDirection.lat + lastDirection.lng * newDirection.lng;
        if (dotProduct < 0) {
          // Strong penalty for backtracking
          backtrackPenalty = Math.abs(dotProduct) * 2;
        }
      }

      // Calculate neighborhood consistency bonus
      let neighborhoodBonus = 0;
      if (result.length > 0) {
        const lastOrder = result[result.length - 1];
        // Same neighborhood = big bonus
        if (lastOrder.geocoded.neighborhood && candidate.geocoded.neighborhood &&
            lastOrder.geocoded.neighborhood === candidate.geocoded.neighborhood) {
          neighborhoodBonus = -0.5; // Reduce score (better)
        }
        // Same street = even bigger bonus
        if (lastOrder.geocoded.street && candidate.geocoded.street &&
            lastOrder.geocoded.street === candidate.geocoded.street) {
          neighborhoodBonus = -1;
        }
      }

      // Calculate region consistency (penalize crossing to distant regions)
      let regionPenalty = 0;
      if (result.length >= 2) {
        // Check if we're zigzagging between regions
        const prev1 = result[result.length - 1];
        const prev2 = result[result.length - 2];
        
        const distFromPrev1 = calculateDistance(
          prev1.geocoded.estimatedLat, prev1.geocoded.estimatedLng,
          candidate.geocoded.estimatedLat, candidate.geocoded.estimatedLng
        );
        const distFromPrev2 = calculateDistance(
          prev2.geocoded.estimatedLat, prev2.geocoded.estimatedLng,
          candidate.geocoded.estimatedLat, candidate.geocoded.estimatedLng
        );

        // If candidate is closer to 2-steps-ago than 1-step-ago, penalize (zigzag)
        if (distFromPrev2 < distFromPrev1 * 0.7) {
          regionPenalty = 0.5;
        }
      }

      const finalScore = dist * (1 + backtrackPenalty + regionPenalty + neighborhoodBonus);

      if (finalScore < bestScore) {
        bestScore = finalScore;
        bestIndex = i;
      }
    }

    const chosen = remaining.splice(bestIndex, 1)[0];
    
    // Update direction for next iteration
    lastDirection = {
      lat: chosen.geocoded.estimatedLat - currentLat,
      lng: chosen.geocoded.estimatedLng - currentLng,
    };

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
  orderedList: Array<{ order: Order; geocoded: GeocodedAddress; distanceFromCD: number }>
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
      item.geocoded.estimatedLat,
      item.geocoded.estimatedLng
    );

    cumulativeDistance += distFromPrev;
    cumulativeMinutes += estimateTravelTime(distFromPrev);

    // Add 5 minutes per stop for delivery
    cumulativeMinutes += 5;

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

  // Add return to CD
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
