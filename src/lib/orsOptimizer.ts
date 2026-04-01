import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types';
import { parseAddress, getDistributionCenterCoords } from './geocoding';

interface OrsOptimizeResult {
  optimizedOrder: string[] | null;
  orsDistance?: number;
  orsDuration?: number;
}

/**
 * Calls the ORS optimization edge function to reorder deliveries
 * using real driving distances (TSP solver).
 * 
 * Returns the optimized order IDs array, or null if ORS fails (fallback to nearest-neighbor).
 */
export async function optimizeWithORS(orders: Order[]): Promise<string[] | null> {
  if (orders.length <= 1) return null;
  // ORS free tier limit: 150 jobs per request
  if (orders.length > 150) {
    console.warn('[ORS] Too many orders for ORS optimization:', orders.length);
    return null;
  }

  try {
    const cd = getDistributionCenterCoords();

    const jobs = orders.map(order => {
      let lat: number, lng: number;
      
      if (order.latitude != null && order.longitude != null && order.geocoding_status === 'success') {
        lat = Number(order.latitude);
        lng = Number(order.longitude);
      } else {
        const geocoded = parseAddress(order.address);
        lat = geocoded.estimatedLat;
        lng = geocoded.estimatedLng;
      }

      return { id: order.id, lat, lng };
    });

    const { data, error } = await supabase.functions.invoke('optimize-route', {
      body: { jobs, cdLat: cd.lat, cdLng: cd.lng },
    });

    if (error) {
      console.warn('[ORS] Edge function error:', error);
      return null;
    }

    const result = data as OrsOptimizeResult;
    
    if (result.optimizedOrder && result.optimizedOrder.length > 0) {
      console.log(`[ORS] Optimization successful: ${result.optimizedOrder.length} deliveries, distance: ${result.orsDistance}m`);
      return result.optimizedOrder;
    }

    return null;
  } catch (err) {
    console.warn('[ORS] Failed to optimize:', err);
    return null;
  }
}
