/*
  # Create Agent Expenses Table

  ## Overview
  This migration creates the agent_expenses table to track expenses for each agent,
  supporting the new Expenses feature with batch entry capability.

  ## New Tables
  
  ### `agent_expenses`
  Stores expense records for agents including type, amount, and date.
  
  **Columns:**
  - `id` (uuid, primary key) - Unique identifier for each expense
  - `agent_id` (uuid, foreign key -> agents.id, required) - Reference to the agent
  - `expense_type` (text, required) - Type/category of expense
  - `amount` (numeric, required) - Expense amount (must be > 0)
  - `expense_date` (timestamptz, required) - Date of the expense
  - `created_by` (uuid, foreign key -> auth.users.id) - User who created the record
  - `created_at` (timestamptz) - Timestamp of record creation

  ## Indexes
  - Index on `agent_id` for fast agent-specific queries
  - Index on `expense_date` for date range filtering
  - Composite index on `agent_id` and `expense_date` for optimized filtering

  ## Security
  - Enable RLS on `agent_expenses` table
  - **Admin policies:** Full read/write access for users with ADMIN role
  - **Agent policies:** Read-only access for agents to view their own expenses
  
  ## Constraints
  - amount must be greater than 0
  - expense_type cannot be empty
  - agent_id must reference valid agent
*/

-- Create agent_expenses table
CREATE TABLE IF NOT EXISTS agent_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expense_type text NOT NULL CHECK (length(trim(expense_type)) > 0),
  amount numeric NOT NULL CHECK (amount > 0),
  expense_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_expenses_agent_id ON agent_expenses(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_expenses_date ON agent_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_agent_expenses_agent_date ON agent_expenses(agent_id, expense_date DESC);

-- Enable Row Level Security
ALTER TABLE agent_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin can view all expenses
CREATE POLICY "Admin can view all expenses"
  ON agent_expenses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- RLS Policy: Admin can insert expenses
CREATE POLICY "Admin can insert expenses"
  ON agent_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- RLS Policy: Admin can update expenses
CREATE POLICY "Admin can update expenses"
  ON agent_expenses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid()
      AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- RLS Policy: Admin can delete expenses
CREATE POLICY "Admin can delete expenses"
  ON agent_expenses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_id = auth.uid()
      AND role = 'ADMIN'
    )
  );

-- RLS Policy: Agents can view their own expenses
CREATE POLICY "Agents can view own expenses"
  ON agent_expenses
  FOR SELECT
  TO authenticated
  USING (
    agent_id = (
      SELECT agent_id FROM user_agent_map
      WHERE user_id = auth.uid()
      AND role = 'AGENT'
    )
  );