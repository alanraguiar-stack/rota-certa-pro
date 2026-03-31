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
import { parseAddress, calculateDistance, getDistributionCenterCoords, GeocodedAddress, normalizeCityName, CITY_COORDINATES } from './geocoding';
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
 * Override temporário por placa — permite injetar regras para uma rota específica
 */
export interface PlateOverride {
  plate: string;
  allowedCities: string[];
  allowedNeighborhoods?: string[];
  maxDeliveries: number;
  maxWeightKg: number;
}

/**
 * Main auto-routing function — TERRITORY-BASED RULES
 */
export function autoComposeRoute(
  orders: ParsedOrder[],
  availableTrucks: Truck[],
  config: Partial<AutoRouterConfig> = {},
  historyHints?: RoutingHint[],
  extractedPatterns?: ExtractedPatterns,
  allowedCities?: Set<string>,
  plateOverrides?: PlateOverride[],
  customTerritoryRules?: TerritoryRule[]
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
  
  let validOrders = orders.filter(o => o.isValid);
  const filteredOutOrders: ParsedOrder[] = [];
  
  // Filter by allowed cities (city schedule) if provided
  if (allowedCities && allowedCities.size > 0) {
    const before = validOrders.length;
    const kept: ParsedOrder[] = [];
    for (const o of validOrders) {
      const parsed = parseAddress(o.address);
      const city = normalizeCityName(parsed.city);
      if (allowedCities.has(city)) {
        kept.push(o);
      } else {
        filteredOutOrders.push(o);
      }
    }
    validOrders = kept;
    if (filteredOutOrders.length > 0) {
      warnings.push(`${filteredOutOrders.length} pedido(s) removidos pelo calendário de entregas (cidades fora do dia)`);
      reasoning.push(`Calendário: ${before} pedidos → ${kept.length} após filtro de cidades do dia`);
    }
  }
  
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
  
  // Step 1: Geocode all orders (use real coordinates when available)
  const cd = getDistributionCenterCoords();
  const geocodedOrders: GeocodedOrder[] = validOrders.map(order => {
    const geocoded = parseAddress(order.address);
    // Override estimated coords with real geocoded coords if available
    if (order.latitude && order.longitude) {
      geocoded.estimatedLat = order.latitude;
      geocoded.estimatedLng = order.longitude;
    }
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

  // ── ETAPA 2: Pré-sequenciar cada caixa de cidade (bairro → rua → proximidade) ──
  // Isso garante que, durante a alocação, overflow remove do FINAL (mais distantes do CD)
  for (const [, cityOrders] of cityOrderMap) {
    if (cityOrders.length > 1) {
      nearestNeighborWithinCity(cityOrders, cd.lat, cd.lng);
      streetGroupSweep(cityOrders);
    }
  }
  reasoning.push('Etapa 2: Cidades pré-sequenciadas (bairro → rua → proximidade)');

  // Step 3: Auto-assign trucks to territories
  clearTruckTerritories();
  const citiesInOrders = new Set(cityOrderMap.keys());
  const truckData = availableTrucks.map(t => ({
    plate: t.plate,
    capacity_kg: Number(t.capacity_kg),
    max_deliveries: t.max_deliveries,
  }));
  const activeRules = customTerritoryRules || TERRITORY_RULES;
  const territoryAssignments = assignTrucksToTerritories(truckData, citiesInOrders, customTerritoryRules);

  // Build territory → truck mapping
  const territoryTrucks: { truck: Truck; rule: TerritoryRule }[] = [];
  const assignedTruckPlates = new Set<string>();

  for (const [territoryId, assignedTruck] of territoryAssignments) {
    const rule = activeRules.find(r => r.id === territoryId)!;
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
    // Pedidos já pré-sequenciados na Etapa 2 — manter ordem (overflow sai do final)
    const sortedAnchor = [...(cityOrderMap.get(rule.anchorCity) || [])];

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

      // Pedidos já pré-sequenciados — manter ordem
      const sortedFill = [...(cityOrderMap.get(fillCity) || [])];

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

    // Check if this non-territory truck has a plate override
    const normalizedPlate = truck.plate.replace(/[\s-]/g, '').toUpperCase();
    const override = plateOverrides?.find(po => po.plate.replace(/[\s-]/g, '').toUpperCase() === normalizedPlate);
    
    const effectiveCapacity = override ? override.maxWeightKg : capacity;
    const effectiveMaxDel = override ? override.maxDeliveries : maxDel;
    const MAX_CITIES_PER_NON_TERRITORY = 3;
    const currentCities = new Set<string>();

    for (const [cityName, cityOrders] of remainingByCity) {
      // If override exists, only allow specified cities/neighborhoods
      if (override) {
        const allowedCitiesNorm = override.allowedCities.map(c => normalizeCityName(c));
        if (!allowedCitiesNorm.includes(cityName)) continue;
      }
      
      // Limit non-territory trucks to max 3 cities (unless overridden)
      if (!override && !currentCities.has(cityName) && currentCities.size >= MAX_CITIES_PER_NON_TERRITORY) continue;

      for (const order of cityOrders) {
        if (assignedOrderKeys.has(orderKey(order))) continue;
        if (currentWeight + order.weight_kg > effectiveCapacity) continue;
        if (assignedOrders.length >= effectiveMaxDel) break;

        // If override has neighborhood filter, check it
        if (override && override.allowedNeighborhoods && override.allowedNeighborhoods.length > 0) {
          const orderNh = normalizeNeighborhood(order.geocoded.neighborhood || '');
          const allowedNhs = override.allowedNeighborhoods.map(n => normalizeNeighborhood(n));
          // Only filter by neighborhood for the anchor cities, not fill cities
          const orderCity = normalizeCityName(order.city || order.geocoded.city || '');
          if (orderCity === normalizeCityName(override.allowedCities[0]) && !allowedNhs.includes(orderNh)) continue;
        }

        assignedOrders.push(order);
        assignedOrderKeys.add(orderKey(order));
        currentWeight += order.weight_kg;
        currentCities.add(cityName);
      }
      if (assignedOrders.length >= effectiveMaxDel) break;
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

  // Step 5d: Consolidation — move trucks with < 8 deliveries to support
  const MIN_DELIVERIES = 8;
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

  // Step 5d.5: Fallback distribution — collect orphaned orders and assign to trucks with capacity
  const orphanedOrders = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
  if (orphanedOrders.length > 0) {
    reasoning.push(`[Fallback] ${orphanedOrders.length} pedidos órfãos detectados — distribuindo por nearest-fit`);

    // Sort orphans by weight descending (heavier first for better packing)
    orphanedOrders.sort((a, b) => b.weight_kg - a.weight_kg);

    for (const orphan of orphanedOrders) {
      const orphanCity = normalizeCityName(orphan.city || orphan.geocoded.city || '');

      // Score each composition by affinity (prefer trucks with same/neighbor cities)
      let bestComp: TruckComposition | null = null;
      let bestScore = -Infinity;

      for (const comp of compositions) {
        const capacity = Number(comp.truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
        const maxDel = comp.truck.max_deliveries ? Number(comp.truck.max_deliveries) : 25;
        const remainingWeight = capacity - comp.totalWeight;
        const remainingSlots = maxDel - comp.orders.length;

        if (remainingWeight < orphan.weight_kg) continue;
        if (remainingSlots <= -3) continue; // permite até 3 extras por caminhão

        // Affinity score: same city = 100, neighbor city = 50, any = 10
        let score = 10;
        if (comp.cities.includes(orphanCity)) {
          score = 100;
        } else {
          // Check if any city in truck is a neighbor
          const neighbors = TERRITORY_RULES.flatMap(r => 
            r.anchorCity === orphanCity ? r.allowedFillCities : 
            r.allowedFillCities.includes(orphanCity) ? [r.anchorCity] : []
          );
          if (comp.cities.some(c => neighbors.includes(c))) {
            score = 50;
          }
        }

        // Prefer trucks with more remaining capacity (better balance)
        score += (remainingWeight / capacity) * 10;

        if (score > bestScore) {
          bestScore = score;
          bestComp = comp;
        }
      }

      if (bestComp) {
        bestComp.orders.push(orphan);
        bestComp.totalWeight += orphan.weight_kg;
        bestComp.occupancyPercent = Math.round(
          (bestComp.totalWeight / Number(bestComp.truck.capacity_kg)) * 100
        );
        bestComp.estimatedDeliveries = bestComp.orders.length;
        if (!bestComp.cities.includes(orphanCity) && orphanCity) {
          bestComp.cities.push(orphanCity);
        }
        assignedOrderKeys.add(orderKey(orphan));
        reasoning.push(`[Fallback] ${orphan.client_name} (${orphanCity}) → ${bestComp.truck.plate}`);
      } else {
        // Will be handled in forced second pass below
      }
    }
  }

  // Step 5d.6: Forced second pass — guarantee 100% distribution (ignore delivery limits, respect weight only)
  const stillOrphaned = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
  if (stillOrphaned.length > 0) {
    reasoning.push(`[Fallback Forçado] ${stillOrphaned.length} pedidos sem slot — ignorando limite de entregas`);

    for (const orphan of stillOrphaned) {
      const orphanCity = normalizeCityName(orphan.city || orphan.geocoded.city || '');
      let bestComp: TruckComposition | null = null;
      let bestScore = -Infinity;

      for (const comp of compositions) {
        const capacity = Number(comp.truck.capacity_kg) * (cfg.maxOccupancyPercent / 100);
        const remainingWeight = capacity - comp.totalWeight;
        if (remainingWeight < orphan.weight_kg) continue; // only respect weight

        let score = 10;
        if (comp.cities.includes(orphanCity)) {
          score = 100; // same city — best fit
        } else {
          const neighbors = TERRITORY_RULES.flatMap(r => 
            r.anchorCity === orphanCity ? r.allowedFillCities : 
            r.allowedFillCities.includes(orphanCity) ? [r.anchorCity] : []
          );
          if (comp.cities.some(c => neighbors.includes(c))) {
            score = 50;
          }
        }
        score += (remainingWeight / capacity) * 10;

        if (score > bestScore) {
          bestScore = score;
          bestComp = comp;
        }
      }

      if (bestComp) {
        bestComp.orders.push(orphan);
        bestComp.totalWeight += orphan.weight_kg;
        bestComp.occupancyPercent = Math.round(
          (bestComp.totalWeight / Number(bestComp.truck.capacity_kg)) * 100
        );
        bestComp.estimatedDeliveries = bestComp.orders.length;
        if (!bestComp.cities.includes(orphanCity) && orphanCity) {
          bestComp.cities.push(orphanCity);
        }
        assignedOrderKeys.add(orderKey(orphan));
        const maxDel = bestComp.truck.max_deliveries ? Number(bestComp.truck.max_deliveries) : 25;
        warnings.push(`${orphan.client_name} (${orphanCity}) alocado acima do limite ideal (${bestComp.orders.length}/${maxDel}) em ${bestComp.truck.plate}`);
        reasoning.push(`[Forçado] ${orphan.client_name} (${orphanCity}) → ${bestComp.truck.plate}`);
      } else {
        warnings.push(`Sem capacidade de peso para: ${orphan.client_name} (${orphanCity}, ${orphan.weight_kg}kg)`);
      }
    }
  }

  // Step 5d.7: Last resort — force into any truck even if overweight
  const lastResort = geocodedOrders.filter(o => !assignedOrderKeys.has(orderKey(o)));
  if (lastResort.length > 0) {
    reasoning.push(`[Último Recurso] ${lastResort.length} pedidos restantes — forçando alocação`);
    for (const orphan of lastResort) {
      const orphanCity = normalizeCityName(orphan.city || orphan.geocoded.city || '');
      // Find truck with most remaining weight capacity
      const sorted = [...compositions]
        .filter(c => c.orders.length > 0)
        .sort((a, b) => {
          // Prefer same city
          const aHasCity = a.cities.includes(orphanCity) ? 1000 : 0;
          const bHasCity = b.cities.includes(orphanCity) ? 1000 : 0;
          const aRemaining = Number(a.truck.capacity_kg) - a.totalWeight;
          const bRemaining = Number(b.truck.capacity_kg) - b.totalWeight;
          return (bHasCity + bRemaining) - (aHasCity + aRemaining);
        });
      const target = sorted[0];
      if (target) {
        target.orders.push(orphan);
        target.totalWeight += orphan.weight_kg;
        target.occupancyPercent = Math.round((target.totalWeight / Number(target.truck.capacity_kg)) * 100);
        target.estimatedDeliveries = target.orders.length;
        if (!target.cities.includes(orphanCity) && orphanCity) {
          target.cities.push(orphanCity);
        }
        assignedOrderKeys.add(orderKey(orphan));
        reasoning.push(`[Último Recurso] ${orphan.client_name} (${orphanCity}) → ${target.truck.plate}`);
      }
    }
  }

  // Step 5e: Rebalance between internal (non-support, non-third-party) trucks
  rebalanceInternalTrucks(compositions, reasoning, warnings);

  // Step 5f: Ensure TRC1Z00 has the most deliveries
  const trcNorm = 'TRC1Z00';
  const trcComp = compositions.find(c => c.truck.plate.replace(/[\s-]/g, '').toUpperCase() === trcNorm);
  if (trcComp && trcComp.orders.length > 0) {
    const leader = compositions.reduce((a, b) => a.orders.length > b.orders.length ? a : b);
    if (leader !== trcComp && leader.orders.length > trcComp.orders.length) {
      const trcCapacity = Number(trcComp.truck.capacity_kg) * 0.95;
      // Transfer non-anchor orders from leader to TRC1Z00
      const leaderAnchor = leader.territoryRule?.anchorCity || '';
      const transferable = leader.orders.filter(o => {
        const city = normalizeCityName(o.city || (o as any).geocoded?.city || '');
        return city !== leaderAnchor;
      });
      
      let transferred = 0;
      const needed = leader.orders.length - trcComp.orders.length + 1; // need at least 1 more
      
      for (const order of transferable) {
        if (transferred >= needed) break;
        if (trcComp.totalWeight + order.weight_kg > trcCapacity) continue;
        
        const idx = leader.orders.indexOf(order);
        if (idx >= 0) {
          leader.orders.splice(idx, 1);
          leader.totalWeight -= order.weight_kg;
          trcComp.orders.push(order);
          trcComp.totalWeight += order.weight_kg;
          transferred++;
          
          const city = normalizeCityName(order.city || (order as any).geocoded?.city || '');
          if (!trcComp.cities.includes(city)) trcComp.cities.push(city);
        }
      }
      
      if (transferred > 0) {
        // Update stats
        for (const comp of [leader, trcComp]) {
          comp.estimatedDeliveries = comp.orders.length;
          comp.occupancyPercent = Math.round((comp.totalWeight / Number(comp.truck.capacity_kg)) * 100);
          const cities = new Set<string>();
          for (const o of comp.orders) {
            cities.add(normalizeCityName(o.city || (o as any).geocoded?.city || 'desconhecida'));
          }
          comp.cities = Array.from(cities);
        }
        reasoning.push(`TRC1Z00 líder: ${transferred} entregas de ${leader.truck.plate} → TRC1Z00 (${trcComp.orders.length} entregas)`);
      }
    }
  }

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
  const unassignedOrders = [
    ...filteredOutOrders,
    ...validOrders.filter(o => !allAssigned.has(orderKey(o))),
  ];

  const totalCapacityUsed = compositions.reduce((sum, c) => sum + c.totalWeight, 0);
  const totalCapacity = compositions.reduce((sum, c) => sum + Number(c.truck.capacity_kg), 0);
  const averageOccupancy = totalCapacity > 0 ? (totalCapacityUsed / totalCapacity) * 100 : 0;

  const validation = validateComposition(compositions);

  if (unassignedOrders.length > 0) {
    warnings.push(`${unassignedOrders.length} pedidos não puderam ser atribuídos`);
    validation.valid = false;
    validation.violations.push(`${unassignedOrders.length} pedido(s) sem caminhão — todos devem ser alocados`);
  }

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
  const MAX_DIFF = 3;
  const MAX_ITERATIONS = 10;

  // Fixed plates that should NOT participate in rebalancing
  const FIXED_PLATES = new Set(['TRC1Z00', 'TRC1ZOO']);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Internal trucks = have territory, not support, have orders, not fixed
    const internal = compositions.filter(c =>
      c.orders.length > 0 &&
      c.territoryRule &&
      !c.territoryRule.isSupport &&
      !FIXED_PLATES.has(c.truck.plate.replace(/[\s-]/g, '').toUpperCase())
    );

    if (internal.length < 2) return;

    // Find most and least loaded
    internal.sort((a, b) => b.orders.length - a.orders.length);
    const most = internal[0];
    const least = internal[internal.length - 1];
    const diff = most.orders.length - least.orders.length;

    if (diff <= MAX_DIFF) return; // balanced enough

    // Calculate how many to move
    const target = Math.floor((most.orders.length + least.orders.length) / 2);
    const toMove = Math.min(most.orders.length - target, diff - MAX_DIFF);
    if (toMove <= 0) return;

    // Find movable orders: NOT from anchor city of source truck
    const anchorCity = most.territoryRule?.anchorCity || '';
    const movable = most.orders.filter(o => {
      const city = normalizeCityName(o.city || (o as any).geocoded?.city || '');
      return city !== anchorCity;
    });

    if (movable.length === 0) return;

    // Score each movable order by geographic affinity with destination truck
    const leastCities = new Set(least.orders.map(o =>
      normalizeCityName(o.city || (o as any).geocoded?.city || '')
    ));
    const leastNeighborhoods = new Set(least.orders.map(o =>
      normalizeNeighborhood((o as any).geocoded?.neighborhood || '')
    ).filter(n => n));
    const leastStreets = new Set(least.orders.map(o =>
      ((o as any).geocoded?.street || '').toLowerCase()
    ).filter(s => s));

    const scored = movable.map(order => {
      const city = normalizeCityName(order.city || (order as any).geocoded?.city || '');
      const neighborhood = normalizeNeighborhood((order as any).geocoded?.neighborhood || '');
      const street = ((order as any).geocoded?.street || '').toLowerCase();

      let score = 0;
      if (street && leastStreets.has(street)) score += 100;
      if (neighborhood && leastNeighborhoods.has(neighborhood)) score += 50;
      if (leastCities.has(city)) score += 20;
      // Check if city is neighbor of any city in destination truck
      const leastAnchor = least.territoryRule?.anchorCity || '';
      if (leastAnchor && city === leastAnchor) score += 30;

      return { order, score };
    });

    // Sort by affinity score descending (best matches first)
    scored.sort((a, b) => b.score - a.score);

    const leastCapacity = Number(least.truck.capacity_kg) * 0.95;
    const leastMaxDel = least.territoryRule?.maxDeliveries || 25;
    let moved = 0;

    for (const { order } of scored) {
      if (moved >= toMove) break;
      if (least.orders.length >= leastMaxDel) break;
      if (least.totalWeight + order.weight_kg > leastCapacity) continue;

      const idx = most.orders.indexOf(order);
      if (idx >= 0) {
        most.orders.splice(idx, 1);
        most.totalWeight -= order.weight_kg;
        least.orders.push(order);
        least.totalWeight += order.weight_kg;
        moved++;
      }
    }

    if (moved === 0) return; // no progress, stop

    // Update stats for affected trucks
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
      `Rebalanceamento #${iteration + 1}: ${moved} entregas de ${most.truck.plate} → ${least.truck.plate} (${most.orders.length}/${least.orders.length})`
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

  // Sort priority orders by nearest-neighbor from CD
  if (priorityOrders.length > 1) {
    nearestNeighborWithinCity(priorityOrders, startLat, startLng);
  }

  // Step 2: Group regular orders by city
  const cityGroups = new Map<string, GeocodedOrder[]>();
  for (const order of regularOrders) {
    const city = normalizeCityName(order.city || order.geocoded.city || 'desconhecida');
    const existing = cityGroups.get(city) || [];
    existing.push(order);
    cityGroups.set(city, existing);
  }

  // Step 3: Sequenciar cidades com nearest-neighbor inter-cidades (transição fluida)
  const anchorCity = anchorRule?.anchorCity || territoryRule?.anchorCity || '';
  const result: GeocodedOrder[] = [...priorityOrders];

  // Build city entries
  const cityEntries: { city: string; orders: GeocodedOrder[] }[] = [];
  for (const [city, cityOrders] of cityGroups) {
    cityEntries.push({ city, orders: cityOrders });
  }

  // Separate anchor city (always first) from the rest
  const anchorEntry = cityEntries.find(e => e.city === anchorCity);
  const remainingCityEntries = cityEntries.filter(e => e.city !== anchorCity);

  // Helper: sequence a city block with insertion rules support
  const sequenceCityBlock = (cityOrders: GeocodedOrder[], fromLat: number, fromLng: number): void => {
    // Handle special neighborhood insertion rules
    if (anchorRule) {
      const insertionRules = anchorRule.neighborhoodExceptions.filter(e => e.insertAfterNeighborhood);
      if (insertionRules.length > 0) {
        nearestNeighborWithinCity(cityOrders, fromLat, fromLng);

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

        nearestNeighborWithinCity(cityOrders, fromLat, fromLng);
        return;
      }
    }

    nearestNeighborWithinCity(cityOrders, fromLat, fromLng);
    streetGroupSweep(cityOrders);
  };

  // Sequence anchor city first (from CD)
  if (anchorEntry && anchorEntry.orders.length > 0) {
    sequenceCityBlock(anchorEntry.orders, startLat, startLng);
    result.push(...anchorEntry.orders);
  }

  // Nearest-neighbor inter-cidades: escolher próxima cidade pela proximidade do último ponto
  const pending = [...remainingCityEntries];
  while (pending.length > 0) {
    const lastOrder = result[result.length - 1];
    const fromLat = lastOrder ? lastOrder.geocoded.estimatedLat : startLat;
    const fromLng = lastOrder ? lastOrder.geocoded.estimatedLng : startLng;

    // Encontrar a cidade com entrega mais próxima do último ponto
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pending.length; i++) {
      for (const order of pending[i].orders) {
        const dist = calculateDistance(fromLat, fromLng,
          order.geocoded.estimatedLat, order.geocoded.estimatedLng);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }

    const nextCity = pending.splice(bestIdx, 1)[0];
    // Sequenciar a próxima cidade começando do último ponto de saída
    sequenceCityBlock(nextCity.orders, fromLat, fromLng);
    result.push(...nextCity.orders);
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

/**
 * Nearest-neighbor sequencing within a city block.
 * Uses real coordinates with bonuses for same street/neighborhood.
 * Falls back to CEP sort if orders lack real coordinates.
 */
function nearestNeighborWithinCity(orders: GeocodedOrder[], startLat: number, startLng: number): void {
  if (orders.length <= 1) return;

  // Check if orders have real coordinates (not just hash estimates)
  const hasRealCoords = orders.some(o => o.latitude && o.longitude);
  
  if (!hasRealCoords) {
    // Fallback: use CEP-based sorting when no real coordinates available
    orders.sort((a, b) => sortWithinCity(a, b));
    streetGroupSweep(orders);
    return;
  }

  const result: GeocodedOrder[] = [];
  const remaining = [...orders];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const o = remaining[i];
      const lat = o.geocoded.estimatedLat;
      const lng = o.geocoded.estimatedLng;
      
      let distance = calculateDistance(currentLat, currentLng, lat, lng);

      // Bonus for same street (reduce effective distance by 85%)
      if (result.length > 0) {
        const lastOrder = result[result.length - 1];
        const sameStreet = (o.geocoded.street || '').toLowerCase() === (lastOrder.geocoded.street || '').toLowerCase()
          && (o.geocoded.street || '').length > 0;
        const sameNeighborhood = normalizeNeighborhood(o.geocoded.neighborhood || '') === 
          normalizeNeighborhood(lastOrder.geocoded.neighborhood || '');

        if (sameStreet) {
          distance *= 0.15;
        } else if (sameNeighborhood) {
          distance *= 0.30;
        }
      }

      if (distance < bestScore) {
        bestScore = distance;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    result.push(chosen);
    currentLat = chosen.geocoded.estimatedLat;
    currentLng = chosen.geocoded.estimatedLng;
  }

  // Replace in-place
  orders.length = 0;
  orders.push(...result);
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
