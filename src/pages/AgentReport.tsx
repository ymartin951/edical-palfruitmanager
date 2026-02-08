import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseUntyped } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { PageContext } from "../App";
import { ArrowLeft, FileText, Trash2, Pencil, Calendar, Wallet, Apple, DollarSign } from "lucide-react";

type AgentRow = {
  id: string;
  full_name: string;
  status?: string | null;
  phone?: string | null;
};

type AdvanceRow = {
  id: string;
  agent_id: string;
  advance_date: string;
  amount: number | string;
  payment_method?: "CASH" | "MOMO" | "BANK" | string | null;
  signed_by?: string | null;
};

type ExpenseRow = {
  id: string;
  agent_id: string;
  expense_date: string;
  expense_type: string;
  amount: number | string;
};

type CollectionRow = {
  id: string;
  agent_id: string;
  collection_date: string;
  total_amount_spent: number | string | null;
  driver_name?: string | null;
};

type CollectionItemRow = {
  id: string;
  collection_id: string;
  weight_kg: number | string | null;
  price_per_kg: number | string | null;
};

type TabKey = "overview" | "advances" | "collections" | "expenses";

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClass(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE") return "bg-green-100 text-green-800 border border-green-200";
  if (s === "INACTIVE") return "bg-gray-100 text-gray-700 border border-gray-200";
  return "bg-blue-100 text-blue-800 border border-blue-200";
}

function safeText(x: unknown) {
  return typeof x === "string" ? x : "";
}

/**
 * ✅ CORRECTION:
 * If total_amount_spent is missing/0, compute from breakdown items:
 * Σ(weight_kg * price_per_kg)
 */
function computeCollectionSpend(c: CollectionRow, items: CollectionItemRow[]): number {
  const stored = toNumber(c.total_amount_spent);
  if (stored > 0) return stored;

  if (!items || items.length === 0) return 0;

  return items.reduce((sum, it) => sum + toNumber(it.weight_kg) * toNumber(it.price_per_kg), 0);
}

