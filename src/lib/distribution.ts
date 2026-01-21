import { Order, RoutingStrategy, TruckDistribution, RouteTruck, Truck } from '@/types';

export interface DistributionResult {
  distributions: TruckDistribution[];
  totalWeight: number;
  totalOrders: number;
}

/**
 * Advanced distribution algorithm that balances both weight AND order count
 * between trucks, respecting capacity limits and max delivery constraints.
 */
export function distributeOrders(
  orders: Order[],
  routeTrucks: Array<{ id: string; truck: Truck }>,
  strategy: RoutingStrategy = 'economy'
): DistributionResult {
  if (orders.length === 0 || routeTrucks.length === 0) {
    return { distributions: [], totalWeight: 0, totalOrders: 0 };
  }

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

  // Sort orders based on strategy
  const sortedOrders = sortOrdersByStrategy(orders, strategy);

  // Target balanced distribution
  const avgOrdersPerTruck = Math.ceil(orders.length / distributions.length);
  const totalWeight = orders.reduce((sum, o) => sum + Number(o.weight_kg), 0);
  const targetWeightPerTruck = totalWeight / distributions.length;

  // Distribute orders using balanced algorithm
  for (const order of sortedOrders) {
    const orderWeight = Number(order.weight_kg);
    
    // Find best truck considering:
    // 1. Can fit the weight
    // 2. Balance weight distribution
    // 3. Balance order count
    // 4. Respect max_deliveries if set
    const eligibleTrucks = distributions.filter((d) => {
      const canFitWeight = d.currentWeight + orderWeight <= d.capacity;
      const truck = routeTrucks.find((rt) => rt.id === d.routeTruckId)?.truck;
      const canFitOrders = !truck?.max_deliveries || d.orderCount < truck.max_deliveries;
      return canFitWeight && canFitOrders;
    });

    if (eligibleTrucks.length === 0) {
      // Force assign to truck with most remaining capacity
      const forcedTruck = [...distributions].sort(
        (a, b) => (b.capacity - b.currentWeight) - (a.capacity - a.currentWeight)
      )[0];
      assignOrder(forcedTruck, order, orderWeight);
    } else {
      // Score each eligible truck
      const scoredTrucks = eligibleTrucks.map((d) => ({
        distribution: d,
        score: calculateAssignmentScore(d, orderWeight, targetWeightPerTruck, avgOrdersPerTruck),
      }));

      // Pick truck with highest score
      scoredTrucks.sort((a, b) => b.score - a.score);
      assignOrder(scoredTrucks[0].distribution, order, orderWeight);
    }
  }

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

function assignOrder(distribution: TruckDistribution, order: Order, weight: number) {
  distribution.currentWeight += weight;
  distribution.orderCount++;
  distribution.orders.push({
    orderId: order.id,
    weight,
    sequence: distribution.orders.length + 1,
  });
}

function calculateAssignmentScore(
  distribution: TruckDistribution,
  orderWeight: number,
  targetWeight: number,
  targetOrders: number
): number {
  // Weight balance score (closer to target = higher score)
  const newWeight = distribution.currentWeight + orderWeight;
  const weightDeviation = Math.abs(newWeight - targetWeight);
  const maxWeightDeviation = targetWeight;
  const weightScore = 1 - (weightDeviation / maxWeightDeviation);

  // Order count balance score
  const newOrderCount = distribution.orderCount + 1;
  const orderDeviation = Math.abs(newOrderCount - targetOrders);
  const orderScore = 1 - (orderDeviation / targetOrders);

  // Capacity utilization score (prefer filling trucks evenly)
  const utilizationAfter = newWeight / distribution.capacity;
  const utilizationScore = utilizationAfter <= 0.9 ? utilizationAfter : 0.9 - (utilizationAfter - 0.9);

  // Weighted combination
  return (weightScore * 0.4) + (orderScore * 0.4) + (utilizationScore * 0.2);
}

function sortOrdersByStrategy(orders: Order[], strategy: RoutingStrategy): Order[] {
  const ordersCopy = [...orders];

  switch (strategy) {
    case 'economy':
      // Sort by weight descending for better bin packing
      return ordersCopy.sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg));

    case 'speed':
      // Keep original order (assumed to be optimized for speed)
      return ordersCopy;

    case 'end_near_cd':
    case 'start_far':
      // Group by weight for balanced trucks, sequence will be adjusted later
      return ordersCopy.sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg));

    case 'start_near':
      // Reverse order for near-to-far routing
      return ordersCopy.sort((a, b) => Number(a.weight_kg) - Number(b.weight_kg));

    default:
      return ordersCopy;
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
