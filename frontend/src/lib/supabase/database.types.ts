/**
 * Database type — mirrors the output of `supabase gen types typescript` for
 * the canonical schema in `supabase/migrations/`. Regenerate via the CLI and
 * overwrite this file when the schema changes.
 *
 *   supabase gen types typescript --project-id <ref> \
 *     > frontend/src/lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------- enums ----------------
export type UserRoleDb           = 'student' | 'teacher' | 'admin';
export type StudentTypeDb        = 'woman' | 'child';
export type MemorizationLevelDb  = 'beginner' | 'intermediate' | 'advanced';
export type PreferredAudienceDb  = 'children' | 'women' | 'both';
export type AccountStatusDb      = 'pending' | 'active' | 'suspended';
export type HalaqahStatusDb      = 'active' | 'paused' | 'completed';
export type ReportTypeDb         = 'memorization' | 'review';
export type UserSegmentDb        = 'women' | 'men' | 'children' | 'non_arab_speakers';

// ---------------- database ----------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          second_name: string;
          third_name: string;
          phone: string;
          age: number | null;
          country: string | null;
          role: UserRoleDb;
          student_type: StudentTypeDb | null;
          memorization_level: MemorizationLevelDb | null;
          teaching_experience: string | null;
          preferred_audience: PreferredAudienceDb | null;
          available_times: Json;
          status: AccountStatusDb;
          created_at: string;
          updated_at: string;
          segment: UserSegmentDb;
          recitation: string | null;
          quran_parts_taught: number | null;
          is_certified: boolean;
          authorized_recitations: Json;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string;
          second_name?: string;
          third_name?: string;
          phone?: string;
          age?: number | null;
          country?: string | null;
          role?: UserRoleDb;
          student_type?: StudentTypeDb | null;
          memorization_level?: MemorizationLevelDb | null;
          teaching_experience?: string | null;
          preferred_audience?: PreferredAudienceDb | null;
          available_times?: Json;
          status?: AccountStatusDb;
          created_at?: string;
          updated_at?: string;
          segment?: UserSegmentDb;
          recitation?: string | null;
          quran_parts_taught?: number | null;
          is_certified?: boolean;
          authorized_recitations?: Json;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };

      halaqahs: {
        Row: {
          id: string;
          name: string;
          teacher_id: string | null;
          meet_link: string | null;
          level: MemorizationLevelDb | null;
          target_audience: PreferredAudienceDb | null;
          schedule: Json;
          status: HalaqahStatusDb;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          teacher_id?: string | null;
          meet_link?: string | null;
          level?: MemorizationLevelDb | null;
          target_audience?: PreferredAudienceDb | null;
          schedule?: Json;
          status?: HalaqahStatusDb;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['halaqahs']['Insert']>;
        Relationships: [
          { foreignKeyName: 'halaqahs_teacher_id_fkey'; columns: ['teacher_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };

      halaqah_members: {
        Row: {
          id: string;
          halaqah_id: string;
          student_id: string;
          joined_at: string;
          status: AccountStatusDb;
        };
        Insert: {
          id?: string;
          halaqah_id: string;
          student_id: string;
          joined_at?: string;
          status?: AccountStatusDb;
        };
        Update: Partial<Database['public']['Tables']['halaqah_members']['Insert']>;
        Relationships: [
          { foreignKeyName: 'halaqah_members_halaqah_id_fkey'; columns: ['halaqah_id']; referencedRelation: 'halaqahs';  referencedColumns: ['id'] },
          { foreignKeyName: 'halaqah_members_student_id_fkey'; columns: ['student_id']; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };

      reports: {
        Row: {
          id: string;
          student_id: string;
          halaqah_id: string;
          report_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          halaqah_id: string;
          report_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reports']['Insert']>;
        Relationships: [
          { foreignKeyName: 'reports_student_id_fkey'; columns: ['student_id']; referencedRelation: 'profiles';  referencedColumns: ['id'] },
          { foreignKeyName: 'reports_halaqah_id_fkey'; columns: ['halaqah_id']; referencedRelation: 'halaqahs';  referencedColumns: ['id'] },
        ];
      };

      report_items: {
        Row: {
          id: string;
          report_id: string;
          surah_name: string;
          pages: number;
          type: ReportTypeDb;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          surah_name: string;
          pages: number;
          type: ReportTypeDb;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['report_items']['Insert']>;
        Relationships: [
          { foreignKeyName: 'report_items_report_id_fkey'; columns: ['report_id']; referencedRelation: 'reports'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRoleDb;
      student_type: StudentTypeDb;
      memorization_level: MemorizationLevelDb;
      preferred_audience: PreferredAudienceDb;
      account_status: AccountStatusDb;
      halaqah_status: HalaqahStatusDb;
      report_type: ReportTypeDb;
      user_segment: UserSegmentDb;
    };
    CompositeTypes: Record<string, never>;
  };
}

// ---------------- convenience aliases ----------------
export type ProfileRow         = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert      = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate      = Database['public']['Tables']['profiles']['Update'];

export type HalaqahRow         = Database['public']['Tables']['halaqahs']['Row'];
export type HalaqahInsert      = Database['public']['Tables']['halaqahs']['Insert'];
export type HalaqahUpdate      = Database['public']['Tables']['halaqahs']['Update'];

export type HalaqahMemberRow   = Database['public']['Tables']['halaqah_members']['Row'];
export type HalaqahMemberInsert = Database['public']['Tables']['halaqah_members']['Insert'];

export type ReportRow          = Database['public']['Tables']['reports']['Row'];
export type ReportInsert       = Database['public']['Tables']['reports']['Insert'];

export type ReportItemRow      = Database['public']['Tables']['report_items']['Row'];
export type ReportItemInsert   = Database['public']['Tables']['report_items']['Insert'];
