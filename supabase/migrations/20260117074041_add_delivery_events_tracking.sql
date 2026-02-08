/*
  # Add Delivery Events Tracking

  1. New Table
    - `delivery_events` - Track all delivery status changes
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key → orders, cascade delete)
      - `status` (delivery_status enum)
      - `event_date` (timestamptz, default now())
      - `delivered_by` (text, nullable)
      - `notes` (text, nullable)
      - `created_by` (uuid, foreign key → auth.users)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS
    - ADMIN-only access via user_agent_map role check
    - Policies for SELECT, INSERT, UPDATE, DELETE

  3. Indexes
    - Index on order_id for fast lookups
    - Index on event_date for timeline queries

  4. Notes
    - This table tracks the history of delivery status changes
    - Every status update creates a new event record
    - Provides audit trail for deliveries
*/

-- Create delivery_events table
CREATE TABLE IF NOT EXISTS delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status delivery_status NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  delivered_by text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_events_order_id ON delivery_events(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_date ON delivery_events(event_date DESC);

-- Enable RLS
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ADMIN access
CREATE POLICY "Admins can view all delivery events"
  ON delivery_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert delivery events"
  ON delivery_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update delivery events"
  ON delivery_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete delivery events"
  ON delivery_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );