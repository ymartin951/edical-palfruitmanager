-- ============================================================
-- MULTI-COMPANY SAAS MIGRATION SQL
-- Edical Palm Fruit Company LTD → Multi-Company SaaS
-- ============================================================
--
-- IMPORTANT: This SQL must be run in your Supabase SQL Editor
-- Run each section in order and verify success before proceeding
--
-- ============================================================

-- ============================================================
-- PART 1: CREATE MULTI-COMPANY SCHEMA
-- ============================================================

-- Create company_role enum
DO $$ BEGIN
  CREATE TYPE company_role AS ENUM ('OWNER', 'ADMIN', 'STAFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  theme_primary text,
  theme_secondary text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create company_members table
CREATE TABLE IF NOT EXISTS company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role company_role NOT NULL DEFAULT 'STAFF',
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 2: RLS POLICIES FOR COMPANIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view companies they are members of" ON companies;
CREATE POLICY "Users can view companies they are members of"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert companies" ON companies;
CREATE POLICY "Users can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "OWNER and ADMIN can update their companies" ON companies;
CREATE POLICY "OWNER and ADMIN can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "OWNER can delete their companies" ON companies;
CREATE POLICY "OWNER can delete their companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
      AND company_members.role = 'OWNER'
    )
  );

-- ============================================================
-- PART 3: RLS POLICIES FOR COMPANY_MEMBERS
-- ============================================================

DROP POLICY IF EXISTS "Users can view members of their companies" ON company_members;
CREATE POLICY "Users can view members of their companies"
  ON company_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "OWNER and ADMIN can add members" ON company_members;
CREATE POLICY "OWNER and ADMIN can add members"
  ON company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('OWNER', 'ADMIN')
    )
    OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "OWNER and ADMIN can update members" ON company_members;
CREATE POLICY "OWNER and ADMIN can update members"
  ON company_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "OWNER and ADMIN can remove members" ON company_members;
CREATE POLICY "OWNER and ADMIN can remove members"
  ON company_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('OWNER', 'ADMIN')
    )
  );

-- ============================================================
-- PART 4: CREATE DEFAULT COMPANY & MIGRATE EXISTING USERS
-- ============================================================

-- Insert default company
INSERT INTO companies (id, name, slug, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Edical Palm Fruit Company LTD',
  'edical',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Migrate existing users from user_agent_map to company_members
INSERT INTO company_members (company_id, user_id, role, created_at)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  user_id,
  CASE
    WHEN role = 'ADMIN' THEN 'ADMIN'::company_role
    ELSE 'STAFF'::company_role
  END,
  created_at
FROM user_agent_map
ON CONFLICT (company_id, user_id) DO NOTHING;

-- ============================================================
-- PART 5: ADD company_id TO ALL BUSINESS TABLES
-- ============================================================

-- Add company_id column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE agents SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE agents ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_company_id ON agents(company_id);

-- Add company_id column to cash_advances table
ALTER TABLE cash_advances ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE cash_advances SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE cash_advances ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_advances_company_id ON cash_advances(company_id);

-- Add company_id column to fruit_collections table
ALTER TABLE fruit_collections ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE fruit_collections SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE fruit_collections ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fruit_collections_company_id ON fruit_collections(company_id);

-- Add company_id column to fruit_collection_items table
ALTER TABLE fruit_collection_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE fruit_collection_items SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE fruit_collection_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fruit_collection_items_company_id ON fruit_collection_items(company_id);

-- Add company_id column to agent_expenses table
ALTER TABLE agent_expenses ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE agent_expenses SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE agent_expenses ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_expenses_company_id ON agent_expenses(company_id);

-- Add company_id column to monthly_reconciliations table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monthly_reconciliations') THEN
    ALTER TABLE monthly_reconciliations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
    UPDATE monthly_reconciliations SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
    ALTER TABLE monthly_reconciliations ALTER COLUMN company_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_monthly_reconciliations_company_id ON monthly_reconciliations(company_id);
  END IF;
END $$;

-- Add company_id column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE customers SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- Add company_id column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE orders SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE orders ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON orders(company_id);

-- Add company_id column to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE order_items SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE order_items ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_company_id ON order_items(company_id);

-- Add company_id column to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE payments SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE payments ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);

-- Add company_id column to receipts table
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE receipts SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE receipts ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_company_id ON receipts(company_id);

-- Add company_id column to delivery_events table
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
UPDATE delivery_events SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
ALTER TABLE delivery_events ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_events_company_id ON delivery_events(company_id);

