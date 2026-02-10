import React, { createContext, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";

import { IdleLogout } from "./components/IdleLogout";

// Pages (adjust these imports to match your project)
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { AgentDashboard } from "./pages/AgentDashboard";
import { ChangePassword } from "./pages/ChangePassword";

// If you already have these pages, keep them. If not, remove the routes.
import { Agents } from "./pages/Agents";
import { CashAdvances } from "./pages/CashAdvances";
import { Expenses } from "./pages/Expenses";
import { FruitCollections } from "./pages/FruitCollections";
import { Orders } from "./pages/Orders";

// --------------------
// PageContext (you already use this in your pages)
// --------------------
type PageContextValue = {
  currentPage: string;
  setCurrentPage: (page: string) => void;
};

export const PageContext = createContext<PageContextValue>({
  currentPage: "",
  setCurrentPage: () => {},
});

// --------------------
// Auth Guards
// --------------------
function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth: any = useAuth();
  const location = useLocation();

  // Support different AuthContext shapes safely:
  const loading = Boolean(auth?.loading ?? auth?.isLoading ?? false);
  const session = auth?.session ?? auth?.user ?? null;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const auth: any = useAuth();
  const role = auth?.userRole?.role;

  // If your app uses must_change_password flag:
  const mustChange = Boolean(auth?.userRole?.must_change_password);

  // If admin must change password, force it (but allow /change-password itself)
  const location = useLocation();
  if (role === "ADMIN" && mustChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (role !== "ADMIN") return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function RequireAgent({ children }: { children: React.ReactNode }) {
  const auth: any = useAuth();
  const role = auth?.userRole?.role;

  if (role !== "AGENT") return <Navigate to="/login" replace />;

  return <>{children}</>;
}

// --------------------
// App Shell (inside providers, so IdleLogout can read useAuth())
// --------------------
function AppShell() {
  const [currentPage, setCurrentPage] = useState("");

  const pageCtx = useMemo(() => ({ currentPage, setCurrentPage }), [currentPage]);

  return (
    <PageContext.Provider value={pageCtx}>
      {/* ✅ Auto-logout ADMIN after inactivity (change minutes if you want) */}
      <IdleLogout timeoutMinutes={10} excludePaths={["/login", "/change-password"]} />

      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Dashboard />
              </RequireAdmin>
            </RequireAuth>
          }
        />

        <Route
          path="/agent-dashboard"
          element={
            <RequireAuth>
              <RequireAgent>
                <AgentDashboard />
              </RequireAgent>
            </RequireAuth>
          }
        />

        {/* Optional admin routes (keep only the ones you actually have) */}
        <Route
          path="/agents"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Agents />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/cash-advances"
          element={
            <RequireAuth>
              <RequireAdmin>
                <CashAdvances />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/expenses"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Expenses />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/fruit-collections"
          element={
            <RequireAuth>
              <RequireAdmin>
                <FruitCollections />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/orders/*"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Orders />
              </RequireAdmin>
            </RequireAuth>
          }
        />

        {/* Default */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </PageContext.Provider>
  );
}

// --------------------
// Main App
// --------------------
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
