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
  // Simplified coordinates based on address parsing
  // In production, would use real geocoding API
  estimatedLat: number;
  estimatedLng: number;
}

export interface DistanceResult {
  fromId: string;
  toId: string;
  distance: number; // in km
  estimatedMinutes: number;
}

/**
 * Parse and normalize a Brazilian address into structured components
 */
export function parseAddress(address: string): GeocodedAddress {
  const normalized = address.trim().toLowerCase();
  
  // Extract street name (first part before comma or number)
  const streetMatch = normalized.match(/^((?:av\.?|r\.?|rua|avenida|alameda|al\.?|travessa|tv\.?|praça|pç\.?)\s*[^,\d]+)/i);
  const street = streetMatch ? streetMatch[1].trim() : '';
  
  // Extract number
  const numberMatch = normalized.match(/,?\s*(\d+)/);
  const number = numberMatch ? numberMatch[1] : '';
  
  // Extract neighborhood (usually after the number, before city)
  const neighborhoodMatch = normalized.match(/(?:,\s*|\s+-\s*)([^,-]+?)(?:\s*-\s*[a-z]{2}\s*,?\s*\d{5}|\s*-\s*[a-z]+\s*-\s*[a-z]{2}|$)/i);
  const neighborhood = neighborhoodMatch ? neighborhoodMatch[1].trim() : '';
  
  // Extract city
  const cityMatch = normalized.match(/(?:\s+-\s*|,\s*)([a-záàâãéèêíïóôõöúçñ\s]+)(?:\s*-\s*[a-z]{2})/i);
  const city = cityMatch ? cityMatch[1].trim() : '';
  
  // Extract state
  const stateMatch = normalized.match(/-\s*([a-z]{2})(?:\s*,?\s*\d{5}|$)/i);
  const state = stateMatch ? stateMatch[1].toUpperCase() : '';
  
  // Extract ZIP code
  const zipMatch = normalized.match(/(\d{5}-?\d{3})/);
  const zipCode = zipMatch ? zipMatch[1].replace('-', '') : '';
  
  // Generate estimated coordinates based on address components
  // This is a simplified approach - in production use real geocoding
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
 * Estimate coordinates based on address components
 * This uses a deterministic hash to generate consistent coordinates within a city region
 */
function estimateCoordinates(
  street: string, 
  neighborhood: string, 
  city: string,
  zipCode: string
): { lat: number; lng: number } {
  // Base coordinates for Barueri region (CD location)
  const baseLat = -23.5115;
  const baseLng = -46.8754;
  
  // Generate hash from address components for consistent results
  const addressHash = hashString(`${street}${neighborhood}${city}${zipCode}`);
  
  // Use hash to create offset within ~20km radius
  const latOffset = ((addressHash % 1000) / 1000) * 0.2 - 0.1; // ~±11km
  const lngOffset = (((addressHash >> 10) % 1000) / 1000) * 0.2 - 0.1;
  
  // Adjust based on neighborhood/zip for clustering
  const neighborhoodHash = hashString(neighborhood);
  const neighborhoodLatOffset = ((neighborhoodHash % 100) / 100) * 0.05;
  const neighborhoodLngOffset = (((neighborhoodHash >> 5) % 100) / 100) * 0.05;
  
  return {
    lat: baseLat + latOffset + neighborhoodLatOffset,
    lng: baseLng + lngOffset + neighborhoodLngOffset,
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
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate estimated distance between two points using Haversine formula
 */
export function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Apply urban factor (1.4x for city driving vs straight line)
  return R * c * 1.4;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get estimated travel time based on distance (assuming average 30 km/h in urban area)
 */
export function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmH = 30;
  return Math.round((distanceKm / avgSpeedKmH) * 60); // minutes
}

/**
 * Calculate similarity score between two addresses (0-100)
 * Higher score = more similar/closer addresses
 */
export function addressSimilarityScore(addr1: GeocodedAddress, addr2: GeocodedAddress): number {
  let score = 0;
  
  // Same street = very high similarity
  if (addr1.street && addr2.street && addr1.street === addr2.street) {
    score += 50;
  } else if (addr1.street && addr2.street) {
    // Check for parallel/nearby streets (simplified: same prefix)
    const prefix1 = addr1.street.substring(0, 5);
    const prefix2 = addr2.street.substring(0, 5);
    if (prefix1 === prefix2) {
      score += 20;
    }
  }
  
  // Same neighborhood = high similarity
  if (addr1.neighborhood && addr2.neighborhood && addr1.neighborhood === addr2.neighborhood) {
    score += 30;
  }
  
  // Same city
  if (addr1.city && addr2.city && addr1.city === addr2.city) {
    score += 10;
  }
  
  // Close ZIP codes
  if (addr1.zipCode && addr2.zipCode) {
    if (addr1.zipCode === addr2.zipCode) {
      score += 10;
    } else if (addr1.zipCode.substring(0, 5) === addr2.zipCode.substring(0, 5)) {
      score += 5;
    }
  }
  
  return Math.min(100, score);
}

/**
 * Geocode the distribution center
 */
export function getDistributionCenterCoords(): { lat: number; lng: number } {
  // Fixed coordinates for CD: Av. Iracema, 939 - Jardim Iracema, Barueri - SP
  return {
    lat: -23.5115,
    lng: -46.8754,
  };
}

/**
 * Calculate distance from distribution center to an address
 */
export function distanceFromCD(geocoded: GeocodedAddress): number {
  const cd = getDistributionCenterCoords();
  return calculateDistance(cd.lat, cd.lng, geocoded.estimatedLat, geocoded.estimatedLng);
}

/**
 * Group orders by geographic proximity (clustering)
 */
export function clusterOrdersByProximity(
  orders: Order[],
  numClusters: number
): Order[][] {
  if (orders.length === 0 || numClusters <= 0) return [];
  
  // Geocode all orders
  const geocodedOrders = orders.map(order => ({
    order,
    geocoded: parseAddress(order.address),
  }));
  
  // Simple k-means style clustering based on distance
  const clusters: Order[][] = Array.from({ length: numClusters }, () => []);
  
  // Initialize cluster centers based on distance from CD
  const sortedByDistance = [...geocodedOrders].sort(
    (a, b) => distanceFromCD(a.geocoded) - distanceFromCD(b.geocoded)
  );
  
  // Distribute orders to clusters based on their position in sorted list
  const ordersPerCluster = Math.ceil(orders.length / numClusters);
  
  sortedByDistance.forEach((item, index) => {
    const clusterIndex = Math.min(Math.floor(index / ordersPerCluster), numClusters - 1);
    clusters[clusterIndex].push(item.order);
  });
  
  return clusters;
}
