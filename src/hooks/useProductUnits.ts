import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ProductUnit {
  id: string;
  product_name: string;
  unit_type: string;
}

const VALID_UNITS = ['kg', 'g', 'fardo', 'unidade', 'caixa', 'pacote', 'litro', 'garrafa', 'peca', 'saco', 'display'];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function useProductUnits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnits = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('product_units')
      .select('id, product_name, unit_type')
      .eq('user_id', user.id)
      .order('product_name');
    
    if (data) setUnits(data);
    if (error) console.error('Error fetching product units:', error);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const normalizedMap = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach(u => {
      map.set(normalize(u.product_name), u.unit_type);
    });
    return map;
  }, [units]);

  const getUnitForProduct = useCallback((productName: string): string => {
    const normalized = normalize(productName);
    
    // Exact match
    const exact = normalizedMap.get(normalized);
    if (exact) return exact;
    
    // Partial match: check if any registered product name is contained in the input
    for (const [key, value] of normalizedMap) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    
    return 'kg'; // default
  }, [normalizedMap]);

  const importProductUnits = useCallback(async (data: Array<{ product_name: string; unit_type: string }>) => {
    if (!user) return { success: 0, failed: 0 };
    
    const validData = data
      .filter(d => d.product_name && d.unit_type)
      .map(d => ({
        user_id: user.id,
        product_name: d.product_name.trim(),
        unit_type: VALID_UNITS.includes(d.unit_type.toLowerCase().trim()) 
          ? d.unit_type.toLowerCase().trim() 
          : 'kg',
      }));

    if (validData.length === 0) return { success: 0, failed: 0 };

    // Delete existing units first (replace all)
    await supabase.from('product_units').delete().eq('user_id', user.id);

    const { error } = await supabase.from('product_units').insert(validData);
    
    if (error) {
      toast({ title: 'Erro ao importar unidades', variant: 'destructive' });
      return { success: 0, failed: validData.length };
    }

    await fetchUnits();
    return { success: validData.length, failed: 0 };
  }, [user, toast, fetchUnits]);

  const deleteUnit = useCallback(async (unitId: string) => {
    const { error } = await supabase.from('product_units').delete().eq('id', unitId);
    if (!error) {
      setUnits(prev => prev.filter(u => u.id !== unitId));
    }
    return !error;
  }, []);

  return {
    units,
    loading,
    getUnitForProduct,
    importProductUnits,
    deleteUnit,
    fetchUnits,
    validUnits: VALID_UNITS,
  };
}
