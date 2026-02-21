import { Order, RoutingStrategy, TruckDistribution, RouteTruck, Truck } from '@/types';
import { 
  parseAddress, calculateDistance, getDistributionCenterCoords, 
  getCityDistanceFromCD, normalizeCityName, areCitiesNeighbors,
  buildCityRegions, GeocodedAddress 
} from './geocoding';

export interface DistributionResult {
  distributions: TruckDistribution[];
  totalWeight: number;
  totalOrders: number;
}

interface GeocodedOrder {
  order: Order;
  geocoded: GeocodedAddress;
  distanceFromCD: number;
  city: string;
}

/**
 * Advanced distribution algorithm that groups neighboring cities into regions
 * and assigns each region to a truck. Replicates the human analyst's logic
 * of keeping geographically connected areas on the same truck.
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

  const geocodedOrders: GeocodedOrder[] = orders.map(order => {
    const geocoded = parseAddress(order.address);
    return {
      order,
      geocoded,
      distanceFromCD: calculateDistance(cd.lat, cd.lng, geocoded.estimatedLat, geocoded.estimatedLng),
      city: normalizeCityName(geocoded.city || ''),
    };
  });

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

  // Cluster orders by connected city regions
  const clusters = clusterByRegions(geocodedOrders, distributions.length);

  assignClustersToTrucks(clusters, distributions, routeTrucks);

  for (const dist of distributions) {
    dist.occupancyPercent = Math.round((dist.currentWeight / dist.capacity) * 100);
  }

  return { distributions, totalWeight, totalOrders: orders.length };
}

/**
 * Cluster orders by connected city regions using the adjacency graph.
 * Each region is a set of neighboring cities that should go to the same truck.
 */
function clusterByRegions(
  geocodedOrders: GeocodedOrder[],
  numClusters: number
): GeocodedOrder[][] {
  if (geocodedOrders.length === 0 || numClusters <= 0) return [];

  // Group orders by city
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const go of geocodedOrders) {
    const key = go.city || '__unknown__';
    if (!cityOrderMap.has(key)) cityOrderMap.set(key, []);
    cityOrderMap.get(key)!.push(go);
  }

  // Build connected regions using BFS on adjacency graph
  const citiesPresent = Array.from(cityOrderMap.keys());
  const regions = buildCityRegions(citiesPresent);

  // Each region is a group of cities. Collect their orders.
  const regionOrders: { cities: string[]; orders: GeocodedOrder[]; weight: number }[] = [];
  for (const region of regions) {
    const orders: GeocodedOrder[] = [];
    for (const city of region) {
      const cityOrders = cityOrderMap.get(city);
      if (cityOrders) orders.push(...cityOrders);
    }
    regionOrders.push({
      cities: region,
      orders,
      weight: orders.reduce((s, go) => s + Number(go.order.weight_kg), 0),
    });
  }

  // Sort regions by weight descending for better bin-packing
  regionOrders.sort((a, b) => b.weight - a.weight);

  // Distribute regions to clusters (trucks)
  const clusters: GeocodedOrder[][] = Array.from({ length: numClusters }, () => []);
  const clusterWeights = new Array(numClusters).fill(0);

  for (const region of regionOrders) {
    // If region fits in one truck, assign to lightest truck
    // If region is too big, split by city sub-groups
    if (numClusters === 1) {
      clusters[0].push(...region.orders);
      clusterWeights[0] += region.weight;
      continue;
    }

    // Find lightest cluster
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

  return clusters;
}

/**
 * Assign geographic clusters to trucks, respecting capacity constraints
 */
