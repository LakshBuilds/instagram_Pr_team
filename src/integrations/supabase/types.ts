export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          video_id: string | null
          channel_name: string | null
          channel_id: string | null
          title: string | null
          description: string | null
          published_at: string | null
          thumbnail_url: string | null
          video_url: string | null
          duration: string | null
          duration_seconds: number | null
          view_count: number | null
          like_count: number | null
          dislike_count: number | null
          comment_count: number | null
          subscriber_count: number | null
          category: string | null
          tags: string[] | null
          language: string | null
          is_short: boolean | null
          is_live: boolean | null
          is_archived: boolean | null
          payout: number | null
          locationname: string | null
          created_by_user_id: string | null
          created_by_email: string | null
          created_by_name: string | null
          last_updated_at: string | null
          created_at: string | null
          updated_at: string | null
          refresh_failed: boolean | null
          decay_priority: number | null
          last_refresh_at: string | null
          refresh_count: number | null
        }
        Insert: {
          id?: string
          video_id?: string | null
          channel_name?: string | null
          channel_id?: string | null
          title?: string | null
          description?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          video_url?: string | null
          duration?: string | null
          duration_seconds?: number | null
          view_count?: number | null
          like_count?: number | null
          dislike_count?: number | null
          comment_count?: number | null
          subscriber_count?: number | null
          category?: string | null
          tags?: string[] | null
          language?: string | null
          is_short?: boolean | null
          is_live?: boolean | null
          is_archived?: boolean | null
          payout?: number | null
          locationname?: string | null
          created_by_user_id?: string | null
          created_by_email?: string | null
          created_by_name?: string | null
          last_updated_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          refresh_failed?: boolean | null
          decay_priority?: number | null
          last_refresh_at?: string | null
          refresh_count?: number | null
        }
        Update: {
          id?: string
          video_id?: string | null
          channel_name?: string | null
          channel_id?: string | null
          title?: string | null
          description?: string | null
          published_at?: string | null
          thumbnail_url?: string | null
          video_url?: string | null
          duration?: string | null
          duration_seconds?: number | null
          view_count?: number | null
          like_count?: number | null
          dislike_count?: number | null
          comment_count?: number | null
          subscriber_count?: number | null
          category?: string | null
          tags?: string[] | null
          language?: string | null
          is_short?: boolean | null
          is_live?: boolean | null
          is_archived?: boolean | null
          payout?: number | null
          locationname?: string | null
          created_by_user_id?: string | null
          created_by_email?: string | null
          created_by_name?: string | null
          last_updated_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          refresh_failed?: boolean | null
          decay_priority?: number | null
          last_refresh_at?: string | null
          refresh_count?: number | null
        }
        Relationships: []
      }
      views_history: {
        Row: {
          id: string
          video_id: string | null
          youtube_video_id: string | null
          channel_name: string | null
          view_count: number | null
          like_count: number | null
          comment_count: number | null
          recorded_at: string
          published_at: string | null
          updated_by_email: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          video_id?: string | null
          youtube_video_id?: string | null
          channel_name?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          recorded_at?: string
          published_at?: string | null
          updated_by_email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          video_id?: string | null
          youtube_video_id?: string | null
          channel_name?: string | null
          view_count?: number | null
          like_count?: number | null
          comment_count?: number | null
          recorded_at?: string
          published_at?: string | null
          updated_by_email?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      weekly_snapshots: {
        Row: {
          id: string
          week_start_date: string
          total_views: number
          total_videos: number
          total_likes: number
          total_comments: number
          total_payout: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          week_start_date: string
          total_views?: number
          total_videos?: number
          total_likes?: number
          total_comments?: number
          total_payout?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          week_start_date?: string
          total_views?: number
          total_videos?: number
          total_likes?: number
          total_comments?: number
          total_payout?: number | null
          created_at?: string | null
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const
