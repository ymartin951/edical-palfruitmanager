import { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, supabaseUntyped } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { PageContext } from "../App";
import { MoreVertical, Plus, Search, X, Pencil, Trash2 } from "lucide-react";

type PaymentMethod = "CASH" | "MOMO" | "BANK" | string;

type AgentRow = {
  id: string;
  full_name: string;
  status?: string | null;
};

type CashAdvanceRow = {
  id: string;
  agent_id: string;
  advance_date: string; // ISO
  amount: number | string;
  payment_method: PaymentMethod;
  notes?: string | null;
  signed_by: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

type CashAdvanceWithAgent = CashAdvanceRow & {
  agents: Pick<AgentRow, "id" | "full_name"> | null;
};

type FormState = {
  id?: string;
  agent_id: string;
  advance_date: string; // yyyy-mm-dd
  amount: string;
  payment_method: PaymentMethod;
  notes: string;
  signed_by: string;
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatMoneyGHS(amount: number) {
  return `GH₵ ${amount.toFixed(2)}`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}

function getMonthRangeISO(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const yyyyMmDd = (x: Date) => x.toISOString().split("T")[0];
  return { from: yyyyMmDd(from), to: yyyyMmDd(to) };
}

function toExclusiveISO(dateToYYYYMMDD: string) {
  const end = new Date(dateToYYYYMMDD);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

export function CashAdvances() {
  const { userRole } = useAuth();
  const { setCurrentPage } = useContext(PageContext);
  const navigate = useNavigate();
  const location = useLocation();

  const monthRange = useMemo(() => getMonthRangeISO(), []);
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [dateFrom, setDateFrom] = useState<string>(query.get("from") || monthRange.from);
  const [dateTo, setDateTo] = useState<string>(query.get("to") || monthRange.to);

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [rows, setRows] = useState<CashAdvanceWithAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");

  // ✅ Action sheet state (fixes clipped dropdown)
  const [actionRow, setActionRow] = useState<CashAdvanceWithAgent | null>(null);

  const [form, setForm] = useState<FormState>({
    agent_id: "",
    advance_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "CASH",
    notes: "",
    signed_by: "",
  });

  useEffect(() => setCurrentPage("cash-advances"), [setCurrentPage]);

  useEffect(() => {
    if (userRole?.role === "ADMIN") void loadAll();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // Keep URL synced (your dashboard links use from/to)
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    sp.set("from", dateFrom);
    sp.set("to", dateTo);
    if (!sp.get("preset")) sp.set("preset", "custom");
    navigate({ pathname: location.pathname, search: sp.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  async function loadAll() {
    setLoading(true);
    try {
      const fromISO = new Date(dateFrom).toISOString();
      const toExclusive = toExclusiveISO(dateTo);

      const [agentsRes, advancesRes] = await Promise.all([
        supabase
          .from("agents")
          .select("id, full_name, status")
          .order("full_name")
          .returns<AgentRow[]>(),

        supabase
          .from("cash_advances")
          .select(
            "id, agent_id, advance_date, amount, payment_method, notes, signed_by, created_by, created_at, agents(id, full_name)"
          )
          .gte("advance_date", fromISO)
          .lt("advance_date", toExclusive)
          .order("advance_date", { ascending: false })
          .returns<CashAdvanceWithAgent[]>(),
      ]);

      setAgents(agentsRes.data ?? []);
      setRows(advancesRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setMode("create");
    setForm({
      agent_id: agents[0]?.id ?? "",
      advance_date: new Date().toISOString().split("T")[0],
      amount: "",
      payment_method: "CASH",
      notes: "",
      signed_by: "",
    });
    setShowModal(true);
  }

  function openEdit(r: CashAdvanceWithAgent) {
    setMode("edit");
    setForm({
      id: r.id,
      agent_id: r.agent_id,
      advance_date: r.advance_date.split("T")[0],
      amount: String(toNumber(r.amount)),
      payment_method: (r.payment_method ?? "CASH") as PaymentMethod,
      notes: r.notes ?? "",
      signed_by: r.signed_by ?? "",
    });
    setShowModal(true);
  }

  async function onSave() {
    if (!form.agent_id) return;

    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    setBusyId(form.id ?? "saving");
    try {
      // ✅ use untyped client for mutations (your database.types makes Insert/Update `never`)
      const payload = {
        agent_id: form.agent_id,
        advance_date: new Date(form.advance_date).toISOString(),
        amount: amt,
        payment_method: form.payment_method,
        notes: form.notes.trim() ? form.notes.trim() : null,
        signed_by: form.signed_by.trim() ? form.signed_by.trim() : null,
      };

      if (mode === "create") {
        const res = await supabaseUntyped.from("cash_advances").insert(payload).select("id");
        if (res.error) return;
      } else {
        if (!form.id) return;
        const res = await supabaseUntyped.from("cash_advances").update(payload).eq("id", form.id).select("id");
        if (res.error) return;
      }

      setShowModal(false);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm("Delete this cash advance? This action cannot be undone.");
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await supabaseUntyped.from("cash_advances").delete().eq("id", id).select("id");
      if (res.error) return;
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const agentName = (r.agents?.full_name ?? "").toLowerCase();
      const method = String(r.payment_method ?? "").toLowerCase();
      const signed = String(r.signed_by ?? "").toLowerCase();
      const notes = String(r.notes ?? "").toLowerCase();
      const amountStr = String(toNumber(r.amount));
      return agentName.includes(q) || method.includes(q) || signed.includes(q) || notes.includes(q) || amountStr.includes(q);
    });
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((sum, r) => sum + toNumber(r.amount), 0), [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (userRole?.role !== "ADMIN") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Cash advances are only available to Admin users.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-text">Cash Advances</h1>
            <p className="text-sm text-gray-600 mt-1">Track advances given to agents (filter by date range).</p>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Advance
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Search</label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Agent, method, signed by, notes, amount..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-800">{filtered.length}</span> record(s)
          </p>
          <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            Total (filtered): <span className="font-semibold">{formatMoneyGHS(total)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gray-50 rounded-t-xl">
          <h2 className="text-base sm:text-lg font-bold text-gray-800">Advances List</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Click the 3 dots to edit or delete.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-white">
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Signed By</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-semibold text-gray-900">{r.agents?.full_name ?? "Unknown"}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">{formatDateShort(r.advance_date)}</td>
                  <td className="px-4 py-4 text-sm text-gray-900">{formatMoneyGHS(toNumber(r.amount))}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">{String(r.payment_method).toUpperCase()}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">{r.signed_by ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setActionRow(r)}
                      disabled={busyId === r.id}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 disabled:opacity-60"
                      title="Actions"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-700" />
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-600">
                    No advances found for this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 sm:px-6 py-4 text-xs text-gray-500">
          Tip: Scroll horizontally on small screens to see Actions.
        </div>
      </div>

      {/* ✅ Action Sheet (fixes the clipped dropdown issue) */}
      {actionRow && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Actions for</p>
                <p className="text-base font-bold text-gray-900">{actionRow.agents?.full_name ?? "Unknown"}</p>
              </div>
              <button onClick={() => setActionRow(null)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={() => {
                  const row = actionRow;
                  setActionRow(null);
                  openEdit(row);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold text-gray-900"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={() => {
                  const id = actionRow.id;
                  setActionRow(null);
                  void onDelete(id);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-red-50 font-semibold text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {mode === "create" ? "Add Cash Advance" : "Edit Cash Advance"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Agent</label>
                <select
                  value={form.agent_id}
                  onChange={(e) => setForm((p) => ({ ...p, agent_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Date</label>
                  <input
                    type="date"
                    value={form.advance_date}
                    onChange={(e) => setForm((p) => ({ ...p, advance_date: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Amount (GH₵)</label>
                  <input
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  >
                    <option value="CASH">CASH</option>
                    <option value="MOMO">MOMO</option>
                    <option value="BANK">BANK</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Signed By (optional)</label>
                  <input
                    value={form.signed_by}
                    onChange={(e) => setForm((p) => ({ ...p, signed_by: e.target.value }))}
                    placeholder="Name"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Any notes about this advance..."
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                  rows={3}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-white font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={busyId === "saving" || busyId === form.id}
                className="px-4 py-2 rounded-lg bg-brand-primary text-white font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {mode === "create" ? "Save Advance" : "Update Advance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
