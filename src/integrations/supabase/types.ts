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
      trucks: {
        Row: {
          capacity_kg: number
          created_at: string
          id: string
          is_active: boolean
          max_deliveries: number | null
          model: string
          plate: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity_kg: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_deliveries?: number | null
          model: string
          plate: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity_kg?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_deliveries?: number | null
          model?: string
          plate?: string
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
      app_role: "admin" | "operacional"
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
      app_role: ["admin", "operacional"],
    },
  },
} as const
