import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

const routeToBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ label: 'Dashboard' }],
  '/agents': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Agents' }],
  '/agents/new': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Agents', path: '/agents' }, { label: 'New Agent' }],
  '/fruit-collections': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Fruit Collections' }],
  '/fruit-collections/new': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Fruit Collections', path: '/fruit-collections' }, { label: 'New Collection' }],
  '/cash-advances': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Cash Advances' }],
  '/cash-advances/new': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Cash Advances', path: '/cash-advances' }, { label: 'New Advance' }],
  '/expenses': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Expenses' }],
  '/reconciliation': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Monthly Reconciliation' }],
  '/reports': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Reports' }],
  '/cash-balance/details': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Cash Balance Details' }],
  '/fruit-spend/details': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Amount Spent on Fruit Details' }],
  '/orders': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Orders & Receipts' }],
  '/orders/new': [{ label: 'Dashboard', path: '/dashboard' }, { label: 'Orders & Receipts', path: '/orders' }, { label: 'New Order' }],
};

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const breadcrumbs = routeToBreadcrumbs[location.pathname] ?? [{ label: 'Dashboard', path: '/dashboard' }];

  const canGoBack = window.history.length > 1 && location.pathname !== '/dashboard';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-brand-secondary/20">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <span key={`${crumb.label}-${idx}`} className="flex items-center gap-2">
                {crumb.path ? (
                  <Link to={crumb.path} className="text-brand-primary hover:underline font-medium">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-700 font-semibold">{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span className="text-gray-300">/</span>}
              </span>
            ))}
          </nav>
        </div>

        <div className="text-xs text-gray-500 font-medium hidden sm:block">
          Single-tenant Admin Console
        </div>
      </div>
    </header>
  );
}
