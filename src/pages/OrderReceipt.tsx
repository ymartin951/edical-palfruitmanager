import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { formatGHS } from "../utils/currency";

type RouteParams = {
  id?: string;
};

export function OrderReceipt() {
  // ✅ Fix: properly type params so TS doesn't complain about undefined usage
  const { id } = useParams<RouteParams>();

  const { showToast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData(id);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async (orderId: string) => {
    setLoading(true);
    try {
      const [orderRes, itemsRes, paymentsRes, receiptRes] = await Promise.all([
        supabase.from("orders").select("*, customers(*)").eq("id", orderId).single(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase.from("payments").select("*").eq("order_id", orderId).order("payment_date"),
        // ✅ Use maybeSingle() so it won't throw if no receipt exists
        supabase
          .from("receipts")
          .select("*")
          .eq("order_id", orderId)
          .order("issued_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (orderRes.error) throw orderRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (receiptRes.error) throw receiptRes.error;

      setOrder(orderRes.data);
      setItems(itemsRes.data || []);
      setPayments(paymentsRes.data || []);
      setReceipt(receiptRes.data || null);
    } catch (error: any) {
      showToast(error?.message || "Failed to load receipt", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getCategoryLabel = (c: string) =>
    (
      {
        BLOCKS: "Blocks Factory",
        CEMENT: "Cement Shop",
        PALM_FRUIT: "Palm Fruit Sales",
      } as Record<string, string>
    )[c] || c;

  const formatStatus = (s: unknown) => {
    const str = typeof s === "string" ? s : "";
    return str.replace(/_/g, " ");
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // If no id or data, show friendly message
  if (!id) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Invalid receipt link</p>
      </div>
    );
  }

  // If no order or no receipt, show message (receipt might not exist yet)
  if (!order || !receipt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Receipt not found</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-content, #receipt-content * { visibility: visible; }
          #receipt-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="no-print flex justify-between items-center mb-4">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            type="button"
          >
            ← Back
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            type="button"
          >
            Print Receipt
          </button>
        </div>

        <div id="receipt-content" className="bg-white p-8 shadow-lg rounded-lg">
          <div className="text-center mb-6">
            <img src="/edical-logo.png" alt="Logo" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Edical Palm Fruit Company LTD</h1>
            <p className="text-gray-600">Official Receipt</p>
          </div>

          <div className="border-t-2 border-b-2 border-green-600 py-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Receipt Number:</p>
                <p className="font-bold text-lg">{receipt.receipt_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date Issued:</p>
                <p className="font-bold">{formatDate(receipt.issued_at)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Customer Details:</h3>
              <p className="font-medium">{order.customers?.full_name || "-"}</p>
              {order.customers?.phone && <p className="text-sm text-gray-600">{order.customers.phone}</p>}
              {order.customers?.delivery_address && (
                <p className="text-sm text-gray-600">{order.customers.delivery_address}</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Order Details:</h3>
              <p>
                <span className="text-gray-600">Category:</span> {getCategoryLabel(order.order_category)}
              </p>
              <p>
                <span className="text-gray-600">Order Date:</span> {formatDate(order.order_date)}
              </p>
              <p>
                <span className="text-gray-600">Status:</span> {formatStatus(order.delivery_status)}
              </p>
            </div>
          </div>

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
                    {String(item.item_type || "").replace(/_/g, " ")}
                    {item.description && (
                      <span className="text-gray-600 text-sm"> ({String(item.description)})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.weight_kg ? `${item.weight_kg} kg` : item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right">{formatGHS(Number(item.unit_price || 0))}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatGHS(Number(item.line_total || 0))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right font-medium">
                  Subtotal:
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatGHS(Number(order.subtotal || 0))}</td>
              </tr>
              {Number(order.discount || 0) > 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-medium">
                    Discount:
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    -{formatGHS(Number(order.discount || 0))}
                  </td>
                </tr>
              )}
              <tr className="font-bold text-lg">
                <td colSpan={3} className="px-4 py-3 text-right">
                  Total Amount:
                </td>
                <td className="px-4 py-3 text-right text-green-700">
                  {formatGHS(Number(order.total_amount || 0))}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Payment Summary:</h3>
            <div className="space-y-2">
              {payments.map((payment, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {payment.method} - {formatDate(payment.payment_date)}
                  </span>
                  <span className="font-semibold">{formatGHS(Number(payment.amount || 0))}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-300 mt-3 pt-3 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium">Total Paid:</span>
                <span className="font-semibold text-green-700">{formatGHS(Number(order.amount_paid || 0))}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-bold">Balance Due:</span>
                <span
                  className={`font-bold ${Number(order.balance_due || 0) > 0 ? "text-red-600" : "text-gray-600"}`}
                >
                  {formatGHS(Number(order.balance_due || 0))}
                </span>
              </div>
            </div>
          </div>

          {/* ✅ CONTACT DETAILS ADDED HERE */}
          <div className="border-t-2 border-gray-300 pt-6 text-center text-sm text-gray-600">
            <p className="mb-2">Thank you for your business!</p>
            <p className="font-semibold text-gray-800">Edical Palm Fruit Company LTD</p>
            <p className="mt-2">For inquiries, please contact:</p>
            <p className="mt-1">
              Madam: <span className="font-semibold text-gray-800">0242101399</span>
            </p>
            <p>
              Stephen: <span className="font-semibold text-gray-800">0247146469</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
