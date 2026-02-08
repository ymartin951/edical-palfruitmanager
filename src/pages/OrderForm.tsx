import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseUntyped } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Trash2, User, Package, CreditCard } from "lucide-react";
import { formatGHS } from "../utils/currency";

type OrderCategory = "BLOCKS" | "CEMENT" | "PALM_FRUIT";
type PalmFruitType = "BUNCHES" | "LOOSE";

type ToastType = "success" | "error";

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  delivery_address: string | null;
  notes?: string | null;
}

interface OrderItem {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  weight_kg?: number; // used for BUNCHES
  line_total: number;
}

interface Payment {
  amount: number;
  method: "CASH" | "MOMO" | "BANK";
  received_by: string;
  reference: string;
  payment_date: string; // yyyy-mm-dd
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function OrderForm() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userRole } = useAuth();
  const isAdmin = userRole?.role === "ADMIN";

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<OrderCategory | "">("");
  const [palmFruitType, setPalmFruitType] = useState<PalmFruitType>("BUNCHES");

  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  const [items, setItems] = useState<OrderItem[]>([
    { item_type: "", description: "", quantity: 0, unit_price: 0, line_total: 0 },
  ]);

  const [discount, setDiscount] = useState(0);

  const [payments, setPayments] = useState<Payment[]>([
    { amount: 0, method: "CASH", received_by: "", reference: "", payment_date: todayISO() },
  ]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    // Whenever category changes and there's still the blank default item, replace it with the category default.
    if (selectedCategory && items.length === 1 && !items[0].item_type) {
      setItems([getDefaultItemForCategory(selectedCategory, palmFruitType)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  useEffect(() => {
    // If you switch palm fruit type while PALM_FRUIT selected, ensure item structure matches.
    if (selectedCategory !== "PALM_FRUIT") return;
    setItems([getDefaultItemForCategory("PALM_FRUIT", palmFruitType)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palmFruitType]);

  const toast = (message: string, type: ToastType) => {
    showToast(message, type);
  };

  const loadCustomers = async () => {
    try {
      // Use untyped client to avoid "never/overload" issues if customers table isn't in Database types
      const { data, error } = await supabaseUntyped.from("customers").select("*").order("full_name");
      if (error) throw error;

      setCustomers((data || []) as Customer[]);
    } catch (err: any) {
      toast(err?.message || "Error loading customers", "error");
    }
  };

  const getDefaultItemForCategory = (category: OrderCategory, pfType: PalmFruitType): OrderItem => {
    if (category === "BLOCKS") {
      return { item_type: "BLOCKS", description: "", quantity: 0, unit_price: 0, line_total: 0 };
    }
    if (category === "CEMENT") {
      return { item_type: "CEMENT", description: "", quantity: 0, unit_price: 0, line_total: 0 };
    }

    // PALM_FRUIT
    if (pfType === "BUNCHES") {
      return {
        item_type: "PALM_FRUIT_BUNCHES",
        description: "",
        quantity: 0, // not used for BUNCHES, but kept for schema compatibility
        unit_price: 0, // price per kg
        weight_kg: 0,
        line_total: 0,
      };
    }

    return {
      item_type: "PALM_FRUIT_LOOSE",
      description: "",
      quantity: 0, // buckets
      unit_price: 0, // price per bucket
      line_total: 0,
    };
  };

  /**
   * ✅ Key fix: immutable updates + correct recalculation rules
   * - PALM_FRUIT (BUNCHES): line_total = weight_kg * unit_price (recompute on either change)
   * - Others (and PALM_FRUIT LOOSE): line_total = quantity * unit_price
   */
  const updateItem = (index: number, patch: Partial<OrderItem>) => {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === index ? { ...it, ...patch } : it));

      const it = next[index];
      const qty = toNumber(it.quantity);
      const unit = toNumber(it.unit_price);
      const w = toNumber(it.weight_kg);

      const isPalmBunches =
        selectedCategory === "PALM_FRUIT" && palmFruitType === "BUNCHES" && it.item_type === "PALM_FRUIT_BUNCHES";

      const lineTotal = isPalmBunches ? w * unit : qty * unit;
      next[index] = { ...it, line_total: lineTotal };

      return next;
    });
  };

  const addItem = () => {
    if (!selectedCategory) return;
    setItems((prev) => [...prev, getDefaultItemForCategory(selectedCategory, palmFruitType)]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const updatePayment = (index: number, patch: Partial<Payment>) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const addPayment = () => {
    setPayments((prev) => [
      ...prev,
      { amount: 0, method: "CASH", received_by: "", reference: "", payment_date: todayISO() },
    ]);
  };

  const removePayment = (index: number) => {
    setPayments((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + toNumber(item.line_total), 0), [items]);
  const totalAmount = useMemo(() => Math.max(0, subtotal - toNumber(discount)), [subtotal, discount]);
  const amountPaid = useMemo(() => payments.reduce((sum, p) => sum + toNumber(p.amount), 0), [payments]);
  const balanceDue = useMemo(() => totalAmount - amountPaid, [totalAmount, amountPaid]);

  const validateBeforeSubmit = (): string | null => {
    if (!selectedCategory) return "Please select an order category";

    if (!isNewCustomer && !customerId) return "Please select a customer";
    if (isNewCustomer && !customerName.trim()) return "Please enter customer name";

    if (items.length === 0) return "Please add at least one item";

    const hasValidItem = items.some((it) => {
      if (selectedCategory === "PALM_FRUIT" && palmFruitType === "BUNCHES") {
        return toNumber(it.weight_kg) > 0 && toNumber(it.unit_price) > 0;
      }
      return toNumber(it.quantity) > 0 && toNumber(it.unit_price) > 0;
    });

    if (!hasValidItem) return "Please add at least one valid item (qty/price or weight/price)";

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errMsg = validateBeforeSubmit();
    if (errMsg) {
      toast(errMsg, "error");
      return;
    }

    setLoading(true);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      let finalCustomerId = customerId;

      if (isNewCustomer) {
        const payload = {
          full_name: customerName.trim(),
          phone: customerPhone ? customerPhone.trim() : null,
          delivery_address: deliveryAddress ? deliveryAddress.trim() : null,
          notes: customerNotes ? customerNotes.trim() : null,
        };

        const { data: createdCustomer, error: customerError } = await supabaseUntyped
          .from("customers")
          .insert(payload)
          .select("*")
          .single();

        if (customerError) throw customerError;

        finalCustomerId = String((createdCustomer as any).id);
      }

      const orderPayload = {
        order_category: selectedCategory,
        customer_id: finalCustomerId,
        order_date: new Date().toISOString(),
        delivery_status: "PENDING",
        subtotal,
        discount: toNumber(discount),
        total_amount: totalAmount,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        created_by: userData.user?.id || null,
      };

      const { data: order, error: orderError } = await supabaseUntyped
        .from("orders")
        .insert(orderPayload)
        .select("*")
        .single();

      if (orderError) throw orderError;

      const orderId = String((order as any).id);

      // Build items: only insert items with meaningful totals
      const orderItems = items
        .map((it) => {
          const qty = toNumber(it.quantity);
          const unit = toNumber(it.unit_price);
          const w = toNumber(it.weight_kg);

          const isPalmBunches =
            selectedCategory === "PALM_FRUIT" && palmFruitType === "BUNCHES" && it.item_type === "PALM_FRUIT_BUNCHES";

          const line_total = isPalmBunches ? w * unit : qty * unit;

          // Must be valid
          const valid = isPalmBunches ? w > 0 && unit > 0 : qty > 0 && unit > 0;
          if (!valid) return null;

          return {
            order_id: orderId,
            item_type: it.item_type,
            description: it.description ? it.description : null,
            quantity: qty,
            unit_price: unit,
            weight_kg: isPalmBunches ? w : null,
            line_total,
          };
        })
        .filter(Boolean);

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabaseUntyped.from("order_items").insert(orderItems as any[]);
        if (itemsError) throw itemsError;
      }

      const validPayments = payments
        .map((p) => ({
          order_id: orderId,
          payment_date: p.payment_date,
          amount: toNumber(p.amount),
          method: p.method,
          received_by: p.received_by ? p.received_by : null,
          reference: p.reference ? p.reference : null,
          created_by: userData.user?.id || null,
        }))
        .filter((p) => p.amount > 0);

      if (validPayments.length > 0) {
        const { error: paymentsError } = await supabaseUntyped.from("payments").insert(validPayments as any[]);
        if (paymentsError) throw paymentsError;
      }

      toast("Order created successfully", "success");
      navigate(`/orders/${orderId}`);
    } catch (err: any) {
      toast(err?.message || "Error creating order", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Admin access required</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Create New Order</h1>
        <button
          type="button"
          onClick={() => navigate("/orders")}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
        >
          Cancel
        </button>
      </div>

      {/* Step 1 */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Step 1: Select Order Category
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["BLOCKS", "CEMENT", "PALM_FRUIT"] as OrderCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setSelectedCategory(category);
                  setItems([getDefaultItemForCategory(category, palmFruitType)]);
                }}
                className={`p-6 rounded-lg border-2 transition ${
                  selectedCategory === category ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-green-300"
                }`}
              >
                <div className="text-center">
                  <Package
                    className={`w-8 h-8 mx-auto mb-2 ${
                      selectedCategory === category ? "text-green-600" : "text-gray-400"
                    }`}
                  />
                  <p className="font-semibold text-gray-800">
                    {category === "BLOCKS"
                      ? "Blocks Factory"
                      : category === "CEMENT"
                      ? "Cement Shop"
                      : "Palm Fruit Sales"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedCategory && (
        <>
          {/* Step 2 */}
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Step 2: Customer Details
            </h2>

            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isNewCustomer}
                  onChange={() => setIsNewCustomer(false)}
                  className="w-4 h-4 text-green-600"
                />
                <span className="text-sm font-medium text-gray-700">Existing Customer</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isNewCustomer}
                  onChange={() => setIsNewCustomer(true)}
                  className="w-4 h-4 text-green-600"
                />
                <span className="text-sm font-medium text-gray-700">New Customer</span>
              </label>
            </div>

            {!isNewCustomer ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  required
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Step 3: Order Items
              </h2>

              {selectedCategory !== "PALM_FRUIT" && (
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              )}
            </div>

            {selectedCategory === "PALM_FRUIT" && (
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={palmFruitType === "BUNCHES"}
                    onChange={() => setPalmFruitType("BUNCHES")}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Bunches (by weight)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={palmFruitType === "LOOSE"}
                    onChange={() => setPalmFruitType("LOOSE")}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Loose (by buckets)</span>
                </label>
              </div>
            )}

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Item {index + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {selectedCategory !== "PALM_FRUIT" && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder={selectedCategory === "BLOCKS" ? "5-inch, 6-inch..." : "Brand/type..."}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                      </div>
                    )}

                    {selectedCategory === "PALM_FRUIT" && palmFruitType === "BUNCHES" ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={toNumber(item.weight_kg)}
                            onChange={(e) => updateItem(index, { weight_kg: toNumber(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Price per kg *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={toNumber(item.unit_price)}
                            onChange={(e) => updateItem(index, { unit_price: toNumber(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            required
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {selectedCategory === "PALM_FRUIT" ? "Buckets" : "Quantity"} *
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={toNumber(item.quantity)}
                            onChange={(e) => updateItem(index, { quantity: toNumber(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {selectedCategory === "PALM_FRUIT" ? "Price per bucket" : "Unit Price"} *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={toNumber(item.unit_price)}
                            onChange={(e) => updateItem(index, { unit_price: toNumber(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                            required
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Line Total</label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-800">
                        {formatGHS(toNumber(item.line_total))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-semibold text-lg text-gray-800">{formatGHS(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center">
                <label className="text-gray-700">Discount:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={subtotal}
                  value={toNumber(discount)}
                  onChange={(e) => setDiscount(toNumber(e.target.value))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-right"
                />
              </div>

              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-gray-800">Total Amount:</span>
                <span className="text-green-700">{formatGHS(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Step 4: Payments (Optional)
              </h2>

              <button
                type="button"
                onClick={addPayment}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Payment
              </button>
            </div>

            <div className="space-y-4">
              {payments.map((payment, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Payment {index + 1}</span>
                    {payments.length > 1 && (
                      <button type="button" onClick={() => removePayment(index)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={totalAmount}
                        value={toNumber(payment.amount)}
                        onChange={(e) => updatePayment(index, { amount: toNumber(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                      <select
                        value={payment.method}
                        onChange={(e) => updatePayment(index, { method: e.target.value as Payment["method"] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      >
                        <option value="CASH">Cash</option>
                        <option value="MOMO">Mobile Money</option>
                        <option value="BANK">Bank Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                      <input
                        type="text"
                        value={payment.received_by}
                        onChange={(e) => updatePayment(index, { received_by: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                      <input
                        type="text"
                        value={payment.reference}
                        onChange={(e) => updatePayment(index, { reference: e.target.value })}
                        placeholder="MoMo ref, etc."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total Amount:</span>
                <span className="font-semibold text-gray-800">{formatGHS(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Amount Paid:</span>
                <span className="font-semibold text-green-700">{formatGHS(amountPaid)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-gray-800">Balance Due:</span>
                <span className={balanceDue > 0 ? "text-red-600" : "text-gray-600"}>{formatGHS(balanceDue)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Order..." : "Create Order"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
