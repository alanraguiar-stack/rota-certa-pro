/**
 * Motor de Inteligência de Roteirização
 * 
 * Este módulo implementa a lógica inteligente orientada a objetivo,
 * simulando o raciocínio de um roteirista humano experiente.
 * 
 * O sistema deve:
 * - Ler os dados completos antes de decidir qualquer coisa
 * - Entender o propósito de cada arquivo
 * - Validar se os números fazem sentido
 * - Tomar decisões coerentes com o contexto logístico
 * - Revisar decisões que gerem resultados incoerentes
 */

import { Truck, ParsedOrder } from '@/types';
import { TERRITORY_RULES, findAnchorRule, assignTrucksToTerritories } from '@/lib/anchorRules';

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error';
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export interface ValidationSummary {
  totalWeight: number;
  totalOrders: number;
  requiredTrucks: number;
  selectedTrucks: number;
  totalCapacity: number;
  utilizationPercent: number;
  isCapacitySufficient: boolean;
  allOrdersAssigned: boolean;
  weightsMatch: boolean;
}

export interface FleetAnalysis {
  totalWeight: number;
  totalWeightWithMargin: number;
  safetyMarginPercent: number;
  minimumTrucksRequired: number;
  recommendedTrucks: Truck[];
  reasoning: string[];
  isOptimal: boolean;
}

export interface DistributionValidation {
  isValid: boolean;
  totalWeightDistributed: number;
  totalWeightExpected: number;
  weightDifference: number;
  allOrdersAssigned: boolean;
  unassignedOrders: string[];
  truckOverloads: Array<{ truckId: string; plate: string; overloadKg: number }>;
  reasoning: string[];
}

// ============================================
// FUNÇÕES DE ANÁLISE INTELIGENTE
// ============================================

/**
 * Analisa a frota necessária com base no peso total
 * Implementa o raciocínio: "Qual é o peso total? Quantos caminhões são necessários?"
 */
