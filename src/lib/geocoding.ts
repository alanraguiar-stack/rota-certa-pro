import { Order, DISTRIBUTION_CENTER } from '@/types';

export interface GeocodedAddress {
  original: string;
  normalized: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  estimatedLat: number;
  estimatedLng: number;
}

export interface DistanceResult {
  fromId: string;
  toId: string;
  distance: number;
  estimatedMinutes: number;
}

/**
 * Real coordinates for cities in the São Paulo metropolitan area.
 * Used to ensure addresses in the same city cluster together geographically.
 */
export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'barueri': { lat: -23.5115, lng: -46.8754 },
  'osasco': { lat: -23.5325, lng: -46.7917 },
  'carapicuiba': { lat: -23.5235, lng: -46.8356 },
  'jandira': { lat: -23.5278, lng: -46.9024 },
  'itapevi': { lat: -23.5488, lng: -46.9327 },
  'cotia': { lat: -23.6038, lng: -46.9191 },
  'santana de parnaiba': { lat: -23.4443, lng: -46.9173 },
  'pirapora do bom jesus': { lat: -23.3926, lng: -46.9992 },
  'cajamar': { lat: -23.3561, lng: -46.8771 },
  'caieiras': { lat: -23.3643, lng: -46.7403 },
  'franco da rocha': { lat: -23.3286, lng: -46.7263 },
  'francisco morato': { lat: -23.2819, lng: -46.7434 },
  'embu das artes': { lat: -23.6490, lng: -46.8522 },
  'embu': { lat: -23.6490, lng: -46.8522 },
  'embu-guacu': { lat: -23.8316, lng: -46.8117 },
  'taboao da serra': { lat: -23.6019, lng: -46.7582 },
  'sao paulo': { lat: -23.5505, lng: -46.6339 },
  'guarulhos': { lat: -23.4543, lng: -46.5337 },
  'sao bernardo do campo': { lat: -23.6936, lng: -46.5650 },
  'santo andre': { lat: -23.6737, lng: -46.5432 },
  'sao caetano do sul': { lat: -23.6229, lng: -46.5548 },
  'diadema': { lat: -23.6861, lng: -46.6228 },
  'maua': { lat: -23.6679, lng: -46.4613 },
  'mogi das cruzes': { lat: -23.5226, lng: -46.1854 },
  'suzano': { lat: -23.5424, lng: -46.3108 },
  'itaquaquecetuba': { lat: -23.4860, lng: -46.3486 },
  'ferraz de vasconcelos': { lat: -23.5412, lng: -46.3708 },
  'poa': { lat: -23.5286, lng: -46.3448 },
  'aruja': { lat: -23.3963, lng: -46.3220 },
  'mairipora': { lat: -23.3187, lng: -46.5872 },
  'vargem grande paulista': { lat: -23.6000, lng: -47.0267 },
  'itapecerica da serra': { lat: -23.7172, lng: -46.8494 },
  'ribeirao pires': { lat: -23.7113, lng: -46.3993 },
  'rio grande da serra': { lat: -23.7439, lng: -46.3975 },
  'alphaville': { lat: -23.4850, lng: -46.8491 },
  'tambore': { lat: -23.4980, lng: -46.8420 },
};

/**
 * Adjacency graph: which cities share a border.
 * Used to keep neighboring cities on the same truck and allow
 * the sequencing algorithm to cross city boundaries when it makes geographic sense.
 */
