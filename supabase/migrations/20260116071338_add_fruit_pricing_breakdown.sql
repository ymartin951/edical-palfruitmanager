/*
  # Add Fruit Collection Pricing Breakdown Support

  1. Changes to fruit_collections table
    - Add `has_price_breakdown` (boolean) - indicates if collection uses multiple price points
    - Add `total_weight_kg` (numeric) - computed total weight from all items
    - Add `total_amount_spent` (numeric) - computed total amount (weight × price) from all items

  2. New Table: fruit_collection_items
    - `id` (uuid, primary key)
    - `collection_id` (uuid, foreign key to fruit_collections)
    - `weight_kg` (numeric) - weight for this price point
    - `price_per_kg` (numeric) - price per kg for this weight
    - `line_total` (numeric) - computed as weight_kg × price_per_kg
    - `created_at` (timestamp)

    This table stores individual pricing rows when a collection has different prices
    for different portions of the load.

  3. Security
    - Enable RLS on fruit_collection_items
    - ADMIN: Full access to all items
    - AGENT: Read-only access to their own collection items

  4. Indexes
    - Index on collection_id for efficient lookups

  Important Notes:
    - For collections with same price: ONE row in fruit_collection_items
    - For collections with breakdown: MULTIPLE rows in fruit_collection_items
    - Header totals (total_weight_kg, total_amount_spent) are computed from items
    - This enables accurate "Total Amount Spent on Fruit" reporting
*/

-- Add columns to fruit_collections table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fruit_collections' AND column_name = 'has_price_breakdown'
  ) THEN
    ALTER TABLE fruit_collections ADD COLUMN has_price_breakdown boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fruit_collections' AND column_name = 'total_weight_kg'
  ) THEN
    ALTER TABLE fruit_collections ADD COLUMN total_weight_kg numeric DEFAULT 0 NOT NULL CHECK (total_weight_kg >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fruit_collections' AND column_name = 'total_amount_spent'
  ) THEN
    ALTER TABLE fruit_collections ADD COLUMN total_amount_spent numeric DEFAULT 0 NOT NULL CHECK (total_amount_spent >= 0);
  END IF;
END $$;

-- Create fruit_collection_items table
CREATE TABLE IF NOT EXISTS fruit_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES fruit_collections(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0),
  price_per_kg numeric NOT NULL CHECK (price_per_kg > 0),
  line_total numeric NOT NULL CHECK (line_total >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create index on collection_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_fruit_collection_items_collection_id
  ON fruit_collection_items(collection_id);

-- Enable RLS
ALTER TABLE fruit_collection_items ENABLE ROW LEVEL SECURITY;

-- Policy: ADMIN can do everything
CREATE POLICY "Admins have full access to fruit collection items"
  ON fruit_collection_items
  FOR ALL
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

-- Policy: AGENT can view items for their own collections
CREATE POLICY "Agents can view own fruit collection items"
  ON fruit_collection_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM fruit_collections fc
      JOIN user_agent_map uam ON uam.user_id = auth.uid()
      WHERE fc.id = fruit_collection_items.collection_id
        AND uam.agent_id = fc.agent_id
        AND uam.role = 'AGENT'
    )
  );