export function analyzeFleetRequirements(
  totalWeight: number,
  availableTrucks: Truck[],
  safetyMarginPercent: number = 10,
  orders: ParsedOrder[] = []
): FleetAnalysis {
  const reasoning: string[] = [];
  
  // Passo 1: Calcular peso total com margem de segurança
  const totalWeightWithMargin = totalWeight * (1 + safetyMarginPercent / 100);
  reasoning.push(
    `Peso total do dia: ${formatWeight(totalWeight)}`
  );
  reasoning.push(
    `Peso com margem de ${safetyMarginPercent}%: ${formatWeight(totalWeightWithMargin)}`
  );

  if (availableTrucks.length === 0) {
    return {
      totalWeight,
      totalWeightWithMargin,
      safetyMarginPercent,
      minimumTrucksRequired: 0,
      recommendedTrucks: [],
      reasoning: [...reasoning, 'ERRO: Nenhum caminhão disponível na frota'],
      isOptimal: false,
    };
  }

  // ============================================
  // PASSO TERRITORIAL: Detectar cidades dos pedidos e forçar caminhões âncora
  // ============================================
  const anchorTrucks: Truck[] = [];
  
  if (orders.length > 0) {
    // Extrair cidades únicas dos pedidos (normalizadas)
    const orderCities = new Set<string>();
    for (const order of orders) {
      if (order.city) {
        const normalized = order.city
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (normalized) orderCities.add(normalized);
      }
    }

    if (orderCities.size > 0) {
      reasoning.push(`🏙️ Cidades detectadas nos pedidos: ${[...orderCities].join(', ')}`);
    }

    // Para cada regra de território, verificar se a cidade está nos pedidos
    // O sistema seleciona automaticamente os melhores caminhões disponíveis
    const truckData = availableTrucks.map(t => ({
      plate: t.plate,
      capacity_kg: Number(t.capacity_kg),
      max_deliveries: t.max_deliveries,
      id: t.id,
    }));
    const territoryAssignments = assignTrucksToTerritories(truckData, orderCities);

    for (const [territoryId, assignedTruck] of territoryAssignments) {
      const rule = TERRITORY_RULES.find(r => r.id === territoryId);
      if (!rule || rule.isSupport) continue;

      const matchingTruck = availableTrucks.find(t => t.plate === assignedTruck.plate);
      if (matchingTruck && !anchorTrucks.some(at => at.id === matchingTruck.id)) {
        anchorTrucks.push(matchingTruck);
        reasoning.push(
          `🔒 ${rule.anchorCity} detectado → ${matchingTruck.plate} atribuído como ${rule.label}`
        );
      }
    }
  }

  // Passo 2: Ordenar caminhões por capacidade (maior primeiro)
  const sortedTrucks = [...availableTrucks].sort(
    (a, b) => Number(b.capacity_kg) - Number(a.capacity_kg)
  );
  
  const largestTruckCapacity = Number(sortedTrucks[0].capacity_kg);
  reasoning.push(
    `Maior caminhão disponível: ${sortedTrucks[0].plate} (${formatWeight(largestTruckCapacity)})`
  );

  // Se temos caminhões âncora obrigatórios, começar com eles
  const selectedTrucks: Truck[] = [...anchorTrucks];
  let remainingWeight = totalWeightWithMargin - anchorTrucks.reduce(
    (sum, t) => sum + Number(t.capacity_kg), 0
  );

  // Se os âncoras já cobrem o peso, não precisamos de mais
  if (remainingWeight <= 0 && anchorTrucks.length > 0) {
    const totalSelectedCapacity = selectedTrucks.reduce(
      (sum, t) => sum + Number(t.capacity_kg), 0
    );
    const utilizationPercent = Math.round((totalWeight / totalSelectedCapacity) * 100);
    reasoning.push(
      `✓ Caminhões âncora são suficientes: ${selectedTrucks.length} caminhões com ${utilizationPercent}% de ocupação`
    );
    return {
      totalWeight,
      totalWeightWithMargin,
      safetyMarginPercent,
      minimumTrucksRequired: selectedTrucks.length,
      recommendedTrucks: selectedTrucks,
      reasoning,
      isOptimal: true,
    };
  }

  // Passo 3: Preencher capacidade restante com bin-packing
  if (remainingWeight > 0) {
    if (anchorTrucks.length > 0) {
      reasoning.push(`Preenchendo capacidade restante: ${formatWeight(Math.max(0, remainingWeight))}`);
    }
    
    let attemptIndex = 0;
    while (remainingWeight > 0 && attemptIndex < sortedTrucks.length * 2) {
      for (const truck of sortedTrucks) {
        // Pular caminhões já selecionados (âncora)
        if (selectedTrucks.some(t => t.id === truck.id)) continue;
        
        selectedTrucks.push(truck);
        remainingWeight -= Number(truck.capacity_kg);
        reasoning.push(
          `+ ${truck.plate} (${formatWeight(Number(truck.capacity_kg))}) → Restante: ${formatWeight(Math.max(0, remainingWeight))}`
        );
        break;
      }
      attemptIndex++;
      
      if (selectedTrucks.length >= sortedTrucks.length) {
        break;
      }
    }
  }

  // Verificar se conseguimos alocar toda a carga
  const totalSelectedCapacity = selectedTrucks.reduce(
    (sum, t) => sum + Number(t.capacity_kg), 0
  );
  
  const isOptimal = totalSelectedCapacity >= totalWeightWithMargin;
  
  if (!isOptimal) {
    reasoning.push(
      `⚠️ AVISO: Capacidade total da frota (${formatWeight(totalSelectedCapacity)}) é insuficiente para a carga`
    );
  } else {
    const utilizationPercent = Math.round((totalWeight / totalSelectedCapacity) * 100);
    reasoning.push(
      `✓ Frota selecionada: ${selectedTrucks.length} caminhões com ${utilizationPercent}% de ocupação`
    );
  }

  return {
    totalWeight,
    totalWeightWithMargin,
    safetyMarginPercent,
    minimumTrucksRequired: selectedTrucks.length,
    recommendedTrucks: selectedTrucks,
    reasoning,
    isOptimal,
  };
}

