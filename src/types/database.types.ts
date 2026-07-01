export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      b2b_integrations: {
        Row: {
          id: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          enabled: boolean
          api_url: string | null
          api_key: string | null
          client_id: string | null
          client_secret: string | null
          username: string | null
          password: string | null
          sync_interval: '5m' | '15m' | '30m' | '1h'
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          enabled?: boolean
          api_url?: string | null
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          username?: string | null
          password?: string | null
          sync_interval?: '5m' | '15m' | '30m' | '1h'
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          enabled?: boolean
          api_url?: string | null
          api_key?: string | null
          client_id?: string | null
          client_secret?: string | null
          username?: string | null
          password?: string | null
          sync_interval?: '5m' | '15m' | '30m' | '1h'
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      b2b_leads: {
        Row: {
          id: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          external_lead_id: string
          buyer_name: string | null
          company_name: string | null
          mobile: string | null
          alternate_mobile: string | null
          email: string | null
          city: string | null
          state: string | null
          country: string | null
          product_name: string | null
          quantity: string | null
          message: string | null
          status: 'pending' | 'assigned' | 'contacted' | 'converted' | 'rejected'
          received_at: string
          inquiry_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          external_lead_id: string
          buyer_name?: string | null
          company_name?: string | null
          mobile?: string | null
          alternate_mobile?: string | null
          email?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          product_name?: string | null
          quantity?: string | null
          message?: string | null
          status?: 'pending' | 'assigned' | 'contacted' | 'converted' | 'rejected'
          received_at?: string
          inquiry_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA'
          external_lead_id?: string
          buyer_name?: string | null
          company_name?: string | null
          mobile?: string | null
          alternate_mobile?: string | null
          email?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          product_name?: string | null
          quantity?: string | null
          message?: string | null
          status?: 'pending' | 'assigned' | 'contacted' | 'converted' | 'rejected'
          received_at?: string
          inquiry_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      b2b_raw_logs: {
        Row: {
          id: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          payload_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          payload_json: Json
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          payload_json?: Json
          created_at?: string
        }
      }
      notification_recipients: {
        Row: {
          id: string
          account_id: string
          name: string
          mobile: string
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          mobile: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          mobile?: string
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      lead_assignments: {
        Row: {
          id: string
          account_id: string
          lead_id: string
          staff_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          account_id: string
          lead_id: string
          staff_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          lead_id?: string
          staff_id?: string
          assigned_at?: string
        }
      }
      lead_conversations: {
        Row: {
          id: string
          account_id: string
          lead_id: string
          conversation_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          lead_id: string
          conversation_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          lead_id?: string
          conversation_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      followup_tasks: {
        Row: {
          id: string
          account_id: string
          lead_id: string
          assigned_to: string | null
          title: string
          description: string | null
          due_at: string | null
          status: 'pending' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          lead_id: string
          assigned_to?: string | null
          title: string
          description?: string | null
          due_at?: string | null
          status?: 'pending' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          lead_id?: string
          assigned_to?: string | null
          title?: string
          description?: string | null
          due_at?: string | null
          status?: 'pending' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
      }
      integration_logs: {
        Row: {
          id: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          event_type: string
          status: string
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          event_type: string
          status: string
          message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          event_type?: string
          status?: string
          message?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          full_name: string
          email: string
          avatar_url: string | null
          role: string
          created_at: string
          updated_at: string
          mobile: string | null
          department: string | null
          designation: string | null
          is_active: boolean
          account_id: string | null
          account_role: Database['public']['Enums']['account_role_enum'] | null
        }
        Insert: {
          id?: string
          user_id: string
          full_name: string
          email: string
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
          mobile?: string | null
          department?: string | null
          designation?: string | null
          is_active?: boolean
          account_id?: string | null
          account_role?: Database['public']['Enums']['account_role_enum'] | null
        }
        Update: {
          id?: string
          user_id?: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
          mobile?: string | null
          department?: string | null
          designation?: string | null
          is_active?: boolean
          account_id?: string | null
          account_role?: Database['public']['Enums']['account_role_enum'] | null
        }
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      permissions: {
        Row: {
          id: string
          module: string
          action: string
          description: string | null
        }
        Insert: {
          id?: string
          module: string
          action: string
          description?: string | null
        }
        Update: {
          id?: string
          module?: string
          action?: string
          description?: string | null
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role_id: string
        }
        Insert: {
          id?: string
          user_id: string
          role_id: string
        }
        Update: {
          id?: string
          user_id?: string
          role_id?: string
        }
      }
      role_permissions: {
        Row: {
          id: string
          role_id: string
          permission_id: string
        }
        Insert: {
          id?: string
          role_id: string
          permission_id: string
        }
        Update: {
          id?: string
          role_id?: string
          permission_id?: string
        }
      }
      user_login_logs: {
        Row: {
          id: string
          user_id: string | null
          ip_address: string | null
          device: string | null
          browser: string | null
          login_time: string | null
          logout_time: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          ip_address?: string | null
          device?: string | null
          browser?: string | null
          login_time?: string | null
          logout_time?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          ip_address?: string | null
          device?: string | null
          browser?: string | null
          login_time?: string | null
          logout_time?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          module: string
          action: string
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          module: string
          action: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          module?: string
          action?: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
      }
      conversation_settings: {
        Row: {
          id: string
          conversation_id: string
          is_pinned: boolean
          is_starred: boolean
          is_archived: boolean
          is_muted: boolean
          ai_replies_enabled: boolean
          notification_preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          is_pinned?: boolean
          is_starred?: boolean
          is_archived?: boolean
          is_muted?: boolean
          ai_replies_enabled?: boolean
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          is_pinned?: boolean
          is_starred?: boolean
          is_archived?: boolean
          is_muted?: boolean
          ai_replies_enabled?: boolean
          notification_preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      blocked_contacts: {
        Row: {
          id: string
          account_id: string
          contact_id: string
          blocked_by: string | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          contact_id: string
          blocked_by?: string | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          contact_id?: string
          blocked_by?: string | null
          reason?: string | null
          created_at?: string
        }
      }
      chat_notes: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          note_text: string
          is_pinned: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          note_text: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          note_text?: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      message_audit_logs: {
        Row: {
          id: string
          message_id: string
          user_id: string | null
          action: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id?: string | null
          action: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string | null
          action?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      conversation_audit_logs: {
        Row: {
          id: string
          conversation_id: string
          user_id: string | null
          action: string
          old_value: string | null
          new_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id?: string | null
          action: string
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string | null
          action?: string
          old_value?: string | null
          new_value?: string | null
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          app_name: string
          logo_url: string | null
          favicon_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          app_name: string
          logo_url?: string | null
          favicon_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          app_name?: string
          logo_url?: string | null
          favicon_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      whatsapp_config: {
        Row: {
          id: string
          account_id: string
          user_id: string
          phone_number_id: string
          waba_id: string | null
          access_token: string
          verify_token: string
          app_secret: string | null
          status: string
          connected_at: string | null
          registered_at: string | null
          subscribed_apps_at: string | null
          last_registration_error: string | null
          ai_enabled: boolean
          ai_only_free_models: boolean
          ai_model: string
          ai_system_prompt: string | null
          openrouter_api_key: string | null
          ai_provider: string | null
          gemini_api_key: string | null
          ai_fallback_enabled: boolean
          ai_model_status: string
          ai_last_error: string | null
          ai_last_success_at: string | null
          ai_available_models: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          user_id: string
          phone_number_id: string
          waba_id?: string | null
          access_token: string
          verify_token: string
          app_secret?: string | null
          status?: string
          connected_at?: string | null
          registered_at?: string | null
          subscribed_apps_at?: string | null
          last_registration_error?: string | null
          ai_enabled?: boolean
          ai_only_free_models?: boolean
          ai_model?: string
          ai_system_prompt?: string | null
          openrouter_api_key?: string | null
          ai_provider?: string | null
          gemini_api_key?: string | null
          ai_fallback_enabled?: boolean
          ai_model_status?: string
          ai_last_error?: string | null
          ai_last_success_at?: string | null
          ai_available_models?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          user_id?: string
          phone_number_id?: string
          waba_id?: string | null
          access_token?: string
          verify_token?: string
          app_secret?: string | null
          status?: string
          connected_at?: string | null
          registered_at?: string | null
          subscribed_apps_at?: string | null
          last_registration_error?: string | null
          ai_enabled?: boolean
          ai_only_free_models?: boolean
          ai_model?: string
          ai_system_prompt?: string | null
          openrouter_api_key?: string | null
          ai_provider?: string | null
          gemini_api_key?: string | null
          ai_fallback_enabled?: boolean
          ai_model_status?: string
          ai_last_error?: string | null
          ai_last_success_at?: string | null
          ai_available_models?: Json
          created_at?: string
          updated_at?: string
        }
      }
      ai_fallback_logs: {
        Row: {
          id: string
          account_id: string
          conversation_id: string | null
          selected_model: string
          failed_model: string | null
          fallback_model: string | null
          reason_for_fallback: string | null
          http_status: number | null
          latency_ms: number | null
          token_usage: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          conversation_id?: string | null
          selected_model: string
          failed_model?: string | null
          fallback_model?: string | null
          reason_for_fallback?: string | null
          http_status?: number | null
          latency_ms?: number | null
          token_usage?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          conversation_id?: string | null
          selected_model?: string
          failed_model?: string | null
          fallback_model?: string | null
          reason_for_fallback?: string | null
          http_status?: number | null
          latency_ms?: number | null
          token_usage?: Json | null
          created_at?: string
        }
      }
      integration_sync_state: {
        Row: {
          id: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          sync_status: string
          last_sync_at: string | null
          last_successful_sync: string | null
          last_lead_timestamp: string | null
          current_page: number
          retry_count: number
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          sync_status?: string
          last_sync_at?: string | null
          last_successful_sync?: string | null
          last_lead_timestamp?: string | null
          current_page?: number
          retry_count?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          sync_status?: string
          last_sync_at?: string | null
          last_successful_sync?: string | null
          last_lead_timestamp?: string | null
          current_page?: number
          retry_count?: number
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          started_at: string
          finished_at: string | null
          records_imported: number
          status: 'SUCCESS' | 'FAILED' | 'RUNNING'
          error_message: string | null
          duration: number | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          platform: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          started_at?: string
          finished_at?: string | null
          records_imported?: number
          status: 'SUCCESS' | 'FAILED' | 'RUNNING'
          error_message?: string | null
          duration?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          platform?: 'INDIAMART' | 'TRADEINDIA' | 'EXPORTERSINDIA' | 'ALIBABA'
          started_at?: string
          finished_at?: string | null
          records_imported?: number
          status?: 'SUCCESS' | 'FAILED' | 'RUNNING'
          error_message?: string | null
          duration?: number | null
          created_at?: string
        }
      }
    }
    Views: {
      users_profile: {
        Row: {
          id: string
          user_id: string
          full_name: string
          email: string
          avatar_url: string | null
          role: string
          account_id: string | null
          account_role: Database['public']['Enums']['account_role_enum'] | null
          mobile: string | null
          department: string | null
          designation: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
    }
    Functions: {
      is_account_member: {
        Args: {
          target_account_id: string
          min_role?: 'owner' | 'admin' | 'agent' | 'viewer'
        }
        Returns: boolean
      }
      upsert_b2b_lead: {
        Args: {
          p_account_id: string
          p_platform: string
          p_external_lead_id: string
          p_buyer_name?: string | null
          p_company_name?: string | null
          p_mobile?: string | null
          p_alternate_mobile?: string | null
          p_email?: string | null
          p_city?: string | null
          p_state?: string | null
          p_country?: string | null
          p_product_name?: string | null
          p_quantity?: string | null
          p_message?: string | null
          p_status?: string
          p_inquiry_at?: string | null
        }
        Returns: string
      }
      get_recent_b2b_leads: {
        Args: {
          p_account_id: string
          p_limit?: number
        }
        Returns: Database['public']['Tables']['b2b_leads']['Row'][]
      }
      get_lead_statistics: {
        Args: {
          p_account_id: string
        }
        Returns: {
          total_leads: number
          today_leads: number
          indiamart_leads: number
          tradeindia_leads: number
          exportersindia_leads: number
          assigned_leads: number
          unassigned_leads: number
        }[]
      }
      assign_lead_to_staff: {
        Args: {
          p_account_id: string
          p_lead_id: string
          p_staff_id: string
        }
        Returns: void
      }
      log_raw_api_response: {
        Args: {
          p_account_id: string
          p_platform: string
          p_payload: Json
        }
        Returns: string
      }
      search_leads: {
        Args: {
          p_account_id: string
          p_platform?: string | null
          p_city?: string | null
          p_state?: string | null
          p_status?: string | null
          p_product_name?: string | null
          p_start_date?: string | null
          p_end_date?: string | null
        }
        Returns: Database['public']['Tables']['b2b_leads']['Row'][]
      }
      soft_delete_lead: {
        Args: {
          p_account_id: string
          p_lead_id: string
        }
        Returns: void
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_permission: {
        Args: {
          p_module: string
          p_action: string
        }
        Returns: boolean
      }
      check_record_access: {
        Args: {
          p_record_department: string
        }
        Returns: boolean
      }
      log_audit_action: {
        Args: {
          p_module: string
          p_action: string
          p_old_value?: Json | null
          p_new_value?: Json | null
        }
        Returns: void
      }
    }
    Enums: {
      account_role_enum: 'owner' | 'admin' | 'agent' | 'viewer'
    }
  }
}
