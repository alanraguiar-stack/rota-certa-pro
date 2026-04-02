export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      city_delivery_schedule: {
        Row: {
          city_name: string
          created_at: string | null
          day_of_week: number
          id: string
          user_id: string
        }
        Insert: {
          city_name: string
          created_at?: string | null
          day_of_week: number
          id?: string
          user_id: string
        }
        Update: {
          city_name?: string
          created_at?: string | null
          day_of_week?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_executions: {
        Row: {
          created_at: string
          delivered_at: string | null
          driver_assignment_id: string
          id: string
          observations: string | null
          order_id: string
          photo_url: string | null
          signature_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          driver_assignment_id: string
          id?: string
          observations?: string | null
          order_id: string
          photo_url?: string | null
          signature_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          driver_assignment_id?: string
          id?: string
          observations?: string | null
          order_id?: string
          photo_url?: string | null
          signature_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_executions_driver_assignment_id_fkey"
            columns: ["driver_assignment_id"]
            isOneToOne: false
            referencedRelation: "driver_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_executions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_access_codes: {
        Row: {
          access_code: string
          created_at: string
          driver_password: string
          id: string
          user_id: string
        }
        Insert: {
          access_code: string
          created_at?: string
          driver_password: string
          id?: string
          user_id: string
        }
        Update: {
          access_code?: string
          created_at?: string
          driver_password?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_assignments: {
        Row: {
          created_at: string
          driver_user_id: string
          finished_at: string | null
          id: string
          route_truck_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          driver_user_id: string
          finished_at?: string | null
          id?: string
          route_truck_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          driver_user_id?: string
          finished_at?: string | null
          id?: string
          route_truck_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignments_route_truck_id_fkey"
            columns: ["route_truck_id"]
            isOneToOne: true
            referencedRelation: "route_trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_decision_history: {
        Row: {
          cities: string[]
          city_count: number
          created_at: string
          id: string
          route_id: string | null
          routing_strategy: string | null
          total_orders: number
          total_weight: number
          truck_plates: string[]
          trucks_selected: number
          user_id: string
        }
        Insert: {
          cities?: string[]
          city_count?: number
          created_at?: string
          id?: string
          route_id?: string | null
          routing_strategy?: string | null
          total_orders: number
          total_weight: number
          truck_plates?: string[]
          trucks_selected: number
          user_id: string
        }
        Update: {
          cities?: string[]
          city_count?: number
          created_at?: string
          id?: string
          route_id?: string | null
          routing_strategy?: string | null
          total_orders?: number
          total_weight?: number
          truck_plates?: string[]
          trucks_selected?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_decision_history_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      geocoding_cache: {
        Row: {
          address_hash: string
          confidence: string | null
          created_at: string | null
          display_name: string | null
          id: string
          latitude: number
          longitude: number
          original_address: string
        }
        Insert: {
          address_hash: string
          confidence?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          latitude: number
          longitude: number
          original_address: string
        }
        Update: {
          address_hash?: string
          confidence?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          latitude?: number
          longitude?: number
          original_address?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          id: string
          ip_address: string
        }
        Insert: {
          attempt_type?: string
          created_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          attempt_type?: string
          created_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      order_assignments: {
        Row: {
          created_at: string
          delivery_sequence: number
          id: string
          order_id: string
          route_truck_id: string
        }
        Insert: {
          created_at?: string
          delivery_sequence?: number
          id?: string
          order_id: string
          route_truck_id: string
        }
        Update: {
          created_at?: string
          delivery_sequence?: number
          id?: string
          order_id?: string
          route_truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_assignments_route_truck_id_fkey"
            columns: ["route_truck_id"]
            isOneToOne: false
            referencedRelation: "route_trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_name: string
          quantity: number
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          quantity?: number
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          city: string | null
          client_name: string
          created_at: string
          geocoding_status: string | null
          id: string
          latitude: number | null
          longitude: number | null
          product_description: string | null
          route_id: string
          sequence_order: number | null
          weight_kg: number
        }
        Insert: {
          address: string
          city?: string | null
          client_name: string
          created_at?: string
          geocoding_status?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          product_description?: string | null
          route_id: string
          sequence_order?: number | null
          weight_kg: number
        }
        Update: {
          address?: string
          city?: string | null
          client_name?: string
          created_at?: string
          geocoding_status?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          product_description?: string | null
          route_id?: string
          sequence_order?: number | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_orders: {
        Row: {
          address: string
          city: string
          client_name: string
          created_at: string | null
          id: string
          original_upload_date: string
          pedido_id: string | null
          product_description: string | null
          route_id: string | null
          routed_at: string | null
          status: string
          target_day_of_week: number | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          address: string
          city: string
          client_name: string
          created_at?: string | null
          id?: string
          original_upload_date?: string
          pedido_id?: string | null
          product_description?: string | null
          route_id?: string | null
          routed_at?: string | null
          status?: string
          target_day_of_week?: number | null
          user_id: string
          weight_kg?: number
        }
        Update: {
          address?: string
          city?: string
          client_name?: string
          created_at?: string | null
          id?: string
          original_upload_date?: string
          pedido_id?: string | null
          product_description?: string | null
          route_id?: string | null
          routed_at?: string | null
          status?: string
          target_day_of_week?: number | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      product_units: {
        Row: {
          created_at: string | null
          id: string
          product_name: string
          unit_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_name: string
          unit_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_name?: string
          unit_type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_delivery_time_minutes: number | null
          full_name: string | null
          id: string
          is_active: boolean | null
          return_to_cd_required: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_delivery_time_minutes?: number | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          return_to_cd_required?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_delivery_time_minutes?: number | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          return_to_cd_required?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      route_history_patterns: {
        Row: {
          address: string | null
          city: string | null
          client_name: string | null
          created_at: string
          id: string
          neighborhood: string | null
          route_date: string | null
          sale_number: string | null
          sequence_order: number | null
          state: string | null
          truck_label: string
          user_id: string
          was_manually_moved: boolean
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          neighborhood?: string | null
          route_date?: string | null
          sale_number?: string | null
          sequence_order?: number | null
          state?: string | null
          truck_label: string
          user_id: string
          was_manually_moved?: boolean
        }
        Update: {
          address?: string | null
          city?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          neighborhood?: string | null
          route_date?: string | null
          sale_number?: string | null
          sequence_order?: number | null
          state?: string | null
          truck_label?: string
          user_id?: string
          was_manually_moved?: boolean
        }
        Relationships: []
      }
      route_trucks: {
        Row: {
          created_at: string
          delivery_time_minutes: number | null
          departure_date: string | null
          departure_time: string | null
          estimated_distance_km: number | null
          estimated_last_delivery_time: string | null
          estimated_return_time: string | null
          estimated_time_minutes: number | null
          id: string
          route_id: string
          total_orders: number
          total_weight_kg: number
          truck_id: string
        }
        Insert: {
          created_at?: string
          delivery_time_minutes?: number | null
          departure_date?: string | null
          departure_time?: string | null
          estimated_distance_km?: number | null
          estimated_last_delivery_time?: string | null
          estimated_return_time?: string | null
          estimated_time_minutes?: number | null
          id?: string
          route_id: string
          total_orders?: number
          total_weight_kg?: number
          truck_id: string
        }
        Update: {
          created_at?: string
          delivery_time_minutes?: number | null
          departure_date?: string | null
          departure_time?: string | null
          estimated_distance_km?: number | null
          estimated_last_delivery_time?: string | null
          estimated_return_time?: string | null
          estimated_time_minutes?: number | null
          id?: string
          route_id?: string
          total_orders?: number
          total_weight_kg?: number
          truck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_trucks_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trucks_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          id: string
          loading_confirmed_at: string | null
          loading_confirmed_by: string | null
          name: string
          status: string
          total_orders: number
          total_weight_kg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loading_confirmed_at?: string | null
          loading_confirmed_by?: string | null
          name: string
          status?: string
          total_orders?: number
          total_weight_kg?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loading_confirmed_at?: string | null
          loading_confirmed_by?: string | null
          name?: string
          status?: string
          total_orders?: number
          total_weight_kg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      territory_overrides: {
        Row: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          occurrences: number
          override_type: string
          territory_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_active?: boolean
          occurrences?: number
          override_type?: string
          territory_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          occurrences?: number
          override_type?: string
          territory_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      truck_territories: {
        Row: {
          anchor_city: string
          created_at: string | null
          fill_cities: string[]
          id: string
          is_support: boolean
          max_deliveries: number
          priority: number
          truck_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anchor_city?: string
          created_at?: string | null
          fill_cities?: string[]
          id?: string
          is_support?: boolean
          max_deliveries?: number
          priority?: number
          truck_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anchor_city?: string
          created_at?: string | null
          fill_cities?: string[]
          id?: string
          is_support?: boolean
          max_deliveries?: number
          priority?: number
          truck_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_territories_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          ano: number | null
          capacity_kg: number
          created_at: string
          id: string
          is_active: boolean
          marca: string | null
          max_deliveries: number | null
          model: string
          observacoes: string | null
          plate: string
          renavam: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano?: number | null
          capacity_kg: number
          created_at?: string
          id?: string
          is_active?: boolean
          marca?: string | null
          max_deliveries?: number | null
          model: string
          observacoes?: string | null
          plate: string
          renavam?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number | null
          capacity_kg?: number
          created_at?: string
          id?: string
          is_active?: boolean
          marca?: string | null
          max_deliveries?: number | null
          model?: string
          observacoes?: string | null
          plate?: string
          renavam?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operacional" | "motorista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operacional", "motorista"],
    },
  },
} as const
