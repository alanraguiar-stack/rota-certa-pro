/**
 * Motor de Roteamento Automático — Regras por Território
 * 
 * LÓGICA: Territórios com cidade âncora → caminhão atribuído automaticamente.
 * 
 * Fluxo:
 * 1. Lê pedidos, agrupa por cidade
 * 2. Atribui caminhões a territórios automaticamente
 * 3. Aloca pedidos conforme regras de cada território
 * 4. Excedentes → caminhão de apoio
 * 5. Sequenciamento: prioridade de bairro > cidade > CEP > bairro > rua (agrupamento por rua)
 */

import { Truck, ParsedOrder, RoutingStrategy } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName } from './geocoding';
import { ParsedItemDetail } from './itemDetailParser';
import { RoutingHint, ExtractedPatterns } from './historyPatternEngine';
import { 
  TerritoryRule, TERRITORY_RULES, 
  findAnchorRule, AnchorRule, normalizeNeighborhood,
  assignTrucksToTerritories, clearTruckTerritories, setTruckTerritory 
} from './anchorRules';

export interface AutoRouterConfig {
  strategy: RoutingStrategy;
  safetyMarginPercent: number;
  maxOccupancyPercent: number;
  balanceOrders: boolean;
}

export interface TruckComposition {
  truck: Truck;
  orders: ParsedOrder[];
  totalWeight: number;
  occupancyPercent: number;
  estimatedDeliveries: number;
  cities: string[];
  primaryCity?: string;
  complementCities?: string[];
  anchorRule?: AnchorRule;
  territoryRule?: TerritoryRule;
  overflowOrders?: ParsedOrder[];
}

export interface CompositionValidation {
  valid: boolean;
  violations: string[];
}

export interface AutoRouterResult {
  compositions: TruckComposition[];
  unassignedOrders: ParsedOrder[];
  totalWeight: number;
  totalOrders: number;
  trucksUsed: number;
  averageOccupancy: number;
  warnings: string[];
  reasoning: string[];
  validation: CompositionValidation;
}

interface GeocodedOrder extends ParsedOrder {
  geocoded: GeocodedAddress;
  distanceFromCD: number;
  angle: number;
}

const DEFAULT_CONFIG: AutoRouterConfig = {
  strategy: 'padrao',
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
  
  const itemsByPedido = new Map<string, ParsedItemDetail[]>();
  itemDetails.forEach(item => {
    const existing = itemsByPedido.get(item.pedido_id) || [];
    existing.push(item);
    itemsByPedido.set(item.pedido_id, existing);
  });
  
  return orders.map(order => {
    const orderItems = order.pedido_id ? itemsByPedido.get(order.pedido_id) : null;
    
    if (orderItems && orderItems.length > 0) {
      const items = orderItems.map(item => ({
        product_name: item.product_name,
        weight_kg: item.weight_kg,
        quantity: item.quantity,
      }));
      
      const totalWeight = items.reduce((sum, item) => sum + item.weight_kg, 0);
      return { ...order, items, weight_kg: totalWeight };
    }
    
    return order;
  });
}

/**
 * Calculate which trucks to use based on total weight
 */
export function recommendTrucks(
  availableTrucks: Truck[],
  totalWeight: number,
  totalOrders: number,
  config: Partial<AutoRouterConfig> = {}
): Truck[] {
  return [...availableTrucks];
}

// ================================================================
// MAIN ENTRY POINT
// ================================================================

/**
 * Main auto-routing function — TERRITORY-BASED RULES
 */
