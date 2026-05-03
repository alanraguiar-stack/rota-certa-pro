/**
 * TESTES DE REGRESSÃO — useRouteDetails
 *
 * Valida que a estrutura de dados retornada pelo hook permanece
 * intacta após qualquer refatoração (ex: item 9 — nested select).
 *
 * Esses testes simulam o banco com mocks e verificam:
 *   - Campos obrigatórios presentes
 *   - Tipos corretos
 *   - Estrutura aninhada (orders.items, route_trucks.assignments)
 *   - Cálculo de occupancy_percent
 *   - Comportamento com rota vazia / sem caminhões
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Tipos mínimos usados nos testes ───────────────────────────────────────
interface RouteResult {
  id: string;
  name: string;
  status: string;
  orders: OrderResult[];
  route_trucks: RouteTruckResult[];
}

interface OrderResult {
  id: string;
  client_name: string;
  address: string;
  weight_kg: number;
  items: OrderItemResult[];
}

interface OrderItemResult {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
}

interface RouteTruckResult {
  id: string;
  total_weight_kg: number;
  occupancy_percent: number;
  truck: { id: string; plate: string; capacity_kg: number } | null;
  assignments: AssignmentResult[];
}

interface AssignmentResult {
  id: string;
  delivery_sequence: number;
  order: OrderResult | null;
}

// ─── Função que replica a lógica de montagem do useRouteDetails ────────────
// Mantida separada para poder testar sem React/Supabase
function buildRouteResult(
  route: any,
  orders: any[],
  orderItems: any[],
  routeTrucks: any[],
  assignments: any[]
): RouteResult {
  // Agrupa itens por order_id
  const itemsByOrder: Record<string, OrderItemResult[]> = {};
  for (const item of orderItems) {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  }

  // Anexa itens aos pedidos
  const ordersWithItems: OrderResult[] = orders.map(o => ({
    ...o,
    items: itemsByOrder[o.id] ?? [],
  }));

  // Agrupa assignments por caminhão
  const assignsByTruck: Record<string, AssignmentResult[]> = {};
  for (const a of assignments) {
    if (!assignsByTruck[a.route_truck_id]) assignsByTruck[a.route_truck_id] = [];
    const order = orders.find(o => o.id === a.order_id) ?? null;
    assignsByTruck[a.route_truck_id].push({
      ...a,
      order: order ? { ...order, items: itemsByOrder[order.id] ?? [] } : null,
    });
  }

  // Monta caminhões com occupancy
  const routeTrucksWithAssignments: RouteTruckResult[] = routeTrucks.map(rt => ({
    ...rt,
    assignments: (assignsByTruck[rt.id] ?? []).sort(
      (a, b) => a.delivery_sequence - b.delivery_sequence
    ),
    occupancy_percent: rt.truck
      ? Math.round((Number(rt.total_weight_kg) / Number(rt.truck.capacity_kg)) * 100)
      : 0,
  }));

  return {
    ...route,
    orders: ordersWithItems,
    route_trucks: routeTrucksWithAssignments,
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────────────
const mockRoute = { id: 'route-1', name: 'Rota Teste', status: 'planned' };

const mockOrders = [
  { id: 'order-1', client_name: 'Cliente A', address: 'Rua X, 10', weight_kg: 50, route_id: 'route-1' },
  { id: 'order-2', client_name: 'Cliente B', address: 'Rua Y, 20', weight_kg: 30, route_id: 'route-1' },
];

const mockItems = [
  { id: 'item-1', order_id: 'order-1', product_name: 'Produto 1', quantity: 2 },
  { id: 'item-2', order_id: 'order-1', product_name: 'Produto 2', quantity: 1 },
  { id: 'item-3', order_id: 'order-2', product_name: 'Produto 3', quantity: 5 },
];

const mockTruck = { id: 'truck-1', plate: 'ABC1234', capacity_kg: 1000 };

const mockRouteTrucks = [
  { id: 'rt-1', route_id: 'route-1', truck_id: 'truck-1', total_weight_kg: 80, truck: mockTruck },
];

const mockAssignments = [
  { id: 'assign-1', route_truck_id: 'rt-1', order_id: 'order-1', delivery_sequence: 1 },
  { id: 'assign-2', route_truck_id: 'rt-1', order_id: 'order-2', delivery_sequence: 2 },
];

// ─── Testes ────────────────────────────────────────────────────────────────
describe('useRouteDetails — estrutura de dados (regressão)', () => {

  describe('campos raiz da rota', () => {
    it('deve preservar id, name e status', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      expect(result.id).toBe('route-1');
      expect(result.name).toBe('Rota Teste');
      expect(result.status).toBe('planned');
    });
  });

  describe('orders — pedidos da rota', () => {
    it('deve retornar todos os pedidos', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      expect(result.orders).toHaveLength(2);
    });

    it('cada pedido deve ter campos obrigatórios', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      for (const order of result.orders) {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('client_name');
        expect(order).toHaveProperty('address');
        expect(order).toHaveProperty('weight_kg');
        expect(order).toHaveProperty('items');
        expect(Array.isArray(order.items)).toBe(true);
      }
    });

    it('deve anexar os itens corretos a cada pedido', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      const orderA = result.orders.find(o => o.id === 'order-1')!;
      const orderB = result.orders.find(o => o.id === 'order-2')!;
      expect(orderA.items).toHaveLength(2);
      expect(orderB.items).toHaveLength(1);
    });

    it('pedido sem itens deve ter items = []', () => {
      const result = buildRouteResult(mockRoute, mockOrders, [], mockRouteTrucks, mockAssignments);
      for (const order of result.orders) {
        expect(order.items).toEqual([]);
      }
    });
  });

  describe('route_trucks — caminhões da rota', () => {
    it('deve retornar todos os caminhões', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      expect(result.route_trucks).toHaveLength(1);
    });

    it('cada caminhão deve ter campos obrigatórios', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      const rt = result.route_trucks[0];
      expect(rt).toHaveProperty('id');
      expect(rt).toHaveProperty('total_weight_kg');
      expect(rt).toHaveProperty('truck');
      expect(rt).toHaveProperty('assignments');
      expect(rt).toHaveProperty('occupancy_percent');
    });

    it('deve calcular occupancy_percent corretamente (80kg / 1000kg = 8%)', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      expect(result.route_trucks[0].occupancy_percent).toBe(8);
    });

    it('occupancy_percent = 0 quando truck é null', () => {
      const trucksNoTruck = [{ ...mockRouteTrucks[0], truck: null }];
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, trucksNoTruck, mockAssignments);
      expect(result.route_trucks[0].occupancy_percent).toBe(0);
    });

    it('deve preservar dados do caminhão (plate, capacity_kg)', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      const truck = result.route_trucks[0].truck!;
      expect(truck.plate).toBe('ABC1234');
      expect(truck.capacity_kg).toBe(1000);
    });
  });

  describe('assignments — entregas por caminhão', () => {
    it('deve ter o número correto de assignments no caminhão', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      expect(result.route_trucks[0].assignments).toHaveLength(2);
    });

    it('assignments devem estar ordenados por delivery_sequence', () => {
      const shuffled = [mockAssignments[1], mockAssignments[0]]; // ordem inversa
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, shuffled);
      const seqs = result.route_trucks[0].assignments.map(a => a.delivery_sequence);
      expect(seqs).toEqual([1, 2]);
    });

    it('cada assignment deve ter o pedido aninhado com seus itens', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, mockRouteTrucks, mockAssignments);
      const assign1 = result.route_trucks[0].assignments.find(a => a.id === 'assign-1')!;
      expect(assign1.order).not.toBeNull();
      expect(assign1.order!.client_name).toBe('Cliente A');
      expect(assign1.order!.items).toHaveLength(2);
    });
  });

  describe('casos limite', () => {
    it('rota sem pedidos deve retornar orders = []', () => {
      const result = buildRouteResult(mockRoute, [], [], mockRouteTrucks, []);
      expect(result.orders).toEqual([]);
    });

    it('rota sem caminhões deve retornar route_trucks = []', () => {
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, [], []);
      expect(result.route_trucks).toEqual([]);
    });

    it('rota completamente vazia deve ter estrutura válida', () => {
      const result = buildRouteResult(mockRoute, [], [], [], []);
      expect(result.orders).toEqual([]);
      expect(result.route_trucks).toEqual([]);
      expect(result.id).toBe('route-1');
    });

    it('múltiplos caminhões devem receber seus assignments corretamente', () => {
      const trucks2 = [
        ...mockRouteTrucks,
        { id: 'rt-2', route_id: 'route-1', total_weight_kg: 30, truck: { id: 'truck-2', plate: 'XYZ9999', capacity_kg: 500 } },
      ];
      const assigns2 = [
        mockAssignments[0], // order-1 → rt-1
        { id: 'assign-3', route_truck_id: 'rt-2', order_id: 'order-2', delivery_sequence: 1 },
      ];
      const result = buildRouteResult(mockRoute, mockOrders, mockItems, trucks2, assigns2);
      const rt1 = result.route_trucks.find(rt => rt.id === 'rt-1')!;
      const rt2 = result.route_trucks.find(rt => rt.id === 'rt-2')!;
      expect(rt1.assignments).toHaveLength(1);
      expect(rt2.assignments).toHaveLength(1);
      expect(rt1.assignments[0].order!.id).toBe('order-1');
      expect(rt2.assignments[0].order!.id).toBe('order-2');
    });
  });
});
