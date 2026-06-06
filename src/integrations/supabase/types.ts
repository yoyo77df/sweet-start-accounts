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
      announcements: {
        Row: {
          active: boolean
          audience: Database["public"]["Enums"]["announcement_audience"]
          bg_color: string
          body: string
          created_at: string
          id: string
          text_color: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: Database["public"]["Enums"]["announcement_audience"]
          bg_color?: string
          body: string
          created_at?: string
          id?: string
          text_color?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: Database["public"]["Enums"]["announcement_audience"]
          bg_color?: string
          body?: string
          created_at?: string
          id?: string
          text_color?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          admin_id: string | null
          created_at: string
          delta: number
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          delta: number
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          active: boolean
          allow_thumbnail: boolean
          created_at: string
          credits: number
          features: Json
          id: string
          max_resolution: Database["public"]["Enums"]["resolution_tier"]
          popular: boolean
          price: number
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          allow_thumbnail?: boolean
          created_at?: string
          credits: number
          features?: Json
          id?: string
          max_resolution?: Database["public"]["Enums"]["resolution_tier"]
          popular?: boolean
          price: number
          sort_order?: number
          title: string
        }
        Update: {
          active?: boolean
          allow_thumbnail?: boolean
          created_at?: string
          credits?: number
          features?: Json
          id?: string
          max_resolution?: Database["public"]["Enums"]["resolution_tier"]
          popular?: boolean
          price?: number
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          resolution: Database["public"]["Enums"]["resolution_tier"]
          table_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          resolution?: Database["public"]["Enums"]["resolution_tier"]
          table_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          resolution?: Database["public"]["Enums"]["resolution_tier"]
          table_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "point_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          credits: number
          id: string
          max_resolution: Database["public"]["Enums"]["resolution_tier"]
          package_id: string | null
          package_name: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reject_reason: string | null
          reviewed_at: string | null
          sender_number: string
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credits: number
          id?: string
          max_resolution?: Database["public"]["Enums"]["resolution_tier"]
          package_id?: string | null
          package_name: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          reject_reason?: string | null
          reviewed_at?: string | null
          sender_number: string
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          id?: string
          max_resolution?: Database["public"]["Enums"]["resolution_tier"]
          package_id?: string | null
          package_name?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reject_reason?: string | null
          reviewed_at?: string | null
          sender_number?: string
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      point_tables: {
        Row: {
          created_at: string
          data: Json
          id: string
          image_url: string | null
          template_id: string | null
          tournament_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          image_url?: string | null
          template_id?: string | null
          tournament_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          image_url?: string | null
          template_id?: string | null
          tournament_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_tables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          can_upload_thumbnails: boolean
          created_at: string
          credits: number
          email: string | null
          id: string
          max_resolution: Database["public"]["Enums"]["resolution_tier"]
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          can_upload_thumbnails?: boolean
          created_at?: string
          credits?: number
          email?: string | null
          id: string
          max_resolution?: Database["public"]["Enums"]["resolution_tier"]
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          can_upload_thumbnails?: boolean
          created_at?: string
          credits?: number
          email?: string | null
          id?: string
          max_resolution?: Database["public"]["Enums"]["resolution_tier"]
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          accent_color: string
          active: boolean
          coordinates: Json
          created_at: string
          id: string
          image_url: string
          name: string
          premium: boolean
        }
        Insert: {
          accent_color?: string
          active?: boolean
          coordinates?: Json
          created_at?: string
          id?: string
          image_url: string
          name: string
          premium?: boolean
        }
        Update: {
          accent_color?: string
          active?: boolean
          coordinates?: Json
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          premium?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_thumbnails: {
        Row: {
          accent_color: string
          created_at: string
          id: string
          image_url: string
          name: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          id?: string
          image_url: string
          name: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_credits: {
        Args: { _delta: number; _reason: string; _user_id: string }
        Returns: number
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_thumbnail_access: {
        Args: { _allow: boolean; _user_id: string }
        Returns: undefined
      }
      admin_set_user_quality: {
        Args: {
          _quality: Database["public"]["Enums"]["resolution_tier"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      approve_payment: { Args: { _request_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned: { Args: { _uid: string }; Returns: boolean }
      reject_payment: {
        Args: { _reason: string; _request_id: string }
        Returns: undefined
      }
      resolution_rank: {
        Args: { _r: Database["public"]["Enums"]["resolution_tier"] }
        Returns: number
      }
      spend_credit_for_download: {
        Args: {
          _resolution: Database["public"]["Enums"]["resolution_tier"]
          _table_id: string
        }
        Returns: number
      }
    }
    Enums: {
      announcement_audience: "all" | "admin" | "user"
      app_role: "admin" | "user"
      payment_method: "bkash" | "nagad"
      payment_status: "pending" | "approved" | "rejected"
      resolution_tier: "244p" | "480p" | "720p" | "1080p" | "2k" | "4k"
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
      announcement_audience: ["all", "admin", "user"],
      app_role: ["admin", "user"],
      payment_method: ["bkash", "nagad"],
      payment_status: ["pending", "approved", "rejected"],
      resolution_tier: ["244p", "480p", "720p", "1080p", "2k", "4k"],
    },
  },
} as const