export function autoComposeRoute(
  orders: ParsedOrder[],
  availableTrucks: Truck[],
  config: Partial<AutoRouterConfig> = {},
  historyHints?: RoutingHint[],
  extractedPatterns?: ExtractedPatterns
): AutoRouterResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const reasoning: string[] = [];
  
  if (orders.length === 0) {
    return {
      compositions: [], unassignedOrders: [], totalWeight: 0,
      totalOrders: 0, trucksUsed: 0, averageOccupancy: 0,
      warnings: ['Nenhum pedido para roteirizar'], reasoning: [],
      validation: { valid: true, violations: [] },
    };
  }
  
  const validOrders = orders.filter(o => o.isValid);
  const totalWeight = validOrders.reduce((sum, o) => sum + o.weight_kg, 0);
  const totalOrders = validOrders.length;
  
  if (availableTrucks.length === 0) {
    return {
      compositions: [], unassignedOrders: validOrders, totalWeight,
      totalOrders, trucksUsed: 0, averageOccupancy: 0,
      warnings: ['Nenhum caminhão disponível'], reasoning: [],
      validation: { valid: true, violations: [] },
    };
  }
  
  // Step 1: Geocode all orders
  const cd = getDistributionCenterCoords();
  const geocodedOrders: GeocodedOrder[] = validOrders.map(order => {
    const geocoded = parseAddress(order.address);
    const distanceFromCD = calculateDistance(
      cd.lat, cd.lng, geocoded.estimatedLat, geocoded.estimatedLng
    );
    const angle = Math.atan2(
      geocoded.estimatedLat - cd.lat,
      geocoded.estimatedLng - cd.lng
    ) * (180 / Math.PI);
    return { ...order, geocoded, distanceFromCD, angle };
  });

  // Step 2: Group orders by city
  const cityOrderMap = new Map<string, GeocodedOrder[]>();
  for (const order of geocodedOrders) {
    const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
    const existing = cityOrderMap.get(city) || [];
    existing.push(order);
    cityOrderMap.set(city, existing);
  }

  for (const [city, cityOrders] of cityOrderMap) {
    const weight = cityOrders.reduce((s, o) => s + o.weight_kg, 0);
    reasoning.push(`${city}: ${cityOrders.length} entregas (${(weight / 1000).toFixed(1)}t)`);
  }

  // Step 3: Auto-assign trucks to territories
  clearTruckTerritories();
  const citiesInOrders = new Set(cityOrderMap.keys());
  const truckData = availableTrucks.map(t => ({
    plate: t.plate,
    capacity_kg: Number(t.capacity_kg),
    max_deliveries: t.max_deliveries,
  }));
  const territoryAssignments = assignTrucksToTerritories(truckData, citiesInOrders);

  // Build territory → truck mapping
  const territoryTrucks: { truck: Truck; rule: TerritoryRule }[] = [];
  const assignedTruckPlates = new Set<string>();

  for (const [territoryId, assignedTruck] of territoryAssignments) {
    const rule = TERRITORY_RULES.find(r => r.id === territoryId)!;
    const truck = availableTrucks.find(t => t.plate === assignedTruck.plate)!;
    territoryTrucks.push({ truck, rule });
    assignedTruckPlates.add(truck.plate);
    setTruckTerritory(truck.plate, rule);
    reasoning.push(`${truck.plate} → ${rule.label}`);
  }

  const nonTerritoryTrucks = availableTrucks.filter(t => !assignedTruckPlates.has(t.plate));

  // Step 4: Allocate orders to territory trucks
  const compositions: TruckComposition[] = [];
  const assignedOrderKeys = new Set<string>();
  const overflowOrders: GeocodedOrder[] = [];

  const orderKey = (o: ParsedOrder) => o.pedido_id || `${o.client_name}::${o.address}`;

  // Find the support territory truck
  const supportEntry = territoryTrucks.find(a => a.rule.isSupport);

  // Process non-support territories first (sorted by priority)
  const sortedTerritories = territoryTrucks
    .filter(t => !t.rule.isSupport)
    .sort((a, b) => a.rule.priority - b.rule.priority);

  for (const { truck, rule } of sortedTerritories) {
    const capacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    const maxDel = rule.maxDeliveries;
    const assignedOrders: GeocodedOrder[] = [];
    let currentWeight = 0;

    // 4a: Priority neighborhoods (e.g., Jardim Mutinga for Osasco truck)
    // These go FIRST in the sequence
    for (const pn of rule.priorityNeighborhoods) {
      const pnCity = normalizeCityName(pn.city);
      const pnNh = normalizeNeighborhood(pn.neighborhood);
      for (const order of geocodedOrders) {
        const key = orderKey(order);
        if (assignedOrderKeys.has(key)) continue;
        if (assignedOrders.length >= maxDel) break;
        if (currentWeight + order.weight_kg > capacity) continue;

        const orderCity = normalizeCityName(order.city || order.geocoded.city || '');
        const orderNh = normalizeNeighborhood(order.geocoded.neighborhood || '');
        if (orderCity === pnCity && orderNh === pnNh) {
          assignedOrders.push(order);
          assignedOrderKeys.add(key);
          currentWeight += order.weight_kg;
          reasoning.push(`Prioridade bairro: ${order.client_name} (${pn.neighborhood}, ${pn.city}) → ${truck.plate}`);
        }
      }
    }

    // 4b: Anchor city orders (MANDATORY), excluding excluded neighborhoods
    const anchorOrders = cityOrderMap.get(rule.anchorCity) || [];
    const sortedAnchor = [...anchorOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);

    for (const order of sortedAnchor) {
      const key = orderKey(order);
      if (assignedOrderKeys.has(key)) continue;

      // Check if this neighborhood is excluded
      const orderNh = normalizeNeighborhood(order.geocoded.neighborhood || '');
      const isExcluded = rule.excludedNeighborhoods.some(en => 
        normalizeNeighborhood(en.neighborhood) === orderNh &&
        normalizeCityName(en.city) === normalizeCityName(order.city || order.geocoded.city || '')
      );
      if (isExcluded) continue;

      if (currentWeight + order.weight_kg <= capacity && assignedOrders.length < maxDel) {
        assignedOrders.push(order);
        assignedOrderKeys.add(key);
        currentWeight += order.weight_kg;
      } else {
        overflowOrders.push(order);
        assignedOrderKeys.add(key);
        reasoning.push(`Excedente de ${rule.anchorCity}: ${order.client_name} → Caminhão de apoio`);
      }
    }

    // 4c: Neighborhood exceptions (bairros de cidades específicas, com limite)
    for (const exception of rule.neighborhoodExceptions) {
      let exceptionCount = 0;
      const exceptionCity = normalizeCityName(exception.city);
      for (const order of geocodedOrders) {
        if (assignedOrderKeys.has(orderKey(order))) continue;
        if (exceptionCount >= exception.maxDeliveries) break;
        if (assignedOrders.length >= maxDel) break;
        if (currentWeight + order.weight_kg > capacity) continue;

        const orderCity = normalizeCityName(order.city || order.geocoded.city || '');
        if (orderCity !== exceptionCity) continue;

        const nh = normalizeNeighborhood(order.geocoded.neighborhood || '');
        if (nh === normalizeNeighborhood(exception.neighborhood)) {
          assignedOrders.push(order);
          assignedOrderKeys.add(orderKey(order));
          currentWeight += order.weight_kg;
          exceptionCount++;
          reasoning.push(`Exceção bairro: ${order.client_name} (${exception.neighborhood}, ${exception.city}) → ${truck.plate}`);
        }
      }
    }

    // 4d: Neighborhood fills (bairros específicos sem limite rígido)
    for (const nf of rule.neighborhoodFills) {
      if (assignedOrders.length >= maxDel) break;
      const nfCity = normalizeCityName(nf.city);
      const nfNh = normalizeNeighborhood(nf.neighborhood);

      for (const order of geocodedOrders) {
        const key = orderKey(order);
        if (assignedOrderKeys.has(key)) continue;
        if (assignedOrders.length >= maxDel) break;
        if (currentWeight + order.weight_kg > capacity) continue;

        const orderCity = normalizeCityName(order.city || order.geocoded.city || '');
        const orderNh = normalizeNeighborhood(order.geocoded.neighborhood || '');
        if (orderCity === nfCity && orderNh === nfNh) {
          assignedOrders.push(order);
          assignedOrderKeys.add(key);
          currentWeight += order.weight_kg;
          reasoning.push(`Fill bairro: ${order.client_name} (${nf.neighborhood}, ${nf.city}) → ${truck.plate}`);
        }
      }
    }

    // 4e: Allowed fill cities (if capacity remains)
    for (const fillCity of rule.allowedFillCities) {
      if (assignedOrders.length >= maxDel) break;

      const fillOrders = cityOrderMap.get(fillCity) || [];
      const sortedFill = [...fillOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);

      for (const order of sortedFill) {
        const key = orderKey(order);
        if (assignedOrderKeys.has(key)) continue;
        if (assignedOrders.length >= maxDel) break;
        if (currentWeight + order.weight_kg > capacity) continue;

        assignedOrders.push(order);
        assignedOrderKeys.add(key);
        currentWeight += order.weight_kg;
      }
    }

    // Build cities list
    const citiesInTruck = new Set<string>();
    const complementCities: string[] = [];
    for (const order of assignedOrders) {
      const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
      citiesInTruck.add(city);
      if (city !== rule.anchorCity && !complementCities.includes(city)) {
        complementCities.push(city);
      }
    }

    // Build legacy AnchorRule for compatibility
    const legacyRule: AnchorRule = {
      platePrefix: truck.plate.replace(/[\s-]/g, '').toUpperCase().substring(0, 3),
      anchorCity: rule.anchorCity,
      maxDeliveries: rule.maxDeliveries,
      allowedFillCities: rule.allowedFillCities,
      neighborhoodExceptions: rule.neighborhoodExceptions,
      label: rule.label,
      isSupport: rule.isSupport,
    };

    compositions.push({
      truck,
      orders: assignedOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / Number(truck.capacity_kg)) * 100),
      estimatedDeliveries: assignedOrders.length,
      cities: Array.from(citiesInTruck),
      primaryCity: rule.anchorCity,
      complementCities: complementCities.length > 0 ? complementCities : undefined,
      anchorRule: legacyRule,
      territoryRule: rule,
    });

    reasoning.push(
      `${truck.plate} (${rule.label}): ${assignedOrders.length} entregas, ${(currentWeight / 1000).toFixed(1)}t`
    );
  }

  // Step 5: Support truck — gets its own cities + all overflow
  if (supportEntry) {
    const { truck, rule } = supportEntry;
    const capacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    const maxDel = rule.maxDeliveries;
    const assignedOrders: GeocodedOrder[] = [];
    let currentWeight = 0;

    // 5a: Support's own cities
    for (const city of rule.allowedFillCities) {
      const cityOrders = cityOrderMap.get(city) || [];
      for (const order of cityOrders) {
        const key = orderKey(order);
        if (assignedOrderKeys.has(key)) continue;
        if (assignedOrders.length >= maxDel) break;
        if (currentWeight + order.weight_kg > capacity) continue;

        assignedOrders.push(order);
        assignedOrderKeys.add(key);
        currentWeight += order.weight_kg;
      }
    }

    // 5b: Overflow from anchor trucks
    for (const order of overflowOrders) {
      if (assignedOrders.length >= maxDel) break;
      if (currentWeight + order.weight_kg > capacity) continue;

      assignedOrders.push(order);
      currentWeight += order.weight_kg;
    }

    const citiesInTruck = new Set<string>();
    for (const order of assignedOrders) {
      const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
      citiesInTruck.add(city);
    }

    const legacyRule: AnchorRule = {
      platePrefix: truck.plate.replace(/[\s-]/g, '').toUpperCase().substring(0, 3),
      anchorCity: '',
      maxDeliveries: rule.maxDeliveries,
      allowedFillCities: rule.allowedFillCities,
      neighborhoodExceptions: [],
      label: rule.label,
      isSupport: true,
    };

    compositions.push({
      truck,
      orders: assignedOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / Number(truck.capacity_kg)) * 100),
      estimatedDeliveries: assignedOrders.length,
      cities: Array.from(citiesInTruck),
      primaryCity: 'apoio',
      anchorRule: legacyRule,
      territoryRule: rule,
    });

    reasoning.push(
      `${truck.plate} (Apoio): ${assignedOrders.length} entregas, ${(currentWeight / 1000).toFixed(1)}t`
    );
  }

  // Step 5c: Non-territory trucks — receive remaining unassigned orders
  const remainingOrders = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
  
  for (const truck of nonTerritoryTrucks) {
    if (remainingOrders.length === 0) {
      compositions.push({
        truck, orders: [], totalWeight: 0, occupancyPercent: 0,
        estimatedDeliveries: 0, cities: [],
      });
      continue;
    }

    const capacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    const maxDel = truck.max_deliveries ? Number(truck.max_deliveries) : 25;
    const assignedOrders: GeocodedOrder[] = [];
    let currentWeight = 0;

    const remainingByCity = new Map<string, GeocodedOrder[]>();
    for (const o of remainingOrders) {
      const city = normalizeCityName(o.city || o.geocoded.city || 'desconhecida');
      const existing = remainingByCity.get(city) || [];
      existing.push(o);
      remainingByCity.set(city, existing);
    }

    for (const [, cityOrders] of remainingByCity) {
      for (const order of cityOrders) {
        if (assignedOrderKeys.has(orderKey(order))) continue;
        if (currentWeight + order.weight_kg > capacity) continue;
        if (assignedOrders.length >= maxDel) break;

        assignedOrders.push(order);
        assignedOrderKeys.add(orderKey(order));
        currentWeight += order.weight_kg;
      }
      if (assignedOrders.length >= maxDel) break;
    }

    const citiesInTruck = new Set<string>();
    for (const order of assignedOrders) {
      const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
      citiesInTruck.add(city);
    }

    compositions.push({
      truck,
      orders: assignedOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / Number(truck.capacity_kg)) * 100),
      estimatedDeliveries: assignedOrders.length,
      cities: Array.from(citiesInTruck),
    });

    if (assignedOrders.length > 0) {
      reasoning.push(`${truck.plate} (extra): ${assignedOrders.length} entregas`);
    }
  }

  // Step 5d: Consolidation — move trucks with < 15 deliveries to support
  const MIN_DELIVERIES = 15;
  const supportComp = compositions.find(c => c.territoryRule?.isSupport || c.anchorRule?.isSupport);
  if (supportComp) {
    for (const comp of compositions) {
      if (comp === supportComp) continue;
      if (comp.orders.length === 0) continue;
      if (comp.territoryRule?.isSupport || comp.anchorRule?.isSupport) continue;
      if (comp.orders.length < MIN_DELIVERIES) {
        warnings.push(
          `${comp.truck.plate}: apenas ${comp.orders.length} entregas (mín. ${MIN_DELIVERIES}). Pedidos transferidos para caminhão de apoio.`
        );
        reasoning.push(
          `Consolidação: ${comp.truck.plate} (${comp.orders.length} entregas) → apoio ${supportComp.truck.plate}`
        );
        supportComp.orders.push(...comp.orders);
        supportComp.totalWeight += comp.totalWeight;
        supportComp.occupancyPercent = Math.round(
          (supportComp.totalWeight / Number(supportComp.truck.capacity_kg)) * 100
        );
        supportComp.estimatedDeliveries = supportComp.orders.length;
        for (const order of comp.orders) {
          const city = normalizeCityName((order as any).city || (order as any).geocoded?.city || 'desconhecida');
          if (!supportComp.cities.includes(city)) {
            supportComp.cities.push(city);
          }
        }
        comp.orders = [];
        comp.totalWeight = 0;
        comp.occupancyPercent = 0;
        comp.estimatedDeliveries = 0;
        comp.cities = [];
      }
    }
  }

  // Step 5e: Rebalance between internal (non-support, non-third-party) trucks
  rebalanceInternalTrucks(compositions, reasoning, warnings);

  // Step 6: Sequence optimization with street grouping
  for (const comp of compositions) {
    if (comp.orders.length > 1) {
      optimizeDeliverySequence(
        comp.orders as GeocodedOrder[],
        cd.lat, cd.lng, cfg.strategy,
        comp.anchorRule,
        comp.territoryRule
      );
    }
  }

  // Collect truly unassigned
  const allAssigned = new Set(
    compositions.flatMap(c => c.orders.map(o => orderKey(o)))
  );
  const unassignedOrders = validOrders.filter(o => !allAssigned.has(orderKey(o)));

  if (unassignedOrders.length > 0) {
    warnings.push(`${unassignedOrders.length} pedidos não puderam ser atribuídos`);
  }

  const totalCapacityUsed = compositions.reduce((sum, c) => sum + c.totalWeight, 0);
  const totalCapacity = compositions.reduce((sum, c) => sum + Number(c.truck.capacity_kg), 0);
  const averageOccupancy = totalCapacity > 0 ? (totalCapacityUsed / totalCapacity) * 100 : 0;

  const validation = validateComposition(compositions);
  if (!validation.valid) {
    warnings.push('⚠️ Composição contém violações de regras operacionais');
  }

  return {
    compositions, unassignedOrders, totalWeight, totalOrders,
    trucksUsed: compositions.filter(c => c.orders.length > 0).length,
    averageOccupancy: Math.round(averageOccupancy),
    warnings, reasoning, validation,
  };
}

