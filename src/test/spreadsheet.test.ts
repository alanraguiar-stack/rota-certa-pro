/**
 * Testes para o Motor Inteligente de Leitura de Planilhas
 */

import { describe, it, expect } from 'vitest';
import {
  superNormalize,
  standardNormalize,
  detectSemanticType,
  parseNumericValue,
  isLikelyMonetaryColumn,
  isLikelyWeightColumn,
} from '@/lib/spreadsheet/columnDetector';
import { extractWeight, isValidDeliveryWeight, formatWeight } from '@/lib/spreadsheet/weightExtractor';

describe('Column Detector', () => {
  describe('superNormalize', () => {
    it('deve remover acentos e caracteres especiais', () => {
      expect(superNormalize('Peso Bruto')).toBe('pesobruto');
      expect(superNormalize('Peso  Bruto')).toBe('pesobruto');
      expect(superNormalize('End. Ent.')).toBe('endent');
      expect(superNormalize('Endereço')).toBe('endereco');
      expect(superNormalize('Bairro Ent.')).toBe('bairroent');
    });
  });

  describe('detectSemanticType', () => {
    it('deve detectar coluna de peso bruto', () => {
      const result = detectSemanticType('Peso Bruto');
      expect(result.type).toBe('weight_gross');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('deve detectar coluna de cliente', () => {
      const result = detectSemanticType('Cliente');
      expect(result.type).toBe('client_name');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('deve detectar coluna de endereço de entrega', () => {
      const result = detectSemanticType('End. Ent.');
      expect(result.type).toBe('address_street');
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it('deve detectar coluna monetária', () => {
      const result = detectSemanticType('Total');
      expect(result.type).toBe('monetary_value');
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it('deve retornar unknown para colunas não reconhecidas', () => {
      const result = detectSemanticType('XYZ123');
      expect(result.type).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('parseNumericValue', () => {
    it('deve parsear números diretos', () => {
      expect(parseNumericValue(224.55)).toBe(224.55);
      expect(parseNumericValue(1000)).toBe(1000);
    });

    it('deve parsear formato brasileiro (vírgula decimal)', () => {
      expect(parseNumericValue('224,55')).toBe(224.55);
      expect(parseNumericValue('1.234,56')).toBe(1234.56);
    });

    it('deve parsear formato americano (ponto decimal)', () => {
      expect(parseNumericValue('224.55')).toBe(224.55);
      expect(parseNumericValue('1,234.56')).toBe(1234.56);
    });

    it('deve remover sufixos de unidade', () => {
      expect(parseNumericValue('224.55 kg')).toBe(224.55);
      expect(parseNumericValue('100 kilos')).toBe(100);
    });

    it('deve retornar 0 para valores inválidos', () => {
      expect(parseNumericValue(null)).toBe(0);
      expect(parseNumericValue(undefined)).toBe(0);
      expect(parseNumericValue('')).toBe(0);
      expect(parseNumericValue('abc')).toBe(0);
    });
  });

  describe('isLikelyMonetaryColumn', () => {
    it('deve detectar coluna monetária', () => {
      const values = ['R$ 100,00', 'R$ 250,50', 'R$ 483,30'];
      expect(isLikelyMonetaryColumn(values)).toBe(true);
    });

    it('deve não detectar coluna de peso como monetária', () => {
      const values = ['224.55', '150.30', '89.20', '300.00'];
      expect(isLikelyMonetaryColumn(values)).toBe(false);
    });
  });

  describe('isLikelyWeightColumn', () => {
    it('deve detectar coluna de peso', () => {
      const values = [224.55, 150.30, 89.20, 300.00, 180.00, 250.00];
      const result = isLikelyWeightColumn(values);
      expect(result.isWeight).toBe(true);
      expect(result.stats.average).toBeCloseTo(199.01, 1);
    });

    it('deve não detectar valores muito altos como peso', () => {
      const values = [1000000, 2000000, 3000000];
      const result = isLikelyWeightColumn(values);
      expect(result.isWeight).toBe(false);
    });
  });
});

describe('Weight Extractor', () => {
  describe('extractWeight', () => {
    it('deve extrair peso de número', () => {
      const result = extractWeight(224.55);
      expect(result.value).toBe(224.55);
      expect(result.format).toBe('number');
      expect(result.confidence).toBe(100);
    });

    it('deve extrair peso de string BR', () => {
      const result = extractWeight('1.234,56');
      expect(result.value).toBe(1234.56);
      expect(result.format).toBe('string_br');
    });

    it('deve extrair peso de string simples', () => {
      const result = extractWeight('224.55');
      expect(result.value).toBe(224.55);
    });

    it('deve retornar 0 para valores inválidos', () => {
      expect(extractWeight(null).value).toBe(0);
      expect(extractWeight('').value).toBe(0);
      expect(extractWeight('abc').value).toBe(0);
    });
  });

  describe('isValidDeliveryWeight', () => {
    it('deve validar peso dentro do range', () => {
      expect(isValidDeliveryWeight(100).valid).toBe(true);
      expect(isValidDeliveryWeight(500).valid).toBe(true);
      expect(isValidDeliveryWeight(3000).valid).toBe(true);
    });

    it('deve rejeitar peso zero ou negativo', () => {
      expect(isValidDeliveryWeight(0).valid).toBe(false);
      expect(isValidDeliveryWeight(-10).valid).toBe(false);
    });

    it('deve rejeitar peso acima de 5 toneladas', () => {
      expect(isValidDeliveryWeight(6000).valid).toBe(false);
    });
  });

  describe('formatWeight', () => {
    it('deve formatar peso em kg', () => {
      expect(formatWeight(224.55)).toBe('224,55 kg');
      expect(formatWeight(500)).toBe('500,00 kg');
    });

    it('deve formatar peso em toneladas', () => {
      expect(formatWeight(1000)).toBe('1,00 t');
      expect(formatWeight(13048.56)).toBe('13,05 t');
    });
  });
});
