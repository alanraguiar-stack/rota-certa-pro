import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { geocodeAddress, batchGeocodeAddresses, GeocodingResult } from '@/lib/nominatimGeocoding';

interface GeocodingProgress {
  current: number;
  total: number;
  currentAddress?: string;
  status: 'idle' | 'processing' | 'complete' | 'error';
  successCount: number;
  failedCount: number;
}

export function useGeocoding() {
  const [progress, setProgress] = useState<GeocodingProgress>({
    current: 0,
    total: 0,
    status: 'idle',
    successCount: 0,
    failedCount: 0,
  });

  const geocodeOrders = useCallback(async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      return { success: 0, failed: 0 };
    }

    // Fetch orders that need geocoding
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, address, geocoding_status')
      .in('id', orderIds)
      .or('geocoding_status.is.null,geocoding_status.eq.pending,geocoding_status.eq.error');

    if (error || !orders || orders.length === 0) {
      return { success: 0, failed: 0 };
    }

    setProgress({
      current: 0,
      total: orders.length,
      status: 'processing',
      successCount: 0,
      failedCount: 0,
    });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        currentAddress: order.address,
      }));

      try {
        const result = await geocodeAddress(order.address);

        if (result.status === 'success') {
          await supabase
            .from('orders')
            .update({
              latitude: result.lat,
              longitude: result.lng,
              geocoding_status: 'success',
            })
            .eq('id', order.id);
          
          successCount++;
        } else {
          await supabase
            .from('orders')
            .update({
              geocoding_status: result.status === 'not_found' ? 'not_found' : 'error',
            })
            .eq('id', order.id);
          
          failedCount++;
        }
      } catch (err) {
        console.error('Geocoding error for order:', order.id, err);
        await supabase
          .from('orders')
          .update({ geocoding_status: 'error' })
          .eq('id', order.id);
        failedCount++;
      }

      setProgress(prev => ({
        ...prev,
        successCount,
        failedCount,
      }));
    }

    setProgress(prev => ({
      ...prev,
      status: 'complete',
      current: orders.length,
      currentAddress: undefined,
    }));

    return { success: successCount, failed: failedCount };
  }, []);

  const geocodeSingleAddress = useCallback(async (address: string): Promise<GeocodingResult> => {
    return await geocodeAddress(address);
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      status: 'idle',
      successCount: 0,
      failedCount: 0,
    });
  }, []);

  return {
    progress,
    geocodeOrders,
    geocodeSingleAddress,
    resetProgress,
  };
}