/**
 * Valida se a distribuição de carga está correta
 * Implementa a auto-validação: "A soma dos pesos bate? Todos os clientes foram atribuídos?"
 */
export function validateDistribution(
  orders: ParsedOrder[],
  distributions: Array<{
    truckId: string;
    truckPlate: string;
    truckCapacity: number;
    assignedOrders: Array<{ orderId: string; weight: number }>;
  }>
): DistributionValidation {
  const reasoning: string[] = [];
  const errors: string[] = [];
  
  // Calcular peso total esperado
  const totalWeightExpected = orders
    .filter(o => o.isValid)
    .reduce((sum, o) => sum + o.weight_kg, 0);
  
  reasoning.push(`Peso total esperado: ${formatWeight(totalWeightExpected)}`);
  
  // Calcular peso total distribuído
  const totalWeightDistributed = distributions.reduce(
    (sum, d) => sum + d.assignedOrders.reduce((s, o) => s + o.weight, 0),
    0
  );
  
  reasoning.push(`Peso total distribuído: ${formatWeight(totalWeightDistributed)}`);
  
  // Verificar diferença de peso
  const weightDifference = Math.abs(totalWeightExpected - totalWeightDistributed);
  const weightsMatch = weightDifference < 1; // Tolerância de 1kg
  
  if (!weightsMatch) {
    reasoning.push(
      `⚠️ Diferença de peso: ${formatWeight(weightDifference)}`
    );
  } else {
    reasoning.push(`✓ Pesos conferem`);
  }
  
  // Verificar se todos os pedidos foram atribuídos
  const assignedOrderIds = new Set(
    distributions.flatMap(d => d.assignedOrders.map(o => o.orderId))
  );
  
  const validOrderIds = orders.filter(o => o.isValid).map(o => o.pedido_id || `${o.client_name}::${o.address}`);
  const unassignedOrders = validOrderIds.filter(id => !assignedOrderIds.has(id));
  const allOrdersAssigned = unassignedOrders.length === 0;
  
  if (!allOrdersAssigned) {
    reasoning.push(
      `⚠️ ${unassignedOrders.length} pedidos não foram atribuídos a nenhum caminhão`
    );
  } else {
    reasoning.push(`✓ Todos os ${validOrderIds.length} pedidos atribuídos`);
  }
  
  // Verificar sobrecarga de caminhões
  const truckOverloads: Array<{ truckId: string; plate: string; overloadKg: number }> = [];
  
  for (const dist of distributions) {
    const totalTruckWeight = dist.assignedOrders.reduce((s, o) => s + o.weight, 0);
    if (totalTruckWeight > dist.truckCapacity) {
      const overload = totalTruckWeight - dist.truckCapacity;
      truckOverloads.push({
        truckId: dist.truckId,
        plate: dist.truckPlate,
        overloadKg: overload,
      });
      reasoning.push(
        `⚠️ Caminhão ${dist.truckPlate} está sobrecarregado em ${formatWeight(overload)}`
      );
    }
  }
  
  if (truckOverloads.length === 0) {
    reasoning.push(`✓ Nenhum caminhão sobrecarregado`);
  }
  
  const isValid = weightsMatch && allOrdersAssigned && truckOverloads.length === 0;
  
  return {
    isValid,
    totalWeightDistributed,
    totalWeightExpected,
    weightDifference,
    allOrdersAssigned,
    unassignedOrders,
    truckOverloads,
    reasoning,
  };
}

/**
 * Valida o resultado final antes de gerar os romaneios
 * Esta é a "auto-validação" mencionada nos requisitos
 */