// ================================================================
// REBALANCING: Equalize orders between internal trucks
// ================================================================

function rebalanceInternalTrucks(
  compositions: TruckComposition[],
  reasoning: string[],
  warnings: string[]
): void {
  // Internal trucks = have territory, not support, have orders
  const internal = compositions.filter(c =>
    c.orders.length > 0 &&
    c.territoryRule &&
    !c.territoryRule.isSupport
  );

  if (internal.length < 2) return;

  const MAX_DIFF = 3;

  // Sort by order count descending
  internal.sort((a, b) => b.orders.length - a.orders.length);
  const most = internal[0];
  const least = internal[internal.length - 1];
  const diff = most.orders.length - least.orders.length;

  if (diff <= MAX_DIFF + 1) return; // already balanced enough

  // Calculate how many to move
  const target = Math.floor((most.orders.length + least.orders.length) / 2);
  const toMove = most.orders.length - target;
  if (toMove <= 0) return;

  // Find movable orders: NOT from anchor city, prefer fill cities and neighborhood exceptions
  const anchorCity = most.territoryRule?.anchorCity || '';
  const movable = most.orders.filter(o => {
    const city = normalizeCityName(o.city || (o as any).geocoded?.city || '');
    return city !== anchorCity;
  });

  if (movable.length === 0) return;

  const leastCapacity = Number(least.truck.capacity_kg) * 0.95;
  const leastMaxDel = least.territoryRule?.maxDeliveries || 25;
  let moved = 0;

  for (const order of movable) {
    if (moved >= toMove) break;
    if (least.orders.length >= leastMaxDel) break;
    if (least.totalWeight + order.weight_kg > leastCapacity) continue;

    // Remove from most
    const idx = most.orders.indexOf(order);
    if (idx >= 0) {
      most.orders.splice(idx, 1);
      most.totalWeight -= order.weight_kg;

      // Add to least
      least.orders.push(order);
      least.totalWeight += order.weight_kg;
      moved++;
    }
  }

  if (moved > 0) {
    // Update stats
    for (const comp of [most, least]) {
      comp.estimatedDeliveries = comp.orders.length;
      comp.occupancyPercent = Math.round((comp.totalWeight / Number(comp.truck.capacity_kg)) * 100);
      const cities = new Set<string>();
      for (const o of comp.orders) {
        cities.add(normalizeCityName(o.city || (o as any).geocoded?.city || 'desconhecida'));
      }
      comp.cities = Array.from(cities);
    }

    reasoning.push(
      `Rebalanceamento: ${moved} entregas de ${most.truck.plate} (${most.orders.length + moved}→${most.orders.length}) → ${least.truck.plate} (${least.orders.length - moved}→${least.orders.length})`
    );
  }
}

