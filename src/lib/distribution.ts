import { Order, RoutingStrategy, TruckDistribution, Truck } from '@/types';
import { 
  parseAddress, calculateDistance, getDistributionCenterCoords, 
  getCityDistanceFromCD, normalizeCityName, areCitiesNeighbors,
  getNeighborCities, GeocodedAddress, CITY_NEIGHBORS
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

interface CityVolume {
  city: string;
  orders: GeocodedOrder[];
  totalWeight: number;
  trucksNeeded: number;
  classification: 'grande' | 'pequena';
  assigned: boolean;
}

// =====================================================
// MAIN ENTRY POINT - Layered Distribution
// =====================================================

/**
 * Distribui pedidos usando lógica territorial em camadas:
 * 1. Leitura do território (agrupar por cidade)
 * 2. Volume por cidade (quantos caminhões cada cidade precisa)
 * 3. Atribuição cidade→caminhão (cidade principal por caminhão)
 * 3.5. Complemento com vizinhas (preencher sobra de capacidade)
 * 4. Órfãos (cidades pequenas não absorvidas)
 */
export function distributeOrders(
  orders: Order[],
  routeTrucks: Array<{ id: string; truck: Truck }>,
  strategy: RoutingStrategy = 'padrao'
): DistributionResult {
  if (orders.length === 0 || routeTrucks.length === 0) {
    return { distributions: [], totalWeight: 0, totalOrders: 0 };
  }

  const cd = getDistributionCenterCoords();

  // Geocode all orders
  const geocodedOrders: GeocodedOrder[] = orders.map(order => {
    const geocoded = parseAddress(order.address);
    if (order.latitude != null && order.longitude != null && order.geocoding_status === 'success') {
      geocoded.estimatedLat = Number(order.latitude);
      geocoded.estimatedLng = Number(order.longitude);
    }
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
  const avgCapacity = distributions.reduce((s, d) => s + d.capacity, 0) / distributions.length;

  // ---- CAMADA 1: Leitura do Território ----
  const cityVolumeMap = buildCityVolumeMap(geocodedOrders, avgCapacity);

  // ---- CAMADA 2 + 3: Atribuição cidade→caminhão ----
  // ---- CAMADA 3.5: Complemento com vizinhas ----
  // ---- CAMADA 4: Órfãos ----
  assignCitiesToTrucks(cityVolumeMap, distributions, routeTrucks, avgCapacity);

  for (const dist of distributions) {
    dist.occupancyPercent = Math.round((dist.currentWeight / dist.capacity) * 100);
  }

  return { distributions, totalWeight, totalOrders: orders.length };
}

// =====================================================
// CAMADA 1 + 2: Território e Volume por Cidade
// =====================================================

function buildCityVolumeMap(
  geocodedOrders: GeocodedOrder[],
  avgTruckCapacity: number
): CityVolume[] {
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const go of geocodedOrders) {
    const key = go.city || '__unknown__';
    if (!cityOrderMap.has(key)) cityOrderMap.set(key, []);
    cityOrderMap.get(key)!.push(go);
  }

  const SMALL_THRESHOLD = 0.30; // < 30% da capacidade = cidade pequena

  const cityVolumes: CityVolume[] = [];
  for (const [city, orders] of cityOrderMap) {
    const totalWeight = orders.reduce((s, go) => s + Number(go.order.weight_kg), 0);
    const trucksNeeded = Math.ceil(totalWeight / avgTruckCapacity);
    const classification: 'grande' | 'pequena' = 
      totalWeight >= avgTruckCapacity * SMALL_THRESHOLD ? 'grande' : 'pequena';

    cityVolumes.push({
      city,
      orders,
      totalWeight,
      trucksNeeded: Math.max(1, trucksNeeded),
      classification,
      assigned: false,
    });
  }

  // Ordenar por peso descrescente (cidades grandes primeiro)
  cityVolumes.sort((a, b) => b.totalWeight - a.totalWeight);

  return cityVolumes;
}

// =====================================================
// CAMADA 3 + 3.5 + 4: Atribuição com complemento
// =====================================================

function assignCitiesToTrucks(
  cityVolumes: CityVolume[],
  distributions: TruckDistribution[],
  routeTrucks: Array<{ id: string; truck: Truck }>,
  avgCapacity: number
) {
  let truckIndex = 0;

  // CAMADA 3: Cidades grandes primeiro
  for (const cv of cityVolumes) {
    if (cv.classification === 'pequena') continue;
    if (cv.assigned) continue;

    if (cv.trucksNeeded > 1 && truckIndex + cv.trucksNeeded <= distributions.length) {
      // Cidade precisa de múltiplos caminhões → dividir por proximidade interna
      const blocks = splitCityIntoBlocks(cv.orders, cv.trucksNeeded);
      for (const block of blocks) {
        if (truckIndex >= distributions.length) break;
        addOrdersToTruck(distributions[truckIndex], block, routeTrucks);
        truckIndex++;
      }
    } else if (truckIndex < distributions.length) {
      // Cidade cabe em 1 caminhão
      addOrdersToTruck(distributions[truckIndex], cv.orders, routeTrucks);
      truckIndex++;
    }
    cv.assigned = true;
  }

  // CAMADA 3.5: Complemento com vizinhas
  // Para cada caminhão que já tem cidade principal, verificar sobra e adicionar vizinhas pequenas
  for (let i = 0; i < Math.min(truckIndex, distributions.length); i++) {
    const dist = distributions[i];
    const remainingCapacity = dist.capacity - dist.currentWeight;
    if (remainingCapacity <= 0) continue;

    // Identificar a cidade principal deste caminhão
    const primaryCity = getPrimaryCityOfTruck(dist, distributions[i].orders.map(o => o.orderId), 
      cityVolumes);

    if (!primaryCity) continue;

    // Buscar cidades vizinhas pequenas não atribuídas
    const neighbors = getNeighborCities(primaryCity);
    // Ordenar vizinhas por proximidade ao CD (mais próximas primeiro para coerência)
    const sortedNeighbors = neighbors.sort((a, b) => 
      getCityDistanceFromCD(a) - getCityDistanceFromCD(b)
    );

    for (const neighbor of sortedNeighbors) {
      const neighborCV = cityVolumes.find(cv => cv.city === neighbor && !cv.assigned && cv.classification === 'pequena');
      if (!neighborCV) continue;

      const canFit = dist.currentWeight + neighborCV.totalWeight <= dist.capacity;
      if (canFit) {
        addOrdersToTruck(dist, neighborCV.orders, routeTrucks);
        neighborCV.assigned = true;
      }
    }
  }

  // CAMADA 4: Cidades pequenas órfãs (não absorvidas por nenhum vizinho)
  const orphans = cityVolumes.filter(cv => !cv.assigned);
  if (orphans.length > 0) {
    // Agrupar órfãs entre si por adjacência
    const orphanGroups = groupOrphansByAdjacency(orphans);
    
    for (const group of orphanGroups) {
      const allOrders = group.flatMap(cv => cv.orders);
      const groupWeight = allOrders.reduce((s, go) => s + Number(go.order.weight_kg), 0);

      // Tentar encaixar no caminhão com mais espaço
      if (truckIndex < distributions.length) {
        // Caminhão novo disponível
        addOrdersToTruck(distributions[truckIndex], allOrders, routeTrucks);
        truckIndex++;
      } else {
        // Todos os caminhões já estão em uso → colocar no que tem mais espaço
        const bestTruck = findTruckWithMostSpace(distributions);
        if (bestTruck) {
          addOrdersToTruck(bestTruck, allOrders, routeTrucks);
        }
      }

      for (const cv of group) cv.assigned = true;
    }
  }
}

// =====================================================
// Funções auxiliares
// =====================================================

/**
 * Divide os pedidos de uma cidade em N blocos por proximidade geográfica interna
 */
function splitCityIntoBlocks(
  orders: GeocodedOrder[],
  numBlocks: number
): GeocodedOrder[][] {
  if (numBlocks <= 1) return [orders];

  // Ordenar por distância do CD para criar blocos geográficos coerentes
  const sorted = [...orders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);
  
  const blocks: GeocodedOrder[][] = Array.from({ length: numBlocks }, () => []);
  const blockWeights = new Array(numBlocks).fill(0);

  // Distribuir round-robin por peso para balancear
  for (const order of sorted) {
    // Encontrar bloco mais leve
    let minIdx = 0;
    let minWeight = blockWeights[0];
    for (let i = 1; i < numBlocks; i++) {
      if (blockWeights[i] < minWeight) {
        minWeight = blockWeights[i];
        minIdx = i;
      }
    }
    blocks[minIdx].push(order);
    blockWeights[minIdx] += Number(order.order.weight_kg);
  }

  return blocks;
}

/**
 * Adiciona pedidos a um caminhão respeitando capacidade
 */
function addOrdersToTruck(
  dist: TruckDistribution,
  orders: GeocodedOrder[],
  routeTrucks: Array<{ id: string; truck: Truck }>
) {
  const truck = routeTrucks.find(rt => rt.id === dist.routeTruckId)?.truck;
  
  for (const go of orders) {
    const weight = Number(go.order.weight_kg);
    const canFitWeight = dist.currentWeight + weight <= dist.capacity;
    const canFitOrders = !truck?.max_deliveries || dist.orderCount < truck.max_deliveries;

    if (canFitWeight && canFitOrders) {
      dist.orders.push({
        orderId: go.order.id,
        weight,
        sequence: dist.orders.length + 1,
      });
      dist.currentWeight += weight;
      dist.orderCount++;
    }
  }
}

/**
 * Identifica a cidade principal de um caminhão baseado nos pedidos já atribuídos
 */
function getPrimaryCityOfTruck(
  dist: TruckDistribution,
  orderIds: string[],
  cityVolumes: CityVolume[]
): string | null {
  // Encontrar qual cidade tem mais pedidos neste caminhão
  const cityCounts = new Map<string, number>();
  
  for (const cv of cityVolumes) {
    if (!cv.assigned) continue;
    const count = cv.orders.filter(go => orderIds.includes(go.order.id)).length;
    if (count > 0) {
      cityCounts.set(cv.city, count);
    }
  }

  let bestCity: string | null = null;
  let bestCount = 0;
  for (const [city, count] of cityCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestCity = city;
    }
  }

  return bestCity;
}

/**
 * Agrupa cidades órfãs por adjacência geográfica
 */
function groupOrphansByAdjacency(orphans: CityVolume[]): CityVolume[][] {
  const visited = new Set<string>();
  const groups: CityVolume[][] = [];

  for (const orphan of orphans) {
    if (visited.has(orphan.city)) continue;

    const group: CityVolume[] = [orphan];
    visited.add(orphan.city);

    // BFS para encontrar vizinhas também órfãs
    const queue = [orphan.city];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = CITY_NEIGHBORS[current] || [];
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        const neighborOrphan = orphans.find(o => o.city === neighbor);
        if (neighborOrphan) {
          visited.add(neighbor);
          group.push(neighborOrphan);
          queue.push(neighbor);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Encontra o caminhão com mais espaço disponível
 */
function findTruckWithMostSpace(distributions: TruckDistribution[]): TruckDistribution | null {
  let best: TruckDistribution | null = null;
  let bestSpace = -1;

  for (const dist of distributions) {
    const space = dist.capacity - dist.currentWeight;
    if (space > bestSpace) {
      bestSpace = space;
      best = dist;
    }
  }

  return best;
}

// =====================================================
// Reordenação por estratégia (nearest-neighbor com bônus)
// =====================================================

/**
 * Reordena entregas dentro de cada caminhão usando nearest-neighbor
 * com bônus de proximidade. Contexto territorial por caminhão.
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

    if (truckOrders.length <= 1) return dist;

    // Determinar ponto de partida baseado na estratégia
    let startLat = cd.lat;
    let startLng = cd.lng;

    if (strategy === 'finalizacao_proxima') {
      // Iniciar pela mais distante do CD dentro das cidades do caminhão
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
    // Para 'padrao' e 'finalizacao_distante': começar do CD (padrão)

    // Nearest-neighbor com bônus de proximidade
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
