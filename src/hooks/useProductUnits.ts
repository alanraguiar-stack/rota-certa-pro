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

const UNIT_ABBREV_MAP: Record<string, string> = {
  kg: 'KG',
  g: 'G',
  fardo: 'FD',
  unidade: 'UN',
  caixa: 'CX',
  pacote: 'PCT',
  litro: 'LT',
  garrafa: 'GF',
  peca: 'PC',
  saco: 'SC',
  display: 'DP',
};

export function getUnitAbbrev(unitType: string): string {
  return UNIT_ABBREV_MAP[unitType.toLowerCase().trim()] || unitType.toUpperCase();
}

export function isWeightUnit(unitType: string): boolean {
  const u = unitType.toLowerCase().trim();
  return u === 'kg' || u === 'g';
}

/**
 * Regra de NEGÓCIO de categoria/produto.
 * Quando retorna um valor não-nulo, ele tem precedência absoluta sobre
 * marcadores de embalagem no nome (FD12UN, CX15KG, ...) e sobre
 * cadastros automáticos antigos que possam estar conflitantes.
 *
 * Use só para produtos cuja unidade operacional foi explicitamente
 * direcionada pela operação. Produtos sem regra direcionada caem na
 * hierarquia normal (marcador → cadastro → inferência → kg).
 */
