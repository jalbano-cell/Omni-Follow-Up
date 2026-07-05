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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          lead_id: string | null
          metadata: Json | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          subject: string
          template_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          subject: string
          template_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          subject?: string
          template_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_attachments: {
        Row: {
          content_type: string | null
          estimate_id: string
          file_name: string
          id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          workspace_id: string
        }
        Insert: {
          content_type?: string | null
          estimate_id: string
          file_name: string
          id?: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          workspace_id: string
        }
        Update: {
          content_type?: string | null
          estimate_id?: string
          file_name?: string
          id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_attachments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          business_name: string
          created_at: string
          customer_email: string
          customer_name: string
          date_sent: string
          estimate_number: string
          gmail_last_message_id: string | null
          gmail_thread_id: string | null
          id: string
          last_contact_date: string | null
          lead_id: string | null
          next_followup_date: string | null
          notes: string
          service_type: string
          status: string
          value: number
          workspace_id: string
        }
        Insert: {
          business_name?: string
          created_at?: string
          customer_email: string
          customer_name: string
          date_sent?: string
          estimate_number: string
          gmail_last_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          last_contact_date?: string | null
          lead_id?: string | null
          next_followup_date?: string | null
          notes?: string
          service_type?: string
          status?: string
          value?: number
          workspace_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          date_sent?: string
          estimate_number?: string
          gmail_last_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          last_contact_date?: string | null
          lead_id?: string | null
          next_followup_date?: string | null
          notes?: string
          service_type?: string
          status?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          calendar_event_id: string | null
          created_at: string
          estimate_id: string
          id: string
          message: string
          scheduled_date: string
          sent_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string
          estimate_id: string
          id?: string
          message: string
          scheduled_date: string
          sent_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string
          estimate_id?: string
          id?: string
          message?: string
          scheduled_date?: string
          sent_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followups_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_category: string | null
          ai_generated_at: string | null
          ai_opportunity_confidence: string | null
          ai_opportunity_value_range: string | null
          ai_priority: string | null
          ai_priority_reason: string | null
          ai_response_urgency: string | null
          ai_response_urgency_reason: string | null
          ai_status: string
          ai_summary: string | null
          assigned_to: string
          company: string
          converted_estimate_id: string | null
          created_at: string
          email: string
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          internal_notes: string
          ip_address: string | null
          last_activity_at: string
          lead_id: string
          message: string
          name: string
          pending_appointment_date_time: string | null
          pending_appointment_duration_minutes: number | null
          phone: string
          possible_duplicate_of_lead_id: string | null
          service: string
          source: string
          status: string
          suggested_next_action: string | null
          updated_at: string
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          ai_category?: string | null
          ai_generated_at?: string | null
          ai_opportunity_confidence?: string | null
          ai_opportunity_value_range?: string | null
          ai_priority?: string | null
          ai_priority_reason?: string | null
          ai_response_urgency?: string | null
          ai_response_urgency_reason?: string | null
          ai_status?: string
          ai_summary?: string | null
          assigned_to?: string
          company?: string
          converted_estimate_id?: string | null
          created_at?: string
          email: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          internal_notes?: string
          ip_address?: string | null
          last_activity_at?: string
          lead_id: string
          message: string
          name: string
          pending_appointment_date_time?: string | null
          pending_appointment_duration_minutes?: number | null
          phone?: string
          possible_duplicate_of_lead_id?: string | null
          service?: string
          source?: string
          status?: string
          suggested_next_action?: string | null
          updated_at?: string
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          ai_category?: string | null
          ai_generated_at?: string | null
          ai_opportunity_confidence?: string | null
          ai_opportunity_value_range?: string | null
          ai_priority?: string | null
          ai_priority_reason?: string | null
          ai_response_urgency?: string | null
          ai_response_urgency_reason?: string | null
          ai_status?: string
          ai_summary?: string | null
          assigned_to?: string
          company?: string
          converted_estimate_id?: string | null
          created_at?: string
          email?: string
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          internal_notes?: string
          ip_address?: string | null
          last_activity_at?: string
          lead_id?: string
          message?: string
          name?: string
          pending_appointment_date_time?: string | null
          pending_appointment_duration_minutes?: number | null
          phone?: string
          possible_duplicate_of_lead_id?: string | null
          service?: string
          source?: string
          status?: string
          suggested_next_action?: string | null
          updated_at?: string
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_estimate_id_fkey"
            columns: ["converted_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_possible_duplicate_of_lead_id_fkey"
            columns: ["possible_duplicate_of_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          lead_id: string | null
          message: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          lead_id?: string | null
          message: string
          type: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          lead_id?: string | null
          message?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          max_leads_per_month: number | null
          max_users: number
          name: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          features?: Json
          id: string
          max_leads_per_month?: number | null
          max_users?: number
          name: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          max_leads_per_month?: number | null
          max_users?: number
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      replies: {
        Row: {
          body_text: string
          created_at: string
          estimate_id: string
          from_email: string
          gmail_message_id: string
          gmail_thread_id: string
          id: string
          is_read: boolean
          received_at: string
          snippet: string
          subject: string
          workspace_id: string
        }
        Insert: {
          body_text?: string
          created_at?: string
          estimate_id: string
          from_email: string
          gmail_message_id: string
          gmail_thread_id: string
          id?: string
          is_read?: boolean
          received_at: string
          snippet?: string
          subject?: string
          workspace_id: string
        }
        Update: {
          body_text?: string
          created_at?: string
          estimate_id?: string
          from_email?: string
          gmail_message_id?: string
          gmail_thread_id?: string
          id?: string
          is_read?: boolean
          received_at?: string
          snippet?: string
          subject?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replies_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          auto_book_appointments: boolean | null
          business_name: string
          calendar_id: string | null
          created_at: string
          email_signature: string | null
          follow_up_cadence_followup1_days: number | null
          follow_up_cadence_followup2_days: number | null
          follow_up_cadence_sent_days: number | null
          google_connected_at: string | null
          google_connected_email: string | null
          google_refresh_token_enc: string | null
          google_scopes: string | null
          id: string
          industry: string | null
          intake_api_key: string | null
          intake_api_key_created_at: string | null
          monitor_gmail_inbox: boolean | null
          notify_on_new_lead: boolean | null
          notify_on_reply: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number
          outbound_webhook_url: string | null
          owner_email: string
          owner_name: string
          password_hash: string
          timezone: string | null
          working_hours_end: number | null
          working_hours_start: number | null
        }
        Insert: {
          auto_book_appointments?: boolean | null
          business_name: string
          calendar_id?: string | null
          created_at?: string
          email_signature?: string | null
          follow_up_cadence_followup1_days?: number | null
          follow_up_cadence_followup2_days?: number | null
          follow_up_cadence_sent_days?: number | null
          google_connected_at?: string | null
          google_connected_email?: string | null
          google_refresh_token_enc?: string | null
          google_scopes?: string | null
          id?: string
          industry?: string | null
          intake_api_key?: string | null
          intake_api_key_created_at?: string | null
          monitor_gmail_inbox?: boolean | null
          notify_on_new_lead?: boolean | null
          notify_on_reply?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          outbound_webhook_url?: string | null
          owner_email: string
          owner_name: string
          password_hash: string
          timezone?: string | null
          working_hours_end?: number | null
          working_hours_start?: number | null
        }
        Update: {
          auto_book_appointments?: boolean | null
          business_name?: string
          calendar_id?: string | null
          created_at?: string
          email_signature?: string | null
          follow_up_cadence_followup1_days?: number | null
          follow_up_cadence_followup2_days?: number | null
          follow_up_cadence_sent_days?: number | null
          google_connected_at?: string | null
          google_connected_email?: string | null
          google_refresh_token_enc?: string | null
          google_scopes?: string | null
          id?: string
          industry?: string | null
          intake_api_key?: string | null
          intake_api_key_created_at?: string | null
          monitor_gmail_inbox?: boolean | null
          notify_on_new_lead?: boolean | null
          notify_on_reply?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          outbound_webhook_url?: string | null
          owner_email?: string
          owner_name?: string
          password_hash?: string
          timezone?: string | null
          working_hours_end?: number | null
          working_hours_start?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
