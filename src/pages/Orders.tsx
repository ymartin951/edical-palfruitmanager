import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShoppingCart, Filter, X, Calendar, User, Package } from 'lucide-react';
import { formatGHS } from '../utils/currency';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';

type OrderCategory = 'BLOCKS' | 'CEMENT' | 'PALM_FRUIT';
type DeliveryStatus = 'PENDING' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Order {
  id: string;
  order_category: OrderCategory;
  customer_id: string;
  order_date: string;
  delivery_status: DeliveryStatus;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customers?: Customer;
}

export function Orders() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = userRole?.role === 'ADMIN';

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlPreset = searchParams.get('preset');
    const urlFrom = searchParams.get('from');
    const urlTo = searchParams.get('to');

    if (urlStatus === 'OUTSTANDING') {
      setStatusFilter('OUTSTANDING');
    } else if (urlStatus) {
      setStatusFilter(urlStatus);
    }

    if (urlPreset === 'this_month' && urlFrom && urlTo) {
      setDateFrom(urlFrom);
      setDateTo(urlTo);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAdmin) {
      loadOrders();
    }
  }, [isAdmin]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            id,
            full_name,
            phone
          )
        `)
        .order('order_date', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      showToast(error.message || 'Error loading orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOrder) return;

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', deletingOrder.id);

      if (error) throw error;

      showToast('Order deleted successfully', 'success');
      setDeletingOrder(null);
      loadOrders();
    } catch (error: any) {
      showToast(error.message || 'Error deleting order', 'error');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (categoryFilter && order.order_category !== categoryFilter) return false;

    if (statusFilter) {
      if (statusFilter === 'OUTSTANDING') {
        if (order.delivery_status !== 'PENDING' && order.delivery_status !== 'PARTIALLY_DELIVERED') return false;
      } else if (order.delivery_status !== statusFilter) {
        return false;
      }
    }

    if (dateFrom && order.order_date < dateFrom) return false;
    if (dateTo && order.order_date > dateTo) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const customerName = order.customers?.full_name?.toLowerCase() || '';
      const customerPhone = order.customers?.phone?.toLowerCase() || '';
      if (!customerName.includes(query) && !customerPhone.includes(query)) return false;
    }
    return true;
  });

  const clearFilters = () => {
    setCategoryFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryLabel = (category: OrderCategory) => {
    switch (category) {
      case 'BLOCKS': return 'Blocks Factory';
      case 'CEMENT': return 'Cement Shop';
      case 'PALM_FRUIT': return 'Palm Fruit Sales';
      default: return category;
    }
  };

  const getStatusBadgeColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'PARTIALLY_DELIVERED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: DeliveryStatus) => {
    return status.replace('_', ' ');
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Admin access required</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Orders & Receipts</h1>
          <p className="text-gray-600 mt-2">Manage prepaid orders for blocks, cement, and palm fruit</p>
        </div>
        <button
          onClick={() => navigate('/orders/new')}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition shadow-lg"
        >
          <Plus className="w-5 h-5" />
          New Order
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-800">Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="">All Categories</option>
              <option value="BLOCKS">Blocks Factory</option>
              <option value="CEMENT">Cement Shop</option>
              <option value="PALM_FRUIT">Palm Fruit Sales</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="">All Statuses</option>
              <option value="OUTSTANDING">Outstanding (Pending + Partial)</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name or phone"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {(categoryFilter || statusFilter || dateFrom || dateTo || searchQuery) && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Clear Filters
            </button>
            <span className="text-sm text-gray-600">
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Order Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount Paid
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Balance Due
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {order.customers?.full_name || 'Unknown'}
                        </p>
                        {order.customers?.phone && (
                          <p className="text-sm text-gray-500">{order.customers.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{getCategoryLabel(order.order_category)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{formatDate(order.order_date)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-800">{formatGHS(order.total_amount)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-green-700">{formatGHS(order.amount_paid)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-semibold ${Number(order.balance_due) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formatGHS(order.balance_due)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(order.delivery_status)}`}>
                      {getStatusLabel(order.delivery_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setDeletingOrder(order)}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4 p-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{order.customers?.full_name || 'Unknown'}</p>
                    {order.customers?.phone && (
                      <p className="text-sm text-gray-500">{order.customers.phone}</p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(order.delivery_status)}`}>
                  {getStatusLabel(order.delivery_status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Category:</span>
                  <p className="font-medium text-gray-800">{getCategoryLabel(order.order_category)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <p className="font-medium text-gray-800">{formatDate(order.order_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total:</span>
                  <p className="font-semibold text-gray-800">{formatGHS(order.total_amount)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Paid:</span>
                  <p className="font-semibold text-green-700">{formatGHS(order.amount_paid)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Balance Due:</span>
                  <p className={`font-semibold ${Number(order.balance_due) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatGHS(order.balance_due)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View
                </button>
                <button
                  onClick={() => setDeletingOrder(order)}
                  className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No orders found</p>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deletingOrder}
        title="Delete Order"
        description={`Are you sure you want to delete this order for ${deletingOrder?.customers?.full_name || 'this customer'}? This will also delete all associated items, payments, and receipts. This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeletingOrder(null)}
      />
    </div>
  );
}
