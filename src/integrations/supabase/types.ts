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
      admin_notification_logs: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          message: string | null
          notification_type: string
          recipient: string
          sent_via: string
          subject: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          notification_type: string
          recipient: string
          sent_via?: string
          subject?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          notification_type?: string
          recipient?: string
          sent_via?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_collection_logs: {
        Row: {
          client_id: string | null
          company_id: string
          completion_tokens: number | null
          created_at: string
          error_message: string | null
          generated_message: string | null
          id: string
          model_used: string | null
          payment_id: string | null
          prompt_tokens: number | null
          sent_successfully: boolean | null
          total_tokens: number | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          generated_message?: string | null
          id?: string
          model_used?: string | null
          payment_id?: string | null
          prompt_tokens?: number | null
          sent_successfully?: boolean | null
          total_tokens?: number | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          completion_tokens?: number | null
          created_at?: string
          error_message?: string | null
          generated_message?: string | null
          id?: string
          model_used?: string | null
          payment_id?: string | null
          prompt_tokens?: number | null
          sent_successfully?: boolean | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_collection_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_collection_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_collection_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_collection_settings: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          openai_model: string | null
          system_prompt: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          openai_model?: string | null
          system_prompt?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          openai_model?: string | null
          system_prompt?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_collection_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_weekly_reports: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          manager_phones: string[] | null
          schedule_day: number | null
          schedule_time: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          manager_phones?: string[] | null
          schedule_day?: number | null
          schedule_time?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          manager_phones?: string[] | null
          schedule_day?: number | null
          schedule_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_weekly_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_logs: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          operation_type: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_settings: {
        Row: {
          api_token_encrypted: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          last_test_at: string | null
          test_result: Json | null
          updated_at: string
          webhook_auth_token: string | null
          webhook_enabled: boolean | null
          webhook_events: Json | null
          webhook_id: string | null
          webhook_last_setup_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_token_encrypted: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_auth_token?: string | null
          webhook_enabled?: boolean | null
          webhook_events?: Json | null
          webhook_id?: string | null
          webhook_last_setup_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_token_encrypted?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_auth_token?: string | null
          webhook_enabled?: boolean | null
          webhook_events?: Json | null
          webhook_id?: string | null
          webhook_last_setup_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      assinafy_logs: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          error_message: string | null
          id: string
          operation_type: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinafy_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinafy_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      assinafy_settings: {
        Row: {
          api_token_encrypted: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          last_test_at: string | null
          test_result: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          api_token_encrypted: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          api_token_encrypted?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinafy_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_type: string | null
          balance: number | null
          bank_name: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          bank_name: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          bank_name?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_registration_vehicles: {
        Row: {
          created_at: string | null
          has_gnv: boolean | null
          id: string
          is_armored: boolean | null
          registration_id: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_id: string | null
          vehicle_model: string
          vehicle_plate: string
          vehicle_year: number
        }
        Insert: {
          created_at?: string | null
          has_gnv?: boolean | null
          id?: string
          is_armored?: boolean | null
          registration_id: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_id?: string | null
          vehicle_model: string
          vehicle_plate: string
          vehicle_year: number
        }
        Update: {
          created_at?: string | null
          has_gnv?: boolean | null
          id?: string
          is_armored?: boolean | null
          registration_id?: string
          vehicle_brand?: string
          vehicle_color?: string
          vehicle_id?: string | null
          vehicle_model?: string
          vehicle_plate?: string
          vehicle_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_registration_vehicles_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "client_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_registration_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_registrations: {
        Row: {
          birth_date: string
          cep: string
          city: string
          client_id: string | null
          company_id: string
          complement: string | null
          created_at: string
          document: string
          document_back_url: string | null
          document_front_url: string | null
          email: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          has_gnv: boolean | null
          id: string
          is_armored: boolean | null
          name: string
          neighborhood: string
          number: string
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          status: string | null
          street: string
          updated_at: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_id: string | null
          vehicle_model: string
          vehicle_plate: string
          vehicle_year: number
        }
        Insert: {
          birth_date: string
          cep: string
          city: string
          client_id?: string | null
          company_id: string
          complement?: string | null
          created_at?: string
          document: string
          document_back_url?: string | null
          document_front_url?: string | null
          email?: string | null
          emergency_contact_name: string
          emergency_contact_phone: string
          emergency_contact_relationship: string
          has_gnv?: boolean | null
          id?: string
          is_armored?: boolean | null
          name: string
          neighborhood: string
          number: string
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state: string
          status?: string | null
          street: string
          updated_at?: string
          vehicle_brand: string
          vehicle_color: string
          vehicle_id?: string | null
          vehicle_model: string
          vehicle_plate: string
          vehicle_year: number
        }
        Update: {
          birth_date?: string
          cep?: string
          city?: string
          client_id?: string | null
          company_id?: string
          complement?: string | null
          created_at?: string
          document?: string
          document_back_url?: string | null
          document_front_url?: string | null
          email?: string | null
          emergency_contact_name?: string
          emergency_contact_phone?: string
          emergency_contact_relationship?: string
          has_gnv?: boolean | null
          id?: string
          is_armored?: boolean | null
          name?: string
          neighborhood?: string
          number?: string
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          status?: string | null
          street?: string
          updated_at?: string
          vehicle_brand?: string
          vehicle_color?: string
          vehicle_id?: string | null
          vehicle_model?: string
          vehicle_plate?: string
          vehicle_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_registrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_registrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_registrations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_scores: {
        Row: {
          avg_days_late: number | null
          client_id: string
          company_id: string
          created_at: string | null
          id: string
          last_calculated_at: string | null
          max_days_late: number | null
          overdue_count: number | null
          paid_late: number | null
          paid_on_time: number | null
          score: number
          total_payments: number | null
          updated_at: string | null
        }
        Insert: {
          avg_days_late?: number | null
          client_id: string
          company_id: string
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          max_days_late?: number | null
          overdue_count?: number | null
          paid_late?: number | null
          paid_on_time?: number | null
          score?: number
          total_payments?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_days_late?: number | null
          client_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          max_days_late?: number | null
          overdue_count?: number | null
          paid_late?: number | null
          paid_on_time?: number | null
          score?: number
          total_payments?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          company_id: string
          complement: string | null
          created_at: string
          document: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          id: string
          name: string
          neighborhood: string | null
          number: string | null
          phone: string
          state: string | null
          status: string | null
          street: string | null
          updated_at: string
          whatsapp_block_reason: string | null
          whatsapp_blocked: boolean | null
          whatsapp_failures: number | null
          whatsapp_opt_out: boolean | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          company_id: string
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          number?: string | null
          phone: string
          state?: string | null
          status?: string | null
          street?: string | null
          updated_at?: string
          whatsapp_block_reason?: string | null
          whatsapp_blocked?: boolean | null
          whatsapp_failures?: number | null
          whatsapp_opt_out?: boolean | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          company_id?: string
          complement?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string
          state?: string | null
          status?: string | null
          street?: string | null
          updated_at?: string
          whatsapp_block_reason?: string | null
          whatsapp_blocked?: boolean | null
          whatsapp_failures?: number | null
          whatsapp_opt_out?: boolean | null
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
          cnpj: string | null
          created_at: string
          domain: string | null
          email: string | null
          encryption_key: string
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
          cnpj?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          encryption_key?: string
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
          cnpj?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          encryption_key?: string
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
      company_activity_logs: {
        Row: {
          activity_type: string
          company_id: string
          created_at: string
          description: string
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_branding: {
        Row: {
          company_id: string
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          privacy_policy: string | null
          secondary_color: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          subdomain: string | null
          terms_of_service: string | null
          theme_mode: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          privacy_policy?: string | null
          secondary_color?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          subdomain?: string | null
          terms_of_service?: string | null
          theme_mode?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          privacy_policy?: string | null
          secondary_color?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          subdomain?: string | null
          terms_of_service?: string | null
          theme_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_branding_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_credentials: {
        Row: {
          company_id: string
          created_at: string
          id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_late_fee_settings: {
        Row: {
          company_id: string
          created_at: string | null
          fine_enabled: boolean | null
          fine_type: string | null
          fine_value: number | null
          grace_days: number | null
          id: string
          interest_enabled: boolean | null
          interest_type: string | null
          interest_value: number | null
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          fine_enabled?: boolean | null
          fine_type?: string | null
          fine_value?: number | null
          grace_days?: number | null
          id?: string
          interest_enabled?: boolean | null
          interest_type?: string | null
          interest_value?: number | null
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          fine_enabled?: boolean | null
          fine_type?: string | null
          fine_value?: number | null
          grace_days?: number | null
          id?: string
          interest_enabled?: boolean | null
          interest_type?: string | null
          interest_value?: number | null
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_late_fee_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_limits: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          max_api_calls_per_day: number | null
          max_messages_per_month: number | null
          max_storage_mb: number | null
          max_users: number | null
          max_vehicles: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_api_calls_per_day?: number | null
          max_messages_per_month?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_vehicles?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_api_calls_per_day?: number | null
          max_messages_per_month?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_vehicles?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          auto_renew: boolean
          company_id: string
          created_at: string
          ends_at: string | null
          id: string
          plan_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          company_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          company_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_vehicles: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          vehicle_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          vehicle_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_vehicles_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_vehicles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          assinafy_document_id: string | null
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
          assinafy_document_id?: string | null
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
          assinafy_document_id?: string | null
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
      cron_execution_logs: {
        Row: {
          error_message: string | null
          execution_time_ms: number | null
          finished_at: string | null
          id: string
          job_name: string
          response_body: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          job_name: string
          response_body?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          job_name?: string
          response_body?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          company_id: string
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          category_id: string | null
          company_id: string
          created_at: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          recurrence_parent_id: string | null
          recurrence_type: string | null
          status: string | null
          supplier_name: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          status?: string | null
          supplier_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      gerencianet_logs: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          operation_type: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gerencianet_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gerencianet_settings: {
        Row: {
          client_id_encrypted: string
          client_secret_encrypted: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          last_test_at: string | null
          test_result: Json | null
          updated_at: string
          webhook_token: string | null
          webhook_url: string | null
        }
        Insert: {
          client_id_encrypted: string
          client_secret_encrypted: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          client_id_encrypted?: string
          client_secret_encrypted?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gerencianet_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_logs: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          operation_type: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_settings: {
        Row: {
          certificate_base64: string | null
          client_id_encrypted: string
          client_secret_encrypted: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          last_test_at: string | null
          test_result: Json | null
          updated_at: string
          webhook_enabled: boolean | null
          webhook_url: string | null
        }
        Insert: {
          certificate_base64?: string | null
          client_id_encrypted: string
          client_secret_encrypted: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_enabled?: boolean | null
          webhook_url?: string | null
        }
        Update: {
          certificate_base64?: string | null
          client_id_encrypted?: string
          client_secret_encrypted?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_enabled?: boolean | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inter_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
      mercadopago_logs: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          operation_type: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercadopago_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_settings: {
        Row: {
          access_token_encrypted: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_sandbox: boolean
          last_test_at: string | null
          test_result: Json | null
          updated_at: string
          webhook_enabled: boolean | null
          webhook_url: string | null
        }
        Insert: {
          access_token_encrypted: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_enabled?: boolean | null
          webhook_url?: string | null
        }
        Update: {
          access_token_encrypted?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_sandbox?: boolean
          last_test_at?: string | null
          test_result?: Json | null
          updated_at?: string
          webhook_enabled?: boolean | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercadopago_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
        Relationships: [
          {
            foreignKeyName: "message_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_methods: {
        Row: {
          company_id: string
          created_at: string
          gateway_type: string
          id: string
          is_active: boolean
          payment_method: string
          priority: number
          settings: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gateway_type: string
          id?: string
          is_active?: boolean
          payment_method: string
          priority?: number
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gateway_type?: string
          id?: string
          is_active?: boolean
          payment_method?: string
          priority?: number
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notification_settings: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          on_due: boolean
          on_paid: boolean
          post_due_days: number[]
          pre_due_days: number[]
          send_hour: string
          template_on_due: string
          template_post_due: string
          template_pre_due: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          on_due?: boolean
          on_paid?: boolean
          post_due_days?: number[]
          pre_due_days?: number[]
          send_hour?: string
          template_on_due?: string
          template_post_due?: string
          template_pre_due?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          on_due?: boolean
          on_paid?: boolean
          post_due_days?: number[]
          pre_due_days?: number[]
          send_hour?: string
          template_on_due?: string
          template_post_due?: string
          template_pre_due?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_notification_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notifications: {
        Row: {
          attempts: number
          client_id: string
          company_id: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          message_body: string | null
          offset_days: number
          payment_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_id: string
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          message_body?: string | null
          offset_days: number
          payment_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_id?: string
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          message_body?: string | null
          offset_days?: number
          payment_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          barcode: string | null
          client_id: string
          company_id: string
          contract_id: string | null
          created_at: string
          days_overdue: number | null
          description: string | null
          due_date: string | null
          external_id: string | null
          fine_amount: number | null
          id: string
          interest_amount: number | null
          invoice_id: string | null
          original_amount: number | null
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
          days_overdue?: number | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          invoice_id?: string | null
          original_amount?: number | null
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
          days_overdue?: number | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          fine_amount?: number | null
          id?: string
          interest_amount?: number | null
          invoice_id?: string | null
          original_amount?: number | null
          paid_at?: string | null
          payment_gateway?: string | null
          payment_url?: string | null
          pix_code?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
      reengagement_email_logs: {
        Row: {
          admin_name: string | null
          clicked_at: string | null
          company_id: string
          email: string
          error_message: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string
          template_type: string
        }
        Insert: {
          admin_name?: string | null
          clicked_at?: string | null
          company_id: string
          email: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          template_type?: string
        }
        Update: {
          admin_name?: string | null
          clicked_at?: string | null
          company_id?: string
          email?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          template_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reengagement_email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reminders: {
        Row: {
          action_type: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          manager_phone: string
          metadata: Json | null
          reminder_text: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          manager_phone: string
          metadata?: Json | null
          reminder_text: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          manager_phone?: string
          metadata?: Json | null
          reminder_text?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_api_calls_per_day: number | null
          max_messages_per_month: number | null
          max_storage_mb: number | null
          max_users: number | null
          max_vehicles: number | null
          name: string
          price_monthly: number
          price_yearly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_api_calls_per_day?: number | null
          max_messages_per_month?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_vehicles?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_api_calls_per_day?: number | null
          max_messages_per_month?: number | null
          max_storage_mb?: number | null
          max_users?: number | null
          max_vehicles?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          company_id: string
          created_at: string
          dismissed_at: string | null
          id: string
          message: string
          severity: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message: string
          severity?: string
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string
          severity?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          chassis: string | null
          client_id: string
          color: string
          company_id: string
          created_at: string
          has_gnv: boolean | null
          id: string
          installation_date: string | null
          is_active: boolean
          is_armored: boolean | null
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
          has_gnv?: boolean | null
          id?: string
          installation_date?: string | null
          is_active?: boolean
          is_armored?: boolean | null
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
          has_gnv?: boolean | null
          id?: string
          installation_date?: string | null
          is_active?: boolean
          is_armored?: boolean | null
          license_plate?: string
          model?: string
          notes?: string | null
          tracker_device_id?: string | null
          tracker_status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          response_data: Json | null
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
          response_data?: Json | null
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
          response_data?: Json | null
          sent_at?: string
          status?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrypt_asaas_token: {
        Args: { p_encrypted_token: string }
        Returns: string
      }
      decrypt_assinafy_token: {
        Args: { p_encrypted_token: string }
        Returns: string
      }
      decrypt_gerencianet_credential: {
        Args: { p_encrypted_credential: string }
        Returns: string
      }
      decrypt_inter_credential: {
        Args: { p_encrypted_credential: string }
        Returns: string
      }
      decrypt_mercadopago_credential:
        | {
            Args: { p_company_id: string; p_encrypted_credential: string }
            Returns: string
          }
        | { Args: { p_encrypted_credential: string }; Returns: string }
      decrypt_whatsapp_token: {
        Args: { p_encrypted_token: string }
        Returns: string
      }
      encrypt_asaas_token: { Args: { p_token: string }; Returns: string }
      encrypt_assinafy_token: { Args: { p_token: string }; Returns: string }
      encrypt_gerencianet_credential: {
        Args: { p_credential: string }
        Returns: string
      }
      encrypt_inter_credential: {
        Args: { p_credential: string }
        Returns: string
      }
      encrypt_mercadopago_credential:
        | {
            Args: { p_company_id: string; p_credential: string }
            Returns: string
          }
        | { Args: { p_credential: string }; Returns: string }
      encrypt_whatsapp_token: { Args: { p_token: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
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
      app_role: ["user", "admin", "super_admin"],
    },
  },
} as const
