import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const { data: rawPatterns = [], isLoading } = useQuery<HistoryRow[]>({
    queryKey: ['history-patterns', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_history_patterns')
        .select('id, truck_label, city, client_name, address, neighborhood, sequence_order, route_date, state, was_manually_moved')
        .eq('user_id', user!.id);

      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
    enabled: !!user?.id,
    staleTime: 10 * 60_000, // padrões mudam raramente — frescos por 10 minutos
    gcTime: 30 * 60_000,    // manter no cache por 30 minutos após desmontar
  });

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