export function getCategoryRule(productName: string): string | null {
  const upper = (productName || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Proteínas / frios — sempre KG (mesmo com "CX 15KG" no nome)
  if (/\bLINGUICA\b/.test(upper)) return 'kg';
  if (/\bSALSICHA\b/.test(upper)) return 'kg';
  if (/\bBISTECA\b/.test(upper)) return 'kg';
  if (/\bAPRESUNTADO\b/.test(upper)) return 'kg';

  // Categorias direcionadas
  if (/\bCAFE\b/.test(upper)) return 'fardo';
  if (/\bFARINHA\b/.test(upper)) return 'fardo';
  if (/MOLHO\s+DE\s+TOMATE/.test(upper)) return 'pacote';
  if (/\bKETCHUP\b/.test(upper)) return 'unidade';
  if (/\bMAIONESE\b/.test(upper)) return 'unidade';

  return null;
}

/**
 * Detecta marcadores explícitos fortes de unidade no nome do produto
 * (ex: "REFRI 2L FD12UN", "BISCOITO CX24"). Retorna a unidade detectada
 * ou null se não houver marcador explícito.
 *
 * Esses marcadores ganham precedência sobre qualquer cadastro/inferência.
 */
export function getStrongUnitMarker(productName: string): string | null {
  const upper = (productName || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Marcadores explícitos com dígitos colados (FD12UN, CX6, PCT24...)
  const strongMap: Array<[RegExp, string]> = [
    [/\bFD\d+\b/, 'fardo'],
    [/\bCX\d+\b/, 'caixa'],
    [/\bPCT\d+\b/, 'pacote'],
    [/\bSC\d+\b/, 'saco'],
    [/\bDP\d+\b/, 'display'],
    [/\bGF\d+\b/, 'garrafa'],
    [/\bLT\d+\b/, 'litro'],
    [/\bUN\d+\b/, 'unidade'],
  ];
  for (const [re, unit] of strongMap) {
    if (re.test(upper)) return unit;
  }
  return null;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Infere a unidade de medida a partir do nome do produto.
 * Prioridade: refrigerante > abreviações explícitas > kg (padrão).
 */
export function inferUnitFromName(productName: string): string {
  // 1) Regra de NEGÓCIO: proteína / categoria direcionada vence tudo
  const ruled = getCategoryRule(productName);
  if (ruled) return ruled;

  // Normalizar: maiúsculas e sem acentos para regras consistentes
  const upper = productName
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Bebidas → fardo (categoria genérica, mas não direcionamento estrito)
  if (/REFRIGERANTE|AGUA MINERAL|SUCO|CERVEJA|ENERGETICO|ISOTON|CHA\s+GELADO|ICE\s+TEA|\bCHA\b/.test(upper)) return 'fardo';

  // Abreviações flexíveis — aceita FD12UN, CX6, PCT24 etc.
  // Ordem importa: FD antes de UN para não conflitar com "FD12UN"
  const abbrevMap: Array<[RegExp, string]> = [
    [/FD\d*/, 'fardo'],
    [/FARDO/, 'fardo'],
    [/CX\d*/, 'caixa'],
    [/CAIXA/, 'caixa'],
    [/PCT\d*/, 'pacote'],
    [/PACOTE/, 'pacote'],
    [/SC\d*/, 'saco'],
    [/SACO/, 'saco'],
    [/DP\d*/, 'display'],
    [/DISPLAY/, 'display'],
    [/GF\d*/, 'garrafa'],
    [/GARRAFA/, 'garrafa'],
    [/\bLT\d*\b/, 'litro'],
    [/LITRO/, 'litro'],
    [/\bPC\d*\b/, 'peca'],
    [/PECA/, 'peca'],
    [/\bUN\d*\b/, 'unidade'],
    [/UNIDADE/, 'unidade'],
  ];

  for (const [pattern, unit] of abbrevMap) {
    if (pattern.test(upper)) return unit;
  }

  return 'kg';
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
    // 1) Regra de NEGÓCIO sempre vence — protege contra cadastros antigos
    //    salvos errados (ex.: linguiça/apresuntado/bisteca como "caixa").
    const ruled = getCategoryRule(productName);
    if (ruled) return ruled;

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
    
    // Fallback: inferir pelo nome do produto em vez de assumir kg
    return inferUnitFromName(productName);
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

  const addUnit = useCallback(async (product_name: string, unit_type: string) => {
    if (!user) return false;
    const normalizedUnit = VALID_UNITS.includes(unit_type.toLowerCase().trim())
      ? unit_type.toLowerCase().trim()
      : 'kg';
    const { data, error } = await supabase
      .from('product_units')
      .insert({ user_id: user.id, product_name: product_name.trim(), unit_type: normalizedUnit })
      .select()
      .single();
    if (!error && data) {
      setUnits(prev => [...prev, data].sort((a, b) => a.product_name.localeCompare(b.product_name)));
    }
    return !error;
  }, [user]);

  const bulkAddNewProducts = useCallback(async (products: Array<{ product_name: string }>) => {
    if (!user) return { added: 0, skipped: 0 };

    // Refresh units to have latest data
    await fetchUnits();

    const currentMap = new Map<string, string>();
    units.forEach(u => currentMap.set(normalize(u.product_name), u.unit_type));

    const newProducts: Array<{ user_id: string; product_name: string; unit_type: string }> = [];
    const seen = new Set<string>();

    for (const p of products) {
      if (!p.product_name) continue;
      const norm = normalize(p.product_name);
      if (norm.length < 2) continue;
      if (currentMap.has(norm) || seen.has(norm)) continue;

      seen.add(norm);
      newProducts.push({
        user_id: user.id,
        product_name: p.product_name.trim(),
        unit_type: inferUnitFromName(p.product_name),
      });
    }

    if (newProducts.length === 0) return { added: 0, skipped: products.length };

    const { error } = await supabase.from('product_units').insert(newProducts);

    if (error) {
      console.error('Erro ao cadastrar produtos em lote:', error);
      return { added: 0, skipped: products.length };
    }

    await fetchUnits();
    return { added: newProducts.length, skipped: products.length - newProducts.length };
  }, [user, units, fetchUnits]);

  return {
    units,
    loading,
    getUnitForProduct,
    importProductUnits,
    deleteUnit,
    addUnit,
    bulkAddNewProducts,
    fetchUnits,
    validUnits: VALID_UNITS,
  };
}
