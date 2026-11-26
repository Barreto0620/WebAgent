// Gerado a partir do schema do Supabase (projeto WebAgent). Não editar à mão:
// regenere com `pnpm db:types` após cada migration.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          metadata: Json
          system_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          metadata?: Json
          system_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          metadata?: Json
          system_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "audit_logs_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          closes_at: string
          enabled: boolean
          id: string
          opens_at: string
          system_id: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          closes_at?: string
          enabled?: boolean
          id?: string
          opens_at?: string
          system_id: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          closes_at?: string
          enabled?: boolean
          id?: string
          opens_at?: string
          system_id?: string
          weekday?: number
        }
        Relationships: [
          { foreignKeyName: "business_hours_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      channel_secrets: {
        Row: { channel_id: string; data: Json; updated_at: string }
        Insert: { channel_id: string; data?: Json; updated_at?: string }
        Update: { channel_id?: string; data?: Json; updated_at?: string }
        Relationships: [
          { foreignKeyName: "channel_secrets_channel_id_fkey"; columns: ["channel_id"]; isOneToOne: true; referencedRelation: "channels"; referencedColumns: ["id"] },
        ]
      }
      channels: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          instance_name: string
          last_status_at: string | null
          name: string
          phone: string | null
          profile_name: string | null
          profile_picture_url: string | null
          provider: string
          status: Database["public"]["Enums"]["channel_status"]
          system_id: string
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name: string
          last_status_at?: string | null
          name: string
          phone?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["channel_status"]
          system_id: string
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_name?: string
          last_status_at?: string | null
          name?: string
          phone?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["channel_status"]
          system_id?: string
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "channels_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      consent_events: {
        Row: {
          actor_id: string | null
          contact_id: string
          created_at: string
          evidence: string | null
          id: string
          source: string
          status: Database["public"]["Enums"]["consent_status"]
          system_id: string
        }
        Insert: {
          actor_id?: string | null
          contact_id: string
          created_at?: string
          evidence?: string | null
          id?: string
          source: string
          status: Database["public"]["Enums"]["consent_status"]
          system_id: string
        }
        Update: {
          actor_id?: string | null
          contact_id?: string
          created_at?: string
          evidence?: string | null
          id?: string
          source?: string
          status?: Database["public"]["Enums"]["consent_status"]
          system_id?: string
        }
        Relationships: [
          { foreignKeyName: "consent_events_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] },
          { foreignKeyName: "consent_events_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          consent_updated_at: string | null
          created_at: string
          email: string | null
          id: string
          last_inbound_at: string | null
          name: string | null
          notes: string | null
          phone: string
          push_name: string | null
          system_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          consent_updated_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_inbound_at?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          push_name?: string | null
          system_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          consent_updated_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_inbound_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          push_name?: string | null
          system_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "contacts_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      conversations: {
        Row: {
          assignee_id: string | null
          channel_id: string
          contact_id: string
          created_at: string
          csat_score: number | null
          first_response_at: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          opened_outside_hours: boolean
          protocol: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          system_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          channel_id: string
          contact_id: string
          created_at?: string
          csat_score?: number | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          opened_outside_hours?: boolean
          protocol: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          system_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          channel_id?: string
          contact_id?: string
          created_at?: string
          csat_score?: number | null
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          opened_outside_hours?: boolean
          protocol?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          system_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "conversations_channel_id_fkey"; columns: ["channel_id"]; isOneToOne: false; referencedRelation: "channels"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      cookie_consents: {
        Row: {
          analytics: boolean
          anon_id: string | null
          created_at: string
          id: string
          necessary: boolean
          preferences: boolean
          user_agent: string | null
          user_id: string | null
          version: string
        }
        Insert: {
          analytics?: boolean
          anon_id?: string | null
          created_at?: string
          id?: string
          necessary?: boolean
          preferences?: boolean
          user_agent?: string | null
          user_id?: string | null
          version: string
        }
        Update: {
          analytics?: boolean
          anon_id?: string | null
          created_at?: string
          id?: string
          necessary?: boolean
          preferences?: boolean
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Relationships: []
      }
      data_requests: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          notes: string | null
          requester_contact: string
          requester_name: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["data_request_status"]
          system_id: string
          type: Database["public"]["Enums"]["data_request_type"]
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          notes?: string | null
          requester_contact: string
          requester_name: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["data_request_status"]
          system_id: string
          type: Database["public"]["Enums"]["data_request_type"]
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          notes?: string | null
          requester_contact?: string
          requester_name?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["data_request_status"]
          system_id?: string
          type?: Database["public"]["Enums"]["data_request_type"]
        }
        Relationships: [
          { foreignKeyName: "data_requests_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] },
          { foreignKeyName: "data_requests_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      holidays: {
        Row: { created_at: string; date: string; id: string; name: string; system_id: string | null }
        Insert: { created_at?: string; date: string; id?: string; name: string; system_id?: string | null }
        Update: { created_at?: string; date?: string; id?: string; name?: string; system_id?: string | null }
        Relationships: [
          { foreignKeyName: "holidays_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          error: string | null
          external_id: string | null
          id: string
          is_internal: boolean
          media_mime: string | null
          media_path: string | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status: Database["public"]["Enums"]["message_status"]
          system_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          external_id?: string | null
          id?: string
          is_internal?: boolean
          media_mime?: string | null
          media_path?: string | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"]
          system_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          error?: string | null
          external_id?: string | null
          id?: string
          is_internal?: boolean
          media_mime?: string | null
          media_path?: string | null
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"]
          system_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          { foreignKeyName: "messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_platform_admin: boolean
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_platform_admin?: boolean
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_platform_admin?: boolean
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocol_counters: {
        Row: { day: string; last_value: number; system_id: string }
        Insert: { day: string; last_value?: number; system_id: string }
        Update: { day?: string; last_value?: number; system_id?: string }
        Relationships: [
          { foreignKeyName: "protocol_counters_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      quick_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
          system_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
          system_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
          system_id?: string
          title?: string
        }
        Relationships: [
          { foreignKeyName: "quick_replies_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      system_heartbeats: {
        Row: { created_at: string; id: number; source: string }
        Insert: { created_at?: string; id?: never; source?: string }
        Update: { created_at?: string; id?: never; source?: string }
        Relationships: []
      }
      system_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["system_role"]
          system_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["system_role"]
          system_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["system_role"]
          system_id?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "system_members_system_id_fkey"; columns: ["system_id"]; isOneToOne: false; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      system_settings: {
        Row: {
          away_enabled: boolean
          away_message: string
          closing_enabled: boolean
          closing_message: string
          opt_out_message: string
          retention_days: number
          system_id: string
          updated_at: string
          welcome_cooldown_minutes: number
          welcome_enabled: boolean
          welcome_message: string
        }
        Insert: {
          away_enabled?: boolean
          away_message?: string
          closing_enabled?: boolean
          closing_message?: string
          opt_out_message?: string
          retention_days?: number
          system_id: string
          updated_at?: string
          welcome_cooldown_minutes?: number
          welcome_enabled?: boolean
          welcome_message?: string
        }
        Update: {
          away_enabled?: boolean
          away_message?: string
          closing_enabled?: boolean
          closing_message?: string
          opt_out_message?: string
          retention_days?: number
          system_id?: string
          updated_at?: string
          welcome_cooldown_minutes?: number
          welcome_enabled?: boolean
          welcome_message?: string
        }
        Relationships: [
          { foreignKeyName: "system_settings_system_id_fkey"; columns: ["system_id"]; isOneToOne: true; referencedRelation: "systems"; referencedColumns: ["id"] },
        ]
      }
      systems: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          protocol_prefix: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          protocol_prefix: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          protocol_prefix?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_audit: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_metadata?: Json
          p_system: string
        }
        Returns: undefined
      }
      next_protocol: { Args: { p_system: string }; Returns: string }
    }
    Enums: {
      channel_status: "disconnected" | "connecting" | "connected" | "error"
      channel_type: "whatsapp" | "instagram" | "facebook" | "tiktok"
      consent_status: "unknown" | "opt_in" | "opt_out"
      conversation_status: "bot" | "queued" | "open" | "pending" | "resolved"
      data_request_status: "open" | "in_progress" | "done" | "rejected"
      data_request_type: "access" | "correction" | "deletion" | "portability" | "revocation"
      message_direction: "in" | "out"
      message_status: "queued" | "sent" | "delivered" | "read" | "failed" | "received"
      message_type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact" | "other"
      sender_type: "contact" | "agent" | "bot" | "system"
      system_role: "admin" | "supervisor" | "agent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
