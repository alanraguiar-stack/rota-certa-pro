// Distribution Center address
export const DISTRIBUTION_CENTER = {
  address: 'Av. Iracema, 939 - Jardim Iracema, Barueri - SP, 06440-010',
  name: 'Centro de Distribuição',
} as const;

// Routing strategy types
export type RoutingStrategy = 
  | 'economy'      // Menor distância total
  | 'speed'        // Menor tempo de entrega
  | 'end_near_cd'  // Terminar próximo ao CD
  | 'start_far'    // Iniciar longe, terminar perto
  | 'start_near';  // Iniciar perto, terminar longe

export interface RoutingStrategyOption {
  id: RoutingStrategy;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const ROUTING_STRATEGIES: RoutingStrategyOption[] = [
  {
    id: 'economy',
    name: 'Economia',
    description: 'Menor distância total para economizar combustível',
    icon: 'Fuel',
    color: 'route-economy',
  },
  {
    id: 'speed',
    name: 'Velocidade',
    description: 'Menor tempo total de entrega',
    icon: 'Clock',
    color: 'route-speed',
  },
  {
    id: 'end_near_cd',
    name: 'Finalizar no CD',
    description: 'Terminar a rota próximo ao Centro de Distribuição',
    icon: 'Home',
    color: 'route-balanced',
  },
  {
    id: 'start_far',
    name: 'Longe → Perto',
    description: 'Começar longe do CD e retornar gradualmente',
    icon: 'ArrowDownLeft',
    color: 'route-end-near',
  },
  {
    id: 'start_near',
    name: 'Perto → Longe',
    description: 'Começar próximo ao CD e ir se afastando',
    icon: 'ArrowUpRight',
    color: 'route-start-near',
  },
];

// Fleet recommendation types
export interface FleetRecommendation {
  trucks: Truck[];
  totalCapacity: number;
  utilizationPercent: number;
  score: number;
  reason: string;
}

// Step/wizard types
export type RouteWizardStep = 
  | 'orders'       // 1. Input de pedidos
  | 'validation'   // 2. Validação do peso total
  | 'fleet'        // 3. Recomendação de frota
  | 'strategy'     // 4. Modo de roteirização
  | 'distribution' // 5. Visualização e ajustes
  | 'manifest';    // 6. Geração de romaneio

export interface WizardStepConfig {
  id: RouteWizardStep;
  number: number;
  title: string;
  description: string;
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  { id: 'orders', number: 1, title: 'Pedidos', description: 'Inserir pedidos' },
  { id: 'validation', number: 2, title: 'Validação', description: 'Confirmar peso total' },
  { id: 'fleet', number: 3, title: 'Frota', description: 'Selecionar caminhões' },
  { id: 'strategy', number: 4, title: 'Estratégia', description: 'Modo de roteirização' },
  { id: 'distribution', number: 5, title: 'Distribuição', description: 'Visualizar rotas' },
  { id: 'manifest', number: 6, title: 'Romaneio', description: 'Gerar documentos' },
];

// Base entity types
export interface Truck {
  id: string;
  user_id: string;
  plate: string;
  model: string;
  capacity_kg: number;
  max_deliveries: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  user_id: string;
  name: string;
  total_weight_kg: number;
  total_orders: number;
  status: 'draft' | 'planned' | 'completed';
  routing_strategy?: RoutingStrategy;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  route_id: string;
  client_name: string;
  address: string;
  weight_kg: number;
  sequence_order: number | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  geocoding_status?: string | null;
}

export interface RouteTruck {
  id: string;
  route_id: string;
  truck_id: string;
  total_weight_kg: number;
  total_orders: number;
  estimated_distance_km: number | null;
  estimated_time_minutes: number | null;
  departure_time: string | null;
  departure_date: string | null;
  estimated_last_delivery_time: string | null;
  estimated_return_time: string | null;
  delivery_time_minutes: number;
  created_at: string;
  truck?: Truck;
}

export interface OrderAssignment {
  id: string;
  order_id: string;
  route_truck_id: string;
  delivery_sequence: number;
  created_at: string;
  order?: Order;
}

export interface TruckWithAssignments extends RouteTruck {
  truck: Truck;
  assignments: OrderAssignment[];
  occupancy_percent: number;
}

export interface RouteWithDetails extends Route {
  orders: Order[];
  route_trucks: TruckWithAssignments[];
}

// Form types
export interface TruckFormData {
  plate: string;
  model: string;
  capacity_kg: number;
  max_deliveries?: number;
}

export interface OrderFormData {
  client_name: string;
  address: string;
  weight_kg: number;
}

export interface ParsedOrder {
  client_name: string;
  address: string;
  weight_kg: number;
  isValid: boolean;
  error?: string;
}

// Distribution algorithm types
export interface DistributionConfig {
  strategy: RoutingStrategy;
  balanceWeight: boolean;
  balanceOrders: boolean;
  maxOrdersPerTruck?: number;
}

export interface TruckDistribution {
  truckId: string;
  routeTruckId: string;
  capacity: number;
  currentWeight: number;
  orderCount: number;
  orders: Array<{
    orderId: string;
    weight: number;
    sequence: number;
  }>;
  occupancyPercent: number;
}