export function validateFinalResult(
  orders: ParsedOrder[],
  trucks: Truck[],
  distributions: Array<{
    truckId: string;
    assignedOrders: Array<{ weight: number }>;
  }>,
  expectedTotalWeight: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Calcular totais
  const totalWeight = orders.filter(o => o.isValid).reduce((sum, o) => sum + o.weight_kg, 0);
  const totalOrders = orders.filter(o => o.isValid).length;
  const selectedTrucks = distributions.filter(d => d.assignedOrders.length > 0).length;
  const totalCapacity = trucks
    .filter(t => distributions.some(d => d.truckId === t.id))
    .reduce((sum, t) => sum + Number(t.capacity_kg), 0);
  
  const totalDistributedWeight = distributions.reduce(
    (sum, d) => sum + d.assignedOrders.reduce((s, o) => s + o.weight, 0),
    0
  );
  
  // Validação 1: Peso total correto
  const weightDifference = Math.abs(totalWeight - expectedTotalWeight);
  if (weightDifference > 10) { // Tolerância de 10kg
    errors.push({
      code: 'WEIGHT_MISMATCH',
      message: `Peso calculado (${formatWeight(totalWeight)}) difere do esperado (${formatWeight(expectedTotalWeight)})`,
      severity: 'error',
      suggestion: 'Verifique se todas as linhas do arquivo foram processadas corretamente',
    });
  }
  
  // Validação 2: Caminhões suficientes
  if (totalCapacity < totalWeight) {
    errors.push({
      code: 'INSUFFICIENT_CAPACITY',
      message: `Capacidade total (${formatWeight(totalCapacity)}) é menor que o peso (${formatWeight(totalWeight)})`,
      severity: 'critical',
      suggestion: 'Adicione mais caminhões ou verifique se a frota está correta',
    });
  }
  
  // Validação 3: Todos os pedidos distribuídos
  const totalOrdersDistributed = distributions.reduce(
    (sum, d) => sum + d.assignedOrders.length, 0
  );
  
  if (totalOrdersDistributed < totalOrders) {
    errors.push({
      code: 'MISSING_ORDERS',
      message: `${totalOrders - totalOrdersDistributed} pedidos não foram distribuídos`,
      severity: 'error',
      suggestion: 'Execute a distribuição novamente ou verifique a capacidade dos caminhões',
    });
  }
  
  // Validação 4: Peso distribuído bate com peso total
  if (Math.abs(totalDistributedWeight - totalWeight) > 1) {
    warnings.push({
      code: 'DISTRIBUTION_WEIGHT_DIFF',
      message: `Diferença de ${formatWeight(Math.abs(totalDistributedWeight - totalWeight))} entre peso total e peso distribuído`,
      suggestion: 'Pode indicar erro de arredondamento ou pedido não contabilizado',
    });
  }
  
  // Calcular número mínimo de caminhões necessários
  const avgTruckCapacity = totalCapacity / selectedTrucks || 3500;
  const requiredTrucks = Math.ceil(totalWeight * 1.1 / avgTruckCapacity);
  
  if (selectedTrucks < requiredTrucks) {
    warnings.push({
      code: 'TRUCK_COUNT_LOW',
      message: `Recomendado ${requiredTrucks} caminhões, mas apenas ${selectedTrucks} foram selecionados`,
      suggestion: 'Considere adicionar mais caminhões para melhor distribuição',
    });
  }
  
  const utilizationPercent = totalCapacity > 0 
    ? Math.round((totalWeight / totalCapacity) * 100)
    : 0;
  
  return {
    isValid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    summary: {
      totalWeight,
      totalOrders,
      requiredTrucks,
      selectedTrucks,
      totalCapacity,
      utilizationPercent,
      isCapacitySufficient: totalCapacity >= totalWeight,
      allOrdersAssigned: totalOrdersDistributed >= totalOrders,
      weightsMatch: Math.abs(totalDistributedWeight - totalWeight) < 1,
    },
  };
}

/**
 * Gera explicação do raciocínio para o usuário
 */
