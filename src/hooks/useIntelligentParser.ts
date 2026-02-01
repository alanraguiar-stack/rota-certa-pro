/**
 * Hook para integração do Motor Inteligente de Leitura de Planilhas
 * 
 * Fornece interface simplificada para uso nos componentes de upload
 */

import { useState, useCallback } from 'react';
import { ParsedOrder } from '@/types';
import {
  analyzeSpreadsheet,
  convertToLegacyFormat,
  SpreadsheetAnalysis,
  ExtractedOrder,
  formatWeight,
} from '@/lib/spreadsheet';

export interface IntelligentParseResult {
  success: boolean;
  orders: ParsedOrder[];
  analysis: SpreadsheetAnalysis | null;
  extractedOrders: ExtractedOrder[];
  summary: {
    totalOrders: number;
    validOrders: number;
    totalWeight: number;
    formattedWeight: string;
    averageWeight: number;
    estimatedTrucks: number;
    hasAddresses: boolean;
    hasProducts: boolean;
  };
  diagnostics: {
    format: string;
    headerRow: number;
    weightColumn: string | null;
    clientColumn: string | null;
    warnings: string[];
    errors: string[];
    suggestions: string[];
  };
}

export function useIntelligentParser() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<IntelligentParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File): Promise<IntelligentParseResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log('[useIntelligentParser] Iniciando análise:', file.name);

      // Usar o motor inteligente
      const { analysis, orders: extractedOrders } = await analyzeSpreadsheet(file);

      // Converter para formato legado (ParsedOrder)
      const legacyOrders = convertToLegacyFormat(extractedOrders);

      // Calcular estatísticas
      const validOrders = legacyOrders.filter(o => o.isValid);
      const totalWeight = extractedOrders.reduce((sum, o) => sum + o.weight_kg, 0);
      const averageWeight = extractedOrders.length > 0 ? totalWeight / extractedOrders.length : 0;
      const estimatedTrucks = Math.ceil(totalWeight / 3150); // 3.5t * 90%
      const hasAddresses = extractedOrders.some(o => o.address && o.address.length >= 10);
      const hasProducts = extractedOrders.some(o => o.products.length > 0);

      const result: IntelligentParseResult = {
        success: extractedOrders.length > 0,
        orders: legacyOrders,
        analysis,
        extractedOrders,
        summary: {
          totalOrders: extractedOrders.length,
          validOrders: validOrders.length,
          totalWeight,
          formattedWeight: formatWeight(totalWeight),
          averageWeight,
          estimatedTrucks,
          hasAddresses,
          hasProducts,
        },
        diagnostics: {
          format: analysis.format,
          headerRow: analysis.headerRowIndex + 1,
          weightColumn: analysis.weightColumn?.rawHeader || null,
          clientColumn: analysis.mapping ? 
            analysis.columns.find(c => c.index === analysis.mapping?.clientName)?.rawHeader || null 
            : null,
          warnings: analysis.validation.warnings.map(w => w.message),
          errors: analysis.validation.errors.map(e => e.message),
          suggestions: analysis.validation.suggestions,
        },
      };

      setLastResult(result);
      setIsProcessing(false);

      console.log('[useIntelligentParser] Resultado:', {
        orders: result.summary.totalOrders,
        weight: result.summary.formattedWeight,
        format: result.diagnostics.format,
      });

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      console.error('[useIntelligentParser] Erro:', err);
      setError(errorMessage);
      setIsProcessing(false);

      const emptyResult: IntelligentParseResult = {
        success: false,
        orders: [],
        analysis: null,
        extractedOrders: [],
        summary: {
          totalOrders: 0,
          validOrders: 0,
          totalWeight: 0,
          formattedWeight: '0 kg',
          averageWeight: 0,
          estimatedTrucks: 0,
          hasAddresses: false,
          hasProducts: false,
        },
        diagnostics: {
          format: 'unknown',
          headerRow: 0,
          weightColumn: null,
          clientColumn: null,
          warnings: [],
          errors: [errorMessage],
          suggestions: [],
        },
      };

      setLastResult(emptyResult);
      return emptyResult;
    }
  }, []);

  const reset = useCallback(() => {
    setLastResult(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  return {
    parseFile,
    isProcessing,
    lastResult,
    error,
    reset,
  };
}
