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
 * Nearest neighbor algorithm starting from CD
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

  while (remaining.length > 0) {
    // Find nearest unvisited order
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        currentLat, currentLng,
        remaining[i].geocoded.estimatedLat,
        remaining[i].geocoded.estimatedLng
      );

      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    result.push(nearest);
    currentLat = nearest.geocoded.estimatedLat;
    currentLng = nearest.geocoded.estimatedLng;
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
