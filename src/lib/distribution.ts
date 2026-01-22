import { Order, RoutingStrategy, TruckDistribution, RouteTruck, Truck } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress } from './geocoding';

export interface DistributionResult {
  distributions: TruckDistribution[];
  totalWeight: number;
  totalOrders: number;
}

interface GeocodedOrder {
  order: Order;
  geocoded: GeocodedAddress;
  distanceFromCD: number;
}

/**
 * Advanced distribution algorithm that prioritizes GEOGRAPHIC PROXIMITY
 * Weight is only used as a capacity constraint, not as distribution criterion.
 * Groups orders by real address proximity to create continuous routes.
 */
export function distributeOrders(
  orders: Order[],
  routeTrucks: Array<{ id: string; truck: Truck }>,
  strategy: RoutingStrategy = 'economy'
): DistributionResult {
  if (orders.length === 0 || routeTrucks.length === 0) {
    return { distributions: [], totalWeight: 0, totalOrders: 0 };
  }

  const cd = getDistributionCenterCoords();

  // Geocode all orders and calculate distance from CD
  const geocodedOrders: GeocodedOrder[] = orders.map(order => {
    const geocoded = parseAddress(order.address);
    return {
      order,
      geocoded,
      distanceFromCD: calculateDistance(cd.lat, cd.lng, geocoded.estimatedLat, geocoded.estimatedLng),
    };
  });

  // Initialize truck distributions
  const distributions: TruckDistribution[] = routeTrucks.map((rt) => ({
    truckId: rt.truck.id,
    routeTruckId: rt.id,
    capacity: Number(rt.truck.capacity_kg),
    currentWeight: 0,
    orderCount: 0,
    orders: [],
    occupancyPercent: 0,
  }));

  const totalWeight = orders.reduce((sum, o) => sum + Number(o.weight_kg), 0);

  // Cluster orders geographically for each truck
  const clusters = clusterByGeographicProximity(geocodedOrders, distributions.length, strategy);

  // Assign clusters to trucks, respecting capacity constraints
  assignClustersToTrucks(clusters, distributions, routeTrucks);

  // Calculate final occupancy percentages
  for (const dist of distributions) {
    dist.occupancyPercent = Math.round((dist.currentWeight / dist.capacity) * 100);
  }

  return {
    distributions,
    totalWeight,
    totalOrders: orders.length,
  };
}

/**
 * Cluster orders by geographic proximity using sector-based approach
 * This ensures routes don't cross neighborhoods unnecessarily
 */
function clusterByGeographicProximity(
  geocodedOrders: GeocodedOrder[],
  numClusters: number,
  strategy: RoutingStrategy
): GeocodedOrder[][] {
  if (geocodedOrders.length === 0 || numClusters <= 0) return [];

  const cd = getDistributionCenterCoords();

  // Calculate angle from CD for each order (sector-based clustering)
  const ordersWithAngle = geocodedOrders.map(go => ({
    ...go,
    angle: Math.atan2(
      go.geocoded.estimatedLat - cd.lat,
      go.geocoded.estimatedLng - cd.lng
    ) * (180 / Math.PI),
  }));

  // Sort by angle to create geographic sectors
  ordersWithAngle.sort((a, b) => a.angle - b.angle);

  // Divide into sectors (clusters)
  const clusters: GeocodedOrder[][] = Array.from({ length: numClusters }, () => []);
  const ordersPerCluster = Math.ceil(ordersWithAngle.length / numClusters);

  ordersWithAngle.forEach((item, index) => {
    const clusterIndex = Math.min(Math.floor(index / ordersPerCluster), numClusters - 1);
    clusters[clusterIndex].push(item);
  });

  // Within each cluster, sort by distance from CD based on strategy
  clusters.forEach(cluster => {
    switch (strategy) {
      case 'start_far':
      case 'end_near_cd':
        // Start far, end near CD
        cluster.sort((a, b) => b.distanceFromCD - a.distanceFromCD);
        break;
      case 'start_near':
        // Start near CD, end far
        cluster.sort((a, b) => a.distanceFromCD - b.distanceFromCD);
        break;
      default:
        // For economy/speed, use nearest-neighbor within cluster
        optimizeClusterSequence(cluster, cd);
    }
  });

  return clusters;
}

/**
 * Optimize sequence within a cluster using nearest-neighbor
 * Prioritizes continuous route without backtracking
 */
