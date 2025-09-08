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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          domain: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          autentique_document_id: string | null
          client_id: string
          company_id: string
          contract_type: string | null
          created_at: string
          document_url: string | null
          end_date: string | null
          id: string
          monthly_value: number
          plan_id: string
          signature_status: string | null
          signed_at: string | null
          start_date: string
          status: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          autentique_document_id?: string | null
          client_id: string
          company_id: string
          contract_type?: string | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          monthly_value: number
          plan_id: string
          signature_status?: string | null
          signed_at?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          autentique_document_id?: string | null
          client_id?: string
          company_id?: string
          contract_type?: string | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          monthly_value?: number
          plan_id?: string
          signature_status?: string | null
          signed_at?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          company_id: string
          contract_id: string
          created_at: string
          due_date: string
          external_id: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          payment_method: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          company_id: string
          contract_id: string
          created_at?: string
          due_date: string
          external_id?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          company_id?: string
          contract_id?: string
          created_at?: string
          due_date?: string
          external_id?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string | null
          template_type: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          template_type: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          template_type?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          barcode: string | null
          client_id: string
          company_id: string
          contract_id: string | null
          created_at: string
          due_date: string | null
          external_id: string | null
          id: string
          invoice_id: string | null
          paid_at: string | null
          payment_gateway: string | null
          payment_url: string | null
          pix_code: string | null
          status: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          barcode?: string | null
          client_id: string
          company_id: string
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_url?: string | null
          pix_code?: string | null
          status?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          barcode?: string | null
          client_id?: string
          company_id?: string
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          external_id?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_url?: string | null
          pix_code?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_cycle: string | null
          company_id: string
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string
          chassis: string | null
          client_id: string
          color: string
          company_id: string
          created_at: string
          id: string
          installation_date: string | null
          is_active: boolean
          license_plate: string
          model: string
          notes: string | null
          tracker_device_id: string | null
          tracker_status: string
          updated_at: string
          year: number
        }
        Insert: {
          brand: string
          chassis?: string | null
          client_id: string
          color: string
          company_id: string
          created_at?: string
          id?: string
          installation_date?: string | null
          is_active?: boolean
          license_plate: string
          model: string
          notes?: string | null
          tracker_device_id?: string | null
          tracker_status?: string
          updated_at?: string
          year: number
        }
        Update: {
          brand?: string
          chassis?: string | null
          client_id?: string
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          installation_date?: string | null
          is_active?: boolean
          license_plate?: string
          model?: string
          notes?: string | null
          tracker_device_id?: string | null
          tracker_status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          external_message_id: string | null
          id: string
          message_content: string
          message_type: string
          phone_number: string
          read_at: string | null
          sent_at: string
          status: string
          template_name: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_content: string
          message_type: string
          phone_number: string
          read_at?: string | null
          sent_at?: string
          status?: string
          template_name?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_content?: string
          message_type?: string
          phone_number?: string
          read_at?: string | null
          sent_at?: string
          status?: string
          template_name?: string | null
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          instance_name: string
          qr_code: string | null
          session_id: string
          status: string
          token: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_name: string
          qr_code?: string | null
          session_id: string
          status?: string
          token?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_name?: string
          qr_code?: string | null
          session_id?: string
          status?: string
          token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          api_token: string
          company_id: string
          connection_status: string
          created_at: string
          enable_delivery_status: boolean
          enable_logs: boolean
          id: string
          instance_name: string
          instance_url: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          api_token: string
          company_id: string
          connection_status?: string
          created_at?: string
          enable_delivery_status?: boolean
          enable_logs?: boolean
          id?: string
          instance_name: string
          instance_url: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          api_token?: string
          company_id?: string
          connection_status?: string
          created_at?: string
          enable_delivery_status?: boolean
          enable_logs?: boolean
          id?: string
          instance_name?: string
          instance_url?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_whatsapp_token: {
        Args: { p_encrypted_token: string }
        Returns: string
      }
      encrypt_whatsapp_token: {
        Args: { p_token: string }
        Returns: string
      }
      maintain_whatsapp_connection: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      validate_whatsapp_session: {
        Args: { p_company_id: string }
        Returns: {
          instance_name: string
          is_valid: boolean
          message: string
          session_status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
