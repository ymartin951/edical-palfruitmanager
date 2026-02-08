# Multi-Company SaaS Transformation Guide
## Converting Edical Palm Fruit Company to Multi-Tenant SaaS

---

## 🎯 Overview

This guide covers the complete transformation from a single-company application to a **multi-company SaaS** platform where:
- Any company can sign up and use the service
- Strict data isolation between companies (enforced by RLS)
- Company-aware UI with branding and company switcher
- Mobile-friendly and maintains all existing features

---

## ✅ COMPLETED WORK

### 1. Database Schema (SQL Ready)

**File:** `/MULTI_COMPANY_MIGRATION.sql`

This SQL file contains:
- Companies table creation
- Company_members table creation
- company_role enum (OWNER, ADMIN, STAFF)
- Default company creation ("Edical Palm Fruit Company LTD")
- Migration of existing users from user_agent_map
- Addition of company_id to ALL business tables
- Backfill of company_id with default company
- Updated RLS policies for strict company isolation

**Status:** ✅ SQL ready to run (see "NEXT STEPS" section below)

### 2. Frontend Infrastructure

#### A. CompanyContext (`/src/contexts/CompanyContext.tsx`)

**Purpose:** Global state management for multi-company

**Features:**
- Tracks current company
- Manages company list for current user
- Handles company switching
- Persists company selection in localStorage
- Provides company creation functionality

**Key Functions:**
```typescript
currentCompany: Company | null
currentRole: 'OWNER' | 'ADMIN' | 'STAFF' | null
userCompanies: CompanyMember[]
switchCompany(companyId: string): void
createCompany(name, slug, logoUrl?): Promise<Company>
```

**Usage in Components:**
```typescript
import { useCompany } from '../contexts/CompanyContext';

const { currentCompany, currentRole } = useCompany();
const companyId = currentCompany?.id;
```

#### B. Company Selection Page (`/src/pages/CompanySelect.tsx`)

**Route:** `/company/select`

**Features:**
- Shows list of user's companies
- Allows selection to switch companies
- Create new company form
- Auto-generates slug from company name
- Validates slug format (lowercase, numbers, hyphens)

**When It Appears:**
- First-time users (no company membership)
- Users who manually navigate to `/company/select`
- Accessible from company switcher menu

#### C. Company Switcher in TopBar (`/src/components/TopBar.tsx`)

**Location:** Top-right corner of every page

**Features:**
- Shows current company logo + name
- Dropdown menu to switch between companies
- Displays user's role in each company (Owner/Admin/Staff)
- "+ Create New Company" link
- Only visible if user has companies
- Responsive on mobile (hides company name, shows only logo)

#### D. App.tsx Routing Updates

**Changes Made:**
- Wrapped app with `CompanyProvider`
- Added `/company/select` route
- Redirects to company select if user has no company
- Protected routes check for `currentCompany`
- Layout only renders when company is selected

---

## 📋 NEXT STEPS: WHAT YOU NEED TO DO

### Step 1: Run Database Migration (CRITICAL)

1. Open Supabase SQL Editor for your project
2. Copy the entire contents of `/MULTI_COMPANY_MIGRATION.sql`
3. Paste and run in SQL Editor
4. Verify success:
   ```sql
   -- Should return 1 row for default company
   SELECT * FROM companies WHERE slug = 'edical';

   -- Should show all users migrated to company_members
   SELECT cm.*, u.email, c.name as company_name
   FROM company_members cm
   JOIN auth.users u ON u.id = cm.user_id
   JOIN companies c ON c.id = cm.company_id;

   -- Verify all tables have company_id
   SELECT COUNT(*) as total, COUNT(company_id) as with_company FROM agents;
   SELECT COUNT(*) as total, COUNT(company_id) as with_company FROM orders;
   ```

**⚠️ WARNING:** This migration:
- Modifies all business tables (adds company_id column)
- Updates ALL RLS policies
- Migrates existing data to default company
- THIS MUST BE DONE BEFORE running the app with the new code

### Step 2: Update All Data Fetching to Include company_id

All queries that fetch data MUST filter by company_id. Here's how:

**Before:**
```typescript
const { data } = await supabase
  .from('agents')
  .select('*');
```

**After:**
```typescript
import { useCompany } from '../contexts/CompanyContext';

const { currentCompany } = useCompany();

const { data } = await supabase
  .from('agents')
  .select('*')
  .eq('company_id', currentCompany!.id);
```

