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
      alerts: {
        Row: {
          company_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          message: string
          metadata: Json | null
          resolved: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          resolved?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          resolved?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_connections: {
        Row: {
          access_token: string | null
          api_key: string | null
          api_secret: string | null
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          api_secret?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          api_secret?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      backup_history: {
        Row: {
          backup_type: string
          company_id: string
          completed_at: string | null
          error_message: string | null
          id: string
          row_counts: Json | null
          started_at: string
          status: string
          tables_backed_up: string[]
        }
        Insert: {
          backup_type?: string
          company_id: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          row_counts?: Json | null
          started_at?: string
          status?: string
          tables_backed_up?: string[]
        }
        Update: {
          backup_type?: string
          company_id?: string
          completed_at?: string | null
          error_message?: string | null
          id?: string
          row_counts?: Json | null
          started_at?: string
          status?: string
          tables_backed_up?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "backup_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          company_id: string | null
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          keywords: string[] | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          keywords?: string[] | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          keywords?: string[] | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
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
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      export_history: {
        Row: {
          company_id: string | null
          created_at: string
          export_type: string
          file_name: string
          format: string
          id: string
          period_end: string | null
          period_start: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          export_type: string
          file_name: string
          format: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          export_type?: string
          file_name?: string
          format?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          company_id: string | null
          created_at: string
          error_details: Json | null
          file_name: string
          id: string
          rows_failed: number | null
          rows_imported: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          error_details?: Json | null
          file_name: string
          id?: string
          rows_failed?: number | null
          rows_imported?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          error_details?: Json | null
          file_name?: string
          id?: string
          rows_failed?: number | null
          rows_imported?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
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
      subscriptions: {
        Row: {
          company_id: string
          created_at: string
          data_ativacao: string
          data_renovacao: string
          id: string
          plano: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          company_id: string
          created_at?: string
          data_ativacao?: string
          data_renovacao?: string
          id?: string
          plano?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          data_ativacao?: string
          data_renovacao?: string
          id?: string
          plano?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_events: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          company_id: string | null
          created_at: string
          endpoint: string | null
          id: string
          message: string
          metadata: Json | null
          type: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          endpoint?: string | null
          id?: string
          message: string
          metadata?: Json | null
          type?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          endpoint?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string
          id: string
          notes: string | null
          origin: string | null
          product_cost: number | null
          profit: number | null
          source: string | null
          subcategory: string | null
          tax_amount: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description: string
          id?: string
          notes?: string | null
          origin?: string | null
          product_cost?: number | null
          profit?: number | null
          source?: string | null
          subcategory?: string | null
          tax_amount?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string
          id?: string
          notes?: string | null
          origin?: string | null
          product_cost?: number | null
          profit?: number | null
          source?: string | null
          subcategory?: string | null
          tax_amount?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          max_expense_goal: number | null
          monthly_revenue_goal: number | null
          sync_frequency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          max_expense_goal?: number | null
          monthly_revenue_goal?: number | null
          sync_frequency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          max_expense_goal?: number | null
          monthly_revenue_goal?: number | null
          sync_frequency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_connections_decrypted: {
        Row: {
          access_token: string | null
          api_key: string | null
          api_secret: string | null
          company_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_sync_at: string | null
          platform: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: never
          api_key?: never
          api_secret?: never
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          platform?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: never
          api_key?: never
          api_secret?: never
          company_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          platform?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_safe: {
        Row: {
          amount: number | null
          category_id: string | null
          company_id: string | null
          created_at: string | null
          date: string | null
          description: string | null
          id: string | null
          notes: string | null
          origin: string | null
          product_cost: number | null
          profit: number | null
          source: string | null
          subcategory: string | null
          tax_amount: number | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string | null
          notes?: string | null
          origin?: string | null
          product_cost?: never
          profit?: never
          source?: string | null
          subcategory?: string | null
          tax_amount?: never
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          category_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string | null
          notes?: string | null
          origin?: string | null
          product_cost?: never
          profit?: never
          source?: string | null
          subcategory?: string | null
          tax_amount?: never
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bootstrap_user_company: {
        Args: {
          company_address?: string
          company_document: string
          company_email?: string
          company_name: string
          company_phone?: string
          profile_full_name?: string
        }
        Returns: string
      }
      check_duplicate_transactions: {
        Args: { p_company_id: string }
        Returns: {
          amount: number
          date: string
          description: string
          duplicate_of: string
          similarity_score: number
          transaction_id: string
        }[]
      }
      decrypt_api_credential: {
        Args: { p_ciphertext: string; p_user_id: string }
        Returns: string
      }
      encrypt_api_credential: {
        Args: { p_plaintext: string; p_user_id: string }
        Returns: string
      }
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_company_admin: { Args: { _company_id: string }; Returns: boolean }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      is_subscription_active: {
        Args: { _company_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_new_data?: Json
          p_old_data?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      log_auth_event: {
        Args: { p_action: string; p_metadata?: Json }
        Returns: string
      }
      validate_user_company_access: {
        Args: { p_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "financeiro" | "leitura"
      subscription_status: "ativo" | "suspenso" | "cancelado"
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
      app_role: ["admin", "financeiro", "leitura"],
      subscription_status: ["ativo", "suspenso", "cancelado"],
    },
  },
} as const