export function generateReasoningExplanation(
  totalWeight: number,
  trucks: Truck[],
  selectedTruckIds: string[]
): string[] {
  const explanation: string[] = [];
  
  // Passo 1: O que temos
  explanation.push(`📦 **Peso total do dia:** ${formatWeight(totalWeight)}`);
  
  // Passo 2: Análise de capacidade
  const selectedTrucks = trucks.filter(t => selectedTruckIds.includes(t.id));
  const totalCapacity = selectedTrucks.reduce((sum, t) => sum + Number(t.capacity_kg), 0);
  
  if (selectedTrucks.length === 0) {
    explanation.push(`🚚 **Nenhum caminhão selecionado**`);
    explanation.push(`❌ Selecione pelo menos um caminhão para continuar`);
    return explanation;
  }
  
  explanation.push(`🚚 **Caminhões selecionados:** ${selectedTrucks.length}`);
  explanation.push(`📊 **Capacidade total:** ${formatWeight(totalCapacity)}`);
  
  // Passo 3: Decisão
  const utilizationPercent = Math.round((totalWeight / totalCapacity) * 100);
  
  if (totalCapacity < totalWeight) {
    explanation.push(`⚠️ **Capacidade insuficiente!** Faltam ${formatWeight(totalWeight - totalCapacity)}`);
    
    // Recomendar quantos caminhões são necessários
    const avgCapacity = totalCapacity / selectedTrucks.length;
    const additionalNeeded = Math.ceil((totalWeight - totalCapacity) / avgCapacity);
    explanation.push(`💡 **Recomendação:** Adicione pelo menos ${additionalNeeded} caminhão(ões)`);
  } else if (utilizationPercent > 95) {
    explanation.push(`⚠️ **Ocupação muito alta:** ${utilizationPercent}%`);
    explanation.push(`💡 Considere adicionar mais um caminhão para margem de segurança`);
  } else if (utilizationPercent >= 70) {
    explanation.push(`✅ **Ocupação ideal:** ${utilizationPercent}%`);
    explanation.push(`💡 Boa distribuição de carga entre os veículos`);
  } else {
    explanation.push(`ℹ️ **Ocupação baixa:** ${utilizationPercent}%`);
    explanation.push(`💡 Você poderia usar menos caminhões se necessário`);
  }
  
  return explanation;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function formatWeight(weightKg: number): string {
  if (weightKg >= 1000) {
    return `${(weightKg / 1000).toFixed(2).replace('.', ',')} t`;
  }
  return `${weightKg.toFixed(2).replace('.', ',')} kg`;
}

/**
 * Calcula a quantidade mínima de caminhões necessária
 * Raciocínio simples: peso total / capacidade média
 */
export function calculateMinimumTrucks(
  totalWeight: number,
  trucks: Truck[],
  safetyMarginPercent: number = 10
): number {
  if (trucks.length === 0) return 0;
  
  const weightWithMargin = totalWeight * (1 + safetyMarginPercent / 100);
  
  // Ordenar por capacidade decrescente
  const sorted = [...trucks].sort((a, b) => Number(b.capacity_kg) - Number(a.capacity_kg));
  
  let accumulated = 0;
  let count = 0;
  
  for (const truck of sorted) {
    accumulated += Number(truck.capacity_kg);
    count++;
    if (accumulated >= weightWithMargin) {
      return count;
    }
  }
  
  // Se todos os caminhões não são suficientes, retorna o total disponível
  return trucks.length;
}

/**
 * Verifica se a seleção de caminhões é logicamente válida
 */
export function isFleetSelectionValid(
  totalWeight: number,
  selectedTrucks: Truck[]
): { valid: boolean; reason: string } {
  if (selectedTrucks.length === 0) {
    return { valid: false, reason: 'Nenhum caminhão selecionado' };
  }
  
  const totalCapacity = selectedTrucks.reduce((sum, t) => sum + Number(t.capacity_kg), 0);
  
  if (totalCapacity < totalWeight) {
    return { 
      valid: false, 
      reason: `Capacidade insuficiente: ${formatWeight(totalCapacity)} < ${formatWeight(totalWeight)}` 
    };
  }
  
  const utilizationPercent = (totalWeight / totalCapacity) * 100;
  
  if (utilizationPercent > 100) {
    return { valid: false, reason: 'Capacidade excedida' };
  }
  
  return { valid: true, reason: 'Frota adequada para a carga' };
}