**Files That Need Updating:**
- `/src/pages/Agents.tsx` - Filter agents by company_id
- `/src/pages/AgentForm.tsx` - Include company_id on insert
- `/src/pages/CashAdvances.tsx` - Filter advances by company_id
- `/src/pages/CashAdvanceForm.tsx` - Include company_id on insert
- `/src/pages/FruitCollections.tsx` - Filter collections by company_id
- `/src/pages/FruitCollectionForm.tsx` - Include company_id on insert
- `/src/pages/Expenses.tsx` - Filter expenses by company_id
- `/src/pages/Orders.tsx` - Filter orders by company_id
- `/src/pages/OrderForm.tsx` - Include company_id on insert
- `/src/pages/Dashboard.tsx` - Filter all dashboard queries by company_id
- `/src/pages/Reports.tsx` - Filter reports by company_id
- All other pages that query business data

**Pattern for INSERT:**
```typescript
const { error } = await supabase
  .from('agents')
  .insert({
    ...formData,
    company_id: currentCompany!.id, // ← Add this
  });
```

**Pattern for SELECT:**
```typescript
const { data } = await supabase
  .from('agents')
  .select('*')
  .eq('company_id', currentCompany!.id) // ← Add this
  .order('created_at', { ascending: false });
```

### Step 3: Update Reports/Receipts with Company Branding

Files to update:
- `/src/pages/OrderReceipt.tsx`
- `/src/pages/OrderDeliveryNote.tsx`
- `/src/utils/pdfExport.tsx`
- `/src/utils/agentReportPDF.tsx`

**Changes Needed:**
1. Import `useCompany` hook
2. Use `currentCompany.name` instead of hardcoded "Edical Palm Fruit Company LTD"
3. Use `currentCompany.logo_url` if available, fallback to default logo

**Example:**
```typescript
import { useCompany } from '../contexts/CompanyContext';

export function OrderReceipt() {
  const { currentCompany } = useCompany();

  return (
    <div>
      <img src={currentCompany?.logo_url || '/edical-logo.png'} alt="Logo" />
      <h1>{currentCompany?.name}</h1>
    </div>
  );
}
```

### Step 4: Reorganize Dashboard with Card Sections

**Current:** All KPI cards in one grid

**Target:** Organize into 3 clear sections

```
┌─────────────────────────────────────┐
│ Palm Fruit Operations               │
├─────────────────────────────────────┤
│ [Advances] [Collections] [Amount]  │
│ [Weight]                            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Orders & Deliveries                 │
├─────────────────────────────────────┤
│ [Outstanding] [Delivered] [Received]│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Finance Summary                     │
├─────────────────────────────────────┤
│ [Expenses] [Cash Balance]           │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
<div className="space-y-6">
  {/* Section 1: Palm Fruit Operations */}
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-lg font-bold text-gray-800 mb-4">Palm Fruit Operations</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {palmFruitCards.map(card => <KPICard key={card.title} {...card} />)}
    </div>
  </div>

  {/* Section 2: Orders & Deliveries */}
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-lg font-bold text-gray-800 mb-4">Orders & Deliveries</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ordersCards.map(card => <KPICard key={card.title} {...card} />)}
    </div>
  </div>

  {/* Section 3: Finance Summary */}
  <div className="bg-white rounded-xl shadow-md p-6">
    <h2 className="text-lg font-bold text-gray-800 mb-4">Finance Summary</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {financeCards.map(card => <KPICard key={card.title} {...card} />)}
    </div>
  </div>
</div>
```

### Step 5: Test Multi-Company Isolation

**Testing Checklist:**

1. **Company Creation**
   - [ ] Sign up a new user
   - [ ] Create first company (should become OWNER)
   - [ ] Create second company
   - [ ] Verify both companies appear in switcher

2. **Data Isolation**
   - [ ] Create agents in Company A
   - [ ] Switch to Company B
   - [ ] Verify Company A agents NOT visible
   - [ ] Create agents in Company B
   - [ ] Switch back to Company A
   - [ ] Verify Company B agents NOT visible

3. **RLS Testing (Critical)**
   - [ ] User A in Company A cannot see Company B data
   - [ ] User B in Company B cannot see Company A data
   - [ ] Verify by checking browser network tab (queries should return empty for other company data)

4. **Company Switcher**
   - [ ] Switching reloads app with new company context
   - [ ] All pages show correct company data after switch
   - [ ] Company logo displays in switcher
   - [ ] Role displays correctly (Owner/Admin/Staff)