export const CITY_NEIGHBORS: Record<string, string[]> = {
  'barueri': ['osasco', 'carapicuiba', 'jandira', 'santana de parnaiba', 'cotia', 'sao paulo'],
  'osasco': ['barueri', 'carapicuiba', 'sao paulo', 'taboao da serra'],
  'carapicuiba': ['barueri', 'osasco', 'jandira', 'cotia'],
  'jandira': ['barueri', 'carapicuiba', 'itapevi'],
  'itapevi': ['jandira', 'cotia', 'vargem grande paulista'],
  'cotia': ['barueri', 'carapicuiba', 'itapevi', 'vargem grande paulista', 'embu das artes', 'sao paulo'],
  'santana de parnaiba': ['barueri', 'cajamar', 'pirapora do bom jesus', 'sao paulo'],
  'cajamar': ['santana de parnaiba', 'caieiras', 'franco da rocha', 'pirapora do bom jesus'],
  'caieiras': ['cajamar', 'franco da rocha', 'mairipora', 'sao paulo'],
  'franco da rocha': ['cajamar', 'caieiras', 'francisco morato', 'mairipora'],
  'francisco morato': ['franco da rocha', 'cajamar'],
  'pirapora do bom jesus': ['santana de parnaiba', 'cajamar'],
  'embu das artes': ['cotia', 'taboao da serra', 'sao paulo', 'itapecerica da serra'],
  'embu': ['cotia', 'taboao da serra', 'sao paulo', 'itapecerica da serra'],
  'taboao da serra': ['osasco', 'embu das artes', 'sao paulo'],
  'sao paulo': ['osasco', 'barueri', 'cotia', 'taboao da serra', 'embu das artes', 'santana de parnaiba', 'caieiras', 'guarulhos', 'sao bernardo do campo', 'santo andre', 'sao caetano do sul', 'diadema', 'mairipora', 'itapecerica da serra'],
  'guarulhos': ['sao paulo', 'aruja', 'itaquaquecetuba', 'mairipora'],
  'sao bernardo do campo': ['sao paulo', 'santo andre', 'diadema', 'sao caetano do sul', 'ribeirao pires'],
  'santo andre': ['sao paulo', 'sao bernardo do campo', 'sao caetano do sul', 'maua', 'ribeirao pires', 'rio grande da serra'],
  'sao caetano do sul': ['sao paulo', 'sao bernardo do campo', 'santo andre'],
  'diadema': ['sao paulo', 'sao bernardo do campo'],
  'maua': ['santo andre', 'ribeirao pires', 'rio grande da serra'],
  'itapecerica da serra': ['embu das artes', 'sao paulo', 'cotia', 'embu-guacu'],
  'vargem grande paulista': ['cotia', 'itapevi'],
  'mairipora': ['caieiras', 'franco da rocha', 'sao paulo', 'guarulhos'],
  'aruja': ['guarulhos', 'itaquaquecetuba'],
  'itaquaquecetuba': ['guarulhos', 'aruja', 'poa', 'suzano'],
  'poa': ['itaquaquecetuba', 'suzano', 'ferraz de vasconcelos'],
  'suzano': ['poa', 'itaquaquecetuba', 'ferraz de vasconcelos', 'mogi das cruzes'],
  'ferraz de vasconcelos': ['poa', 'suzano'],
  'mogi das cruzes': ['suzano'],
  'ribeirao pires': ['sao bernardo do campo', 'santo andre', 'maua', 'rio grande da serra'],
  'rio grande da serra': ['santo andre', 'maua', 'ribeirao pires'],
  'embu-guacu': ['itapecerica da serra'],
};

/**
 * Check if two cities are direct neighbors (share a border)
 */
export function areCitiesNeighbors(cityA: string, cityB: string): boolean {
  const a = normalizeCityName(cityA);
  const b = normalizeCityName(cityB);
  if (a === b) return true;
  const neighbors = CITY_NEIGHBORS[a];
  return neighbors ? neighbors.includes(b) : false;
}

/**
 * Get the neighbor cities for a given city
 */
export function getNeighborCities(city: string): string[] {
  return CITY_NEIGHBORS[normalizeCityName(city)] || [];
}

/**
 * Build connected regions of cities using BFS from a starting city.
 * Only includes cities that have orders present.
 */
