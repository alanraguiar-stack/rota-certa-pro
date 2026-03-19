import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CitySchedule {
  [cityName: string]: Set<number>;
}

export function useCitySchedule() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<CitySchedule>({});
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // Load toggle state
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'city_schedule_enabled')
        .single();

      setIsEnabled(settingData?.setting_value === 'true');

      // Load schedule entries via raw query workaround for unsynced types
      const { data: entries } = await (supabase as any)
        .from('city_delivery_schedule')
        .select('city_name, day_of_week')
        .eq('user_id', user.id);

      if (entries) {
        const map: CitySchedule = {};
        for (const e of entries as { city_name: string; day_of_week: number }[]) {
          if (!map[e.city_name]) map[e.city_name] = new Set();
          map[e.city_name].add(e.day_of_week);
        }
        setSchedule(map);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const toggleEnabled = useCallback(async (value: boolean) => {
    if (!user) return;
    setIsEnabled(value);

    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('user_id', user.id)
      .eq('setting_key', 'city_schedule_enabled')
      .single();

    if (existing) {
      await supabase
        .from('app_settings')
        .update({ setting_value: value ? 'true' : 'false', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('app_settings')
        .insert({ user_id: user.id, setting_key: 'city_schedule_enabled', setting_value: value ? 'true' : 'false' });
    }
  }, [user]);

  const saveSchedule = useCallback(async (newSchedule: CitySchedule) => {
    if (!user) return;

    // Delete all existing
    await (supabase as any)
      .from('city_delivery_schedule')
      .delete()
      .eq('user_id', user.id);

    // Build insert rows
    const rows: { user_id: string; city_name: string; day_of_week: number }[] = [];
    for (const [city, days] of Object.entries(newSchedule)) {
      for (const day of days) {
        rows.push({ user_id: user.id, city_name: city, day_of_week: day });
      }
    }

    if (rows.length > 0) {
      await (supabase as any).from('city_delivery_schedule').insert(rows);
    }

    setSchedule(newSchedule);
  }, [user]);

  const getCitiesForDate = useCallback((date: Date): Set<string> | null => {
    if (!isEnabled) return null; // null = no filtering
    const dow = date.getDay();
    const cities = new Set<string>();
    for (const [city, days] of Object.entries(schedule)) {
      if (days.has(dow)) cities.add(city);
    }
    return cities;
  }, [isEnabled, schedule]);

  return { schedule, isEnabled, loading, toggleEnabled, saveSchedule, getCitiesForDate };
}
