import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LockIcon, Shield } from 'lucide-react';
import { Logo } from './Logo';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Apple,
  FileText,
  LogOut,
  Menu,
  X,
  BarChart3,
  Receipt,
  ShoppingCart
} from 'lucide-react';

interface NavItem {
  name: string;
  icon: typeof LayoutDashboard;
  path: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Admins', icon: Shield, path: '/admins' },
  { name: 'Agents', icon: Users, path: '/agents' },
  { name: 'Cash Advances', icon: DollarSign, path: '/cash-advances' },
  { name: 'Expenses', icon: Receipt, path: '/expenses' },
  { name: 'Fruit Collections', icon: Apple, path: '/fruit-collections' },
  { name: 'Orders & Receipts', icon: ShoppingCart, path: '/orders' },
  { name: 'Monthly Reconciliation', icon: FileText, path: '/reconciliation' },
  { name: 'Reports', icon: BarChart3, path: '/reports' },
  { name: 'Change Password', icon: LockIcon, path: '/change-password' },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = () => setMobileMenuOpen(false);

  const SidebarContent = () => (
    <>
      <div className="flex-shrink-0 p-3 lg:p-6 border-b border-brand-secondary/30 bg-white">
        <div className="flex items-center justify-center mb-2 lg:mb-3">
          <div className="max-h-[36px] lg:max-h-none max-w-[160px] lg:max-w-none overflow-hidden">
            <Logo size="small" variant="full" className="lg:hidden" />
            <Logo size="medium" variant="full" className="hidden lg:block" />
          </div>
        </div>
        <p className="text-[10px] lg:text-xs text-brand-secondary leading-tight font-medium text-center">
          Advance Tracking • Fruit Collection • Reconciliation
        </p>
        {user?.email && (
          <p className="mt-2 text-[10px] lg:text-xs text-gray-500 text-center break-all">
            {user.email}
          </p>
        )}
      </div>

      <nav className="flex-1 px-3 lg:px-4 py-4 lg:py-6 space-y-1 lg:space-y-2 overflow-y-auto bg-brand-bg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={`w-full flex items-center gap-3 px-3 lg:px-4 py-3 lg:py-3 rounded-lg transition-all min-h-[44px] ${
                isActive
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'text-brand-text hover:bg-brand-primary/10'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm lg:text-base">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 p-3 lg:p-4 border-t border-brand-secondary/30 bg-white">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg text-brand-text hover:bg-brand-red/10 hover:text-brand-red transition-all min-h-[44px]"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm lg:text-base">Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white shadow-lg border border-brand-secondary/20"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 z-40 w-72 lg:w-80 h-full bg-white shadow-xl lg:shadow-none transform transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } flex flex-col`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
