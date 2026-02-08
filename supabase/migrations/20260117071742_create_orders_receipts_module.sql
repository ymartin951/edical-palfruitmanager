/*
  # Orders & Receipts Module

  1. New Tables
    - `customers` - Customer information
      - `id` (uuid, primary key)
      - `full_name` (text, required)
      - `phone` (text)
      - `delivery_address` (text)
      - `notes` (text)
      - `created_at` (timestamptz)
      
    - `orders` - Order headers with financial tracking
      - `id` (uuid, primary key)
      - `order_category` (enum: BLOCKS, CEMENT, PALM_FRUIT)
      - `customer_id` (uuid, foreign key)
      - `order_date` (timestamptz)
      - `delivery_status` (enum: PENDING, PARTIALLY_DELIVERED, DELIVERED, CANCELLED)
      - `delivery_date` (timestamptz, nullable)
      - `delivered_by` (text, nullable)
      - `delivery_notes` (text, nullable)
      - Financial fields: subtotal, discount, total_amount, amount_paid, balance_due
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      
    - `order_items` - Line items for all order types
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key, cascade delete)
      - `item_type` (text) - BLOCKS, CEMENT, PALM_FRUIT_BUNCHES, PALM_FRUIT_LOOSE
      - `description` (text, nullable)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `weight_kg` (numeric, nullable) - for palm fruit bunches
      - `line_total` (numeric)
      - `created_at` (timestamptz)
      
    - `payments` - Payment records
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key, cascade delete)
      - `payment_date` (timestamptz)
      - `amount` (numeric, > 0)
      - `method` (text) - CASH, MOMO, BANK
      - `received_by` (text, nullable)
      - `reference` (text, nullable)
      - `created_by` (uuid, foreign key)
      - `created_at` (timestamptz)
      
    - `receipts` - Receipt tracking
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key, cascade delete)
      - `receipt_number` (text, unique)
      - `issued_at` (timestamptz)
      - `issued_by` (uuid, foreign key)
      - `pdf_url` (text, nullable)

  2. Security
    - Enable RLS on all tables
    - ADMIN-only access via user_agent_map role check
    - Policies for SELECT, INSERT, UPDATE, DELETE

  3. Notes
    - All currency amounts use numeric type for precision
    - Sequential receipt numbering: EDC-REC-2026-XXXXXX
    - Cascade deletes maintain referential integrity
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE order_category AS ENUM ('BLOCKS', 'CEMENT', 'PALM_FRUIT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('PENDING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  delivery_address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_category order_category NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  order_date timestamptz NOT NULL DEFAULT now(),
  delivery_status delivery_status NOT NULL DEFAULT 'PENDING',
  delivery_date timestamptz,
  delivered_by text,
  delivery_notes text,
  
  -- Financial fields
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  weight_kg numeric,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_date timestamptz NOT NULL DEFAULT now(),
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'CASH',
  received_by text,
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  receipt_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES auth.users(id),
  pdf_url text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_category ON orders(order_category);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ADMIN access

-- Customers policies
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
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

CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

-- Orders policies
CREATE POLICY "Admins can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
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

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

-- Order items policies
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update order items"
  ON order_items FOR UPDATE
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

CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

-- Payments policies
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE
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

CREATE POLICY "Admins can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

-- Receipts policies
CREATE POLICY "Admins can view all receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update receipts"
  ON receipts FOR UPDATE
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

CREATE POLICY "Admins can delete receipts"
  ON receipts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_agent_map
      WHERE user_agent_map.user_id = auth.uid()
      AND user_agent_map.role = 'ADMIN'
    )
  );