export function buildCityRegions(citiesWithOrders: string[]): string[][] {
  const normalizedCities = new Set(citiesWithOrders.map(c => normalizeCityName(c)));
  const visited = new Set<string>();
  const regions: string[][] = [];

  // Start BFS from cities closest to CD
  const sortedCities = [...normalizedCities].sort((a, b) => 
    getCityDistanceFromCD(a) - getCityDistanceFromCD(b)
  );

  for (const startCity of sortedCities) {
    if (visited.has(startCity)) continue;

    const region: string[] = [];
    const queue: string[] = [startCity];
    visited.add(startCity);

    while (queue.length > 0) {
      const current = queue.shift()!;
      region.push(current);

      const neighbors = CITY_NEIGHBORS[current] || [];
      for (const neighbor of neighbors) {
        if (normalizedCities.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    regions.push(region);
  }

  return regions;
}

/**
 * Normalize a city name for lookup in CITY_COORDINATES
 */
export function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, ' ');
}

/**
 * Get real coordinates for a city center, or null if not found
 */
export function getCityCoordinates(cityName: string): { lat: number; lng: number } | null {
  const normalized = normalizeCityName(cityName);
  return CITY_COORDINATES[normalized] || null;
}

/**
 * Get the distance from a city to the CD (Barueri)
 */
export function getCityDistanceFromCD(cityName: string): number {
  const coords = getCityCoordinates(cityName);
  if (!coords) return 999; // unknown cities go to the end
  const cd = getDistributionCenterCoords();
  return calculateDistance(cd.lat, cd.lng, coords.lat, coords.lng);
}

/**
 * Parse and normalize a Brazilian address into structured components
 */
export function parseAddress(address: string): GeocodedAddress {
  // Remover instruções entre parênteses (ex: "(fundos)", "(portão azul)")
  const cleanAddress = address.replace(/\s*\([^)]*\)/g, '').trim();
  const normalized = cleanAddress.toLowerCase();
  
  const parts = cleanAddress.split(',').map(p => p.trim());
  
  let street = '';
  let number = '';
  let neighborhood = '';
  let city = '';
  let state = '';
  let zipCode = '';

  if (parts.length >= 4) {
    street = parts[0].toLowerCase();
    number = parts[1] || '';
    neighborhood = parts[2] || '';
    
    const lastPart = parts[parts.length - 1].trim();
    if (/^[a-z]{2}$/i.test(lastPart)) {
      state = lastPart.toUpperCase();
      city = parts[parts.length - 2]?.trim() || '';
    } else {
      city = parts[parts.length - 1]?.trim() || '';
    }
  } else {
    const streetMatch = normalized.match(/^((?:av\.?|r\.?|rua|avenida|alameda|al\.?|travessa|tv\.?|praça|pç\.?)\s*[^,\d]+)/i);
    street = streetMatch ? streetMatch[1].trim() : '';
    
    const numberMatch = normalized.match(/,?\s*(\d+)/);
    number = numberMatch ? numberMatch[1] : '';
    
    const neighborhoodMatch = normalized.match(/(?:,\s*|\s+-\s*)([^,-]+?)(?:\s*-\s*[a-z]{2}\s*,?\s*\d{5}|\s*-\s*[a-z]+\s*-\s*[a-z]{2}|$)/i);
    neighborhood = neighborhoodMatch ? neighborhoodMatch[1].trim() : '';
    
    const cityMatch = normalized.match(/(?:\s+-\s*|,\s*)([a-záàâãéèêíïóôõöúçñ\s]+)(?:\s*-\s*[a-z]{2})/i);
    city = cityMatch ? cityMatch[1].trim() : '';
    
    const stateMatch = normalized.match(/-\s*([a-z]{2})(?:\s*,?\s*\d{5}|$)/i);
    state = stateMatch ? stateMatch[1].toUpperCase() : '';
  }
  
  const zipMatch = normalized.match(/(\d{5}-?\d{3})/);
  zipCode = zipMatch ? zipMatch[1].replace('-', '') : '';
  
  // Generate coordinates using REAL city center + micro-offsets
  const coords = estimateCoordinates(street, neighborhood, city, zipCode);
  
  return {
    original: address,
    normalized,
    street,
    number,
    neighborhood,
    city,
    state,
    zipCode,
    estimatedLat: coords.lat,
    estimatedLng: coords.lng,
  };
}

/**
 * Estimate coordinates using REAL city coordinates as base,
 * with micro-offsets for neighborhood/CEP within the city.
 * This ensures same-city addresses cluster together.
 */
