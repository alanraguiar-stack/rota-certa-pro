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
}

export interface RouteTruck {
  id: string;
  route_id: string;
  truck_id: string;
  total_weight_kg: number;
  total_orders: number;
  estimated_distance_km: number | null;
  estimated_time_minutes: number | null;
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