// ================================================================
// VALIDATION
// ================================================================

export function validateComposition(
  compositions: TruckComposition[],
  extractedPatterns?: ExtractedPatterns
): CompositionValidation {
  const violations: string[] = [];

  for (const comp of compositions) {
    if (comp.orders.length === 0) continue;
    const rule = comp.territoryRule;
    const legacy = comp.anchorRule || findAnchorRule(comp.truck.plate);

    const maxDel = rule?.maxDeliveries || legacy?.maxDeliveries || 25;
    if (comp.orders.length > maxDel) {
      violations.push(
        `${comp.truck.plate}: ${comp.orders.length} entregas excedem o limite de ${maxDel}`
      );
    }

    const capacity = Number(comp.truck.capacity_kg);
    if (comp.totalWeight > capacity) {
      violations.push(
        `${comp.truck.plate}: peso ${(comp.totalWeight / 1000).toFixed(1)}t excede capacidade de ${(capacity / 1000).toFixed(1)}t`
      );
    }

    const anchorCity = rule?.anchorCity || legacy?.anchorCity || '';
    const isSupport = rule?.isSupport || legacy?.isSupport;
    if (!isSupport && anchorCity) {
      const hasAnchorCity = comp.cities.some(c => c === anchorCity);
      if (!hasAnchorCity && comp.orders.length > 0) {
        violations.push(
          `${comp.truck.plate}: deveria conter entregas de ${anchorCity} (cidade âncora)`
        );
      }
    }

    // Check city alternation in sequence
    if (comp.orders.length > 2) {
      const citySequence = comp.orders.map(o => {
        return normalizeCityName(o.city || (o as any).geocoded?.city || parseAddress(o.address).city || 'desconhecida');
      }).filter(c => c !== 'desconhecida');

      const visitedCities = new Set<string>();
      let lastCity = '';
      for (const city of citySequence) {
        if (city !== lastCity) {
          if (visitedCities.has(city)) {
            violations.push(
              `${comp.truck.plate}: alternância de cidades na sequência (${city} aparece mais de uma vez)`
            );
            break;
          }
          if (lastCity) visitedCities.add(lastCity);
          lastCity = city;
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ================================================================
// DELIVERY SEQUENCE: PRIORITY NEIGHBORHOODS > CITY > CEP > BAIRRO > RUA
// With street grouping sweep
// ================================================================

function optimizeDeliverySequence(
  orders: GeocodedOrder[],
  startLat: number,
  startLng: number,
  strategy: RoutingStrategy,
  anchorRule?: AnchorRule,
  territoryRule?: TerritoryRule
): void {
  if (orders.length <= 1) return;

  // Step 1: Separate priority neighborhood orders (they go FIRST)
  const priorityOrders: GeocodedOrder[] = [];
  const regularOrders: GeocodedOrder[] = [];

  if (territoryRule && territoryRule.priorityNeighborhoods.length > 0) {
    for (const order of orders) {
      const orderCity = normalizeCityName(order.city || order.geocoded.city || '');
      const orderNh = normalizeNeighborhood(order.geocoded.neighborhood || '');
      const isPriority = territoryRule.priorityNeighborhoods.some(pn =>
        normalizeCityName(pn.city) === orderCity &&
        normalizeNeighborhood(pn.neighborhood) === orderNh
      );
      if (isPriority) {
        priorityOrders.push(order);
      } else {
        regularOrders.push(order);
      }
    }
  } else {
    regularOrders.push(...orders);
  }

  // Sort priority orders by street grouping
  if (priorityOrders.length > 1) {
    priorityOrders.sort((a, b) => sortWithinCity(a, b));
    streetGroupSweep(priorityOrders);
  }

  // Step 2: Group regular orders by city
  const cityGroups = new Map<string, GeocodedOrder[]>();
  for (const order of regularOrders) {
    const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
    const existing = cityGroups.get(city) || [];
    existing.push(order);
    cityGroups.set(city, existing);
  }

  // Step 3: Order cities — anchor city first, then fill cities
  const cityDistances: { city: string; avgDist: number; orders: GeocodedOrder[] }[] = [];
  for (const [city, cityOrders] of cityGroups) {
    const avgDist = cityOrders.reduce((s, o) => s + o.distanceFromCD, 0) / cityOrders.length;
    cityDistances.push({ city, avgDist, orders: cityOrders });
  }

  const anchorCity = anchorRule?.anchorCity || territoryRule?.anchorCity || '';
  cityDistances.sort((a, b) => {
    if (a.city === anchorCity) return -1;
    if (b.city === anchorCity) return 1;
    if (strategy === 'finalizacao_proxima') return b.avgDist - a.avgDist;
    return a.avgDist - b.avgDist;
  });

  // Step 4: Within each city block, sort by CEP > neighborhood > street, then sweep for street grouping
  const result: GeocodedOrder[] = [...priorityOrders];

  for (const cityGroup of cityDistances) {
    const cityOrders = cityGroup.orders;

    // Handle special neighborhood insertion rules
    if (anchorRule) {
      const insertionRules = anchorRule.neighborhoodExceptions.filter(e => e.insertAfterNeighborhood);
      if (insertionRules.length > 0) {
        cityOrders.sort((a, b) => sortWithinCity(a, b));

        for (const rule of insertionRules) {
          const targetNh = normalizeNeighborhood(rule.insertAfterNeighborhood!);
          const ruleNh = normalizeNeighborhood(rule.neighborhood);

          const ruleOrders: GeocodedOrder[] = [];
          const otherOrders: GeocodedOrder[] = [];
          for (const o of cityOrders) {
            if (normalizeNeighborhood(o.geocoded.neighborhood || '') === ruleNh) {
              ruleOrders.push(o);
            } else {
              otherOrders.push(o);
            }
          }

          if (ruleOrders.length > 0) {
            let insertIdx = -1;
            for (let i = 0; i < otherOrders.length; i++) {
              if (normalizeNeighborhood(otherOrders[i].geocoded.neighborhood || '') === targetNh) {
                insertIdx = i;
              }
            }

            cityOrders.length = 0;
            if (insertIdx >= 0) {
              cityOrders.push(...otherOrders.slice(0, insertIdx + 1));
              cityOrders.push(...ruleOrders);
              cityOrders.push(...otherOrders.slice(insertIdx + 1));
            } else {
              cityOrders.push(...otherOrders, ...ruleOrders);
            }
          }
        }

        // Apply street grouping sweep
        streetGroupSweep(cityOrders);
        result.push(...cityOrders);
        continue;
      }
    }

    cityOrders.sort((a, b) => sortWithinCity(a, b));
    // Apply street grouping sweep
    streetGroupSweep(cityOrders);
    result.push(...cityOrders);
  }

  // Step 5: Cross-city insertAfterNeighborhood (e.g. Jaguaré after Rochdale across city groups)
  const rule = territoryRule || (anchorRule ? TERRITORY_RULES.find(r => r.anchorCity === anchorRule.anchorCity) : null);
  if (rule) {
    const crossCityInsertions = rule.neighborhoodExceptions.filter(e => e.insertAfterNeighborhood);
    for (const insertion of crossCityInsertions) {
      const targetNh = normalizeNeighborhood(insertion.insertAfterNeighborhood!);
      const sourceNh = normalizeNeighborhood(insertion.neighborhood);

      // Find source orders in result
      const sourceIndices: number[] = [];
      for (let i = 0; i < result.length; i++) {
        const orderNh = normalizeNeighborhood(result[i].geocoded.neighborhood || '');
        const orderCity = normalizeCityName(result[i].city || result[i].geocoded.city || '');
        if (orderNh === sourceNh && orderCity === normalizeCityName(insertion.city)) {
          sourceIndices.push(i);
        }
      }
      if (sourceIndices.length === 0) continue;

      // Find last occurrence of target neighborhood
      let lastTargetIdx = -1;
      for (let i = 0; i < result.length; i++) {
        const orderNh = normalizeNeighborhood(result[i].geocoded.neighborhood || '');
        if (orderNh === targetNh) {
          lastTargetIdx = i;
        }
      }
      if (lastTargetIdx === -1) continue;

      // Extract source orders (back to front)
      const sourceOrders = sourceIndices.map(idx => result[idx]);
      for (let i = sourceIndices.length - 1; i >= 0; i--) {
        result.splice(sourceIndices[i], 1);
      }

      // Recalculate insertion point (may have shifted)
      let insertAfter = -1;
      for (let i = 0; i < result.length; i++) {
        const orderNh = normalizeNeighborhood(result[i].geocoded.neighborhood || '');
        if (orderNh === targetNh) {
          insertAfter = i;
        }
      }
      result.splice(insertAfter + 1, 0, ...sourceOrders);
    }
  }

  orders.length = 0;
  orders.push(...result);
}

/**
 * Street grouping sweep: ensures addresses on the same street are consecutive.
 * After initial sort, scans for separated same-street entries and regroups them.
 */
function streetGroupSweep(orders: GeocodedOrder[]): void {
  if (orders.length <= 2) return;

  const streetMap = new Map<string, number[]>();
  for (let i = 0; i < orders.length; i++) {
    const street = (orders[i].geocoded.street || '').toLowerCase().trim();
    if (!street) continue;
    const city = normalizeCityName(orders[i].city || orders[i].geocoded.city || '');
    const nh = (orders[i].geocoded.neighborhood || '').toLowerCase().trim();
    const key = `${city}||${nh}||${street}`;
    const indices = streetMap.get(key) || [];
    indices.push(i);
    streetMap.set(key, indices);
  }

  // Find streets with non-consecutive indices
  for (const [, indices] of streetMap) {
    if (indices.length < 2) continue;

    // Check if already consecutive
    let consecutive = true;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) continue;

    // Move all to the position of the first occurrence
    const firstIdx = indices[0];
    const items = indices.map(idx => orders[idx]);

    // Remove from back to front to preserve indices
    const sortedIndices = [...indices].sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      orders.splice(idx, 1);
    }

    // Insert all at the first occurrence position (adjusted)
    const insertAt = Math.min(firstIdx, orders.length);
    orders.splice(insertAt, 0, ...items);
  }
}

function sortWithinCity(a: GeocodedOrder, b: GeocodedOrder): number {
  const cepA = (a.geocoded.zipCode || '').replace(/\D/g, '').substring(0, 5);
  const cepB = (b.geocoded.zipCode || '').replace(/\D/g, '').substring(0, 5);
  if (cepA !== cepB) return cepA.localeCompare(cepB);

  const nhA = (a.geocoded.neighborhood || '').toLowerCase();
  const nhB = (b.geocoded.neighborhood || '').toLowerCase();
  if (nhA !== nhB) return nhA.localeCompare(nhB);

  const stA = (a.geocoded.street || '').toLowerCase();
  const stB = (b.geocoded.street || '').toLowerCase();
  if (stA !== stB) return stA.localeCompare(stB);

  return a.distanceFromCD - b.distanceFromCD;
}

// ================================================================
// SUMMARY
// ================================================================

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