function optimizeClusterSequence(
  cluster: GeocodedOrder[],
  cd: { lat: number; lng: number }
) {
  if (cluster.length <= 1) return;

  const result: GeocodedOrder[] = [];
  const remaining = [...cluster];

  let currentLat = cd.lat;
  let currentLng = cd.lng;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(
        currentLat, currentLng,
        remaining[i].geocoded.estimatedLat,
        remaining[i].geocoded.estimatedLng
      );

      // Penalize heavily if this would cause backtracking
      const backtrackPenalty = calculateBacktrackPenalty(
        { lat: currentLat, lng: currentLng },
        remaining[i].geocoded,
        result.length > 0 ? result[result.length - 1].geocoded : null
      );

      const adjustedDist = dist * (1 + backtrackPenalty);

      if (adjustedDist < nearestDistance) {
        nearestDistance = adjustedDist;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    result.push(nearest);
    currentLat = nearest.geocoded.estimatedLat;
    currentLng = nearest.geocoded.estimatedLng;
  }

  // Replace cluster contents with optimized sequence
  cluster.length = 0;
  cluster.push(...result);
}

/**
 * Calculate penalty for backtracking (returning to areas already visited)
 * Higher penalty = less likely to choose that order next
 */
function calculateBacktrackPenalty(
  current: { lat: number; lng: number },
  next: GeocodedAddress,
  previous: GeocodedAddress | null
): number {
  if (!previous) return 0;

  // Calculate if we're going back in the general direction
  const prevDirection = {
    lat: current.lat - previous.estimatedLat,
    lng: current.lng - previous.estimatedLng,
  };

  const nextDirection = {
    lat: next.estimatedLat - current.lat,
    lng: next.estimatedLng - current.lng,
  };

  // Dot product to check if we're reversing direction
  const dotProduct = prevDirection.lat * nextDirection.lat + prevDirection.lng * nextDirection.lng;

  // If going backwards (negative dot product), apply penalty
  if (dotProduct < 0) {
    // Penalty proportional to how much we're backtracking
    return Math.abs(dotProduct) * 0.5;
  }

  return 0;
}

/**
 * Assign geographic clusters to trucks, respecting capacity constraints
 * May split clusters if needed to respect weight limits
 */
function assignClustersToTrucks(
  clusters: GeocodedOrder[][],
  distributions: TruckDistribution[],
  routeTrucks: Array<{ id: string; truck: Truck }>
) {
  // Sort clusters by total weight for better bin-packing
  const clustersWithWeight = clusters.map((cluster, index) => ({
    cluster,
    originalIndex: index,
    totalWeight: cluster.reduce((sum, go) => sum + Number(go.order.weight_kg), 0),
  }));

  // Sort trucks by capacity descending
  const sortedTruckIndices = distributions
    .map((d, i) => ({ index: i, capacity: d.capacity }))
    .sort((a, b) => b.capacity - a.capacity);

  // Assign clusters to trucks
  for (const { cluster } of clustersWithWeight) {
    let remainingOrders = [...cluster];

    while (remainingOrders.length > 0) {
      // Find truck with most remaining capacity that can fit at least one order
      let bestTruckIndex = -1;
      let bestRemainingCapacity = -1;

      for (const { index } of sortedTruckIndices) {
        const dist = distributions[index];
        const truck = routeTrucks.find(rt => rt.id === dist.routeTruckId)?.truck;
        const remainingCapacity = dist.capacity - dist.currentWeight;
        const canFitMoreOrders = !truck?.max_deliveries || dist.orderCount < truck.max_deliveries;

        if (canFitMoreOrders && remainingCapacity > bestRemainingCapacity) {
          bestTruckIndex = index;
          bestRemainingCapacity = remainingCapacity;
        }
      }

      if (bestTruckIndex === -1) {
        // No truck can accept more orders, force to first available
        bestTruckIndex = 0;
      }

      const targetDist = distributions[bestTruckIndex];

      // Add orders from this cluster to the truck until capacity reached
      const ordersToAdd: GeocodedOrder[] = [];
      const stillRemaining: GeocodedOrder[] = [];

      for (const go of remainingOrders) {
        const orderWeight = Number(go.order.weight_kg);
        const truck = routeTrucks.find(rt => rt.id === targetDist.routeTruckId)?.truck;
        const canFitWeight = targetDist.currentWeight + orderWeight <= targetDist.capacity;
        const canFitOrders = !truck?.max_deliveries || targetDist.orderCount < truck.max_deliveries;

        if (canFitWeight && canFitOrders) {
          ordersToAdd.push(go);
          targetDist.currentWeight += orderWeight;
          targetDist.orderCount++;
        } else {
          stillRemaining.push(go);
        }
      }

      // Add orders to distribution
      for (const go of ordersToAdd) {
        targetDist.orders.push({
          orderId: go.order.id,
          weight: Number(go.order.weight_kg),
          sequence: targetDist.orders.length + 1,
        });
      }

      remainingOrders = stillRemaining;

      // If we couldn't add any orders, force add to prevent infinite loop
      if (ordersToAdd.length === 0 && remainingOrders.length > 0) {
        const forced = remainingOrders.shift()!;
        targetDist.currentWeight += Number(forced.order.weight_kg);
        targetDist.orderCount++;
        targetDist.orders.push({
          orderId: forced.order.id,
          weight: Number(forced.order.weight_kg),
          sequence: targetDist.orders.length + 1,
        });
      }
    }
  }
}

