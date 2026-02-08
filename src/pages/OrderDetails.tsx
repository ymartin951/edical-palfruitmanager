import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { User, Package, Calendar, CreditCard, Plus, FileText, Printer, Edit, Trash2 } from 'lucide-react';
import { formatGHS } from '../utils/currency';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';

type DeliveryStatus = 'PENDING' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED';

export function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userRole } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [deliveryEvents, setDeliveryEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deletingPayment, setDeletingPayment] = useState<any>(null);
  const [showDeliveryUpdate, setShowDeliveryUpdate] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('PENDING');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const isAdmin = userRole?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin && id) loadOrderDetails();
  }, [isAdmin, id]);

  const loadOrderDetails = async () => {
    try {
      const [orderRes, itemsRes, paymentsRes, receiptsRes, eventsRes] = await Promise.all([
        supabase.from('orders').select('*, customers(*)').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id),
        supabase.from('payments').select('*').eq('order_id', id).order('payment_date', { ascending: false }),
        supabase.from('receipts').select('*').eq('order_id', id),
        supabase.from('delivery_events').select('*').eq('order_id', id).order('event_date', { ascending: false }),
      ]);
      if (orderRes.error) throw orderRes.error;
      setOrder(orderRes.data);
      setItems(itemsRes.data || []);
      setPayments(paymentsRes.data || []);
      setReceipts(receiptsRes.data || []);
      setDeliveryEvents(eventsRes.data || []);

      if (orderRes.data) {
        setDeliveryStatus(orderRes.data.delivery_status);
        setDeliveryDate(orderRes.data.delivery_date || '');
        setDeliveredBy(orderRes.data.delivered_by || '');
        setDeliveryNotes(orderRes.data.delivery_notes || '');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!order || paymentAmount <= 0) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('payments').insert({
        order_id: order.id,
        amount: paymentAmount,
        method: paymentMethod,
        created_by: userData.user?.id,
      });
      const newAmountPaid = Number(order.amount_paid) + Number(paymentAmount);
      await supabase.from('orders').update({
        amount_paid: newAmountPaid,
        balance_due: Number(order.total_amount) - newAmountPaid,
      }).eq('id', order.id);
      showToast('Payment added', 'success');
      setShowAddPayment(false);
      setPaymentAmount(0);
      loadOrderDetails();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;
    try {
      await supabase.from('payments').delete().eq('id', deletingPayment.id);
      const newAmountPaid = Number(order.amount_paid) - Number(deletingPayment.amount);
      await supabase.from('orders').update({
        amount_paid: newAmountPaid,
        balance_due: Number(order.total_amount) - newAmountPaid,
      }).eq('id', order.id);
      showToast('Payment deleted', 'success');
      setDeletingPayment(null);
      loadOrderDetails();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleUpdateDeliveryStatus = async () => {
    if (!order) return;

    if (deliveryStatus === 'DELIVERED' && !deliveryDate) {
      showToast('Please enter delivery date', 'error');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      await supabase.from('orders').update({
        delivery_status: deliveryStatus,
        delivery_date: deliveryStatus === 'DELIVERED' ? deliveryDate : null,
        delivered_by: deliveryStatus === 'DELIVERED' ? deliveredBy : null,
        delivery_notes: deliveryNotes || null,
      }).eq('id', order.id);

      await supabase.from('delivery_events').insert({
        order_id: order.id,
        status: deliveryStatus,
        event_date: new Date().toISOString(),
        delivered_by: deliveryStatus === 'DELIVERED' ? deliveredBy : null,
        notes: deliveryNotes || null,
        created_by: userData.user?.id,
      });

      showToast('Delivery status updated', 'success');
      setShowDeliveryUpdate(false);
      loadOrderDetails();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleIssueReceipt = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const year = new Date().getFullYear();
      const { data: latest } = await supabase.from('receipts')
        .select('receipt_number').order('issued_at', { ascending: false }).limit(1).single();
      let nextNum = 1;
      if (latest?.receipt_number) {
        const match = latest.receipt_number.match(/EDC-REC-\d{4}-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const receiptNumber = `EDC-REC-${year}-${String(nextNum).padStart(6, '0')}`;
      await supabase.from('receipts').insert({
        order_id: order.id,
        receipt_number: receiptNumber,
        issued_by: userData.user?.id,
      });
      showToast(`Receipt ${receiptNumber} issued`, 'success');
      loadOrderDetails();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const getCategoryLabel = (c: string) => ({ BLOCKS: 'Blocks Factory', CEMENT: 'Cement Shop', PALM_FRUIT: 'Palm Fruit Sales' }[c] || c);
  const getStatusColor = (s: DeliveryStatus) => ({
    DELIVERED: 'bg-green-100 text-green-800',
    PARTIALLY_DELIVERED: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    CANCELLED: 'bg-red-100 text-red-800'
  }[s] || 'bg-gray-100 text-gray-800');

  if (!isAdmin || loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;
  if (!order) return <div className="text-center py-12"><p>Order not found</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button onClick={() => navigate('/orders')} className="text-green-600 mb-2">← Back to Orders</button>
          <h1 className="text-3xl font-bold">Order Details</h1>
        </div>
        <button onClick={() => navigate(`/orders/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Edit className="w-4 h-4" />Edit
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2"><User className="w-4 h-4" />Customer</h3>
          <p className="font-medium">{order.customers?.full_name}</p>
          {order.customers?.phone && <p className="text-sm text-gray-600">{order.customers.phone}</p>}
          {order.customers?.delivery_address && <p className="text-sm text-gray-600">{order.customers.delivery_address}</p>}
        </div>
        <div>
          <h3 className="font-semibold text-gray-600 uppercase mb-3 flex items-center gap-2"><Package className="w-4 h-4" />Order</h3>
          <p><span className="text-gray-600">Category:</span> {getCategoryLabel(order.order_category)}</p>
          <p><span className="text-gray-600">Date:</span> {formatDate(order.order_date)}</p>
          <p><span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(order.delivery_status)}`}>{order.delivery_status.replace('_', ' ')}</span></p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="font-semibold mb-4">Order Items</h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs uppercase">Item</th>
              <th className="px-4 py-3 text-right text-xs uppercase">Qty</th>
              <th className="px-4 py-3 text-right text-xs uppercase">Price</th>
              <th className="px-4 py-3 text-right text-xs uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{item.item_type} {item.description}</td>
                <td className="px-4 py-3 text-right">{item.weight_kg ? `${item.weight_kg}kg` : item.quantity}</td>
                <td className="px-4 py-3 text-right">{formatGHS(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatGHS(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2">
            <tr><td colSpan={3} className="px-4 py-3 text-right font-medium">Subtotal:</td><td className="px-4 py-3 text-right font-semibold">{formatGHS(order.subtotal)}</td></tr>
            {Number(order.discount) > 0 && <tr><td colSpan={3} className="px-4 py-3 text-right">Discount:</td><td className="px-4 py-3 text-right text-red-600">-{formatGHS(order.discount)}</td></tr>}
            <tr><td colSpan={3} className="px-4 py-3 text-right font-bold">Total:</td><td className="px-4 py-3 text-right font-bold text-green-700">{formatGHS(order.total_amount)}</td></tr>
          </tfoot>
        </table>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5" />Payments</h3>
          <button onClick={() => setShowAddPayment(!showAddPayment)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" />Add Payment
          </button>
        </div>
        {showAddPayment && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1">Amount</label><input type="number" step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium mb-1">Method</label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg"><option value="CASH">Cash</option><option value="MOMO">Mobile Money</option><option value="BANK">Bank Transfer</option></select></div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddPayment} className="px-4 py-2 bg-green-600 text-white rounded-lg">Save</button>
              <button onClick={() => setShowAddPayment(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        )}
        {payments.map(p => (
          <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg mb-2">
            <div><p className="font-semibold">{formatGHS(p.amount)}</p><p className="text-sm text-gray-600">{p.method} • {formatDate(p.payment_date)}</p></div>
            <button onClick={() => setDeletingPayment(p)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between"><span>Total:</span><span className="font-semibold">{formatGHS(order.total_amount)}</span></div>
          <div className="flex justify-between"><span>Paid:</span><span className="font-semibold text-green-700">{formatGHS(order.amount_paid)}</span></div>
          <div className="flex justify-between text-lg"><span className="font-bold">Balance:</span><span className={`font-bold ${Number(order.balance_due) > 0 ? 'text-red-600' : 'text-gray-600'}`}>{formatGHS(order.balance_due)}</span></div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Delivery Status</h3>
          <button onClick={() => setShowDeliveryUpdate(!showDeliveryUpdate)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Update Status</button>
        </div>

        {showDeliveryUpdate ? (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-2">Delivery Status *</label>
              <select value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value as DeliveryStatus)} className="w-full px-4 py-2 border rounded-lg">
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            {deliveryStatus === 'DELIVERED' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Delivery Date *</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Delivered By</label>
                  <input type="text" value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Delivery Notes</label>
              <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={3} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpdateDeliveryStatus} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Status</button>
              <button onClick={() => setShowDeliveryUpdate(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <p><span className={`px-4 py-2 text-sm font-medium rounded-full ${order.delivery_status === 'DELIVERED' ? 'bg-green-100 text-green-800' : order.delivery_status === 'PARTIALLY_DELIVERED' ? 'bg-blue-100 text-blue-800' : order.delivery_status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{order.delivery_status.replace('_', ' ')}</span></p>
            {order.delivery_date && <p className="text-sm text-gray-600 mt-2">Delivered on {formatDate(order.delivery_date)}</p>}
            {order.delivered_by && <p className="text-sm text-gray-600">Delivered by {order.delivered_by}</p>}
            {order.delivery_notes && <p className="text-sm text-gray-600 mt-2">{order.delivery_notes}</p>}
          </div>
        )}
      </div>

      {deliveryEvents.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="font-semibold mb-4">Delivery History</h3>
          <div className="space-y-3">
            {deliveryEvents.map(event => (
              <div key={event.id} className="flex gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{event.status.replace('_', ' ')}</p>
                  <p className="text-sm text-gray-600">{formatDate(event.event_date)}</p>
                  {event.delivered_by && <p className="text-sm text-gray-600">By: {event.delivered_by}</p>}
                  {event.notes && <p className="text-sm text-gray-500 mt-1">{event.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="w-5 h-5" />Documents</h3>
        {receipts.length > 0 ? receipts.map(r => (
          <div key={r.id} className="p-3 border rounded-lg mb-2"><p className="font-semibold">Receipt: {r.receipt_number}</p><p className="text-sm text-gray-600">Issued {formatDate(r.issued_at)}</p></div>
        )) : <p className="text-gray-500 mb-4">No receipt issued</p>}
        <div className="flex flex-wrap gap-2">
          {receipts.length === 0 && <button onClick={handleIssueReceipt} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><FileText className="w-4 h-4" />Issue Receipt</button>}
          {receipts.length > 0 && (
            <>
              <button onClick={() => navigate(`/orders/${id}/receipt`)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Printer className="w-4 h-4" />Print Receipt</button>
              <button onClick={() => navigate(`/orders/${id}/delivery-note`)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Package className="w-4 h-4" />Print Delivery Note</button>
            </>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog open={!!deletingPayment} title="Delete Payment" description={`Delete payment of ${deletingPayment ? formatGHS(deletingPayment.amount) : ''}?`} onConfirm={handleDeletePayment} onCancel={() => setDeletingPayment(null)} />
    </div>
  );
}
