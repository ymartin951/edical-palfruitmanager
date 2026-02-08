import React, { useState, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChangePassword } from "./pages/ChangePassword";
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { AgentForm } from './pages/AgentForm';
import AgentReport from './pages/AgentReport';
import ExpensesBatchForm from './pages/ExpensesBatchForm';
import { ExpenseEditForm } from './pages/ExpenseEditForm';
import { Expenses } from './pages/Expenses';
import { CashAdvances } from './pages/CashAdvances';
import { CashAdvanceForm } from './pages/CashAdvanceForm';
import { FruitCollections } from './pages/FruitCollections';
import { FruitCollectionForm } from './pages/FruitCollectionForm';
import { MonthlyReconciliation } from './pages/MonthlyReconciliation';
import { Reports } from './pages/Reports';
import { CashBalanceDetails } from './pages/CashBalanceDetails';
import { FruitSpendDetails } from './pages/FruitSpendDetails';
import { ConsolidatedReport } from "./pages/ConsolidatedReport";
import { Orders } from './pages/Orders';
import { OrderForm } from './pages/OrderForm';
import { OrderDetails } from './pages/OrderDetails';
import { OrderEdit } from './pages/OrderEdit';
import { OrderReceipt } from './pages/OrderReceipt';
import { OrderDeliveryNote } from './pages/OrderDeliveryNote';
import { AdminUsers } from './pages/AdminUsers';


export const PageContext = createContext<{
  currentPage: string;
  setCurrentPage: (page: string) => void;
}>({
  currentPage: 'dashboard',
  setCurrentPage: () => {},
});

function AppContent() {
  const { user, loading, isAdmin, mustChangePassword } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Force co-admin to change password before using the app
if (mustChangePassword) {
  return (
    <Layout>
      <Routes>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    </Layout>
  );
}


  // Single-tenant: only ADMIN users may use the app.
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">Access denied</h1>
          <p className="mt-2 text-gray-600">
            Your account is not set up as an admin for this system. Please ask the system owner to add you as a co-admin.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            (In Supabase: add a row for your user in <code className="px-1 py-0.5 bg-gray-100 rounded">user_agent_map</code> with role <code className="px-1 py-0.5 bg-gray-100 rounded">ADMIN</code>.)
          </p>
        </div>
      </div>
    );
  }

  const defaultRoute = '/dashboard';

  return (
    <PageContext.Provider value={{ currentPage, setCurrentPage }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Admin-only modules */}
          <Route path="/change-password" element={<ChangePassword />} />

          <Route path="/admins" element={<AdminUsers />} />
<Route path="/change-password" element={<ChangePassword />} />


          <Route path="/agents" element={<Agents />} />
          
          <Route path="/agents/new" element={<AgentForm />} />
          <Route path="/agents/:id/edit" element={<AgentForm />} />
          <Route path="/agents/:id/report" element={<AgentReport />} />
          <Route path="/agents/:id/expenses/new" element={<ExpensesBatchForm />} />

          <Route path="/expenses" element={<Expenses />} />
          <Route path="/agent-expenses/:id/edit" element={<ExpenseEditForm />} />

          <Route path="/cash-advances" element={<CashAdvances />} />
          <Route path="/cash-advances/new" element={<CashAdvanceForm />} />
          <Route path="/cash-advances/:id/edit" element={<CashAdvanceForm />} />

          <Route path="/fruit-collections" element={<FruitCollections />} />
          <Route path="/fruit-collections/new" element={<FruitCollectionForm />} />
          <Route path="/fruit-collections/:id/edit" element={<FruitCollectionForm />} />

          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/orders/:id/edit" element={<OrderEdit />} />
          <Route path="/orders/:id/receipt" element={<OrderReceipt />} />
          <Route path="/orders/:id/delivery-note" element={<OrderDeliveryNote />} />
           <Route path="/reports/consolidated" element={<ConsolidatedReport />} />

          <Route path="/cash-balance/details" element={<CashBalanceDetails />} />
          <Route path="/fruit-spend/details" element={<FruitSpendDetails />} />

          <Route path="/reconciliation" element={<MonthlyReconciliation />} />
          <Route path="/reports" element={<Reports />} />
          
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </Layout>
    </PageContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