5. **Permissions**
   - [ ] OWNER can edit company settings
   - [ ] ADMIN can manage data but not delete company
   - [ ] STAFF can view data (if configured)

6. **Reports & Documents**
   - [ ] Order receipts show correct company name/logo
   - [ ] Delivery notes show correct company name/logo
   - [ ] PDFs display proper company branding

---

## 🏗️ ARCHITECTURE OVERVIEW

### Data Flow

```
User Login
    ↓
AuthContext loads
    ↓
CompanyContext loads
    ↓
Fetch user's company_members
    ↓
If no companies → redirect to /company/select
    ↓
If companies exist → load saved/first company
    ↓
Set currentCompany in context
    ↓
All queries filter by currentCompany.id
```

### RLS Security Model

```sql
-- Every business table has this pattern:
CREATE POLICY "Company members can view their company data"
  ON table_name FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = table_name.company_id
      AND company_members.user_id = auth.uid()
    )
  );
```

**How It Works:**
1. User makes query to `agents` table
2. Supabase checks RLS policy
3. Policy verifies user is member of company
4. If yes, returns rows where `company_id` matches user's membership
5. If no, returns zero rows

**This means:**
- Company A users CANNOT see Company B data (database level)
- Company B users CANNOT see Company A data (database level)
- No way to bypass (enforced by Supabase RLS)

---

## 📊 DATABASE SCHEMA

### New Tables

#### companies
```sql
CREATE TABLE companies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  theme_primary text,
  theme_secondary text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

#### company_members
```sql
CREATE TABLE company_members (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role company_role NOT NULL, -- OWNER | ADMIN | STAFF
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);
```

### Modified Tables

All business tables now have:
```sql
ALTER TABLE table_name ADD COLUMN company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX idx_table_name_company_id ON table_name(company_id);
```

**Tables with company_id:**
- agents
- cash_advances
- fruit_collections
- fruit_collection_items
- agent_expenses
- customers
- orders
- order_items
- payments
- receipts
- delivery_events
- monthly_reconciliations (if exists)

---

## 🔐 SECURITY & RLS POLICIES

### Policy Patterns

**SELECT (Read):**
```sql
-- Users can view data from their companies
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = table.company_id
    AND company_members.user_id = auth.uid()
  )
)
```

**INSERT (Create):**
```sql
-- Only OWNER/ADMIN can create records
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = table.company_id
    AND company_members.user_id = auth.uid()
    AND company_members.role IN ('OWNER', 'ADMIN')
  )
)
```

**UPDATE (Modify):**
```sql
-- Only OWNER/ADMIN can update records
USING (... check membership ...)
WITH CHECK (... check membership ...)
```

**DELETE (Remove):**
```sql
-- Only OWNER/ADMIN can delete records
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = table.company_id
    AND company_members.user_id = auth.uid()
    AND company_members.role IN ('OWNER', 'ADMIN')
  )
)
```

---

## 🎨 UI/UX ENHANCEMENTS

### Company Switcher

**Location:** Top-right of every page (in TopBar)

**Features:**
- Displays current company logo + name
- Click to open dropdown (if multiple companies)
- Shows all user's companies with roles
- Highlights current company
- "+ Create New Company" option

**Mobile:**
- Shows only logo (no company name)
- Full dropdown still available

### Company Select Page

**Route:** `/company/select`

**Sections:**
1. **Your Companies** (if user has companies)
   - Grid of company cards
   - Click to switch
   - Shows role badge

2. **Create Company Form**
   - Company Name input
   - Auto-generated slug (editable)
   - Slug validation (lowercase, numbers, hyphens)
   - Submit to create

**Auto-Navigation:**
- If no companies → shows create form
- If companies exist → shows selection grid
- After creation → redirects to dashboard

---

## 🐛 TROUBLESHOOTING

### Issue: "No data showing after migration"

**Cause:** Queries not filtering by company_id

**Fix:**
```typescript
// Add to ALL queries:
.eq('company_id', currentCompany!.id)
```

### Issue: "RLS policy prevents insert"

**Cause:** company_id not provided or user not member of company

**Fix:**
```typescript
// Always include company_id on inserts:
.insert({
  ...data,
  company_id: currentCompany!.id
})
```

### Issue: "Company switcher not appearing"

**Cause:** CompanyProvider not wrapping App or user has no companies

**Fix:**
- Verify App.tsx has CompanyProvider wrapper
- Check user has company_members records
- Check CompanyContext is loading correctly

### Issue: "Can't create company, slug taken error"

**Cause:** Slug must be globally unique

**Fix:**
- Try different slug
- Add numbers or extra words to make unique
- Slug validation prevents this at form level

### Issue: "User sees other company's data"

**Cause:** RLS policies not applied or query missing company_id filter

**Fix:**
- Re-run RLS policy updates from migration SQL
- Add company_id filter to query
- Check user's company_members records

---

## 📝 CODE EXAMPLES

### Example: Updating Agents Page

**Before:**
```typescript
const loadAgents = async () => {
  const { data } = await supabase
    .from('agents')
    .select('*')
    .order('full_name');

  setAgents(data || []);
};
```

**After:**
```typescript
import { useCompany } from '../contexts/CompanyContext';

