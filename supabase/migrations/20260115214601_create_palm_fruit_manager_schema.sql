/*
  # Palm Fruit Manager Database Schema

  ## Overview
  This migration creates the complete database schema for the Palm Fruit Manager application,
  including tables for agents, cash advances, fruit collections, and monthly reconciliations.

  ## New Tables
  
  ### 1. `agents`
  Stores information about field agents who collect palm fruit
  - `id` (uuid, primary key) - Unique identifier
  - `full_name` (text, required) - Agent's full name
  - `phone` (text) - Contact phone number
  - `region` (text) - Geographic region
  - `community` (text) - Community area
  - `status` (enum: ACTIVE, INACTIVE) - Agent status, default ACTIVE
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. `cash_advances`
  Tracks cash advances given to agents
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key -> agents.id) - Associated agent
  - `advance_date` (timestamptz) - Date advance was given
  - `amount` (numeric) - Advance amount
  - `payment_method` (enum: CASH, MOMO, BANK) - Payment method, default CASH
  - `notes` (text) - Additional notes
  - `created_by` (uuid, foreign key -> auth.users.id) - User who created record
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `fruit_collections`
  Records fruit collections from agents
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key -> agents.id) - Associated agent
  - `collection_date` (timestamptz) - Date of collection
  - `weight_kg` (numeric) - Weight in kilograms
  - `notes` (text) - Additional notes
  - `created_by` (uuid, foreign key -> auth.users.id) - User who created record
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `monthly_reconciliations`
  Monthly reconciliation records for agents
  - `id` (uuid, primary key) - Unique identifier
  - `agent_id` (uuid, foreign key -> agents.id) - Associated agent
  - `month` (date) - Month (stored as first day, e.g., 2026-01-01)
  - `total_advance` (numeric) - Total advances for the month
  - `total_weight_kg` (numeric) - Total weight collected for the month
  - `status` (enum: OPEN, RENDERED, CLOSED) - Reconciliation status, default OPEN
  - `comments` (text) - Additional comments
  - `created_by` (uuid, foreign key -> auth.users.id) - User who created record
  - `created_at` (timestamptz) - Record creation timestamp

  ### 5. `user_agent_map`
  Maps auth users to agent records and defines roles
  - `user_id` (uuid, primary key, foreign key -> auth.users.id) - Auth user ID
  - `agent_id` (uuid, foreign key -> agents.id) - Associated agent (nullable for ADMIN)
  - `role` (enum: ADMIN, AGENT) - User role

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - ADMIN users can access all records
  - AGENT users can only access their own data

  ## Indexes
  - Foreign key indexes for optimal join performance
  - Month index on reconciliations for reporting queries
*/

-- Create enum types
CREATE TYPE agent_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE payment_method AS ENUM ('CASH', 'MOMO', 'BANK');
CREATE TYPE reconciliation_status AS ENUM ('OPEN', 'RENDERED', 'CLOSED');
CREATE TYPE user_role AS ENUM ('ADMIN', 'AGENT');

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  region text,
  community text,
  status agent_status DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now()
);

-- Create cash_advances table
CREATE TABLE IF NOT EXISTS cash_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  advance_date timestamptz NOT NULL DEFAULT now(),
  amount numeric NOT NULL,
  payment_method payment_method DEFAULT 'CASH',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create fruit_collections table
CREATE TABLE IF NOT EXISTS fruit_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  collection_date timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create monthly_reconciliations table
CREATE TABLE IF NOT EXISTS monthly_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  month date NOT NULL,
  total_advance numeric DEFAULT 0,
  total_weight_kg numeric DEFAULT 0,
  status reconciliation_status DEFAULT 'OPEN',
  comments text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create user_agent_map table
CREATE TABLE IF NOT EXISTS user_agent_map (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  role user_role NOT NULL,
  UNIQUE(agent_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cash_advances_agent_id ON cash_advances(agent_id);
CREATE INDEX IF NOT EXISTS idx_cash_advances_advance_date ON cash_advances(advance_date);
CREATE INDEX IF NOT EXISTS idx_fruit_collections_agent_id ON fruit_collections(agent_id);
CREATE INDEX IF NOT EXISTS idx_fruit_collections_collection_date ON fruit_collections(collection_date);
CREATE INDEX IF NOT EXISTS idx_monthly_reconciliations_agent_id ON monthly_reconciliations(agent_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reconciliations_month ON monthly_reconciliations(month);
CREATE INDEX IF NOT EXISTS idx_user_agent_map_agent_id ON user_agent_map(agent_id);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agent_map ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_agent_map
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get user's agent_id
CREATE OR REPLACE FUNCTION get_user_agent_id()
RETURNS uuid AS $$
  SELECT agent_id FROM user_agent_map WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies for agents table
CREATE POLICY "Admins can view all agents"
  ON agents FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Agents can view their own agent record"
  ON agents FOR SELECT
  TO authenticated
  USING (id = get_user_agent_id());

CREATE POLICY "Admins can insert agents"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update agents"
  ON agents FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete agents"
  ON agents FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for cash_advances table
CREATE POLICY "Admins can view all cash advances"
  ON cash_advances FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Agents can view their own cash advances"
  ON cash_advances FOR SELECT
  TO authenticated
  USING (agent_id = get_user_agent_id());

CREATE POLICY "Admins can insert cash advances"
  ON cash_advances FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update cash advances"
  ON cash_advances FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete cash advances"
  ON cash_advances FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for fruit_collections table
CREATE POLICY "Admins can view all fruit collections"
  ON fruit_collections FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Agents can view their own fruit collections"
  ON fruit_collections FOR SELECT
  TO authenticated
  USING (agent_id = get_user_agent_id());

CREATE POLICY "Admins can insert fruit collections"
  ON fruit_collections FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Agents can insert their own fruit collections"
  ON fruit_collections FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = get_user_agent_id());

CREATE POLICY "Admins can update fruit collections"
  ON fruit_collections FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Agents can update their own fruit collections"
  ON fruit_collections FOR UPDATE
  TO authenticated
  USING (agent_id = get_user_agent_id())
  WITH CHECK (agent_id = get_user_agent_id());

CREATE POLICY "Admins can delete fruit collections"
  ON fruit_collections FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for monthly_reconciliations table
CREATE POLICY "Admins can view all reconciliations"
  ON monthly_reconciliations FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Agents can view their own reconciliations"
  ON monthly_reconciliations FOR SELECT
  TO authenticated
  USING (agent_id = get_user_agent_id());

CREATE POLICY "Admins can insert reconciliations"
  ON monthly_reconciliations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update reconciliations"
  ON monthly_reconciliations FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete reconciliations"
  ON monthly_reconciliations FOR DELETE
  TO authenticated
  USING (is_admin());

-- RLS Policies for user_agent_map table
CREATE POLICY "Users can view their own mapping"
  ON user_agent_map FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all mappings"
  ON user_agent_map FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can manage mappings"
  ON user_agent_map FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());