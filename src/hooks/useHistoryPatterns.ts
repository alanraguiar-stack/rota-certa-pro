import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  HistoryRow,
  RoutingHint,
  ExtractedPatterns,
  extractCityPatterns,
  generateRoutingHints,
} from '@/lib/historyPatternEngine';
import { ParsedOrder } from '@/types';

export function useHistoryPatterns() {
  const { user } = useAuth();
  const [rawPatterns, setRawPatterns] = useState<HistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchPatterns = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('route_history_patterns')
          .select('id, truck_label, city, client_name, address, neighborhood, sequence_order, route_date, state, was_manually_moved')
          .eq('user_id', user.id);

        if (!error && data) {
          setRawPatterns(data as HistoryRow[]);
        }
      } catch {
        // silently fail - patterns are optional enhancement
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatterns();
  }, [user?.id]);

  const extractedPatterns: ExtractedPatterns = useMemo(
    () => extractCityPatterns(rawPatterns),
    [rawPatterns]
  );

  const getHintsForOrders = (orders: ParsedOrder[]): RoutingHint[] => {
    if (rawPatterns.length === 0) return [];
    return generateRoutingHints(extractedPatterns, orders);
  };

  return {
    hints: [] as RoutingHint[], // lazy - call getHintsForOrders when needed
    getHintsForOrders,
    extractedPatterns,
    rawPatterns,
    isLoading,
    patternsCount: rawPatterns.length,
    routeCount: extractedPatterns.routeCount,
  };
}