export default function AgentReport() {
  const { id } = useParams<{ id: string }>();
  const agentId = id || "";

  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setCurrentPage } = useContext(PageContext);

  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<AgentRow | null>(null);

  const [tab, setTab] = useState<TabKey>("overview");

  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [itemsByCollectionId, setItemsByCollectionId] = useState<Record<string, CollectionItemRow[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage("agents");
  }, [setCurrentPage]);

  useEffect(() => {
    if (!agentId) {
      showToast("Missing agent id", "error");
      navigate("/agents");
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [agentRes, advancesRes, collectionsRes, expensesRes] = await Promise.all([
        supabaseUntyped.from("agents").select("id, full_name, status, phone").eq("id", agentId).single(),
        supabaseUntyped
          .from("cash_advances")
          .select("id, agent_id, advance_date, amount, payment_method, signed_by")
          .eq("agent_id", agentId)
          .order("advance_date", { ascending: false }),
        supabaseUntyped
          .from("fruit_collections")
          .select("id, agent_id, collection_date, total_amount_spent, driver_name")
          .eq("agent_id", agentId)
          .order("collection_date", { ascending: false }),
        supabaseUntyped
          .from("agent_expenses")
          .select("id, agent_id, expense_date, expense_type, amount")
          .eq("agent_id", agentId)
          .order("expense_date", { ascending: false }),
      ]);

      if (agentRes.error) throw agentRes.error;
      if (advancesRes.error) throw advancesRes.error;
      if (collectionsRes.error) throw collectionsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const agentRow = (agentRes.data ?? null) as AgentRow | null;
      const adv = (advancesRes.data ?? []) as AdvanceRow[];
      const cols = (collectionsRes.data ?? []) as CollectionRow[];
      const exp = (expensesRes.data ?? []) as ExpenseRow[];

      setAgent(agentRow);
      setAdvances(adv);
      setCollections(cols);
      setExpenses(exp);

      const ids = cols.map((c) => c.id);

      if (ids.length === 0) {
        setItemsByCollectionId({});
      } else {
        const itemsRes = await supabaseUntyped
          .from("fruit_collection_items")
          .select("id, collection_id, weight_kg, price_per_kg")
          .in("collection_id", ids);

        if (itemsRes.error) throw itemsRes.error;

        const items = (itemsRes.data ?? []) as CollectionItemRow[];

        const grouped: Record<string, CollectionItemRow[]> = {};
        for (const it of items) {
          const key = String(it.collection_id);
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(it);
        }

        Object.values(grouped).forEach((arr) => {
          arr.sort((a, b) => toNumber(b.weight_kg) - toNumber(a.weight_kg));
        });

        setItemsByCollectionId(grouped);
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to load agent report", "error");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const totalAdvances = advances.reduce((s, a) => s + toNumber(a.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + toNumber(e.amount), 0);

    // ✅ CORRECTION: compute total spend reliably per collection
    const totalSpend = collections.reduce((sum, c) => {
      const items = itemsByCollectionId[String(c.id)] ?? [];
      return sum + computeCollectionSpend(c, items);
    }, 0);

    const totalWeight = Object.values(itemsByCollectionId)
      .flat()
      .reduce((s, it) => s + toNumber(it.weight_kg), 0);

    const net = totalAdvances - (totalExpenses + totalSpend);

    return { totalAdvances, totalExpenses, totalSpend, totalWeight, netCash: net };
  }, [advances, expenses, collections, itemsByCollectionId]);

  // ---------- Delete handlers ----------
  const deleteAdvance = async (advanceId: string) => {
    const ok = window.confirm("Delete this cash advance?");
    if (!ok) return;

    setBusyId(advanceId);
    try {
      const res = await supabaseUntyped.from("cash_advances").delete().eq("id", advanceId).select("id");
      if (res.error) throw res.error;
      showToast("Advance deleted", "success");
      await loadAll();
    } catch (e: any) {
      showToast(e?.message || "Failed to delete advance", "error");
    } finally {
      setBusyId(null);
    }
  };

  const deleteCollection = async (collectionId: string) => {
    const ok = window.confirm("Delete this collection and its breakdown items?");
    if (!ok) return;

    setBusyId(collectionId);
    try {
      await supabaseUntyped.from("fruit_collection_items").delete().eq("collection_id", collectionId);
      const res = await supabaseUntyped.from("fruit_collections").delete().eq("id", collectionId).select("id");
      if (res.error) throw res.error;

      showToast("Collection deleted", "success");
      await loadAll();
    } catch (e: any) {
      showToast(e?.message || "Failed to delete collection", "error");
    } finally {
      setBusyId(null);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    const ok = window.confirm("Delete this expense?");
    if (!ok) return;

    setBusyId(expenseId);
    try {
      const res = await supabaseUntyped.from("agent_expenses").delete().eq("id", expenseId).select("id");
      if (res.error) throw res.error;
      showToast("Expense deleted", "success");
      await loadAll();
    } catch (e: any) {
      showToast(e?.message || "Failed to delete expense", "error");
    } finally {
      setBusyId(null);
    }
  };

  // ✅ GENERAL ACCOUNT REPORT (always)
  const openGeneralAccountReport = () => {
    const agentName = agent?.full_name || "Agent";
    const today = new Date().toLocaleDateString();

    const companyName = "Edical Palm Fruit Company LTD";
    const companyTagline = "Palm Fruit Operations & Accounting Report";

    // ✅ CORRECTION: remove extra semicolon in your pasted code
    const logoUrl = "/edical-logo.png";

    const preparedBy = "________________________";
    const approvedBy = "________________________";

    const totalAdv = totals.totalAdvances;
    const totalExp = totals.totalExpenses;
    const totalSpend = totals.totalSpend;
    const balance = totals.netCash;

    const balanceLabel = balance >= 0 ? "CASH BALANCE (SURPLUS)" : "DEFICIT (OVERDRAWN)";
    const balanceColor = balance >= 0 ? "#0f7a3a" : "#b42318";

    // ---------------- Collections table rows (with breakdown) ----------------
    const collectionsRows = collections
      .map((c) => {
        const items = itemsByCollectionId[String(c.id)] ?? [];
        const totalW = items.reduce((s, it) => s + toNumber(it.weight_kg), 0);

        const breakdownHtml =
          items.length === 0
            ? `<div style="color:#64748b;">No breakdown</div>`
            : items
                .map((it) => {
                  const w = toNumber(it.weight_kg);
                  const p = toNumber(it.price_per_kg);
                  return `
                    <div style="margin:2px 0;">
                      <span style="font-weight:800;">${w.toFixed(2)}kg</span>
                      <span style="color:#64748b;"> @ </span>
                      <span style="color:#0f7a3a; font-weight:800;">GH₵${p.toFixed(2)}/kg</span>
                    </div>
                  `;
                })
                .join("");

        // ✅ CORRECTION: Amount Spent uses computed spend
        const spend = computeCollectionSpend(c, items);

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${formatDate(
              c.collection_date
            )}</td>

            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
              ${breakdownHtml}
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;color:#334155;font-size:12px;">
                <b>Total Weight:</b> ${totalW.toFixed(2)}kg
              </div>
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">
              GH₵ ${spend.toFixed(2)}
            </td>

            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
              ${safeText(c.driver_name) || "-"}
            </td>
          </tr>
        `;
      })
      .join("");

    // ---------------- Advances table rows ----------------
    const advancesRows = advances
      .map(
        (a) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${formatDate(
            a.advance_date
          )}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${safeText(a.payment_method) || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${safeText(a.signed_by) || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">
            GH₵ ${toNumber(a.amount).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join("");

    // ---------------- Expenses table rows ----------------
    const expensesRows = expenses
      .map(
        (e) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${formatDate(
            e.expense_date
          )}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${safeText(e.expense_type)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">
            GH₵ ${toNumber(e.amount).toFixed(2)}
          </td>
        </tr>
      `
      )
      .join("");

    const howItsCalculated = `
      <div style="margin-top:14px; padding:14px; border:1px dashed #94a3b8; border-radius:14px; background:#f8fafc;">
        <div style="font-size:12px; color:#475569;"><b>How this account balance is calculated</b></div>

        <div style="margin-top:8px; font-size:14px; line-height:1.7;">
          <div><b>Total Advances:</b> GH₵ ${totalAdv.toFixed(2)}</div>
          <div><b>Less Expenses:</b> - GH₵ ${totalExp.toFixed(2)}</div>
          <div><b>Less Amount Spent On Fruit:</b> - GH₵ ${totalSpend.toFixed(2)}</div>

          <div style="margin-top:10px; padding-top:10px; border-top:1px solid #e2e8f0;">
            <b>Balance</b> = GH₵ ${totalAdv.toFixed(2)} − (GH₵ ${totalExp.toFixed(2)} + GH₵ ${totalSpend.toFixed(2)})
          </div>

          <div style="margin-top:10px; font-size:16px; font-weight:900; color:${balanceColor};">
            ${balanceLabel}: GH₵ ${Math.abs(balance).toFixed(2)}
          </div>
        </div>
      </div>
    `;

    const html = `
      <html>
      <head>
        <title>General Account Report - ${agentName}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
          body { font-family: Arial, sans-serif; color:#0f172a; }
          header { position: fixed; top: -6mm; left: 0; right: 0; }
          footer { position: fixed; bottom: -8mm; left: 0; right: 0; font-size: 11px; color: #64748b; }
          .page-number:after { content: counter(page); }
          .muted { color:#64748b; }
          h1,h2 { margin:0; }
          .topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding-bottom:10px; border-bottom:1px solid #e2e8f0; }
          .brand { display:flex; align-items:flex-start; gap:12px; }
          .logo { width:52px; height:52px; object-fit:contain; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
          .card { border:1px solid #e2e8f0; border-radius:16px; padding:12px 14px; background:#ffffff; }
          .kpis { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
          .kpi { min-width:210px; border:1px solid #e2e8f0; border-radius:16px; padding:12px 14px; background:#ffffff; }
          .kpi .label { font-size:12px; color:#64748b; }
          .kpi .value { font-size:18px; font-weight:900; margin-top:4px; }
          .table-wrap { margin-top:14px; }
          table { width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
          thead { background:#f1f5f9; }
          th { text-align:left; font-size:12px; padding:10px; color:#334155; border-bottom:1px solid #e2e8f0; }
          td { font-size:13px; padding:10px; vertical-align:top; }
          .right { text-align:right; }
          .section-title { margin: 14px 0 8px 0; font-size: 15px; font-weight: 900; color:#0f172a; }
          .signature-grid { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-top:16px; }
          .sig-box { border:1px solid #e2e8f0; border-radius:14px; padding:12px; background:#fff; height:88px; display:flex; flex-direction:column; justify-content:space-between; }
          .sig-label { font-size:12px; color:#64748b; }
          .sig-line { border-top:1px solid #94a3b8; padding-top:8px; font-size:12px; color:#334155; }
          .content { margin-top: 12mm; margin-bottom: 14mm; }
        </style>
      </head>

      <body>
        <header></header>

        <footer>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>${companyName} • ${today}</div>
            <div>Page <span class="page-number"></span></div>
          </div>
        </footer>

        <div class="content">
          <div class="topbar">
            <div class="brand">
              ${
                logoUrl
                  ? `<img class="logo" src="${logoUrl}" alt="Logo" />`
                  : `<div class="logo" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">LOGO</div>`
              }
              <div>
                <div style="font-size:16px;font-weight:900;">${companyName}</div>
                <div class="muted" style="margin-top:2px;">${companyTagline}</div>
                <div class="muted" style="margin-top:8px;">
                  Agent: <b style="color:#0f172a;">${agentName}</b> • Generated: ${today}
                </div>
              </div>
            </div>

            <div class="card" style="min-width:260px; text-align:right;">
              <div class="muted" style="font-size:12px;">Account Status</div>
              <div style="font-weight:900; margin-top:6px; color:${balanceColor};">${balanceLabel}</div>
              <div style="font-size:22px; font-weight:900; margin-top:6px; color:${balanceColor};">
                GH₵ ${Math.abs(balance).toFixed(2)}
              </div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi">
              <div class="label">Total Advances</div>
              <div class="value">GH₵ ${totalAdv.toFixed(2)}</div>
            </div>
            <div class="kpi">
              <div class="label">Total Expenses</div>
              <div class="value">GH₵ ${totalExp.toFixed(2)}</div>
            </div>
            <div class="kpi">
              <div class="label">Total Amount Spent On Fruit</div>
              <div class="value">GH₵ ${totalSpend.toFixed(2)}</div>
            </div>
            <div class="kpi">
              <div class="label">Total Weight (All Collections)</div>
              <div class="value">${totals.totalWeight.toFixed(2)} kg</div>
            </div>
          </div>

          ${howItsCalculated}

          <div class="table-wrap">
            <div class="section-title">Fruit Collections (with price breakdown)</div>
            <table>
              <thead>
                <tr>
                  <th style="width:120px;">Date</th>
                  <th>Breakdown (Weight @ Price)</th>
                  <th class="right" style="width:160px;">Amount Spent</th>
                  <th style="width:150px;">Driver</th>
                </tr>
              </thead>
              <tbody>
                ${collectionsRows || `<tr><td colspan="4" style="padding:14px;color:#64748b;">No collections</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="table-wrap">
            <div class="section-title">Cash Advances</div>
            <table>
              <thead>
                <tr>
                  <th style="width:120px;">Date</th>
                  <th style="width:140px;">Method</th>
                  <th>Signed By</th>
                  <th class="right" style="width:160px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${advancesRows || `<tr><td colspan="4" style="padding:14px;color:#64748b;">No advances</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="table-wrap">
            <div class="section-title">Expenses</div>
            <table>
              <thead>
                <tr>
                  <th style="width:120px;">Date</th>
                  <th>Expense Type</th>
                  <th class="right" style="width:160px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expensesRows || `<tr><td colspan="3" style="padding:14px;color:#64748b;">No expenses</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="signature-grid">
            <div class="sig-box">
              <div class="sig-label">Prepared By</div>
              <div class="sig-line">${preparedBy}</div>
            </div>

            <div class="sig-box">
              <div class="sig-label">Approved By</div>
              <div class="sig-line">${approvedBy}</div>
            </div>

            <div class="sig-box">
              <div class="sig-label">Date</div>
              <div class="sig-line">${today}</div>
            </div>
          </div>

          <div style="margin-top:14px; font-size:12px; color:#64748b;">
            Interpretation: <b>Deficit</b> means (Expenses + Amount Spent on Fruit) exceeded the Advances. <b>Cash Balance</b> means there is remaining cash after accounting for expenses and amount spending on fruit.
          </div>

          <script>
            window.onload = () => window.print();
          </script>
        </div>
      </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) {
      showToast("Popup blocked. Allow popups to print the report.", "error");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate("/agents")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="mt-6 text-gray-600">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate("/agents")}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border hover:bg-gray-50"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{agent.full_name}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(agent.status || "")}`}>
                {agent.status || "UNKNOWN"}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Agent Report</p>
          </div>
        </div>

        <button
          onClick={openGeneralAccountReport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
        >
          <FileText className="w-4 h-4" />
          Report / PDF
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={<Wallet className="w-4 h-4" />} label="Total Advances" value={`GH₵ ${totals.totalAdvances.toFixed(2)}`} />
        <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Total Expenses" value={`GH₵ ${totals.totalExpenses.toFixed(2)}`} />
        <SummaryCard icon={<Apple className="w-4 h-4" />} label="Total Amount Spent on Fruit" value={`GH₵ ${totals.totalSpend.toFixed(2)}`} />
        <SummaryCard icon={<Apple className="w-4 h-4" />} label="Total Weight" value={`${totals.totalWeight.toFixed(2)} kg`} />
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden mb-6">
        <div className="flex flex-wrap gap-2 p-3 border-b bg-gray-50">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")} label="Overview" />
          <TabButton active={tab === "advances"} onClick={() => setTab("advances")} label="Advances" />
          <TabButton active={tab === "collections"} onClick={() => setTab("collections")} label="Collections" />
          <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")} label="Expenses" />
        </div>

        <div className="p-4">
          {tab === "overview" && (
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-2">Account Summary</p>
              <div className="bg-gray-50 border rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span>Total Advances</span>
                  <b>GH₵ {totals.totalAdvances.toFixed(2)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Expenses</span>
                  <b>- GH₵ {totals.totalExpenses.toFixed(2)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount Spent On Fruit</span>
                  <b>- GH₵ {totals.totalSpend.toFixed(2)}</b>
                </div>
                <div className="pt-2 mt-2 border-t flex justify-between">
                  <span className="font-semibold">Balance</span>
                  <b className={totals.netCash >= 0 ? "text-green-700" : "text-red-600"}>
                    {totals.netCash >= 0 ? "GH₵ " : "GH₵ -"}
                    {Math.abs(totals.netCash).toFixed(2)}{" "}
                    <span className="text-xs font-normal text-gray-500">
                      ({totals.netCash >= 0 ? "Cash Balance" : "Deficit"})
                    </span>
                  </b>
                </div>
                <div className="text-xs text-gray-600 pt-2">
                  Formula: <b>Advances − (Expenses + Amount Spent on Fruit)</b>
                </div>
              </div>
            </div>
          )}

          {tab === "advances" && (
            <DataTable
              title="Cash Advances"
              emptyText="No cash advances recorded."
              columns={
                <>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Signed By</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </>
              }
              rows={advances.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">
                    <div className="inline-flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      {formatDate(a.advance_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">GH₵ {toNumber(a.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{a.payment_method || "-"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{a.signed_by || "-"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/cash-advances/${a.id}/edit`)}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm inline-flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button
                        disabled={busyId === a.id}
                        onClick={() => void deleteAdvance(a.id)}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            />
          )}

          {tab === "collections" && (
            <DataTable
              title="Collections"
              emptyText="No collections recorded."
              columns={
                <>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Breakdown (Weight @ Price)</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount Spent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Driver</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </>
              }
              rows={collections.map((c) => {
                const items = itemsByCollectionId[String(c.id)] ?? [];
                const totalWeight = items.reduce((s, it) => s + toNumber(it.weight_kg), 0);

                // ✅ CORRECTION: Amount Spent computed properly
                const spend = computeCollectionSpend(c, items);

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800">
                      <div className="inline-flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        {formatDate(c.collection_date)}
                      </div>
                    </td>

                    <td className="px-6 py-4 align-top">
                      {items.length === 0 ? (
                        <span className="text-sm text-gray-500">No breakdown found</span>
                      ) : (
                        <div className="space-y-1">
                          {items.map((it) => {
                            const w = toNumber(it.weight_kg);
                            const p = toNumber(it.price_per_kg);
                            return (
                              <div key={it.id} className="text-sm">
                                <span className="font-semibold text-gray-900">{w.toFixed(2)}kg</span>{" "}
                                <span className="text-gray-600">@</span>{" "}
                                <span className="text-green-700 font-medium">GH₵{p.toFixed(2)}/kg</span>
                              </div>
                            );
                          })}
                          <div className="pt-2 mt-2 border-t text-xs text-gray-700">
                            <span className="font-semibold">Total Weight:</span> {totalWeight.toFixed(2)}kg
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-green-700">GH₵ {spend.toFixed(2)}</td>

                    <td className="px-6 py-4 text-sm text-gray-700">{c.driver_name || "-"}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/fruit-collections/${c.id}/edit`)}
                          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm inline-flex items-center gap-2"
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                        <button
                          disabled={busyId === c.id}
                          onClick={() => void deleteCollection(c.id)}
                          className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm inline-flex items-center gap-2 disabled:opacity-60"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            />
          )}

          {tab === "expenses" && (
            <DataTable
              title="Expenses"
              emptyText="No expenses recorded."
              columns={
                <>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </>
              }
              rows={expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">
                    <div className="inline-flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      {formatDate(e.expense_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">{e.expense_type}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">GH₵ {toNumber(e.amount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/agent-expenses/${e.id}/edit`)}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm inline-flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button
                        disabled={busyId === e.id}
                        onClick={() => void deleteExpense(e.id)}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
        active ? "bg-gray-900 text-white" : "bg-white border hover:bg-gray-50 text-gray-800"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border shadow-sm p-4 bg-white">
      <div className="flex items-center gap-2 text-gray-600 text-sm">
        {icon} {label}
      </div>
      <div className="text-xl font-bold mt-1 text-gray-900">{value}</div>
    </div>
  );
}

function DataTable({
  title,
  emptyText,
  columns,
  rows,
}: {
  title: string;
  emptyText: string;
  columns: React.ReactNode;
  rows: React.ReactNode[];
}) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 border-b">
            <tr>{columns}</tr>
          </thead>
          <tbody className="divide-y">{rows}</tbody>
        </table>
      </div>

      {rows.length === 0 && <div className="p-8 text-center text-gray-600">{emptyText}</div>}
    </div>
  );
}
