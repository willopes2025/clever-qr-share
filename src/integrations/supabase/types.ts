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
      ai_agent_configs: {
        Row: {
          active_hours_end: number | null
          active_hours_start: number | null
          agent_name: string
          behavior_rules: string | null
          campaign_id: string | null
          created_at: string | null
          elevenlabs_agent_id: string | null
          fallback_message: string | null
          funnel_id: string | null
          goodbye_message: string | null
          greeting_message: string | null
          handoff_keywords: string[] | null
          id: string
          is_active: boolean | null
          max_interactions: number | null
          pause_emoji: string | null
          personality_prompt: string | null
          response_delay_max: number | null
          response_delay_min: number | null
          response_mode: string | null
          resume_emoji: string | null
          template_type: string | null
          updated_at: string | null
          user_id: string
          voice_id: string | null
        }
        Insert: {
          active_hours_end?: number | null
          active_hours_start?: number | null
          agent_name?: string
          behavior_rules?: string | null
          campaign_id?: string | null
          created_at?: string | null
          elevenlabs_agent_id?: string | null
          fallback_message?: string | null
          funnel_id?: string | null
          goodbye_message?: string | null
          greeting_message?: string | null
          handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean | null
          max_interactions?: number | null
          pause_emoji?: string | null
          personality_prompt?: string | null
          response_delay_max?: number | null
          response_delay_min?: number | null
          response_mode?: string | null
          resume_emoji?: string | null
          template_type?: string | null
          updated_at?: string | null
          user_id: string
          voice_id?: string | null
        }
        Update: {
          active_hours_end?: number | null
          active_hours_start?: number | null
          agent_name?: string
          behavior_rules?: string | null
          campaign_id?: string | null
          created_at?: string | null
          elevenlabs_agent_id?: string | null
          fallback_message?: string | null
          funnel_id?: string | null
          goodbye_message?: string | null
          greeting_message?: string | null
          handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean | null
          max_interactions?: number | null
          pause_emoji?: string | null
          personality_prompt?: string | null
          response_delay_max?: number | null
          response_delay_min?: number | null
          response_mode?: string | null
          resume_emoji?: string | null
          template_type?: string | null
          updated_at?: string | null
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_configs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_configs_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_integrations: {
        Row: {
          agent_config_id: string
          api_auth_type: string | null
          api_base_url: string | null
          api_credentials: Json | null
          api_headers: Json | null
          created_at: string | null
          description: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          last_error: string | null
          last_used_at: string | null
          name: string
          updated_at: string | null
          user_id: string
          webhook_events: string[] | null
          webhook_payload_template: Json | null
          webhook_target_url: string | null
          webhook_token: string | null
          webhook_url: string | null
        }
        Insert: {
          agent_config_id: string
          api_auth_type?: string | null
          api_base_url?: string | null
          api_credentials?: Json | null
          api_headers?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_error?: string | null
          last_used_at?: string | null
          name: string
          updated_at?: string | null
          user_id: string
          webhook_events?: string[] | null
          webhook_payload_template?: Json | null
          webhook_target_url?: string | null
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          agent_config_id?: string
          api_auth_type?: string | null
          api_base_url?: string | null
          api_credentials?: Json | null
          api_headers?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_error?: string | null
          last_used_at?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
          webhook_events?: string[] | null
          webhook_payload_template?: Json | null
          webhook_target_url?: string | null
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_integrations_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_knowledge_items: {
        Row: {
          agent_config_id: string
          content: string | null
          created_at: string | null
          error_message: string | null
          file_name: string | null
          file_url: string | null
          id: string
          last_synced_at: string | null
          processed_content: string | null
          source_type: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          agent_config_id: string
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          last_synced_at?: string | null
          processed_content?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          agent_config_id?: string
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          last_synced_at?: string | null
          processed_content?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_items_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_stages: {
        Row: {
          actions: Json | null
          agent_config_id: string
          collected_fields: Json | null
          completion_condition: Json | null
          condition_type: string
          created_at: string | null
          id: string
          is_final: boolean | null
          next_stage_id: string | null
          order_index: number
          stage_name: string
          stage_prompt: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actions?: Json | null
          agent_config_id: string
          collected_fields?: Json | null
          completion_condition?: Json | null
          condition_type?: string
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          next_stage_id?: string | null
          order_index?: number
          stage_name: string
          stage_prompt?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actions?: Json | null
          agent_config_id?: string
          collected_fields?: Json | null
          completion_condition?: Json | null
          condition_type?: string
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          next_stage_id?: string | null
          order_index?: number
          stage_name?: string
          stage_prompt?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_stages_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_stages_next_stage_id_fkey"
            columns: ["next_stage_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_variables: {
        Row: {
          agent_config_id: string
          created_at: string | null
          id: string
          is_system: boolean | null
          updated_at: string | null
          user_id: string
          variable_description: string | null
          variable_key: string
          variable_value: string | null
        }
        Insert: {
          agent_config_id: string
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          updated_at?: string | null
          user_id: string
          variable_description?: string | null
          variable_key: string
          variable_value?: string | null
        }
        Update: {
          agent_config_id?: string
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          updated_at?: string | null
          user_id?: string
          variable_description?: string | null
          variable_key?: string
          variable_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_variables_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_webhook_logs: {
        Row: {
          created_at: string | null
          direction: string
          error_message: string | null
          event_type: string | null
          id: string
          integration_id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          integration_id: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          integration_id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_webhook_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_suggestions: {
        Row: {
          agent_config_id: string
          analysis_date: string
          answer: string
          category: string | null
          confidence_score: number | null
          created_at: string | null
          dismissed_reason: string | null
          frequency_count: number | null
          id: string
          question: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_conversation_id: string | null
          source_message_ids: string[] | null
          status: string | null
          suggested_title: string | null
          user_id: string
        }
        Insert: {
          agent_config_id: string
          analysis_date?: string
          answer: string
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          dismissed_reason?: string | null
          frequency_count?: number | null
          id?: string
          question: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_conversation_id?: string | null
          source_message_ids?: string[] | null
          status?: string | null
          suggested_title?: string | null
          user_id: string
        }
        Update: {
          agent_config_id?: string
          analysis_date?: string
          answer?: string
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          dismissed_reason?: string | null
          frequency_count?: number | null
          id?: string
          question?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_conversation_id?: string | null
          source_message_ids?: string[] | null
          status?: string | null
          suggested_title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_suggestions_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_suggestions_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_phone_calls: {
        Row: {
          agent_config_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          elevenlabs_conversation_id: string | null
          ended_at: string | null
          error_message: string | null
          id: string
          recording_url: string | null
          sip_call_id: string | null
          sip_config_id: string | null
          status: string
          to_number: string
          transcript: string | null
          user_id: string
        }
        Insert: {
          agent_config_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          recording_url?: string | null
          sip_call_id?: string | null
          sip_config_id?: string | null
          status?: string
          to_number: string
          transcript?: string | null
          user_id: string
        }
        Update: {
          agent_config_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          recording_url?: string | null
          sip_call_id?: string | null
          sip_config_id?: string | null
          status?: string
          to_number?: string
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_phone_calls_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_phone_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_phone_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_phone_calls_sip_config_id_fkey"
            columns: ["sip_config_id"]
            isOneToOne: false
            referencedRelation: "elevenlabs_sip_config"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_packages: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          price_brl: number
          stripe_price_id: string
          stripe_product_id: string
          tokens: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          price_brl: number
          stripe_price_id: string
          stripe_product_id: string
          tokens: number
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          price_brl?: number
          stripe_price_id?: string
          stripe_product_id?: string
          tokens?: number
        }
        Relationships: []
      }
      ai_token_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          package_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          package_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          package_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_token_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      available_widgets: {
        Row: {
          admin_only: boolean | null
          category: string
          created_at: string
          default_size: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          member_only: boolean | null
          name: string
          size_options: string[] | null
          widget_key: string
          widget_type: string | null
        }
        Insert: {
          admin_only?: boolean | null
          category: string
          created_at?: string
          default_size?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          member_only?: boolean | null
          name: string
          size_options?: string[] | null
          widget_key: string
          widget_type?: string | null
        }
        Update: {
          admin_only?: boolean | null
          category?: string
          created_at?: string
          default_size?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          member_only?: boolean | null
          name?: string
          size_options?: string[] | null
          widget_key?: string
          widget_type?: string | null
        }
        Relationships: []
      }
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
      calendar_integrations: {
        Row: {
          access_token: string | null
          agent_config_id: string | null
          api_token: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          organization_uri: string | null
          provider: string
          refresh_token: string | null
          selected_event_type_name: string | null
          selected_event_type_uri: string | null
          selected_scheduling_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
          user_uri: string | null
          webhook_signing_key: string | null
          webhook_subscription_id: string | null
        }
        Insert: {
          access_token?: string | null
          agent_config_id?: string | null
          api_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_uri?: string | null
          provider?: string
          refresh_token?: string | null
          selected_event_type_name?: string | null
          selected_event_type_uri?: string | null
          selected_scheduling_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
          user_uri?: string | null
          webhook_signing_key?: string | null
          webhook_subscription_id?: string | null
        }
        Update: {
          access_token?: string | null
          agent_config_id?: string | null
          api_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          organization_uri?: string | null
          provider?: string
          refresh_token?: string | null
          selected_event_type_name?: string | null
          selected_event_type_uri?: string | null
          selected_scheduling_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
          user_uri?: string | null
          webhook_signing_key?: string | null
          webhook_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_agent_config_id_fkey"
            columns: ["agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      calendly_events: {
        Row: {
          calendly_event_uri: string | null
          cancel_reason: string | null
          canceled_at: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          deal_id: string | null
          event_end_time: string | null
          event_name: string | null
          event_start_time: string | null
          event_type: string
          id: string
          integration_id: string | null
          invitee_email: string | null
          invitee_name: string | null
          invitee_phone: string | null
          location: string | null
          processed_at: string | null
          raw_payload: Json | null
          user_id: string
        }
        Insert: {
          calendly_event_uri?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          event_end_time?: string | null
          event_name?: string | null
          event_start_time?: string | null
          event_type: string
          id?: string
          integration_id?: string | null
          invitee_email?: string | null
          invitee_name?: string | null
          invitee_phone?: string | null
          location?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          user_id: string
        }
        Update: {
          calendly_event_uri?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          event_end_time?: string | null
          event_name?: string | null
          event_start_time?: string | null
          event_type?: string
          id?: string
          integration_id?: string | null
          invitee_email?: string | null
          invitee_name?: string | null
          invitee_phone?: string | null
          location?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendly_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "funnel_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendly_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          call_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voip_calls"
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
          ai_active_hours_end: number | null
          ai_active_hours_start: number | null
          ai_enabled: boolean | null
          ai_handoff_keywords: string[] | null
          ai_knowledge_base: string | null
          ai_max_interactions: number | null
          ai_prompt: string | null
          ai_response_delay_max: number | null
          ai_response_delay_min: number | null
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
          skip_already_sent: boolean | null
          skip_days_period: number | null
          skip_mode: string | null
          started_at: string | null
          status: string
          template_id: string | null
          timezone: string | null
          total_contacts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_active_hours_end?: number | null
          ai_active_hours_start?: number | null
          ai_enabled?: boolean | null
          ai_handoff_keywords?: string[] | null
          ai_knowledge_base?: string | null
          ai_max_interactions?: number | null
          ai_prompt?: string | null
          ai_response_delay_max?: number | null
          ai_response_delay_min?: number | null
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
          skip_already_sent?: boolean | null
          skip_days_period?: number | null
          skip_mode?: string | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          timezone?: string | null
          total_contacts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_active_hours_end?: number | null
          ai_active_hours_start?: number | null
          ai_enabled?: boolean | null
          ai_handoff_keywords?: string[] | null
          ai_knowledge_base?: string | null
          ai_max_interactions?: number | null
          ai_prompt?: string | null
          ai_response_delay_max?: number | null
          ai_response_delay_min?: number | null
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
          skip_already_sent?: boolean | null
          skip_days_period?: number | null
          skip_mode?: string | null
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
      chatbot_executions: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          current_node_id: string | null
          deal_id: string | null
          error_message: string | null
          flow_id: string | null
          id: string
          started_at: string | null
          status: string | null
          trigger_automation_id: string | null
          trigger_source: string | null
          user_id: string
          variables: Json | null
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          current_node_id?: string | null
          deal_id?: string | null
          error_message?: string | null
          flow_id?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          trigger_automation_id?: string | null
          trigger_source?: string | null
          user_id: string
          variables?: Json | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          current_node_id?: string | null
          deal_id?: string | null
          error_message?: string | null
          flow_id?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
          trigger_automation_id?: string | null
          trigger_source?: string | null
          user_id?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_executions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "funnel_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_executions_trigger_automation_id_fkey"
            columns: ["trigger_automation_id"]
            isOneToOne: false
            referencedRelation: "funnel_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_edges: {
        Row: {
          created_at: string | null
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_handle: string | null
          target_node_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_handle?: string | null
          target_node_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_handle?: string | null
          target_node_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_nodes: {
        Row: {
          created_at: string | null
          data: Json | null
          flow_id: string
          id: string
          position_x: number
          position_y: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          flow_id: string
          id?: string
          position_x?: number
          position_y?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          flow_id?: string
          id?: string
          position_x?: number
          position_y?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instance_id: string | null
          is_active: boolean | null
          name: string
          trigger_config: Json | null
          trigger_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          name: string
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          is_active?: boolean | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_activity_log: {
        Row: {
          activity_type: string
          ai_agent_id: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          ai_agent_id?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          ai_agent_id?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activity_log_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activity_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          asaas_customer_id: string | null
          asaas_payment_status: string | null
          avatar_url: string | null
          contact_display_id: string | null
          contact_number: number
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          label_id: string | null
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
          asaas_customer_id?: string | null
          asaas_payment_status?: string | null
          avatar_url?: string | null
          contact_display_id?: string | null
          contact_number?: number
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          label_id?: string | null
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
          asaas_customer_id?: string | null
          asaas_payment_status?: string | null
          avatar_url?: string | null
          contact_display_id?: string | null
          contact_number?: number
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          label_id?: string | null
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
      conversation_analysis_reports: {
        Row: {
          audio_analysis_score: number
          communication_score: number
          conversation_details: Json
          created_at: string
          efficiency_score: number
          error_message: string | null
          executive_summary: string
          highlighted_examples: Json
          id: string
          improvements: Json
          overall_score: number
          period_end: string
          period_start: string
          recommendations: Json
          sales_score: number
          status: string
          strengths: Json
          textual_quality_score: number
          total_audios_analyzed: number
          total_conversations: number
          total_messages_received: number
          total_messages_sent: number
          user_id: string
        }
        Insert: {
          audio_analysis_score: number
          communication_score: number
          conversation_details?: Json
          created_at?: string
          efficiency_score: number
          error_message?: string | null
          executive_summary: string
          highlighted_examples?: Json
          id?: string
          improvements?: Json
          overall_score: number
          period_end: string
          period_start: string
          recommendations?: Json
          sales_score: number
          status?: string
          strengths?: Json
          textual_quality_score: number
          total_audios_analyzed?: number
          total_conversations?: number
          total_messages_received?: number
          total_messages_sent?: number
          user_id: string
        }
        Update: {
          audio_analysis_score?: number
          communication_score?: number
          conversation_details?: Json
          created_at?: string
          efficiency_score?: number
          error_message?: string | null
          executive_summary?: string
          highlighted_examples?: Json
          id?: string
          improvements?: Json
          overall_score?: number
          period_end?: string
          period_start?: string
          recommendations?: Json
          sales_score?: number
          status?: string
          strengths?: Json
          textual_quality_score?: number
          total_audios_analyzed?: number
          total_conversations?: number
          total_messages_received?: number
          total_messages_sent?: number
          user_id?: string
        }
        Relationships: []
      }
      conversation_notes: {
        Row: {
          contact_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          is_pinned: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_stage_data: {
        Row: {
          collected_data: Json | null
          conversation_id: string
          created_at: string | null
          current_stage_id: string | null
          id: string
          stage_history: Json | null
          updated_at: string | null
        }
        Insert: {
          collected_data?: Json | null
          conversation_id: string
          created_at?: string | null
          current_stage_id?: string | null
          id?: string
          stage_history?: Json | null
          updated_at?: string | null
        }
        Update: {
          collected_data?: Json | null
          conversation_id?: string
          created_at?: string | null
          current_stage_id?: string | null
          id?: string
          stage_history?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_stage_data_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_stage_data_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tag_assignments: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tag_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "conversation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
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
      conversation_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          google_event_id: string | null
          id: string
          priority: string | null
          reminder_at: string | null
          sync_with_google: boolean | null
          task_type_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_event_id?: string | null
          id?: string
          priority?: string | null
          reminder_at?: string | null
          sync_with_google?: boolean | null
          task_type_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_event_id?: string | null
          id?: string
          priority?: string | null
          reminder_at?: string | null
          sync_with_google?: boolean | null
          task_type_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_handled: boolean | null
          ai_handoff_reason: string | null
          ai_handoff_requested: boolean | null
          ai_interactions_count: number | null
          ai_paused: boolean | null
          assigned_to: string | null
          campaign_id: string | null
          contact_id: string
          created_at: string
          first_response_at: string | null
          id: string
          instance_id: string | null
          is_pinned: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          meta_phone_number_id: string | null
          preferred_response_format: string | null
          provider: string | null
          status: string
          unread_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_handled?: boolean | null
          ai_handoff_reason?: string | null
          ai_handoff_requested?: boolean | null
          ai_interactions_count?: number | null
          ai_paused?: boolean | null
          assigned_to?: string | null
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          instance_id?: string | null
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          meta_phone_number_id?: string | null
          preferred_response_format?: string | null
          provider?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_handled?: boolean | null
          ai_handoff_reason?: string | null
          ai_handoff_requested?: boolean | null
          ai_interactions_count?: number | null
          ai_paused?: boolean | null
          assigned_to?: string | null
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          instance_id?: string | null
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          meta_phone_number_id?: string | null
          preferred_response_format?: string | null
          provider?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
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
      custom_field_definitions: {
        Row: {
          created_at: string
          display_order: number | null
          field_key: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean | null
          options: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          field_key: string
          field_name: string
          field_type: string
          id?: string
          is_required?: boolean | null
          options?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          field_key?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          options?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      dashboard_configs: {
        Row: {
          config_type: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
          widgets: Json | null
        }
        Insert: {
          config_type?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id: string
          widgets?: Json | null
        }
        Update: {
          config_type?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
          widgets?: Json | null
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          confirmation_code: string
          created_at: string
          email: string
          id: string
          notes: string | null
          phone: string | null
          processed_at: string | null
          reason: string | null
          status: string
        }
        Insert: {
          confirmation_code?: string
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          phone?: string | null
          processed_at?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          confirmation_code?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          phone?: string | null
          processed_at?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          due_time: string | null
          google_event_id: string | null
          id: string
          priority: string | null
          sync_with_google: boolean | null
          task_type_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_event_id?: string | null
          id?: string
          priority?: string | null
          sync_with_google?: boolean | null
          task_type_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          google_event_id?: string | null
          id?: string
          priority?: string | null
          sync_with_google?: boolean | null
          task_type_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "funnel_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_task_type_id_fkey"
            columns: ["task_type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      elevenlabs_sip_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          phone_number: string
          phone_number_id: string
          sip_domain: string | null
          sip_username: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          phone_number: string
          phone_number_id: string
          sip_domain?: string | null
          sip_username?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          phone_number?: string
          phone_number_id?: string
          sip_domain?: string | null
          sip_username?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      extensions: {
        Row: {
          caller_id_name: string | null
          caller_id_number: string | null
          created_at: string
          display_name: string | null
          extension_number: string
          fusionpbx_config_id: string
          id: string
          is_active: boolean
          organization_id: string | null
          sip_password: string
          updated_at: string
          user_id: string
          voicemail_enabled: boolean | null
          webrtc_enabled: boolean | null
        }
        Insert: {
          caller_id_name?: string | null
          caller_id_number?: string | null
          created_at?: string
          display_name?: string | null
          extension_number: string
          fusionpbx_config_id: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          sip_password: string
          updated_at?: string
          user_id: string
          voicemail_enabled?: boolean | null
          webrtc_enabled?: boolean | null
        }
        Update: {
          caller_id_name?: string | null
          caller_id_number?: string | null
          created_at?: string
          display_name?: string | null
          extension_number?: string
          fusionpbx_config_id?: string
          id?: string
          is_active?: boolean
          organization_id?: string | null
          sip_password?: string
          updated_at?: string
          user_id?: string
          voicemail_enabled?: boolean | null
          webrtc_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "extensions_fusionpbx_config_id_fkey"
            columns: ["fusionpbx_config_id"]
            isOneToOne: false
            referencedRelation: "fusionpbx_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extensions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          conditional_logic: Json | null
          create_custom_field_on_submit: boolean | null
          created_at: string | null
          field_type: string
          form_id: string
          help_text: string | null
          id: string
          label: string
          mapping_target: string | null
          mapping_type: string | null
          options: Json | null
          placeholder: string | null
          position: number
          required: boolean | null
          settings: Json | null
          user_id: string
          validation: Json | null
        }
        Insert: {
          conditional_logic?: Json | null
          create_custom_field_on_submit?: boolean | null
          created_at?: string | null
          field_type: string
          form_id: string
          help_text?: string | null
          id?: string
          label: string
          mapping_target?: string | null
          mapping_type?: string | null
          options?: Json | null
          placeholder?: string | null
          position: number
          required?: boolean | null
          settings?: Json | null
          user_id: string
          validation?: Json | null
        }
        Update: {
          conditional_logic?: Json | null
          create_custom_field_on_submit?: boolean | null
          created_at?: string | null
          field_type?: string
          form_id?: string
          help_text?: string | null
          id?: string
          label?: string
          mapping_target?: string | null
          mapping_type?: string | null
          options?: Json | null
          placeholder?: string | null
          position?: number
          required?: boolean | null
          settings?: Json | null
          user_id?: string
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          contact_id: string | null
          created_at: string | null
          data: Json
          form_id: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          data: Json
          form_id: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          data?: Json
          form_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_webhooks: {
        Row: {
          created_at: string | null
          events: string[] | null
          form_id: string
          headers: Json | null
          id: string
          is_active: boolean | null
          name: string
          target_url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          events?: string[] | null
          form_id: string
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          target_url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          events?: string[] | null
          form_id?: string
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          target_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_webhooks_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          background_color: string | null
          created_at: string | null
          description: string | null
          font_family: string | null
          header_text: string | null
          id: string
          logo_url: string | null
          meta_description: string | null
          name: string
          og_image_url: string | null
          page_title: string | null
          primary_color: string | null
          redirect_url: string | null
          settings: Json | null
          slug: string
          status: string | null
          subheader_text: string | null
          submit_button_text: string | null
          success_message: string | null
          updated_at: string | null
          url_static_params: Json | null
          user_id: string
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          font_family?: string | null
          header_text?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          name: string
          og_image_url?: string | null
          page_title?: string | null
          primary_color?: string | null
          redirect_url?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          subheader_text?: string | null
          submit_button_text?: string | null
          success_message?: string | null
          updated_at?: string | null
          url_static_params?: Json | null
          user_id: string
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          description?: string | null
          font_family?: string | null
          header_text?: string | null
          id?: string
          logo_url?: string | null
          meta_description?: string | null
          name?: string
          og_image_url?: string | null
          page_title?: string | null
          primary_color?: string | null
          redirect_url?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          subheader_text?: string | null
          submit_button_text?: string | null
          success_message?: string | null
          updated_at?: string | null
          url_static_params?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      funnel_automations: {
        Row: {
          action_config: Json | null
          action_type: Database["public"]["Enums"]["funnel_action_type"]
          created_at: string | null
          funnel_id: string
          id: string
          is_active: boolean | null
          name: string
          stage_id: string | null
          trigger_config: Json | null
          trigger_type: Database["public"]["Enums"]["funnel_trigger_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_config?: Json | null
          action_type: Database["public"]["Enums"]["funnel_action_type"]
          created_at?: string | null
          funnel_id: string
          id?: string
          is_active?: boolean | null
          name: string
          stage_id?: string | null
          trigger_config?: Json | null
          trigger_type: Database["public"]["Enums"]["funnel_trigger_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_config?: Json | null
          action_type?: Database["public"]["Enums"]["funnel_action_type"]
          created_at?: string | null
          funnel_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          stage_id?: string | null
          trigger_config?: Json | null
          trigger_type?: Database["public"]["Enums"]["funnel_trigger_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_automations_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_automations_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_close_reasons: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      funnel_deal_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          deal_id: string
          from_stage_id: string | null
          id: string
          notes: string | null
          to_stage_id: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          deal_id: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          deal_id?: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "funnel_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_deal_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_deal_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_deals: {
        Row: {
          close_reason_id: string | null
          closed_at: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string | null
          currency: string | null
          custom_fields: Json | null
          entered_stage_at: string | null
          expected_close_date: string | null
          funnel_id: string
          id: string
          next_action_required: boolean | null
          notes: string | null
          responsible_id: string | null
          source: string | null
          stage_id: string
          title: string | null
          updated_at: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          close_reason_id?: string | null
          closed_at?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          entered_stage_at?: string | null
          expected_close_date?: string | null
          funnel_id: string
          id?: string
          next_action_required?: boolean | null
          notes?: string | null
          responsible_id?: string | null
          source?: string | null
          stage_id: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          close_reason_id?: string | null
          closed_at?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string | null
          currency?: string | null
          custom_fields?: Json | null
          entered_stage_at?: string | null
          expected_close_date?: string | null
          funnel_id?: string
          id?: string
          next_action_required?: boolean | null
          notes?: string | null
          responsible_id?: string | null
          source?: string | null
          stage_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_deals_close_reason_id_fkey"
            columns: ["close_reason_id"]
            isOneToOne: false
            referencedRelation: "funnel_close_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_deals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_deals_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          final_type: string | null
          funnel_id: string
          id: string
          is_final: boolean | null
          name: string
          probability: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          final_type?: string | null
          funnel_id: string
          id?: string
          is_final?: boolean | null
          name: string
          probability?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          final_type?: string | null
          funnel_id?: string
          id?: string
          is_final?: boolean | null
          name?: string
          probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fusionpbx_configs: {
        Row: {
          api_key: string | null
          created_at: string
          domain: string
          esl_password: string | null
          esl_port: number
          host: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          stun_servers: string[] | null
          turn_servers: Json | null
          updated_at: string
          user_id: string
          verto_wss_url: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          domain: string
          esl_password?: string | null
          esl_port?: number
          host: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          stun_servers?: string[] | null
          turn_servers?: Json | null
          updated_at?: string
          user_id: string
          verto_wss_url?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          domain?: string
          esl_password?: string | null
          esl_port?: number
          host?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          stun_servers?: string[] | null
          turn_servers?: Json | null
          updated_at?: string
          user_id?: string
          verto_wss_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fusionpbx_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_integrations: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          refresh_token: string
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token: string
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inbox_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          extracted_content: string | null
          id: string
          is_ai_generated: boolean | null
          media_url: string | null
          message_type: string
          read_at: string | null
          sent_at: string | null
          sent_by_ai_agent_id: string | null
          sent_by_user_id: string | null
          status: string
          transcription: string | null
          user_id: string
          whatsapp_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          extracted_content?: string | null
          id?: string
          is_ai_generated?: boolean | null
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
          sent_by_ai_agent_id?: string | null
          sent_by_user_id?: string | null
          status?: string
          transcription?: string | null
          user_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          extracted_content?: string | null
          id?: string
          is_ai_generated?: boolean | null
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
          sent_by_ai_agent_id?: string | null
          sent_by_user_id?: string | null
          status?: string
          transcription?: string | null
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
          {
            foreignKeyName: "inbox_messages_sent_by_ai_agent_id_fkey"
            columns: ["sent_by_ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_comments: {
        Row: {
          comment_id: string
          comment_text: string | null
          commenter_biography: string | null
          commenter_business_category: string | null
          commenter_email: string | null
          commenter_external_url: string | null
          commenter_followers_count: number | null
          commenter_following_count: number | null
          commenter_full_name: string | null
          commenter_is_business: boolean | null
          commenter_is_verified: boolean | null
          commenter_phone: string | null
          commenter_posts_count: number | null
          commenter_profile_pic: string | null
          commenter_username: string
          created_at: string
          enriched_at: string | null
          id: string
          is_reply: boolean | null
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string | null
          post_url: string
          raw_data: Json | null
          scraped_at: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          comment_text?: string | null
          commenter_biography?: string | null
          commenter_business_category?: string | null
          commenter_email?: string | null
          commenter_external_url?: string | null
          commenter_followers_count?: number | null
          commenter_following_count?: number | null
          commenter_full_name?: string | null
          commenter_is_business?: boolean | null
          commenter_is_verified?: boolean | null
          commenter_phone?: string | null
          commenter_posts_count?: number | null
          commenter_profile_pic?: string | null
          commenter_username: string
          created_at?: string
          enriched_at?: string | null
          id?: string
          is_reply?: boolean | null
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string | null
          post_url: string
          raw_data?: Json | null
          scraped_at?: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          comment_text?: string | null
          commenter_biography?: string | null
          commenter_business_category?: string | null
          commenter_email?: string | null
          commenter_external_url?: string | null
          commenter_followers_count?: number | null
          commenter_following_count?: number | null
          commenter_full_name?: string | null
          commenter_is_business?: boolean | null
          commenter_is_verified?: boolean | null
          commenter_phone?: string | null
          commenter_posts_count?: number | null
          commenter_profile_pic?: string | null
          commenter_username?: string
          created_at?: string
          enriched_at?: string | null
          id?: string
          is_reply?: boolean | null
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string | null
          post_url?: string
          raw_data?: Json | null
          scraped_at?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      instagram_scrape_results: {
        Row: {
          biography: string | null
          business_category: string | null
          created_at: string
          email: string | null
          engagement_score: number | null
          enriched_at: string | null
          external_url: string | null
          fbid: string | null
          followers_count: number | null
          following_count: number | null
          full_name: string | null
          highlights_count: number | null
          id: string
          igtv_count: number | null
          is_business_account: boolean | null
          is_private: boolean | null
          is_suspicious: boolean | null
          is_verified: boolean | null
          latest_posts: Json | null
          linked_facebook_page: string | null
          location_id: string | null
          location_name: string | null
          other_social_links: Json | null
          phone: string | null
          posts_count: number | null
          profile_pic_url: string | null
          raw_data: Json | null
          reels_count: number | null
          scrape_type: string | null
          scraped_at: string
          source_username: string | null
          suspicious_reasons: string[] | null
          user_id: string
          username: string
        }
        Insert: {
          biography?: string | null
          business_category?: string | null
          created_at?: string
          email?: string | null
          engagement_score?: number | null
          enriched_at?: string | null
          external_url?: string | null
          fbid?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          highlights_count?: number | null
          id?: string
          igtv_count?: number | null
          is_business_account?: boolean | null
          is_private?: boolean | null
          is_suspicious?: boolean | null
          is_verified?: boolean | null
          latest_posts?: Json | null
          linked_facebook_page?: string | null
          location_id?: string | null
          location_name?: string | null
          other_social_links?: Json | null
          phone?: string | null
          posts_count?: number | null
          profile_pic_url?: string | null
          raw_data?: Json | null
          reels_count?: number | null
          scrape_type?: string | null
          scraped_at?: string
          source_username?: string | null
          suspicious_reasons?: string[] | null
          user_id: string
          username: string
        }
        Update: {
          biography?: string | null
          business_category?: string | null
          created_at?: string
          email?: string | null
          engagement_score?: number | null
          enriched_at?: string | null
          external_url?: string | null
          fbid?: string | null
          followers_count?: number | null
          following_count?: number | null
          full_name?: string | null
          highlights_count?: number | null
          id?: string
          igtv_count?: number | null
          is_business_account?: boolean | null
          is_private?: boolean | null
          is_suspicious?: boolean | null
          is_verified?: boolean | null
          latest_posts?: Json | null
          linked_facebook_page?: string | null
          location_id?: string | null
          location_name?: string | null
          other_social_links?: Json | null
          phone?: string | null
          posts_count?: number | null
          profile_pic_url?: string | null
          raw_data?: Json | null
          reels_count?: number | null
          scrape_type?: string | null
          scraped_at?: string
          source_username?: string | null
          suspicious_reasons?: string[] | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string | null
          credentials: Json | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          provider: string
          settings: Json | null
          sync_error: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider: string
          settings?: Json | null
          sync_error?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          provider?: string
          settings?: Json | null
          sync_error?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      internal_chat_sessions: {
        Row: {
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          last_activity_at: string | null
          last_message_preview: string | null
          user_id: string
          whatsapp_phone: string
        }
        Insert: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_message_preview?: string | null
          user_id: string
          whatsapp_phone: string
        }
        Update: {
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_message_preview?: string | null
          user_id?: string
          whatsapp_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          contact_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          mentions: string[] | null
          source: string | null
          user_id: string
          whatsapp_message_id: string | null
        }
        Insert: {
          contact_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          mentions?: string[] | null
          source?: string | null
          user_id: string
          whatsapp_message_id?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          mentions?: string[] | null
          source?: string | null
          user_id?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_settings: {
        Row: {
          created_at: string | null
          distribution_mode: string | null
          eligible_members: string[] | null
          id: string
          is_enabled: boolean | null
          last_assigned_index: number | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          distribution_mode?: string | null
          eligible_members?: string[] | null
          id?: string
          is_enabled?: boolean | null
          last_assigned_index?: number | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          distribution_mode?: string | null
          eligible_members?: string[] | null
          id?: string
          is_enabled?: boolean | null
          last_assigned_index?: number | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_panel_tabs: {
        Row: {
          created_at: string | null
          display_order: number | null
          field_keys: Json | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          field_keys?: Json | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          field_keys?: Json | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lead_usage_log: {
        Row: {
          created_at: string | null
          id: string
          leads_consumed: number
          organization_id: string | null
          search_query: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          leads_consumed: number
          organization_id?: string | null
          search_query?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          leads_consumed?: number
          organization_id?: string | null
          search_query?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          media_filename: string | null
          media_type: string | null
          media_url: string | null
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
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
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
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          variables?: Json | null
        }
        Relationships: []
      }
      meta_templates: {
        Row: {
          approved_at: string | null
          body_examples: Json | null
          body_text: string
          buttons: Json | null
          category: string
          created_at: string | null
          footer_text: string | null
          header_content: string | null
          header_example: string | null
          header_type: string | null
          id: string
          language: string
          meta_template_id: string | null
          name: string
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          user_id: string
          waba_id: string | null
        }
        Insert: {
          approved_at?: string | null
          body_examples?: Json | null
          body_text: string
          buttons?: Json | null
          category: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_example?: string | null
          header_type?: string | null
          id?: string
          language?: string
          meta_template_id?: string | null
          name: string
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
          waba_id?: string | null
        }
        Update: {
          approved_at?: string | null
          body_examples?: Json | null
          body_text?: string
          buttons?: Json | null
          category?: string
          created_at?: string | null
          footer_text?: string | null
          header_content?: string | null
          header_example?: string | null
          header_type?: string | null
          id?: string
          language?: string
          meta_template_id?: string | null
          name?: string
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      meta_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          method: string
          payload: Json | null
          phone_number_id: string | null
          received_at: string
          signature_valid: boolean | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          method: string
          payload?: Json | null
          phone_number_id?: string | null
          received_at?: string
          signature_valid?: boolean | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          method?: string
          payload?: Json | null
          phone_number_id?: string | null
          received_at?: string
          signature_valid?: boolean | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: []
      }
      meta_whatsapp_numbers: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          phone_number: string | null
          phone_number_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          phone_number_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          phone_number_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          notification_type: string
          related_id: string | null
          sent_to_phone: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          notification_type: string
          related_id?: string | null
          sent_to_phone?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          notification_type?: string
          related_id?: string | null
          sent_to_phone?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          id: string
          notification_instance_id: string | null
          notify_ai_handoff: boolean | null
          notify_calendly_event: boolean | null
          notify_campaign_complete: boolean | null
          notify_deal_assigned: boolean | null
          notify_deal_stage_change: boolean | null
          notify_instance_disconnect: boolean | null
          notify_internal_chat: boolean | null
          notify_new_deal: boolean | null
          notify_new_message: boolean | null
          notify_task_assigned: boolean | null
          notify_task_created: boolean | null
          notify_task_deleted: boolean | null
          notify_task_due: boolean | null
          notify_task_updated: boolean | null
          only_if_responsible: boolean | null
          schedule_days: number[] | null
          schedule_enabled: boolean | null
          schedule_end_time: string | null
          schedule_start_time: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_instance_id?: string | null
          notify_ai_handoff?: boolean | null
          notify_calendly_event?: boolean | null
          notify_campaign_complete?: boolean | null
          notify_deal_assigned?: boolean | null
          notify_deal_stage_change?: boolean | null
          notify_instance_disconnect?: boolean | null
          notify_internal_chat?: boolean | null
          notify_new_deal?: boolean | null
          notify_new_message?: boolean | null
          notify_task_assigned?: boolean | null
          notify_task_created?: boolean | null
          notify_task_deleted?: boolean | null
          notify_task_due?: boolean | null
          notify_task_updated?: boolean | null
          only_if_responsible?: boolean | null
          schedule_days?: number[] | null
          schedule_enabled?: boolean | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_instance_id?: string | null
          notify_ai_handoff?: boolean | null
          notify_calendly_event?: boolean | null
          notify_campaign_complete?: boolean | null
          notify_deal_assigned?: boolean | null
          notify_deal_stage_change?: boolean | null
          notify_instance_disconnect?: boolean | null
          notify_internal_chat?: boolean | null
          notify_new_deal?: boolean | null
          notify_new_message?: boolean | null
          notify_task_assigned?: boolean | null
          notify_task_created?: boolean | null
          notify_task_deleted?: boolean | null
          notify_task_due?: boolean | null
          notify_task_updated?: boolean | null
          only_if_responsible?: boolean | null
          schedule_days?: number[] | null
          schedule_enabled?: boolean | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_notification_instance_id_fkey"
            columns: ["notification_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          message: string
          notification_data: Json
          notification_type: string
          organization_id: string | null
          phone: string
          processed: boolean | null
          processed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          message: string
          notification_data: Json
          notification_type: string
          organization_id?: string | null
          phone: string
          processed?: boolean | null
          processed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          message?: string
          notification_data?: Json
          notification_type?: string
          organization_id?: string | null
          phone?: string
          processed?: boolean | null
          processed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_context: string | null
          created_at: string | null
          id: string
          name: string
          notification_instance_id: string | null
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          company_context?: string | null
          created_at?: string | null
          id?: string
          name: string
          notification_instance_id?: string | null
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          company_context?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notification_instance_id?: string | null
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_notification_instance_id_fkey"
            columns: ["notification_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
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
      sla_metrics: {
        Row: {
          avg_first_response_seconds: number | null
          conversations_received: number | null
          conversations_responded: number | null
          created_at: string | null
          id: string
          metric_date: string
          organization_id: string | null
          sla_breached_15min: number | null
          sla_breached_1h: number | null
          sla_breached_24h: number | null
          total_first_response_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_first_response_seconds?: number | null
          conversations_received?: number | null
          conversations_responded?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          organization_id?: string | null
          sla_breached_15min?: number | null
          sla_breached_1h?: number | null
          sla_breached_24h?: number | null
          total_first_response_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_first_response_seconds?: number | null
          conversations_received?: number | null
          conversations_responded?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          organization_id?: string | null
          sla_breached_15min?: number | null
          sla_breached_1h?: number | null
          sla_breached_24h?: number | null
          total_first_response_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          leads_reset_at: string | null
          leads_used: number | null
          manual_override: boolean | null
          max_contacts: number | null
          max_instances: number
          max_leads: number | null
          max_messages: number | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          leads_reset_at?: string | null
          leads_used?: number | null
          manual_override?: boolean | null
          max_contacts?: number | null
          max_instances?: number
          max_leads?: number | null
          max_messages?: number | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          leads_reset_at?: string | null
          leads_used?: number | null
          manual_override?: boolean | null
          max_contacts?: number | null
          max_instances?: number
          max_leads?: number | null
          max_messages?: number | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
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
      task_types: {
        Row: {
          color: string
          created_at: string | null
          display_order: number | null
          icon: string
          id: string
          is_default: boolean | null
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          icon: string
          id?: string
          is_default?: boolean | null
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          icon?: string
          id?: string
          is_default?: boolean | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      team_member_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          team_member_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          team_member_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_instances_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          auto_correct_enabled: boolean | null
          created_at: string | null
          email: string
          id: string
          invited_at: string | null
          joined_at: string | null
          organization_id: string
          permissions: Json | null
          phone: string | null
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          auto_correct_enabled?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          organization_id: string
          permissions?: Json | null
          phone?: string | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          auto_correct_enabled?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          organization_id?: string
          permissions?: Json | null
          phone?: string | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      user_activity_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          last_activity: string | null
          notes: string | null
          organization_id: string | null
          session_type: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          last_activity?: string | null
          notes?: string | null
          organization_id?: string | null
          session_type?: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          last_activity?: string | null
          notes?: string | null
          organization_id?: string | null
          session_type?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_tokens: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_consumed: number
          total_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_consumed?: number
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_performance_metrics: {
        Row: {
          avg_response_time_seconds: number | null
          conversations_handled: number | null
          conversations_resolved: number | null
          created_at: string | null
          deals_created: number | null
          deals_value: number | null
          deals_won: number | null
          first_activity_at: string | null
          id: string
          last_activity_at: string | null
          messages_received: number | null
          messages_sent: number | null
          metric_date: string
          organization_id: string | null
          tasks_completed: number | null
          total_break_seconds: number | null
          total_lunch_seconds: number | null
          total_work_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_response_time_seconds?: number | null
          conversations_handled?: number | null
          conversations_resolved?: number | null
          created_at?: string | null
          deals_created?: number | null
          deals_value?: number | null
          deals_won?: number | null
          first_activity_at?: string | null
          id?: string
          last_activity_at?: string | null
          messages_received?: number | null
          messages_sent?: number | null
          metric_date?: string
          organization_id?: string | null
          tasks_completed?: number | null
          total_break_seconds?: number | null
          total_lunch_seconds?: number | null
          total_work_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_response_time_seconds?: number | null
          conversations_handled?: number | null
          conversations_resolved?: number | null
          created_at?: string | null
          deals_created?: number | null
          deals_value?: number | null
          deals_won?: number | null
          first_activity_at?: string | null
          id?: string
          last_activity_at?: string | null
          messages_received?: number | null
          messages_sent?: number | null
          metric_date?: string
          organization_id?: string | null
          tasks_completed?: number | null
          total_break_seconds?: number | null
          total_lunch_seconds?: number | null
          total_work_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_performance_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      user_status_history: {
        Row: {
          auto_detected: boolean | null
          changed_at: string
          id: string
          organization_id: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          auto_detected?: boolean | null
          changed_at?: string
          id?: string
          organization_id?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          auto_detected?: boolean | null
          changed_at?: string
          id?: string
          organization_id?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voip_calls: {
        Row: {
          ai_agent_config_id: string | null
          ai_enabled: boolean | null
          ai_transcript: string | null
          answered_at: string | null
          call_type: string | null
          called: string
          caller: string
          channel_name: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          deal_id: string | null
          device_id: string | null
          direction: string | null
          duration_seconds: number | null
          elevenlabs_conversation_id: string | null
          ended_at: string | null
          extension_id: string | null
          external_call_id: string | null
          freeswitch_uuid: string | null
          fusionpbx_config_id: string | null
          id: string
          organization_id: string | null
          recording_id: string | null
          recording_storage_path: string | null
          recording_url: string | null
          started_at: string | null
          status: string | null
          transcription: string | null
          transfer_from_call_id: string | null
          user_id: string
          voip_config_id: string | null
        }
        Insert: {
          ai_agent_config_id?: string | null
          ai_enabled?: boolean | null
          ai_transcript?: string | null
          answered_at?: string | null
          call_type?: string | null
          called: string
          caller: string
          channel_name?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          device_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          extension_id?: string | null
          external_call_id?: string | null
          freeswitch_uuid?: string | null
          fusionpbx_config_id?: string | null
          id?: string
          organization_id?: string | null
          recording_id?: string | null
          recording_storage_path?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          transcription?: string | null
          transfer_from_call_id?: string | null
          user_id: string
          voip_config_id?: string | null
        }
        Update: {
          ai_agent_config_id?: string | null
          ai_enabled?: boolean | null
          ai_transcript?: string | null
          answered_at?: string | null
          call_type?: string | null
          called?: string
          caller?: string
          channel_name?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          device_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          extension_id?: string | null
          external_call_id?: string | null
          freeswitch_uuid?: string | null
          fusionpbx_config_id?: string | null
          id?: string
          organization_id?: string | null
          recording_id?: string | null
          recording_storage_path?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          transcription?: string | null
          transfer_from_call_id?: string | null
          user_id?: string
          voip_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voip_calls_ai_agent_config_id_fkey"
            columns: ["ai_agent_config_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "funnel_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_fusionpbx_config_id_fkey"
            columns: ["fusionpbx_config_id"]
            isOneToOne: false
            referencedRelation: "fusionpbx_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_transfer_from_call_id_fkey"
            columns: ["transfer_from_call_id"]
            isOneToOne: false
            referencedRelation: "voip_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_calls_voip_config_id_fkey"
            columns: ["voip_config_id"]
            isOneToOne: false
            referencedRelation: "voip_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      voip_configurations: {
        Row: {
          api_key: string
          api_token: string
          created_at: string | null
          default_device_id: string | null
          default_src_number: string | null
          domain: string
          elevenlabs_agent_id: string | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key: string
          api_token: string
          created_at?: string | null
          default_device_id?: string | null
          default_src_number?: string | null
          domain?: string
          elevenlabs_agent_id?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          provider?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string
          api_token?: string
          created_at?: string | null
          default_device_id?: string | null
          default_src_number?: string | null
          domain?: string
          elevenlabs_agent_id?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voip_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voip_lines: {
        Row: {
          caller_id: string | null
          created_at: string | null
          description: string | null
          external_line_id: string
          id: string
          is_default: boolean | null
          line_number: string
          organization_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          voip_config_id: string | null
        }
        Insert: {
          caller_id?: string | null
          created_at?: string | null
          description?: string | null
          external_line_id: string
          id?: string
          is_default?: boolean | null
          line_number: string
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          voip_config_id?: string | null
        }
        Update: {
          caller_id?: string | null
          created_at?: string | null
          description?: string | null
          external_line_id?: string
          id?: string
          is_default?: boolean | null
          line_number?: string
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          voip_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voip_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voip_lines_voip_config_id_fkey"
            columns: ["voip_config_id"]
            isOneToOne: false
            referencedRelation: "voip_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_activities: {
        Row: {
          activity_type: string
          contact_phone: string | null
          content_preview: string | null
          created_at: string
          error_message: string | null
          id: string
          instance_id: string
          schedule_id: string
          success: boolean
        }
        Insert: {
          activity_type: string
          contact_phone?: string | null
          content_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id: string
          schedule_id: string
          success?: boolean
        }
        Update: {
          activity_type?: string
          contact_phone?: string | null
          content_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string
          schedule_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "warming_activities_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_activities_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "warming_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_contacts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          phone: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          phone: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          phone?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      warming_content: {
        Row: {
          category: string
          content: string | null
          content_type: string
          created_at: string
          id: string
          is_active: boolean
          media_url: string | null
          user_id: string
        }
        Insert: {
          category?: string
          content?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          media_url?: string | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          media_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      warming_pairs: {
        Row: {
          created_at: string
          id: string
          instance_a_id: string
          instance_b_id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_a_id: string
          instance_b_id: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_a_id?: string
          instance_b_id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warming_pairs_instance_a_id_fkey"
            columns: ["instance_a_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_pairs_instance_b_id_fkey"
            columns: ["instance_b_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_pool: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          is_active: boolean | null
          joined_at: string | null
          last_paired_at: string | null
          phone_number: string
          total_pairs_made: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          is_active?: boolean | null
          joined_at?: string | null
          last_paired_at?: string | null
          phone_number: string
          total_pairs_made?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          is_active?: boolean | null
          joined_at?: string | null
          last_paired_at?: string | null
          phone_number?: string
          total_pairs_made?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warming_pool_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_pool_pairs: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          messages_exchanged: number | null
          pool_entry_a_id: string
          pool_entry_b_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          messages_exchanged?: number | null
          pool_entry_a_id: string
          pool_entry_b_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          messages_exchanged?: number | null
          pool_entry_a_id?: string
          pool_entry_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warming_pool_pairs_pool_entry_a_id_fkey"
            columns: ["pool_entry_a_id"]
            isOneToOne: false
            referencedRelation: "warming_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warming_pool_pairs_pool_entry_b_id_fkey"
            columns: ["pool_entry_b_id"]
            isOneToOne: false
            referencedRelation: "warming_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      warming_schedules: {
        Row: {
          created_at: string
          current_day: number
          id: string
          instance_id: string
          last_activity_at: string | null
          messages_received_today: number
          messages_sent_today: number
          messages_target_today: number
          start_date: string | null
          status: string
          target_days: number
          total_messages_received: number
          total_messages_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_day?: number
          id?: string
          instance_id: string
          last_activity_at?: string | null
          messages_received_today?: number
          messages_sent_today?: number
          messages_target_today?: number
          start_date?: string | null
          status?: string
          target_days?: number
          total_messages_received?: number
          total_messages_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_day?: number
          id?: string
          instance_id?: string
          last_activity_at?: string | null
          messages_received_today?: number
          messages_sent_today?: number
          messages_target_today?: number
          start_date?: string | null
          status?: string
          target_days?: number
          total_messages_received?: number
          total_messages_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warming_schedules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          chip_device: string | null
          connected_at: string | null
          created_at: string | null
          default_funnel_id: string | null
          device_label: string | null
          evolution_instance_name: string | null
          id: string
          instance_name: string
          is_business: boolean | null
          is_notification_only: boolean | null
          organization_id: string | null
          phone_number: string | null
          profile_name: string | null
          profile_picture_url: string | null
          profile_status: string | null
          qr_code: string | null
          qr_code_updated_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          warming_level: number
          whatsapp_device: string | null
        }
        Insert: {
          chip_device?: string | null
          connected_at?: string | null
          created_at?: string | null
          default_funnel_id?: string | null
          device_label?: string | null
          evolution_instance_name?: string | null
          id?: string
          instance_name: string
          is_business?: boolean | null
          is_notification_only?: boolean | null
          organization_id?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          profile_status?: string | null
          qr_code?: string | null
          qr_code_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          warming_level?: number
          whatsapp_device?: string | null
        }
        Update: {
          chip_device?: string | null
          connected_at?: string | null
          created_at?: string | null
          default_funnel_id?: string | null
          device_label?: string | null
          evolution_instance_name?: string | null
          id?: string
          instance_name?: string
          is_business?: boolean | null
          is_notification_only?: boolean | null
          organization_id?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          profile_status?: string | null
          qr_code?: string | null
          qr_code_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          warming_level?: number
          whatsapp_device?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_default_funnel_id_fkey"
            columns: ["default_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wil_chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          messages: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_abandoned_sessions: { Args: never; Returns: number }
      get_member_instance_ids: { Args: { _user_id: string }; Returns: string[] }
      get_organization_member_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_team_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_instance_org_admin: {
        Args: { _instance_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      member_has_instance_restriction: {
        Args: { _user_id: string }
        Returns: boolean
      }
      reset_leads_monthly: { Args: never; Returns: undefined }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      broadcast_list_type: "manual" | "dynamic"
      funnel_action_type:
        | "send_message"
        | "send_template"
        | "add_tag"
        | "remove_tag"
        | "notify_user"
        | "move_stage"
        | "trigger_chatbot_flow"
        | "set_custom_field"
        | "set_deal_value"
        | "change_responsible"
        | "add_note"
        | "webhook_request"
        | "create_task"
        | "close_deal_won"
        | "close_deal_lost"
        | "ai_analyze_and_move"
      funnel_trigger_type:
        | "on_stage_enter"
        | "on_stage_exit"
        | "on_deal_won"
        | "on_deal_lost"
        | "on_time_in_stage"
        | "on_message_received"
        | "on_keyword_received"
        | "on_contact_created"
        | "on_tag_added"
        | "on_tag_removed"
        | "on_inactivity"
        | "on_deal_value_changed"
        | "on_custom_field_changed"
        | "on_webhook"
        | "on_form_submission"
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
      funnel_action_type: [
        "send_message",
        "send_template",
        "add_tag",
        "remove_tag",
        "notify_user",
        "move_stage",
        "trigger_chatbot_flow",
        "set_custom_field",
        "set_deal_value",
        "change_responsible",
        "add_note",
        "webhook_request",
        "create_task",
        "close_deal_won",
        "close_deal_lost",
        "ai_analyze_and_move",
      ],
      funnel_trigger_type: [
        "on_stage_enter",
        "on_stage_exit",
        "on_deal_won",
        "on_deal_lost",
        "on_time_in_stage",
        "on_message_received",
        "on_keyword_received",
        "on_contact_created",
        "on_tag_added",
        "on_tag_removed",
        "on_inactivity",
        "on_deal_value_changed",
        "on_custom_field_changed",
        "on_webhook",
        "on_form_submission",
      ],
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