const { currentCompany } = useCompany();

const loadAgents = async () => {
  if (!currentCompany) return;

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('company_id', currentCompany.id) // ← Added
    .order('full_name');

  setAgents(data || []);
};
```

### Example: Creating an Agent

**Before:**
```typescript
const handleSubmit = async (formData) => {
  const { error } = await supabase
    .from('agents')
    .insert(formData);
};
```

**After:**
```typescript
import { useCompany } from '../contexts/CompanyContext';

const { currentCompany } = useCompany();

const handleSubmit = async (formData) => {
  const { error } = await supabase
    .from('agents')
    .insert({
      ...formData,
      company_id: currentCompany!.id, // ← Added
    });
};
```

### Example: Company-Branded Receipt

**Before:**
```typescript
<h1>Edical Palm Fruit Company LTD</h1>
<img src="/edical-logo.png" alt="Logo" />
```

**After:**
```typescript
import { useCompany } from '../contexts/CompanyContext';

const { currentCompany } = useCompany();

<h1>{currentCompany?.name}</h1>
<img
  src={currentCompany?.logo_url || '/edical-logo.png'}
  alt={currentCompany?.name}
/>
```

---

## ✅ FINAL CHECKLIST

### Database
- [ ] Run MULTI_COMPANY_MIGRATION.sql in Supabase SQL Editor
- [ ] Verify default company created
- [ ] Verify users migrated to company_members
- [ ] Verify all tables have company_id column
- [ ] Verify all RLS policies updated

### Frontend
- [ ] CompanyProvider wraps App ✅ (DONE)
- [ ] CompanyContext created ✅ (DONE)
- [ ] Company Select page created ✅ (DONE)
- [ ] Company switcher in TopBar ✅ (DONE)
- [ ] All queries filter by company_id (TODO)
- [ ] All inserts include company_id (TODO)
- [ ] Reports use company branding (TODO)
- [ ] Dashboard reorganized into sections (TODO)

### Testing
- [ ] Create new company works
- [ ] Company switcher works
- [ ] Data isolation verified
- [ ] RLS prevents cross-company access
- [ ] Receipts show correct company
- [ ] All features work within company scope

### Documentation
- [ ] SQL migration documented ✅
- [ ] Code changes documented ✅
- [ ] Testing guide provided ✅
- [ ] Troubleshooting guide provided ✅

---

## 🚀 DEPLOYMENT NOTES

**Before Deploying:**
1. Run database migration in production Supabase
2. Test with at least 2 different companies
3. Verify RLS isolation
4. Update all environment variables if needed
5. Test company creation flow
6. Verify existing Edical data intact

**After Deploying:**
1. Existing users will see "Edical Palm Fruit Company LTD"
2. New users must create a company
3. Users can be invited to multiple companies
4. Each company is completely isolated

---

## 📞 SUPPORT

If you encounter issues:
1. Check database migration ran successfully
2. Verify RLS policies in Supabase dashboard
3. Check browser console for errors
4. Verify company_id included in all queries
5. Test with clean user account

---

## 🎉 SUCCESS CRITERIA

The multi-company SaaS is complete when:
- ✅ Users can create companies
- ✅ Users can switch between companies
- ✅ Data is completely isolated by company
- ✅ RLS prevents cross-company data access
- ✅ All features work within company scope
- ✅ Reports show correct company branding
- ✅ Dashboard organized into clear sections
- ✅ Mobile-friendly throughout
- ✅ No data loss from existing Edical company

---

**Status:** 🟡 Core infrastructure complete, queries need updating

**Next Action:** Run MULTI_COMPANY_MIGRATION.sql in Supabase SQL Editor
