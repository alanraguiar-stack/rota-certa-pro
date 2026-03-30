import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { TERRITORY_RULES, TerritoryRule } from '@/lib/anchorRules';

export interface TruckTerritory {
  id: string;
  user_id: string;
  truck_id: string;
  anchor_city: string;
  fill_cities: string[];
  max_deliveries: number;
  priority: number;
  is_support: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerritoryFormData {
  truck_id: string;
  anchor_city: string;
  fill_cities: string[];
  max_deliveries: number;
  priority: number;
  is_support: boolean;
}

/** All known cities from anchor rules */
export const KNOWN_CITIES = [
  'barueri', 'osasco', 'carapicuiba', 'jandira', 'itapevi',
  'embu', 'embu das artes', 'cotia', 'vargem grande paulista',
  'pirapora do bom jesus', 'santana de parnaiba', 'taboao da serra', 'sao paulo',
];

/**
 * Get default territory config for a truck based on its plate and available rules.
 */
export function getDefaultTerritory(
  plate: string,
  assignedRuleIndex: number
): { anchor_city: string; fill_cities: string[]; max_deliveries: number; priority: number; is_support: boolean } {
  const normalizedPlate = plate.replace(/[\s-]/g, '').toUpperCase();

  // Check for fixedPlate match first
  for (const rule of TERRITORY_RULES) {
    if (rule.fixedPlate && rule.fixedPlate.replace(/[\s-]/g, '').toUpperCase() === normalizedPlate) {
      return {
        anchor_city: rule.anchorCity,
        fill_cities: rule.allowedFillCities,
        max_deliveries: rule.maxDeliveries,
        priority: rule.priority,
        is_support: rule.isSupport,
      };
    }
  }

  // Otherwise use position-based assignment
  const nonFixed = TERRITORY_RULES.filter(r => !r.fixedPlate);
  const rule = nonFixed[assignedRuleIndex] || nonFixed[nonFixed.length - 1];
  if (rule) {
    return {
      anchor_city: rule.anchorCity,
      fill_cities: rule.allowedFillCities,
      max_deliveries: rule.maxDeliveries,
      priority: rule.priority,
      is_support: rule.isSupport,
    };
  }

  return { anchor_city: '', fill_cities: [], max_deliveries: 25, priority: 50, is_support: false };
}

export function useTruckTerritories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const territoriesQuery = useQuery({
    queryKey: ['truck_territories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('truck_territories')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;
      return data as TruckTerritory[];
    },
    enabled: !!user,
  });

  const saveTerritories = useMutation({
    mutationFn: async (territories: TerritoryFormData[]) => {
      if (!user) throw new Error('Não autenticado');

      // Delete existing configs
      await supabase
        .from('truck_territories')
        .delete()
        .eq('user_id', user.id);

      // Insert new configs
      if (territories.length > 0) {
        const rows = territories.map(t => ({
          user_id: user.id,
          truck_id: t.truck_id,
          anchor_city: t.anchor_city,
          fill_cities: t.fill_cities,
          max_deliveries: t.max_deliveries,
          priority: t.priority,
          is_support: t.is_support,
        }));

        const { error } = await supabase
          .from('truck_territories')
          .insert(rows);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck_territories'] });
      toast({ title: 'Territórios salvos com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar territórios', description: error.message, variant: 'destructive' });
    },
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      await supabase
        .from('truck_territories')
        .delete()
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truck_territories'] });
      toast({ title: 'Territórios resetados para padrão!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao resetar', description: error.message, variant: 'destructive' });
    },
  });

  /**
   * Build TerritoryRule[] from DB configs (for use by the router engine).
   * Returns null if no custom configs exist (use defaults).
   */
  function buildTerritoryRules(): TerritoryRule[] | null {
    const data = territoriesQuery.data;
    if (!data || data.length === 0) return null;

    return data.map((t, idx) => {
      // Find matching hardcoded rule for advanced settings
      const matchingDefault = TERRITORY_RULES.find(
        r => r.anchorCity === t.anchor_city && !r.isSupport
      ) || (t.is_support ? TERRITORY_RULES.find(r => r.isSupport) : null);

      return {
        id: `custom_${idx}`,
        label: t.is_support ? 'Apoio / Excedentes' : `Âncora ${t.anchor_city || 'N/A'}`,
        anchorCity: t.anchor_city,
        maxDeliveries: t.max_deliveries,
        allowedFillCities: t.fill_cities,
        neighborhoodFills: matchingDefault?.neighborhoodFills || [],
        neighborhoodExceptions: matchingDefault?.neighborhoodExceptions || [],
        excludedNeighborhoods: matchingDefault?.excludedNeighborhoods || [],
        priorityNeighborhoods: matchingDefault?.priorityNeighborhoods || [],
        isSupport: t.is_support,
        priority: t.priority,
        fixedPlate: undefined, // Will be resolved by truck_id mapping
      } satisfies TerritoryRule;
    });
  }

  return {
    territories: territoriesQuery.data ?? [],
    isLoading: territoriesQuery.isLoading,
    saveTerritories,
    resetToDefaults,
    buildTerritoryRules,
  };
}
