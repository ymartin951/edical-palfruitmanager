import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { formatGHS } from '../utils/currency';

export function OrderDeliveryNote() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('orders').select('*, customers(*)').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id),
      ]);
      if (orderRes.error) throw orderRes.error;
      setOrder(orderRes.data);
      setItems(itemsRes.data || []);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const getCategoryLabel = (c: string) => ({ BLOCKS: 'Blocks Factory', CEMENT: 'Cement Shop', PALM_FRUIT: 'Palm Fruit Sales' }[c] || c);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>;
  if (!order) return <div className="text-center py-12"><p>Order not found</p></div>;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #delivery-note-content, #delivery-note-content * { visibility: visible; }
          #delivery-note-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="no-print flex justify-between items-center mb-4">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Back
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Print Delivery Note
          </button>
        </div>

        <div id="delivery-note-content" className="bg-white p-8 shadow-lg rounded-lg">
          <div className="text-center mb-6">
            <img src="/edical-logo.png" alt="Logo" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Edical Palm Fruit Company LTD</h1>
            <p className="text-gray-600 text-lg font-semibold mt-2">Delivery Note</p>
          </div>

          <div className="border-t-2 border-b-2 border-green-600 py-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Order ID:</p>
                <p className="font-bold text-lg">{order.id.substring(0, 8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Order Date:</p>
                <p className="font-bold">{formatDate(order.order_date)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Deliver To:</h3>
              <p className="font-medium text-lg">{order.customers?.full_name}</p>
              {order.customers?.phone && <p className="text-sm text-gray-600">Phone: {order.customers.phone}</p>}
              {order.customers?.delivery_address && (
                <p className="text-sm text-gray-600 mt-2">
                  <span className="font-medium">Address:</span><br />
                  {order.customers.delivery_address}
                </p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Order Details:</h3>
              <p><span className="text-gray-600">Category:</span> {getCategoryLabel(order.order_category)}</p>
              <p><span className="text-gray-600">Status:</span> {order.delivery_status.replace('_', ' ')}</p>
              {order.delivery_date && (
                <p><span className="text-gray-600">Delivery Date:</span> {formatDate(order.delivery_date)}</p>
              )}
              {order.delivered_by && (
                <p><span className="text-gray-600">Delivered By:</span> {order.delivered_by}</p>
              )}
            </div>
          </div>

          <h3 className="font-semibold text-gray-800 mb-3">Items to Deliver:</h3>
          <table className="w-full mb-6">
            <thead className="bg-gray-50 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Item</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Qty/Weight</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Unit Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="px-4 py-3">
                    {item.item_type.replace(/_/g, ' ')}
                    {item.description && <span className="text-gray-600 text-sm"> ({item.description})</span>}
                  </td>
                  <td className="px-4 py-3 text-center">{item.weight_kg ? `${item.weight_kg} kg` : item.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatGHS(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatGHS(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-medium">Subtotal:</td>
                <td className="px-4 py-3 text-right font-semibold">{formatGHS(order.subtotal)}</td>
              </tr>
              {Number(order.discount) > 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-medium">Discount:</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatGHS(order.discount)}</td>
                </tr>
              )}
              <tr className="font-bold text-lg">
                <td colSpan={3} className="px-4 py-3 text-right">Total Amount:</td>
                <td className="px-4 py-3 text-right text-green-700">{formatGHS(order.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          {order.delivery_notes && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Delivery Notes:</h3>
              <p className="text-gray-700">{order.delivery_notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t-2 border-gray-300">
            <div>
              <p className="text-sm text-gray-600 mb-8">Delivered By:</p>
              <div className="border-b-2 border-gray-400 pb-1 mb-2"></div>
              <p className="text-sm text-gray-600">Signature & Date</p>
              {order.delivered_by && (
                <p className="text-sm font-medium mt-2">{order.delivered_by}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-8">Received By (Customer):</p>
              <div className="border-b-2 border-gray-400 pb-1 mb-2"></div>
              <p className="text-sm text-gray-600">Signature & Date</p>
            </div>
          </div>

          <div className="border-t-2 border-gray-300 mt-8 pt-6 text-center text-sm text-gray-600">
            <p className="mb-2">This is an official delivery note from Edical Palm Fruit Company LTD</p>
            <p>For inquiries, please contact us.</p>
          </div>
        </div>
      </div>
    </>
  );
}
