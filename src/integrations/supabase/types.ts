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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      broadcast_list_contacts: {
        Row: {
          added_at: string
          contact_id: string
          id: string
          list_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          id?: string
          list_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_list_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "broadcast_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_lists: {
        Row: {
          created_at: string
          description: string | null
          filter_criteria: Json | null
          id: string
          name: string
          type: Database["public"]["Enums"]["broadcast_list_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["broadcast_list_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["broadcast_list_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcast_sends: {
        Row: {
          completed_at: string | null
          delivered: number
          failed: number
          id: string
          list_id: string
          message: string
          sent_at: string
          status: string
          total_contacts: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          delivered?: number
          failed?: number
          id?: string
          list_id: string
          message: string
          sent_at?: string
          status?: string
          total_contacts?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          delivered?: number
          failed?: number
          id?: string
          list_id?: string
          message?: string
          sent_at?: string
          status?: string
          total_contacts?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_sends_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "broadcast_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          contact_id: string
          contact_name: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          message_content: string
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          contact_name?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          contact_name?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          allowed_days: string[] | null
          allowed_end_hour: number | null
          allowed_start_hour: number | null
          completed_at: string | null
          created_at: string
          daily_limit: number | null
          delivered: number
          failed: number
          id: string
          instance_id: string | null
          instance_ids: string[] | null
          list_id: string | null
          message_interval_max: number | null
          message_interval_min: number | null
          name: string
          scheduled_at: string | null
          sending_mode: string | null
          sent: number
          started_at: string | null
          status: string
          template_id: string | null
          timezone: string | null
          total_contacts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_days?: string[] | null
          allowed_end_hour?: number | null
          allowed_start_hour?: number | null
          completed_at?: string | null
          created_at?: string
          daily_limit?: number | null
          delivered?: number
          failed?: number
          id?: string
          instance_id?: string | null
          instance_ids?: string[] | null
          list_id?: string | null
          message_interval_max?: number | null
          message_interval_min?: number | null
          name: string
          scheduled_at?: string | null
          sending_mode?: string | null
          sent?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          timezone?: string | null
          total_contacts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_days?: string[] | null
          allowed_end_hour?: number | null
          allowed_start_hour?: number | null
          completed_at?: string | null
          created_at?: string
          daily_limit?: number | null
          delivered?: number
          failed?: number
          id?: string
          instance_id?: string | null
          instance_ids?: string[] | null
          list_id?: string | null
          message_interval_max?: number | null
          message_interval_min?: number | null
          name?: string
          scheduled_at?: string | null
          sending_mode?: string | null
          sent?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          timezone?: string | null
          total_contacts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "broadcast_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          last_message_at: string | null
          name: string | null
          notes: string | null
          opted_out: boolean
          opted_out_at: string | null
          phone: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          notes?: string | null
          opted_out?: boolean
          opted_out_at?: string | null
          phone: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          notes?: string | null
          opted_out?: boolean
          opted_out_at?: string | null
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          instance_id: string | null
          last_message_at: string | null
          last_message_preview: string | null
          status: string
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          instance_id?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          id: string
          media_url: string | null
          message_type: string
          read_at: string | null
          sent_at: string | null
          status: string
          user_id: string
          whatsapp_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: Database["public"]["Enums"]["template_category"]
          content: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          variables: Json | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["template_category"]
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          variables?: Json | null
        }
        Update: {
          category?: Database["public"]["Enums"]["template_category"]
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
      scraped_leads: {
        Row: {
          address: string | null
          capital_social: number | null
          cep: string | null
          city: string | null
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string
          created_at: string | null
          data_abertura: string | null
          email: string | null
          id: string
          imported_at: string | null
          neighborhood: string | null
          nome_fantasia: string | null
          phone: string | null
          porte: string | null
          raw_data: Json | null
          razao_social: string | null
          situacao_cadastral: string | null
          source: string | null
          state: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj: string
          created_at?: string | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          imported_at?: string | null
          neighborhood?: string | null
          nome_fantasia?: string | null
          phone?: string | null
          porte?: string | null
          raw_data?: Json | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          source?: string | null
          state?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          capital_social?: number | null
          cep?: string | null
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string
          created_at?: string | null
          data_abertura?: string | null
          email?: string | null
          id?: string
          imported_at?: string | null
          neighborhood?: string | null
          nome_fantasia?: string | null
          phone?: string | null
          porte?: string | null
          raw_data?: Json | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          source?: string | null
          state?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      subscription_history: {
        Row: {
          action: string
          changed_by: string
          created_at: string | null
          id: string
          new_values: Json | null
          notes: string | null
          old_values: Json | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
          subscription_id: string
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string | null
          id?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          manual_override: boolean | null
          max_contacts: number | null
          max_instances: number
          max_messages: number | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          manual_override?: boolean | null
          max_contacts?: number | null
          max_instances?: number
          max_messages?: number | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          manual_override?: boolean | null
          max_contacts?: number | null
          max_instances?: number
          max_messages?: number | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      template_variations: {
        Row: {
          content: string
          created_at: string
          id: string
          template_id: string
          variation_index: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          template_id: string
          variation_index: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          template_id?: string
          variation_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_variations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          allowed_days: string[]
          allowed_end_hour: number
          allowed_start_hour: number
          auto_retry: boolean
          created_at: string
          daily_limit: number
          email_notifications: boolean
          id: string
          max_retries: number
          message_interval_max: number
          message_interval_min: number
          notify_on_complete: boolean
          stop_on_error: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_days?: string[]
          allowed_end_hour?: number
          allowed_start_hour?: number
          auto_retry?: boolean
          created_at?: string
          daily_limit?: number
          email_notifications?: boolean
          id?: string
          max_retries?: number
          message_interval_max?: number
          message_interval_min?: number
          notify_on_complete?: boolean
          stop_on_error?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_days?: string[]
          allowed_end_hour?: number
          allowed_start_hour?: number
          auto_retry?: boolean
          created_at?: string
          daily_limit?: number
          email_notifications?: boolean
          id?: string
          max_retries?: number
          message_interval_max?: number
          message_interval_min?: number
          notify_on_complete?: boolean
          stop_on_error?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          qr_code: string | null
          qr_code_updated_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          warming_level: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          qr_code?: string | null
          qr_code_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          warming_level?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          qr_code?: string | null
          qr_code_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          warming_level?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      broadcast_list_type: "manual" | "dynamic"
      template_category:
        | "promotional"
        | "transactional"
        | "notification"
        | "welcome"
        | "reminder"
        | "other"
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
      app_role: ["admin", "user"],
      broadcast_list_type: ["manual", "dynamic"],
      template_category: [
        "promotional",
        "transactional",
        "notification",
        "welcome",
        "reminder",
        "other",
      ],
    },
  },
} as const