-- ============================================================
-- PART 6: UPDATE RLS POLICIES FOR ALL BUSINESS TABLES
-- ============================================================

-- AGENTS TABLE RLS
DROP POLICY IF EXISTS "Company members can view their agents" ON agents;
DROP POLICY IF EXISTS "Admins can view agents" ON agents;
CREATE POLICY "Company members can view their company agents"
  ON agents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = agents.company_id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company admins can insert agents" ON agents;
DROP POLICY IF EXISTS "Admin can create agents" ON agents;
CREATE POLICY "Company admins can insert agents"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = agents.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Company admins can update agents" ON agents;
DROP POLICY IF EXISTS "Admin can update agents" ON agents;
CREATE POLICY "Company admins can update agents"
  ON agents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = agents.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = agents.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Company admins can delete agents" ON agents;
DROP POLICY IF EXISTS "Admin can delete agents" ON agents;
CREATE POLICY "Company admins can delete agents"
  ON agents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = agents.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- CASH_ADVANCES TABLE RLS
DROP POLICY IF EXISTS "Company members can view advances" ON cash_advances;
DROP POLICY IF EXISTS "Admin can view all advances" ON cash_advances;
CREATE POLICY "Company members can view their company advances"
  ON cash_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = cash_advances.company_id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company admins can insert advances" ON cash_advances;
DROP POLICY IF EXISTS "Admin can create advances" ON cash_advances;
CREATE POLICY "Company admins can insert advances"
  ON cash_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = cash_advances.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Company admins can update advances" ON cash_advances;
DROP POLICY IF EXISTS "Admin can update advances" ON cash_advances;
CREATE POLICY "Company admins can update advances"
  ON cash_advances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = cash_advances.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = cash_advances.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Company admins can delete advances" ON cash_advances;
DROP POLICY IF EXISTS "Admin can delete advances" ON cash_advances;
CREATE POLICY "Company admins can delete advances"
  ON cash_advances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = cash_advances.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- FRUIT_COLLECTIONS TABLE RLS
DROP POLICY IF EXISTS "Company members can view collections" ON fruit_collections;
DROP POLICY IF EXISTS "Admin can view all collections" ON fruit_collections;
CREATE POLICY "Company members can view their company collections"
  ON fruit_collections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = fruit_collections.company_id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company admins can insert collections" ON fruit_collections;
DROP POLICY IF EXISTS "Admin can create collections" ON fruit_collections;
CREATE POLICY "Company admins can insert collections"
  ON fruit_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = fruit_collections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Company admins can update collections" ON fruit_collections;
DROP POLICY IF EXISTS "Admin can update collections" ON fruit_collections;
CREATE POLICY "Company admins can update collections"
  ON fruit_collections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = fruit_collections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = fruit_collections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Company admins can delete collections" ON fruit_collections;
DROP POLICY IF EXISTS "Admin can delete collections" ON fruit_collections;
CREATE POLICY "Company admins can delete collections"
  ON fruit_collections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = fruit_collections.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- Similar policies for all other tables...
-- (fruit_collection_items, agent_expenses, customers, orders, order_items, payments, receipts, delivery_events)
-- Follow the same pattern as above

-- CUSTOMERS TABLE RLS
DROP POLICY IF EXISTS "Company members can view customers" ON customers;
CREATE POLICY "Company members can view their company customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = customers.company_id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company admins can manage customers" ON customers;
CREATE POLICY "Company admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = customers.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Company admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = customers.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = customers.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Company admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = customers.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- ORDERS TABLE RLS
DROP POLICY IF EXISTS "Company members can view orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Company members can view their company orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = orders.company_id
      AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company admins can manage orders" ON orders;
CREATE POLICY "Company admins can insert orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = orders.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Company admins can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = orders.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = orders.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Company admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = orders.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- Apply similar policies to: order_items, payments, receipts, delivery_events, agent_expenses, fruit_collection_items

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify default company created
SELECT * FROM companies WHERE slug = 'edical';

-- Verify users migrated to company_members
SELECT cm.*, u.email, c.name as company_name
FROM company_members cm
JOIN auth.users u ON u.id = cm.user_id
JOIN companies c ON c.id = cm.company_id;

-- Verify all agents have company_id
SELECT COUNT(*) as total, COUNT(company_id) as with_company FROM agents;

-- Verify all orders have company_id
SELECT COUNT(*) as total, COUNT(company_id) as with_company FROM orders;