function estimateCoordinates(
  street: string, 
  neighborhood: string, 
  city: string,
  zipCode: string
): { lat: number; lng: number } {
  // Try to get real city coordinates
  const cityCoords = city ? getCityCoordinates(city) : null;
  
  // Use real city center or fall back to CD location
  const baseLat = cityCoords?.lat ?? -23.5115;
  const baseLng = cityCoords?.lng ?? -46.8754;
  
  // Generate micro-offsets WITHIN the city (~2km radius max)
  // This keeps all addresses in the same city close together
  const neighborhoodHash = hashString(neighborhood || '');
  const streetHash = hashString(street || '');
  const zipHash = zipCode ? hashString(zipCode.substring(0, 5)) : 0;
  
  // CEP-based offset (addresses with same CEP prefix are very close)
  const zipLatOffset = ((zipHash % 100) / 100) * 0.015 - 0.0075; // ~±0.8km
  const zipLngOffset = (((zipHash >> 5) % 100) / 100) * 0.015 - 0.0075;
  
  // Neighborhood offset (smaller, within CEP region)
  const neighLatOffset = ((neighborhoodHash % 50) / 50) * 0.008 - 0.004; // ~±0.4km
  const neighLngOffset = (((neighborhoodHash >> 5) % 50) / 50) * 0.008 - 0.004;
  
  // Street micro-offset (very small)
  const streetLatOffset = ((streetHash % 20) / 20) * 0.003 - 0.0015; // ~±0.15km
  const streetLngOffset = (((streetHash >> 5) % 20) / 20) * 0.003 - 0.0015;
  
  return {
    lat: baseLat + zipLatOffset + neighLatOffset + streetLatOffset,
    lng: baseLng + zipLngOffset + neighLngOffset + streetLngOffset,
  };
}

/**
 * Simple string hash function for deterministic results
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1.4; // urban factor
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmH = 30;
  return Math.round((distanceKm / avgSpeedKmH) * 60);
}

export function addressSimilarityScore(addr1: GeocodedAddress, addr2: GeocodedAddress): number {
  let score = 0;
  if (addr1.street && addr2.street && addr1.street === addr2.street) {
    score += 50;
  } else if (addr1.street && addr2.street) {
    const prefix1 = addr1.street.substring(0, 5);
    const prefix2 = addr2.street.substring(0, 5);
    if (prefix1 === prefix2) score += 20;
  }
  if (addr1.neighborhood && addr2.neighborhood && addr1.neighborhood === addr2.neighborhood) {
    score += 30;
  }
  if (addr1.city && addr2.city && addr1.city === addr2.city) {
    score += 10;
  }
  if (addr1.zipCode && addr2.zipCode) {
    if (addr1.zipCode === addr2.zipCode) score += 10;
    else if (addr1.zipCode.substring(0, 5) === addr2.zipCode.substring(0, 5)) score += 5;
  }
  return Math.min(100, score);
}

export function getDistributionCenterCoords(): { lat: number; lng: number } {
  return { lat: -23.5115, lng: -46.8754 };
}

export function distanceFromCD(geocoded: GeocodedAddress): number {
  const cd = getDistributionCenterCoords();
  return calculateDistance(cd.lat, cd.lng, geocoded.estimatedLat, geocoded.estimatedLng);
}

export function clusterOrdersByProximity(
  orders: Order[],
  numClusters: number
): Order[][] {
  if (orders.length === 0 || numClusters <= 0) return [];
  
  const geocodedOrders = orders.map(order => ({
    order,
    geocoded: parseAddress(order.address),
  }));
  
  const clusters: Order[][] = Array.from({ length: numClusters }, () => []);
  
  const sortedByDistance = [...geocodedOrders].sort(
    (a, b) => distanceFromCD(a.geocoded) - distanceFromCD(b.geocoded)
  );
  
  const ordersPerCluster = Math.ceil(orders.length / numClusters);
  
  sortedByDistance.forEach((item, index) => {
    const clusterIndex = Math.min(Math.floor(index / ordersPerCluster), numClusters - 1);
    clusters[clusterIndex].push(item.order);
  });
  
  return clusters;
}