function assignClustersToTrucks(
  clusters: GeocodedOrder[][],
  distributions: TruckDistribution[],
  routeTrucks: Array<{ id: string; truck: Truck }>
) {
  const clustersWithWeight = clusters.map((cluster, index) => ({
    cluster,
    originalIndex: index,
    totalWeight: cluster.reduce((sum, go) => sum + Number(go.order.weight_kg), 0),
  }));

  const sortedTruckIndices = distributions
    .map((d, i) => ({ index: i, capacity: d.capacity }))
    .sort((a, b) => b.capacity - a.capacity);

  for (const { cluster } of clustersWithWeight) {
    let remainingOrders = [...cluster];

    while (remainingOrders.length > 0) {
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

      if (bestTruckIndex === -1) bestTruckIndex = 0;

      const targetDist = distributions[bestTruckIndex];
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

      for (const go of ordersToAdd) {
        targetDist.orders.push({
          orderId: go.order.id,
          weight: Number(go.order.weight_kg),
          sequence: targetDist.orders.length + 1,
        });
      }

      remainingOrders = stillRemaining;

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
 * Reorder deliveries within each truck using nearest-neighbor with proximity bonuses.
 * Allows natural city-border crossings like the human analyst does.
 */
export function reorderDeliveriesByStrategy(
  distributions: TruckDistribution[],
  orders: Order[],
  strategy: RoutingStrategy
): TruckDistribution[] {
  const ordersMap = new Map(orders.map((o) => [o.id, o]));
  const cd = getDistributionCenterCoords();

  return distributions.map((dist) => {
    const truckOrders = dist.orders
      .map((o) => {
        const order = ordersMap.get(o.orderId);
        if (!order) return null;
        const geocoded = parseAddress(order.address);
        // Use real coords if available
        if (order.latitude != null && order.longitude != null && order.geocoding_status === 'success') {
          geocoded.estimatedLat = Number(order.latitude);
          geocoded.estimatedLng = Number(order.longitude);
        }
        return {
          ...o,
          order,
          geocoded,
          city: normalizeCityName(geocoded.city || ''),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (truckOrders.length <= 1) {
      return dist;
    }

    // Pick start point based on strategy
    let startLat = cd.lat;
    let startLng = cd.lng;

    if (strategy === 'start_far' || strategy === 'end_near_cd') {
      const farthest = [...truckOrders].sort((a, b) => {
        const distA = calculateDistance(cd.lat, cd.lng, a.geocoded.estimatedLat, a.geocoded.estimatedLng);
        const distB = calculateDistance(cd.lat, cd.lng, b.geocoded.estimatedLat, b.geocoded.estimatedLng);
        return distB - distA;
      })[0];
      if (farthest) {
        startLat = farthest.geocoded.estimatedLat;
        startLng = farthest.geocoded.estimatedLng;
      }
    }

    // Nearest-neighbor with proximity bonuses
    const remaining = [...truckOrders];
    const sorted: typeof truckOrders = [];
    let curLat = startLat;
    let curLng = startLng;
    let curCity = '';
    let curNeighborhood = '';
    let curStreet = '';

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i];
        let d = calculateDistance(curLat, curLng, c.geocoded.estimatedLat, c.geocoded.estimatedLng);

        if (curStreet && c.geocoded.street && curStreet === c.geocoded.street && curCity === c.city) {
          d *= 0.15;
        } else if (curNeighborhood && c.geocoded.neighborhood && 
                   curNeighborhood === c.geocoded.neighborhood.toLowerCase() && curCity === c.city) {
          d *= 0.30;
        } else if (curCity && curCity === c.city) {
          d *= 0.70;
        } else if (curCity && areCitiesNeighbors(curCity, c.city)) {
          d *= 0.85;
        }

        if (d < bestScore) {
          bestScore = d;
          bestIdx = i;
        }
      }

      const chosen = remaining.splice(bestIdx, 1)[0];
      sorted.push(chosen);
      curLat = chosen.geocoded.estimatedLat;
      curLng = chosen.geocoded.estimatedLng;
      curCity = chosen.city;
      curNeighborhood = (chosen.geocoded.neighborhood || '').toLowerCase();
      curStreet = chosen.geocoded.street || '';
    }

    return {
      ...dist,
      orders: sorted.map((o, index) => ({
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
