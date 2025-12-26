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
          fallback_message: string | null
          funnel_id: string | null
          goodbye_message: string | null
          greeting_message: string | null
          handoff_keywords: string[] | null
          id: string
          is_active: boolean | null
          max_interactions: number | null
          personality_prompt: string | null
          response_delay_max: number | null
          response_delay_min: number | null
          response_mode: string | null
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
          fallback_message?: string | null
          funnel_id?: string | null
          goodbye_message?: string | null
          greeting_message?: string | null
          handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean | null
          max_interactions?: number | null
          personality_prompt?: string | null
          response_delay_max?: number | null
          response_delay_min?: number | null
          response_mode?: string | null
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
          fallback_message?: string | null
          funnel_id?: string | null
          goodbye_message?: string | null
          greeting_message?: string | null
          handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean | null
          max_interactions?: number | null
          personality_prompt?: string | null
          response_delay_max?: number | null
          response_delay_min?: number | null
          response_mode?: string | null
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
      conversations: {
        Row: {
          ai_handled: boolean | null
          ai_handoff_reason: string | null
          ai_handoff_requested: boolean | null
          ai_interactions_count: number | null
          ai_paused: boolean | null
          campaign_id: string | null
          contact_id: string
          created_at: string
          id: string
          instance_id: string | null
          is_pinned: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          preferred_response_format: string | null
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
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          instance_id?: string | null
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          preferred_response_format?: string | null
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
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          is_pinned?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          preferred_response_format?: string | null
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
      deal_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
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
        ]
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
          deal_id: string
          from_stage_id: string | null
          id: string
          notes: string | null
          to_stage_id: string | null
        }
        Insert: {
          changed_at?: string | null
          deal_id: string
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Update: {
          changed_at?: string | null
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
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
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sent_at?: string | null
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
        ]
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
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
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
          created_at: string | null
          email: string
          id: string
          invited_at: string | null
          joined_at: string | null
          organization_id: string
          permissions: Json | null
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          organization_id: string
          permissions?: Json | null
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invited_at?: string | null
          joined_at?: string | null
          organization_id?: string
          permissions?: Json | null
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
          created_at: string | null
          default_funnel_id: string | null
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
          default_funnel_id?: string | null
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
          default_funnel_id?: string | null
          id?: string
          instance_name?: string
          qr_code?: string | null
          qr_code_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          warming_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_default_funnel_id_fkey"
            columns: ["default_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      funnel_trigger_type:
        | "on_stage_enter"
        | "on_stage_exit"
        | "on_deal_won"
        | "on_deal_lost"
        | "on_time_in_stage"
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
      ],
      funnel_trigger_type: [
        "on_stage_enter",
        "on_stage_exit",
        "on_deal_won",
        "on_deal_lost",
        "on_time_in_stage",
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
