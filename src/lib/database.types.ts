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
      agents: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          region: string | null
          community: string | null
          location: string | null
          photo_url: string | null
          status: 'ACTIVE' | 'INACTIVE'
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          phone?: string | null
          region?: string | null
          community?: string | null
          location?: string | null
          photo_url?: string | null
          status?: 'ACTIVE' | 'INACTIVE'
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          region?: string | null
          community?: string | null
          location?: string | null
          photo_url?: string | null
          status?: 'ACTIVE' | 'INACTIVE'
          created_at?: string
        }
      }
      agent_expenses: {
        Row: {
          id: string
          agent_id: string
          expense_type: string
          amount: number
          expense_date: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          expense_type: string
          amount: number
          expense_date?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          expense_type?: string
          amount?: number
          expense_date?: string
          created_by?: string | null
          created_at?: string
        }
      }
      cash_advances: {
        Row: {
          id: string
          agent_id: string
          advance_date: string
          amount: number
          payment_method: 'CASH' | 'MOMO' | 'BANK'
          notes: string | null
          signed_by: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          advance_date?: string
          amount: number
          payment_method?: 'CASH' | 'MOMO' | 'BANK'
          notes?: string | null
          signed_by?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          advance_date?: string
          amount?: number
          payment_method?: 'CASH' | 'MOMO' | 'BANK'
          notes?: string | null
          signed_by?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      fruit_collections: {
        Row: {
          id: string
          agent_id: string
          collection_date: string
          weight_kg: number
          notes: string | null
          driver_name: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          collection_date?: string
          weight_kg: number
          notes?: string | null
          driver_name?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          collection_date?: string
          weight_kg?: number
          notes?: string | null
          driver_name?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      monthly_reconciliations: {
        Row: {
          id: string
          agent_id: string
          month: string
          total_advance: number
          total_weight_kg: number
          status: 'OPEN' | 'RENDERED' | 'CLOSED'
          comments: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          month: string
          total_advance?: number
          total_weight_kg?: number
          status?: 'OPEN' | 'RENDERED' | 'CLOSED'
          comments?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          month?: string
          total_advance?: number
          total_weight_kg?: number
          status?: 'OPEN' | 'RENDERED' | 'CLOSED'
          comments?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      user_agent_map: {
        Row: {
          user_id: string
          agent_id: string | null
          role: 'ADMIN' | 'AGENT'
        }
        Insert: {
          user_id: string
          agent_id?: string | null
          role: 'ADMIN' | 'AGENT'
        }
        Update: {
          user_id?: string
          agent_id?: string | null
          role?: 'ADMIN' | 'AGENT'
        }
      }
    }
  }
}
