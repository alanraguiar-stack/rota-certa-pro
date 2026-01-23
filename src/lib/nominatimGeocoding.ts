import { supabase } from "@/integrations/supabase/client";

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName?: string;
  status: 'success' | 'not_found' | 'error';
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

// Generate a simple hash for the address to use as cache key
function hashAddress(address: string): string {
  const normalized = address.toLowerCase().trim().replace(/\s+/g, ' ');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `addr_${Math.abs(hash).toString(36)}`;
}

// Rate limiting: track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
}

// Check cache first
async function checkCache(addressHash: string): Promise<GeocodingResult | null> {
  const { data, error } = await supabase
    .from('geocoding_cache')
    .select('latitude, longitude, display_name')
    .eq('address_hash', addressHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    lat: Number(data.latitude),
    lng: Number(data.longitude),
    displayName: data.display_name || undefined,
    status: 'success'
  };
}

// Save to cache
async function saveToCache(
  addressHash: string, 
  originalAddress: string, 
  result: GeocodingResult
): Promise<void> {
  if (result.status !== 'success') return;

  await supabase
    .from('geocoding_cache')
    .upsert({
      address_hash: addressHash,
      original_address: originalAddress,
      latitude: result.lat,
      longitude: result.lng,
      display_name: result.displayName || null
    }, { onConflict: 'address_hash' });
}

// Call Nominatim API
async function callNominatim(address: string): Promise<GeocodingResult> {
  await waitForRateLimit();

  try {
    // Add ", Brasil" to improve results for Brazilian addresses
    const searchAddress = address.includes('Brasil') || address.includes('Brazil') 
      ? address 
      : `${address}, Brasil`;

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', searchAddress);
    url.searchParams.set('format', 'json');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'RotaCerta/1.0 (delivery-routing-app)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Nominatim API error:', response.status);
      return { lat: 0, lng: 0, status: 'error' };
    }

    const data: NominatimResponse[] = await response.json();

    if (data.length === 0) {
      console.warn('Address not found:', address);
      return { lat: 0, lng: 0, status: 'not_found' };
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
      status: 'success'
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return { lat: 0, lng: 0, status: 'error' };
  }
}

// Main geocoding function with cache
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const addressHash = hashAddress(address);
  
  // Check cache first
  const cached = await checkCache(addressHash);
  if (cached) {
    return cached;
  }

  // Call Nominatim API
  const result = await callNominatim(address);
  
  // Save to cache if successful
  if (result.status === 'success') {
    await saveToCache(addressHash, address, result);
  }

  return result;
}

// Batch geocode multiple addresses with progress callback
export async function batchGeocodeAddresses(
  addresses: string[],
  onProgress?: (current: number, total: number, address: string) => void
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    
    if (onProgress) {
      onProgress(i + 1, addresses.length, address);
    }
    
    const result = await geocodeAddress(address);
    results.set(address, result);
  }

  return results;
}

// Pre-check which addresses are already cached
export async function checkCachedAddresses(addresses: string[]): Promise<Set<string>> {
  const hashes = addresses.map(addr => hashAddress(addr));
  
  const { data } = await supabase
    .from('geocoding_cache')
    .select('address_hash, original_address')
    .in('address_hash', hashes);

  const cachedAddresses = new Set<string>();
  if (data) {
    // Create a map of hash to original address from the request
    const hashToAddress = new Map(addresses.map(addr => [hashAddress(addr), addr]));
    
    data.forEach(item => {
      const originalAddr = hashToAddress.get(item.address_hash);
      if (originalAddr) {
        cachedAddresses.add(originalAddr);
      }
    });
  }

  return cachedAddresses;
}
