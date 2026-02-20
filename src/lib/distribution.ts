import { Order, RoutingStrategy, TruckDistribution, RouteTruck, Truck } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, getCityDistanceFromCD, normalizeCityName, GeocodedAddress } from './geocoding';

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
 * Advanced distribution algorithm that prioritizes GEOGRAPHIC PROXIMITY by CITY.
 * Weight is only used as a capacity constraint.
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

  // Cluster orders by CITY instead of angle
  const clusters = clusterByCityProximity(geocodedOrders, distributions.length, strategy);

  assignClustersToTrucks(clusters, distributions, routeTrucks);

  for (const dist of distributions) {
    dist.occupancyPercent = Math.round((dist.currentWeight / dist.capacity) * 100);
  }

  return { distributions, totalWeight, totalOrders: orders.length };
}

/**
 * Cluster orders by city proximity.
 * Groups all orders from the same city together, then distributes city groups across trucks.
 */
function clusterByCityProximity(
  geocodedOrders: GeocodedOrder[],
  numClusters: number,
  strategy: RoutingStrategy
): GeocodedOrder[][] {
  if (geocodedOrders.length === 0 || numClusters <= 0) return [];

  // Group by city
  const cityGroups = new Map<string, GeocodedOrder[]>();
  for (const go of geocodedOrders) {
    const key = go.city || '__unknown__';
    if (!cityGroups.has(key)) cityGroups.set(key, []);
    cityGroups.get(key)!.push(go);
  }

  // Sort city groups by distance from CD
  const sortedCities = Array.from(cityGroups.entries())
    .map(([city, items]) => ({ city, items, dist: getCityDistanceFromCD(city) }))
    .sort((a, b) => a.dist - b.dist);

  // Distribute city groups to clusters, keeping cities together when possible
  const clusters: GeocodedOrder[][] = Array.from({ length: numClusters }, () => []);
  const clusterWeights = new Array(numClusters).fill(0);

  for (const { items } of sortedCities) {
    // Find cluster with least total weight (for balance)
    let bestCluster = 0;
    let minWeight = Infinity;
    for (let i = 0; i < numClusters; i++) {
      if (clusterWeights[i] < minWeight) {
        minWeight = clusterWeights[i];
        bestCluster = i;
      }
    }

    clusters[bestCluster].push(...items);
    clusterWeights[bestCluster] += items.reduce((s, go) => s + Number(go.order.weight_kg), 0);
  }

  // Within each cluster, order by city distance from CD, then by CEP/neighborhood
  for (const cluster of clusters) {
    reorderClusterHierarchically(cluster, strategy);
  }

  return clusters;
}

/**
 * Reorder a cluster hierarchically: city > CEP > neighborhood
 */
function reorderClusterHierarchically(
  cluster: GeocodedOrder[],
  strategy: RoutingStrategy
) {
  if (cluster.length <= 1) return;

  // Group by city within cluster
  const cityGroups = new Map<string, GeocodedOrder[]>();
  for (const go of cluster) {
    const key = go.city || '__unknown__';
    if (!cityGroups.has(key)) cityGroups.set(key, []);
    cityGroups.get(key)!.push(go);
  }

  // Order cities by distance from CD
  const sortedCities = Array.from(cityGroups.entries())
    .map(([city, items]) => ({ city, items, dist: getCityDistanceFromCD(city) }));

  if (strategy === 'start_far' || strategy === 'end_near_cd') {
    sortedCities.sort((a, b) => b.dist - a.dist);
  } else {
    sortedCities.sort((a, b) => a.dist - b.dist);
  }

  // Within each city, sort by CEP then neighborhood
  const result: GeocodedOrder[] = [];
  for (const { items } of sortedCities) {
    items.sort((a, b) => {
      // First by CEP prefix
      const cepA = a.geocoded.zipCode?.substring(0, 5) || 'zzzzz';
      const cepB = b.geocoded.zipCode?.substring(0, 5) || 'zzzzz';
      if (cepA !== cepB) return cepA.localeCompare(cepB);
      // Then by neighborhood
      const nA = (a.geocoded.neighborhood || '').toLowerCase();
      const nB = (b.geocoded.neighborhood || '').toLowerCase();
      if (nA !== nB) return nA.localeCompare(nB);
      // Then by street
      return (a.geocoded.street || '').localeCompare(b.geocoded.street || '');
    });
    result.push(...items);
  }

  cluster.length = 0;
  cluster.push(...result);
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
 * Reorder deliveries within each truck using hierarchical city > CEP > neighborhood logic
 */
export function reorderDeliveriesByStrategy(
  distributions: TruckDistribution[],
  orders: Order[],
  strategy: RoutingStrategy
): TruckDistribution[] {
  const ordersMap = new Map(orders.map((o) => [o.id, o]));

  return distributions.map((dist) => {
    const truckOrders = dist.orders.map((o) => {
      const order = ordersMap.get(o.orderId);
      const geocoded = order ? parseAddress(order.address) : null;
      return {
        ...o,
        order,
        geocoded,
        city: geocoded ? normalizeCityName(geocoded.city || '') : '',
      };
    });

    // Group by city
    const cityGroups = new Map<string, typeof truckOrders>();
    for (const to of truckOrders) {
      const key = to.city || '__unknown__';
      if (!cityGroups.has(key)) cityGroups.set(key, []);
      cityGroups.get(key)!.push(to);
    }

    // Sort cities by distance from CD
    const sortedCities = Array.from(cityGroups.entries())
      .map(([city, items]) => ({ city, items, dist: getCityDistanceFromCD(city) }));

    if (strategy === 'start_far' || strategy === 'end_near_cd') {
      sortedCities.sort((a, b) => b.dist - a.dist);
    } else {
      sortedCities.sort((a, b) => a.dist - b.dist);
    }

    // Within each city, sort by CEP > neighborhood > street
    const sortedOrders: typeof truckOrders = [];
    for (const { items } of sortedCities) {
      items.sort((a, b) => {
        const cepA = a.geocoded?.zipCode?.substring(0, 5) || 'zzzzz';
        const cepB = b.geocoded?.zipCode?.substring(0, 5) || 'zzzzz';
        if (cepA !== cepB) return cepA.localeCompare(cepB);
        const nA = (a.geocoded?.neighborhood || '').toLowerCase();
        const nB = (b.geocoded?.neighborhood || '').toLowerCase();
        if (nA !== nB) return nA.localeCompare(nB);
        return (a.geocoded?.street || '').localeCompare(b.geocoded?.street || '');
      });
      sortedOrders.push(...items);
    }

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
