/**
 * Motor de Roteamento Automático — Regras Operacionais Fixas
 * 
 * LÓGICA: Caminhões âncora por território (placa fixa → cidade fixa).
 * Sem inferência. Sem otimização automática de agrupamento.
 * Executa EXATAMENTE as regras definidas em anchorRules.ts.
 * 
 * Fluxo:
 * 1. Lê pedidos, agrupa por cidade
 * 2. Identifica caminhões âncora pela placa
 * 3. Aloca cidade âncora → caminhão âncora
 * 4. Encaixa cidades permitidas se houver sobra
 * 5. Excedentes → caminhão de apoio (EEF)
 * 6. Sequenciamento: cidade > CEP > bairro > rua (blocos contínuos)
 */

import { Truck, ParsedOrder, RoutingStrategy } from '@/types';
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName } from './geocoding';
import { ParsedItemDetail } from './itemDetailParser';
import { RoutingHint, ExtractedPatterns } from './historyPatternEngine';
import { findAnchorRule, AnchorRule, normalizeNeighborhood } from './anchorRules';

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
  // For anchor-based routing, always use ALL active trucks
  return [...availableTrucks];
}

// ================================================================
// MAIN ENTRY POINT
// ================================================================

/**
 * Main auto-routing function — ANCHOR-BASED RULES
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
    const city = normalizeCityName(order.geocoded.city || 'desconhecida');
    const existing = cityOrderMap.get(city) || [];
    existing.push(order);
    cityOrderMap.set(city, existing);
  }

  // Log city summary
  for (const [city, cityOrders] of cityOrderMap) {
    const weight = cityOrders.reduce((s, o) => s + o.weight_kg, 0);
    reasoning.push(`${city}: ${cityOrders.length} entregas (${(weight / 1000).toFixed(1)}t)`);
  }

  // Step 3: Identify anchor trucks and non-anchor trucks
  const anchorTrucks: { truck: Truck; rule: AnchorRule }[] = [];
  const nonAnchorTrucks: Truck[] = [];

  for (const truck of availableTrucks) {
    const rule = findAnchorRule(truck.plate);
    if (rule) {
      anchorTrucks.push({ truck, rule });
      reasoning.push(`${truck.plate} → ${rule.label}`);
    } else {
      nonAnchorTrucks.push(truck);
    }
  }

  // Step 4: Allocate orders to anchor trucks
  const compositions: TruckComposition[] = [];
  const assignedOrderKeys = new Set<string>();
  const overflowOrders: GeocodedOrder[] = [];

  const orderKey = (o: ParsedOrder) => o.pedido_id || `${o.client_name}::${o.address}`;

  // Find the support truck
  const supportEntry = anchorTrucks.find(a => a.rule.isSupport);

  for (const { truck, rule } of anchorTrucks) {
    if (rule.isSupport) continue; // Handle support truck last

    const capacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    const maxDel = rule.maxDeliveries;
    const assignedOrders: GeocodedOrder[] = [];
    let currentWeight = 0;

    // 4a: Anchor city orders (MANDATORY)
    const anchorOrders = cityOrderMap.get(rule.anchorCity) || [];
    const sortedAnchor = [...anchorOrders].sort((a, b) => a.distanceFromCD - b.distanceFromCD);

    for (const order of sortedAnchor) {
      const key = orderKey(order);
      if (assignedOrderKeys.has(key)) continue;

      if (currentWeight + order.weight_kg <= capacity && assignedOrders.length < maxDel) {
        assignedOrders.push(order);
        assignedOrderKeys.add(key);
        currentWeight += order.weight_kg;
      } else {
        // Overflow → support truck
        overflowOrders.push(order);
        assignedOrderKeys.add(key); // Mark so it doesn't get double-counted
        reasoning.push(`Excedente de ${rule.anchorCity}: ${order.client_name} → Caminhão de apoio`);
      }
    }

    // 4b: Neighborhood exceptions (bairros de cidades específicas)
    for (const exception of rule.neighborhoodExceptions) {
      let exceptionCount = 0;
      const exceptionCity = normalizeCityName(exception.city);
      // Search ALL orders for matching neighborhood AND city
      for (const order of geocodedOrders) {
        if (assignedOrderKeys.has(orderKey(order))) continue;
        if (exceptionCount >= exception.maxDeliveries) break;
        if (assignedOrders.length >= maxDel) break;
        if (currentWeight + order.weight_kg > capacity) continue;

        const orderCity = normalizeCityName(order.geocoded.city || '');
        if (orderCity !== exceptionCity) continue; // MUST match exception city

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

    // 4c: Allowed fill cities (if capacity remains)
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
      const city = normalizeCityName(order.geocoded.city || 'desconhecida');
      citiesInTruck.add(city);
      if (city !== rule.anchorCity && !complementCities.includes(city)) {
        complementCities.push(city);
      }
    }

    compositions.push({
      truck,
      orders: assignedOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / Number(truck.capacity_kg)) * 100),
      estimatedDeliveries: assignedOrders.length,
      cities: Array.from(citiesInTruck),
      primaryCity: rule.anchorCity,
      complementCities: complementCities.length > 0 ? complementCities : undefined,
      anchorRule: rule,
    });

    reasoning.push(
      `${truck.plate} (${rule.label}): ${assignedOrders.length} entregas, ${(currentWeight / 1000).toFixed(1)}t`
    );
  }

  // Step 5: Support truck (EEF) — gets its own cities + all overflow
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
      const key = orderKey(order);
      // overflow orders were already marked in assignedOrderKeys, but we need to re-check
      if (assignedOrders.length >= maxDel) break;
      if (currentWeight + order.weight_kg > capacity) continue;

      assignedOrders.push(order);
      currentWeight += order.weight_kg;
    }

    const citiesInTruck = new Set<string>();
    for (const order of assignedOrders) {
      const city = normalizeCityName(order.geocoded.city || 'desconhecida');
      citiesInTruck.add(city);
    }

    compositions.push({
      truck,
      orders: assignedOrders,
      totalWeight: currentWeight,
      occupancyPercent: Math.round((currentWeight / Number(truck.capacity_kg)) * 100),
      estimatedDeliveries: assignedOrders.length,
      cities: Array.from(citiesInTruck),
      primaryCity: 'apoio',
      anchorRule: rule,
    });

    reasoning.push(
      `${truck.plate} (Apoio): ${assignedOrders.length} entregas, ${(currentWeight / 1000).toFixed(1)}t`
    );
  }

  // Step 5c: Non-anchor trucks — receive remaining unassigned orders
  const remainingOrders = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
  
  for (const truck of nonAnchorTrucks) {
    if (remainingOrders.length === 0) {
      // Empty composition
      compositions.push({
        truck, orders: [], totalWeight: 0, occupancyPercent: 0,
        estimatedDeliveries: 0, cities: [],
      });
      continue;
    }

    const capacity = Number(truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
    const assignedOrders: GeocodedOrder[] = [];
    let currentWeight = 0;

    // Take orders from remaining, grouped by city
    const remainingByCity = new Map<string, GeocodedOrder[]>();
    for (const o of remainingOrders) {
      const city = normalizeCityName(o.geocoded.city || 'desconhecida');
      const existing = remainingByCity.get(city) || [];
      existing.push(o);
      remainingByCity.set(city, existing);
    }

    for (const [, cityOrders] of remainingByCity) {
      for (const order of cityOrders) {
        if (assignedOrderKeys.has(orderKey(order))) continue;
        if (currentWeight + order.weight_kg > capacity) continue;

        assignedOrders.push(order);
        assignedOrderKeys.add(orderKey(order));
        currentWeight += order.weight_kg;
      }
    }

    const citiesInTruck = new Set<string>();
    for (const order of assignedOrders) {
      const city = normalizeCityName(order.geocoded.city || 'desconhecida');
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

  // Step 6: Sequence optimization (city > CEP > bairro > rua)
  for (const comp of compositions) {
    if (comp.orders.length > 1) {
      optimizeDeliverySequence(
        comp.orders as GeocodedOrder[],
        cd.lat, cd.lng, cfg.strategy,
        comp.anchorRule
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
// VALIDATION — Regras operacionais fixas
// ================================================================

export function validateComposition(
  compositions: TruckComposition[],
  extractedPatterns?: ExtractedPatterns
): CompositionValidation {
  const violations: string[] = [];

  for (const comp of compositions) {
    if (comp.orders.length === 0) continue;
    const rule = comp.anchorRule || findAnchorRule(comp.truck.plate);

    // 1. Check delivery limit
    if (rule && comp.orders.length > rule.maxDeliveries) {
      violations.push(
        `${comp.truck.plate}: ${comp.orders.length} entregas excedem o limite de ${rule.maxDeliveries}`
      );
    }

    // 2. Check weight limit
    const capacity = Number(comp.truck.capacity_kg);
    if (comp.totalWeight > capacity) {
      violations.push(
        `${comp.truck.plate}: peso ${(comp.totalWeight / 1000).toFixed(1)}t excede capacidade de ${(capacity / 1000).toFixed(1)}t`
      );
    }

    // 3. Check anchor city usage
    if (rule && !rule.isSupport && rule.anchorCity) {
      const hasAnchorCity = comp.cities.some(c => c === rule.anchorCity);
      if (!hasAnchorCity && comp.orders.length > 0) {
        violations.push(
          `${comp.truck.plate}: deveria conter entregas de ${rule.anchorCity} (cidade âncora)`
        );
      }

      // Check for unauthorized cities
      const allowedCities = new Set([
        rule.anchorCity,
        ...rule.allowedFillCities,
        // Include cities from neighborhood exceptions
        ...rule.neighborhoodExceptions.map(e => normalizeCityName(e.city)),
      ]);
      const exceptionNeighborhoods = new Map(
        rule.neighborhoodExceptions.map(e => [normalizeNeighborhood(e.neighborhood), normalizeCityName(e.city)])
      );

      for (const order of comp.orders) {
        const city = normalizeCityName((order as any).geocoded?.city || parseAddress(order.address).city || 'desconhecida');
        const nh = normalizeNeighborhood((order as any).geocoded?.neighborhood || parseAddress(order.address).neighborhood || '');

        if (!allowedCities.has(city)) {
          // Check if it's a valid neighborhood exception (must match both neighborhood AND city)
          const exceptionCity = exceptionNeighborhoods.get(nh);
          if (!exceptionCity || exceptionCity !== city) {
            violations.push(
              `${comp.truck.plate}: cidade "${city}" não é permitida (âncora: ${rule.anchorCity})`
            );
            break;
          }
        }
      }
    }

    // 4. Check city alternation in sequence
    if (comp.orders.length > 2) {
      const citySequence = comp.orders.map(o => {
        const parsed = parseAddress(o.address);
        return normalizeCityName(parsed.city || 'desconhecida');
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
// DELIVERY SEQUENCE: CITY > CEP > BAIRRO > RUA (blocos contínuos)
// ================================================================

function optimizeDeliverySequence(
  orders: GeocodedOrder[],
  startLat: number,
  startLng: number,
  strategy: RoutingStrategy,
  anchorRule?: AnchorRule
): void {
  if (orders.length <= 1) return;

  // Step 1: Group by city
  const cityGroups = new Map<string, GeocodedOrder[]>();
  for (const order of orders) {
    const city = normalizeCityName(order.geocoded.city || 'desconhecida');
    const existing = cityGroups.get(city) || [];
    existing.push(order);
    cityGroups.set(city, existing);
  }

  // Step 2: Order cities — anchor city ALWAYS first
  const cityDistances: { city: string; avgDist: number; orders: GeocodedOrder[] }[] = [];
  for (const [city, cityOrders] of cityGroups) {
    const avgDist = cityOrders.reduce((s, o) => s + o.distanceFromCD, 0) / cityOrders.length;
    cityDistances.push({ city, avgDist, orders: cityOrders });
  }

  // Anchor city first, then by distance
  const anchorCity = anchorRule?.anchorCity || '';
  cityDistances.sort((a, b) => {
    if (a.city === anchorCity) return -1;
    if (b.city === anchorCity) return 1;
    if (strategy === 'finalizacao_proxima') return b.avgDist - a.avgDist;
    return a.avgDist - b.avgDist;
  });

  // Step 3: Within each city block, sort by CEP > neighborhood > street
  const result: GeocodedOrder[] = [];

  for (const cityGroup of cityDistances) {
    const cityOrders = cityGroup.orders;

    // Handle special neighborhood insertion rules
    if (anchorRule) {
      const insertionRules = anchorRule.neighborhoodExceptions.filter(e => e.insertAfterNeighborhood);
      if (insertionRules.length > 0) {
        // Sort normally first
        cityOrders.sort((a, b) => sortWithinCity(a, b));

        // Then apply insertion rules
        for (const rule of insertionRules) {
          const targetNh = normalizeNeighborhood(rule.insertAfterNeighborhood!);
          const ruleNh = normalizeNeighborhood(rule.neighborhood);

          // Find orders matching the rule neighborhood
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
            // Find insertion point: after last order of targetNh
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

        result.push(...cityOrders);
        continue;
      }
    }

    cityOrders.sort((a, b) => sortWithinCity(a, b));
    result.push(...cityOrders);
  }

  orders.length = 0;
  orders.push(...result);
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