/**
 * Reorder deliveries within each truck based on routing strategy
 */
export function reorderDeliveriesByStrategy(
  distributions: TruckDistribution[],
  orders: Order[],
  strategy: RoutingStrategy
): TruckDistribution[] {
  // Note: In a real implementation, this would use geocoding and actual distance calculations
  // For now, we'll use a simplified approach based on address text (alphabetical as proxy)
  
  const ordersMap = new Map(orders.map((o) => [o.id, o]));

  return distributions.map((dist) => {
    const truckOrders = dist.orders.map((o) => ({
      ...o,
      order: ordersMap.get(o.orderId),
    }));

    let sortedOrders: typeof truckOrders;

    switch (strategy) {
      case 'economy':
        // Group nearby addresses (using alphabetical as proxy for now)
        sortedOrders = truckOrders.sort((a, b) => 
          (a.order?.address ?? '').localeCompare(b.order?.address ?? '')
        );
        break;

      case 'speed':
        // Keep as-is for speed (assumed optimal)
        sortedOrders = truckOrders;
        break;

      case 'end_near_cd':
      case 'start_far':
        // Start with farthest (reverse alphabetical as proxy)
        sortedOrders = truckOrders.sort((a, b) => 
          (b.order?.address ?? '').localeCompare(a.order?.address ?? '')
        );
        break;

      case 'start_near':
        // Start with nearest (alphabetical as proxy)
        sortedOrders = truckOrders.sort((a, b) => 
          (a.order?.address ?? '').localeCompare(b.order?.address ?? '')
        );
        break;

      default:
        sortedOrders = truckOrders;
    }

    // Reassign sequences
    return {
      ...dist,
      orders: sortedOrders.map((o, index) => ({
        orderId: o.orderId,
        weight: o.weight,
        sequence: index + 1,
      })),
    };
  });
}

/**
 * Calculate distribution statistics for display
 */
export function calculateDistributionStats(distributions: TruckDistribution[]) {
  if (distributions.length === 0) {
    return {
      avgOccupancy: 0,
      minOccupancy: 0,
      maxOccupancy: 0,
      balanceScore: 0,
      avgOrdersPerTruck: 0,
    };
  }

  const occupancies = distributions.map((d) => d.occupancyPercent);
  const orderCounts = distributions.map((d) => d.orderCount);

  const avgOccupancy = occupancies.reduce((a, b) => a + b, 0) / occupancies.length;
  const minOccupancy = Math.min(...occupancies);
  const maxOccupancy = Math.max(...occupancies);

  // Balance score: 100 = perfectly balanced, 0 = very unbalanced
  const occupancySpread = maxOccupancy - minOccupancy;
  const balanceScore = Math.max(0, 100 - occupancySpread);

  const avgOrdersPerTruck = orderCounts.reduce((a, b) => a + b, 0) / orderCounts.length;

  return {
    avgOccupancy: Math.round(avgOccupancy),
    minOccupancy,
    maxOccupancy,
    balanceScore: Math.round(balanceScore),
    avgOrdersPerTruck: Math.round(avgOrdersPerTruck * 10) / 10,
  };
}
