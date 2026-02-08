import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type DeliveryStatus = 'PENDING' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED';

export function OrderEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('PENDING');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const isAdmin = userRole?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin && id) loadOrder();
  }, [isAdmin, id]);

  const loadOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setDeliveryStatus(data.delivery_status);
      setDeliveryDate(data.delivery_date || '');
      setDeliveredBy(data.delivered_by || '');
      setDeliveryNotes(data.delivery_notes || '');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deliveryStatus === 'DELIVERED' && !deliveryDate) {
      showToast('Please enter delivery date for delivered orders', 'error');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_status: deliveryStatus,
          delivery_date: deliveryStatus === 'DELIVERED' ? deliveryDate : null,
          delivered_by: deliveryStatus === 'DELIVERED' ? deliveredBy : null,
          delivery_notes: deliveryNotes || null,
        })
        .eq('id', id);

      if (error) throw error;

      showToast('Order updated successfully', 'success');
      navigate(`/orders/${id}`);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Edit Order</h1>
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">Delivery Information</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Status *
          </label>
          <select
            value={deliveryStatus}
            onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            required
          >
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {deliveryStatus === 'DELIVERED' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Date *
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivered By
              </label>
              <input
                type="text"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Notes
          </label>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            placeholder="Add any notes about the delivery..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => navigate(`/orders/${id}`)}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
