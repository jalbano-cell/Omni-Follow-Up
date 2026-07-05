/**
 * Hand-written to match supabase/migrations/0001_init_schema.sql exactly.
 * If the schema changes, update this file in the same commit — there's no
 * codegen step wired up yet (would use `supabase gen types typescript`
 * once the Supabase CLI is linked to the project).
 */

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          business_name: string;
          owner_name: string;
          owner_email: string;
          password_hash: string;
          follow_up_cadence_sent_days: number | null;
          follow_up_cadence_followup1_days: number | null;
          follow_up_cadence_followup2_days: number | null;
          onboarding_step: number;
          onboarding_completed_at: string | null;
          google_refresh_token_enc: string | null;
          google_connected_email: string | null;
          google_scopes: string | null;
          google_connected_at: string | null;
          calendar_id: string | null;
          industry: string | null;
          timezone: string | null;
          working_hours_start: number | null;
          working_hours_end: number | null;
          email_signature: string | null;
          intake_api_key: string | null;
          intake_api_key_created_at: string | null;
          created_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["workspaces"]["Row"]> &
          Pick<Database["public"]["Tables"]["workspaces"]["Row"], "business_name" | "owner_name" | "owner_email" | "password_hash">;
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Row"]>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          workspace_id: string;
          role: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> &
          Pick<Database["public"]["Tables"]["users"]["Row"], "email" | "workspace_id">;
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      leads: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string;
          name: string;
          email: string;
          phone: string;
          company: string;
          service: string;
          message: string;
          status: string;
          source: string;
          ip_address: string | null;
          user_agent: string | null;
          converted_estimate_id: string | null;
          assigned_to: string;
          internal_notes: string;
          ai_summary: string | null;
          ai_category: string | null;
          ai_priority: string | null;
          ai_priority_reason: string | null;
          ai_opportunity_value_range: string | null;
          ai_opportunity_confidence: string | null;
          suggested_next_action: string | null;
          ai_response_urgency: string | null;
          ai_response_urgency_reason: string | null;
          ai_generated_at: string | null;
          ai_status: string;
          created_at: string;
          last_activity_at: string;
          updated_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["leads"]["Row"]> &
          Pick<Database["public"]["Tables"]["leads"]["Row"], "workspace_id" | "lead_id" | "name" | "email" | "message">;
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
      };
      estimates: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string | null;
          customer_name: string;
          customer_email: string;
          business_name: string;
          service_type: string;
          value: number;
          status: string;
          date_sent: string;
          next_followup_date: string | null;
          last_contact_date: string | null;
          notes: string;
          gmail_thread_id: string | null;
          gmail_last_message_id: string | null;
          created_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["estimates"]["Row"]> &
          Pick<Database["public"]["Tables"]["estimates"]["Row"], "workspace_id" | "customer_name" | "customer_email">;
        Update: Partial<Database["public"]["Tables"]["estimates"]["Row"]>;
      };
      followups: {
        Row: {
          id: string;
          workspace_id: string;
          estimate_id: string;
          message: string;
          status: string;
          scheduled_date: string;
          sent_at: string | null;
          calendar_event_id: string | null;
          created_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["followups"]["Row"]> &
          Pick<Database["public"]["Tables"]["followups"]["Row"], "workspace_id" | "estimate_id" | "message" | "scheduled_date">;
        Update: Partial<Database["public"]["Tables"]["followups"]["Row"]>;
      };
      replies: {
        Row: {
          id: string;
          workspace_id: string;
          estimate_id: string;
          gmail_message_id: string;
          gmail_thread_id: string;
          from_email: string;
          subject: string;
          snippet: string;
          body_text: string;
          received_at: string;
          is_read: boolean;
          created_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["replies"]["Row"]> &
          Pick<Database["public"]["Tables"]["replies"]["Row"], "workspace_id" | "estimate_id" | "gmail_message_id" | "gmail_thread_id" | "from_email" | "received_at">;
        Update: Partial<Database["public"]["Tables"]["replies"]["Row"]>;
      };
      activity_logs: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string | null;
          action: string;
          description: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["activity_logs"]["Row"]> &
          Pick<Database["public"]["Tables"]["activity_logs"]["Row"], "workspace_id" | "action">;
        Update: Partial<Database["public"]["Tables"]["activity_logs"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          lead_id: string | null;
          type: string;
          message: string;
          is_read: boolean;
          created_at: string;
          airtable_record_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> &
          Pick<Database["public"]["Tables"]["notifications"]["Row"], "workspace_id" | "type" | "message">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
    };
  };
}
