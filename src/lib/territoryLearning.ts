/**
 * Territory Learning Engine
 * 
 * Analyzes route_history_patterns to detect when the analyst
 * consistently pairs cities differently than hardcoded TERRITORY_RULES.
 * Provides override suggestions and active overrides.
 */

import { supabase } from '@/integrations/supabase/client';
import { TERRITORY_RULES, TerritoryRule } from './anchorRules';

export interface TerritoryOverride {
  id: string;
  territory_id: string;
  override_type: string;
  city: string;
  occurrences: number;
  is_active: boolean;
}

export interface TerritorySuggestion {
  territoryId: string;
  territoryLabel: string;
  city: string;
  occurrences: number;
  totalRoutes: number;
  percentage: number;
  message: string;
}

/**
 * Fetch active territory overrides for a user
 */
export async function fetchTerritoryOverrides(userId: string): Promise<TerritoryOverride[]> {
  const { data } = await supabase
    .from('territory_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);
  
  return (data || []) as TerritoryOverride[];
}

/**
 * Apply territory overrides to TERRITORY_RULES
 * Returns a modified copy of the rules with overrides applied
 */
export function applyTerritoryOverrides(
  rules: TerritoryRule[],
  overrides: TerritoryOverride[]
): TerritoryRule[] {
  if (overrides.length === 0) return rules;

  return rules.map(rule => {
    const ruleOverrides = overrides.filter(o => o.territory_id === rule.id);
    if (ruleOverrides.length === 0) return rule;

    const additionalFillCities = ruleOverrides
      .filter(o => o.override_type === 'fill_city')
      .map(o => o.city)
      .filter(c => !rule.allowedFillCities.includes(c));

    if (additionalFillCities.length === 0) return rule;

    return {
      ...rule,
      allowedFillCities: [...rule.allowedFillCities, ...additionalFillCities],
    };
  });
}

/**
 * Analyze route history to detect territory patterns that differ from hardcoded rules.
 * Returns suggestions for new territory overrides.
 */
export async function analyzeTerritoryPatterns(userId: string): Promise<TerritorySuggestion[]> {
  const { data: patterns } = await supabase
    .from('route_history_patterns')
    .select('truck_label, city, route_date')
    .eq('user_id', userId);

  if (!patterns || patterns.length === 0) return [];

  // Group by route_date to count unique routes
  const routeDates = new Set(patterns.map(p => p.route_date).filter(Boolean));
  const totalRoutes = routeDates.size;
  if (totalRoutes < 5) return []; // Need at least 5 routes

  // Build truck→city co-occurrence: for each route, which cities go with which truck label
  const truckCityPairs = new Map<string, Map<string, number>>();
  
  // Group by route_date + truck_label
  const routeTruckCities = new Map<string, Set<string>>();
  for (const p of patterns) {
    if (!p.city || !p.route_date) continue;
    const key = `${p.route_date}::${p.truck_label}`;
    if (!routeTruckCities.has(key)) routeTruckCities.set(key, new Set());
    routeTruckCities.get(key)!.add(p.city.toLowerCase().trim());
  }

  // For each route+truck, record all city pairs that appeared together
  for (const [, cities] of routeTruckCities) {
    const cityArr = [...cities];
    for (const city of cityArr) {
      // Find which territory this city belongs to as anchor
      const territory = TERRITORY_RULES.find(r => r.anchorCity === city && !r.isSupport);
      if (!territory) continue;

      if (!truckCityPairs.has(territory.id)) {
        truckCityPairs.set(territory.id, new Map());
      }
      const pairMap = truckCityPairs.get(territory.id)!;
      
      // Count companion cities
      for (const companion of cityArr) {
        if (companion === city) continue;
        // Skip if companion is already in allowedFillCities
        if (territory.allowedFillCities.includes(companion)) continue;
        pairMap.set(companion, (pairMap.get(companion) || 0) + 1);
      }
    }
  }

  // Generate suggestions for companions that appear frequently
  const suggestions: TerritorySuggestion[] = [];
  const MIN_OCCURRENCES = 3;
  const MIN_PERCENTAGE = 60;

  for (const [territoryId, companionMap] of truckCityPairs) {
    const territory = TERRITORY_RULES.find(r => r.id === territoryId);
    if (!territory) continue;

    for (const [companionCity, occurrences] of companionMap) {
      const percentage = Math.round((occurrences / totalRoutes) * 100);
      if (occurrences >= MIN_OCCURRENCES && percentage >= MIN_PERCENTAGE) {
        suggestions.push({
          territoryId,
          territoryLabel: territory.label,
          city: companionCity,
          occurrences,
          totalRoutes,
          percentage,
          message: `Nas últimas ${totalRoutes} rotas, ${companionCity} foi combinada com ${territory.anchorCity} em ${occurrences} vezes (${percentage}%).`,
        });
      }
    }
  }

  return suggestions;
}
