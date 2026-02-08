import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase, supabaseUntyped } from "../lib/supabase";
import type { Database } from "../lib/database.types";
import { Download, Filter, ChevronDown, ChevronUp, FileText, Users, Printer } from "lucide-react";
import { downloadCSV } from "../utils/csvExport";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

type CashAdvanceRow = Database["public"]["Tables"]["cash_advances"]["Row"] & {
  agents?: { full_name: string } | null;
};

type ExpenseRow = Database["public"]["Tables"]["agent_expenses"]["Row"] & {
  agents?: { full_name: string } | null;
};

type FruitCollectionRow = Database["public"]["Tables"]["fruit_collections"]["Row"] & {
  agents?: { full_name: string } | null;
};

/**
 * database.types.ts DOES NOT include fruit_collection_items.
 * We query it via supabaseUntyped and define a lightweight runtime type.
 */
type FruitCollectionItem = {
  id?: string;

  // FK may be one of these (we support both)
  collection_id?: string;
  fruit_collection_id?: string;

  weight_kg?: number | string | null;
  price_per_kg?: number | string | null;

  created_at?: string;
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

function fmtMoney(n: number) {
  return `GH₵ ${n.toFixed(2)}`;
}

// Plain number string for printable HTML (so you can control prefixes)
function fmtMoneyPlain(n: number) {
  return `${n.toFixed(2)}`;
}

function fmtDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export function ConsolidatedReport() {
  const { userRole } = useAuth();
  const { showToast } = useToast();

  const isAdmin = userRole?.role === "ADMIN";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");

  const [advances, setAdvances] = useState<CashAdvanceRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [collections, setCollections] = useState<FruitCollectionRow[]>([]);

  // Map<collectionId, items[]>
  const [collectionItemsMap, setCollectionItemsMap] = useState<Record<string, FruitCollectionItem[]>>({});

  useEffect(() => {
    if (!isAdmin) return;

    // Default to this month
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    setDateFrom(from);
    setDateTo(to);

    loadAgents().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase.from("agents").select("*").order("full_name");
      if (error) throw error;
      setAgents(data || []);
    } catch (err: any) {
      showToast(err?.message || "Error loading agents", "error");
    }
  };

  const setQuickPreset = (preset: "thisMonth" | "lastMonth" | "last7Days") => {
    const now = new Date();
    let from = "";
    let to = "";

    if (preset === "thisMonth") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    } else if (preset === "lastMonth") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    } else {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      to = now.toISOString().split("T")[0];
    }

    setDateFrom(from);
    setDateTo(to);
  };

  const resolveCollectionId = (it: FruitCollectionItem) => it.collection_id || it.fruit_collection_id || "";

  /**
   * ✅ Reliable spend calculation:
   * - If item breakdown exists => Σ(weight * price)
   * - Else fallback to collection.total_amount_spent (if present)
   */
  const computeCollectionSpend = (c: FruitCollectionRow): number => {
    const its = collectionItemsMap[String(c.id)] || [];
    if (its.length > 0) {
      return its.reduce((sum, it) => sum + toNumber(it.weight_kg) * toNumber(it.price_per_kg), 0);
    }

    // fallback for schema variants
    const fallback =
      toNumber((c as any).total_amount_spent) ||
      toNumber((c as any).total_amount) ||
      toNumber((c as any).amount_spent);

    return fallback;
  };

  const loadConsolidated = async () => {
    if (!dateFrom || !dateTo) {
      showToast("Please select date range", "error");
      return;
    }

    setLoading(true);
    try {
      let advancesQ = supabase
        .from("cash_advances")
        .select("*, agents(full_name)")
        .gte("advance_date", dateFrom)
        .lte("advance_date", dateTo)
        .order("advance_date", { ascending: false });

      let expensesQ = supabase
        .from("agent_expenses")
        .select("*, agents(full_name)")
        .gte("expense_date", dateFrom)
        .lte("expense_date", dateTo)
        .order("expense_date", { ascending: false });

      let collectionsQ = supabase
        .from("fruit_collections")
        .select("*, agents(full_name)")
        .gte("collection_date", dateFrom)
        .lte("collection_date", dateTo)
        .order("collection_date", { ascending: false });

      if (selectedAgent) {
        advancesQ = advancesQ.eq("agent_id", selectedAgent);
        expensesQ = expensesQ.eq("agent_id", selectedAgent);
        collectionsQ = collectionsQ.eq("agent_id", selectedAgent);
      }

      const [advRes, expRes, colRes] = await Promise.all([advancesQ, expensesQ, collectionsQ]);

      if (advRes.error) throw advRes.error;
      if (expRes.error) throw expRes.error;
      if (colRes.error) throw colRes.error;

      const advData = (advRes.data || []) as CashAdvanceRow[];
      const expData = (expRes.data || []) as ExpenseRow[];
      const colData = (colRes.data || []) as FruitCollectionRow[];

      setAdvances(advData);
      setExpenses(expData);
      setCollections(colData);

      const collectionIds = colData.map((c) => String(c.id));

      if (collectionIds.length === 0) {
        setCollectionItemsMap({});
        showToast("Consolidated report loaded", "success");
        return;
      }

      // ✅ IMPORTANT FIX:
      // Some DBs use collection_id, others use fruit_collection_id.
      // We fetch ALL items, then map only those matching our collection ids using either FK.
      const { data: itemsRaw, error: itemsErr } = await supabaseUntyped
        .from("fruit_collection_items")
        .select("*");

      if (itemsErr) throw itemsErr;

      const items = (itemsRaw || []) as FruitCollectionItem[];
      const map: Record<string, FruitCollectionItem[]> = {};

      for (const it of items) {
        const cid = resolveCollectionId(it);
        if (!cid) continue;
        if (!collectionIds.includes(String(cid))) continue;
        (map[String(cid)] ||= []).push(it);
      }

      setCollectionItemsMap(map);
      showToast("Consolidated report loaded", "success");
    } catch (err: any) {
      showToast(err?.message || "Error loading consolidated report", "error");
    } finally {
      setLoading(false);
    }
  };

  const breakdownForCollection = (collectionId: string) => {
    const items = collectionItemsMap[String(collectionId)] || [];
    const groups: Record<string, { price: number; weight: number; amount: number }> = {};

    for (const it of items) {
      const price = toNumber(it.price_per_kg);
      const weight = toNumber(it.weight_kg);
      const key = String(price);

      if (!groups[key]) groups[key] = { price, weight: 0, amount: 0 };
      groups[key].weight += weight;
      groups[key].amount += weight * price;
    }

    const rows = Object.values(groups).sort((a, b) => b.price - a.price);
    const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

    return { rows, totalWeight, totalAmount };
  };

  // ✅ FIXED TOTALS (robust conversions + spend fallback)
  const totals = useMemo(() => {
    const totalAdvances = advances.reduce((s, a) => s + toNumber((a as any).amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + toNumber((e as any).amount), 0);

    const fruitSpendFinal = collections.reduce((sum, c) => sum + computeCollectionSpend(c), 0);

    const totalCollectionWeight = collections.reduce((s, c) => s + toNumber((c as any).weight_kg), 0);

    const totalOutflow = totalAdvances + totalExpenses + fruitSpendFinal;

    return {
      totalAdvances,
      totalExpenses,
      fruitSpendFinal,
      totalCollectionWeight,
      totalOutflow,
    };
  }, [advances, expenses, collections, collectionItemsMap]);

  /**
   * Agent surplus/deficit breakdown:
   * net = advances - (expenses + fruitSpend)
   */
  const agentNetBreakdown = useMemo(() => {
    // agent id => {name, advances, expenses, fruitSpend}
    const map: Record<
      string,
      { agent_id: string; agent_name: string; advances: number; expenses: number; fruitSpend: number; net: number }
    > = {};

    const agentNameFromId = (id: string) => {
      const found = agents.find((a) => String(a.id) === String(id));
      return found?.full_name || "Unknown";
    };

    for (const a of advances) {
      const id = String((a as any).agent_id || "");
      if (!id) continue;
      if (!map[id]) {
        map[id] = { agent_id: id, agent_name: a.agents?.full_name || agentNameFromId(id), advances: 0, expenses: 0, fruitSpend: 0, net: 0 };
      }
      map[id].advances += toNumber((a as any).amount);
    }

    for (const e of expenses) {
      const id = String((e as any).agent_id || "");
      if (!id) continue;
      if (!map[id]) {
        map[id] = { agent_id: id, agent_name: e.agents?.full_name || agentNameFromId(id), advances: 0, expenses: 0, fruitSpend: 0, net: 0 };
      }
      map[id].expenses += toNumber((e as any).amount);
    }

    for (const c of collections) {
      const id = String((c as any).agent_id || "");
      if (!id) continue;
      if (!map[id]) {
        map[id] = { agent_id: id, agent_name: c.agents?.full_name || agentNameFromId(id), advances: 0, expenses: 0, fruitSpend: 0, net: 0 };
      }
      map[id].fruitSpend += computeCollectionSpend(c);
    }

    // compute net
    const rows = Object.values(map).map((r) => {
      const outflow = r.expenses + r.fruitSpend;
      return { ...r, net: r.advances - outflow };
    });

    // show biggest absolute issues first
    rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    return rows;
  }, [agents, advances, expenses, collections, collectionItemsMap]);

  const topDeficitAgents = useMemo(() => {
    return [...agentNetBreakdown]
      .filter((r) => r.net < 0)
      .sort((a, b) => a.net - b.net)
      .slice(0, 5);
  }, [agentNetBreakdown]);

  const topSurplusAgents = useMemo(() => {
    return [...agentNetBreakdown]
      .filter((r) => r.net > 0)
      .sort((a, b) => b.net - a.net)
      .slice(0, 5);
  }, [agentNetBreakdown]);

  const actionNotes = useMemo(() => {
    const notes: string[] = [];
    if (agentNetBreakdown.length === 0) return notes;

    if (topDeficitAgents.length > 0) {
      notes.push(
        `Deficit agents: Follow up on receipts/collections and confirm whether expenses were correctly recorded or additional advances are required.`
      );
    }
    if (topSurplusAgents.length > 0) {
      notes.push(
        `Surplus agents: Request cash return or confirm remaining balance is carried forward for approved next operations.`
      );
    }

    notes.push(
      `Formula: Net = Advances − (Expenses + Fruit Spend). Fruit Spend is calculated from items as weight_kg × price_per_kg (fallbacks apply if items are missing).`
    );

    return notes;
  }, [agentNetBreakdown, topDeficitAgents, topSurplusAgents]);

  const exportCSV = () => {
    if (collections.length === 0 && advances.length === 0 && expenses.length === 0) {
      showToast("No data to export", "error");
      return;
    }

    const agentName = selectedAgent ? agents.find((a) => String(a.id) === String(selectedAgent))?.full_name : "All Agents";

    const csvRows: Array<Record<string, string>> = [
      { Section: "SUMMARY", Field: "Agent", Value: String(agentName || "All Agents") },
      { Section: "SUMMARY", Field: "From", Value: dateFrom },
      { Section: "SUMMARY", Field: "To", Value: dateTo },
      { Section: "SUMMARY", Field: "Total Advances", Value: totals.totalAdvances.toFixed(2) },
      { Section: "SUMMARY", Field: "Total Expenses", Value: totals.totalExpenses.toFixed(2) },
      { Section: "SUMMARY", Field: "Total Amount Spent on Fruit", Value: totals.fruitSpendFinal.toFixed(2) },
      { Section: "SUMMARY", Field: "Total Outflow", Value: totals.totalOutflow.toFixed(2) },
      { Section: "SUMMARY", Field: "Total Collection Weight (kg)", Value: totals.totalCollectionWeight.toFixed(2) },
    ];

    downloadCSV(csvRows, ["Section", "Field", "Value"], `edical-consolidated-${dateFrom}-${dateTo}.csv`);
    showToast("CSV exported successfully", "success");
  };

  const buildPrintableHtml = () => {
    const agentName = selectedAgent
      ? agents.find((a) => String(a.id) === String(selectedAgent))?.full_name || "Unknown"
      : "All Agents";

    const today = new Date().toLocaleDateString();
    const now = new Date().toLocaleString();

    const companyName = "Edical Palm Fruit Company LTD";
    const companyTagline = "Multi-Agent Consolidated Report";

    const logoUrl = "/edical-logo.png";

    const preparedBy = "________________________";
    const approvedBy = "________________________";

    // overall status:
    const netOverall = totals.totalAdvances - (totals.totalExpenses + totals.fruitSpendFinal);
    const balanceLabel = netOverall >= 0 ? "CASH BALANCE (SURPLUS)" : "DEFICIT (OVERDRAWN)";
    const balanceColor = netOverall >= 0 ? "#0f7a3a" : "#b42318";

    const breakdownRows = agentNetBreakdown
      .map((r) => {
        const label = r.net >= 0 ? "Surplus" : "Deficit";
        const color = r.net >= 0 ? "#0f7a3a" : "#b42318";
        const netAbs = Math.abs(r.net);

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(r.agent_name)}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">GH₵ ${escapeHtml(fmtMoneyPlain(r.advances))}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">GH₵ ${escapeHtml(fmtMoneyPlain(r.expenses))}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">GH₵ ${escapeHtml(fmtMoneyPlain(r.fruitSpend))}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;color:${color};">
              ${label} GH₵ ${escapeHtml(fmtMoneyPlain(netAbs))}
            </td>
          </tr>
        `;
      })
      .join("");

    const topDeficitHtml = topDeficitAgents
      .map(
        (r) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(r.agent_name)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#b42318;font-weight:900;">
            Deficit GH₵ ${escapeHtml(fmtMoneyPlain(Math.abs(r.net)))}
          </td>
        </tr>
      `
      )
      .join("");

    const topSurplusHtml = topSurplusAgents
      .map(
        (r) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(r.agent_name)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#0f7a3a;font-weight:900;">
            Surplus GH₵ ${escapeHtml(fmtMoneyPlain(Math.abs(r.net)))}
          </td>
        </tr>
      `
      )
      .join("");

    const actionNotesHtml = actionNotes
      .map((n) => `<div style="margin:6px 0; font-size:12px; color:#334155;">• ${escapeHtml(n)}</div>`)
      .join("");

    // Tables
    const advancesRows = advances
      .map(
        (a) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(fmtDate((a as any).advance_date))}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(a.agents?.full_name || "Unknown")}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">GH₵ ${escapeHtml(
            fmtMoneyPlain(toNumber((a as any).amount))
          )}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(String((a as any).payment_method || "-"))}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(String((a as any).signed_by || "-"))}</td>
        </tr>
      `
      )
      .join("");

    const expensesRows = expenses
      .map((e) => {
        const type = (e as any).expense_type ? String((e as any).expense_type) : "-";
        const desc = (e as any).description
          ? String((e as any).description)
          : (e as any).notes
          ? String((e as any).notes)
          : "-";

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(fmtDate((e as any).expense_date))}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(e.agents?.full_name || "Unknown")}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(type)}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">GH₵ ${escapeHtml(
              fmtMoneyPlain(toNumber((e as any).amount))
            )}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(desc)}</td>
          </tr>
        `;
      })
      .join("");

    const collectionsRows = collections
      .map((c) => {
        const breakdown = breakdownForCollection(String(c.id));

        const breakdownHtml =
          breakdown.rows.length === 0
            ? `<div style="color:#64748b;">No breakdown found (using fallback spend if available)</div>`
            : `
              <div style="min-width:260px;">
                ${breakdown.rows
                  .map(
                    (r) => `
                    <div style="display:flex;justify-content:space-between;gap:10px;margin:2px 0;">
                      <span>GH₵ ${escapeHtml(fmtMoneyPlain(r.price))} /kg</span>
                      <span>${escapeHtml(r.weight.toFixed(2))} kg</span>
                      <span style="font-weight:800;">GH₵ ${escapeHtml(fmtMoneyPlain(r.amount))}</span>
                    </div>
                  `
                  )
                  .join("")}
                <div style="border-top:1px solid #eee; padding-top:6px; margin-top:6px; display:flex; justify-content:space-between; gap:10px;">
                  <span style="font-weight:900;">Total</span>
                  <span style="font-weight:900;">${escapeHtml(breakdown.totalWeight.toFixed(2))} kg</span>
                  <span style="font-weight:900;">GH₵ ${escapeHtml(fmtMoneyPlain(breakdown.totalAmount))}</span>
                </div>
              </div>
            `;

        const spend = computeCollectionSpend(c);

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(fmtDate((c as any).collection_date))}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(c.agents?.full_name || "Unknown")}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(toNumber((c as any).weight_kg).toFixed(2))} kg</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(String((c as any).driver_name || "-"))}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${breakdownHtml}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;">GH₵ ${escapeHtml(fmtMoneyPlain(spend))}</td>
          </tr>
        `;
      })
      .join("");

    const howItsCalculated = `
      <div style="margin-top:14px; padding:14px; border:1px dashed #94a3b8; border-radius:14px; background:#f8fafc;">
        <div style="font-size:12px; color:#475569;"><b>How Surplus / Deficit is calculated</b></div>
        <div style="margin-top:8px; font-size:14px; line-height:1.7;">
          <div><b>Total Advances:</b> GH₵ ${escapeHtml(fmtMoneyPlain(totals.totalAdvances))}</div>
          <div><b>Less Expenses:</b> - GH₵ ${escapeHtml(fmtMoneyPlain(totals.totalExpenses))}</div>
          <div><b>Less Amount Spent On Fruit:</b> - GH₵ ${escapeHtml(fmtMoneyPlain(totals.fruitSpendFinal))}</div>
          <div style="margin-top:10px; padding-top:10px; border-top:1px solid #e2e8f0;">
            <b>Net</b> = GH₵ ${escapeHtml(fmtMoneyPlain(totals.totalAdvances))} − (GH₵ ${escapeHtml(
      fmtMoneyPlain(totals.totalExpenses)
    )} + GH₵ ${escapeHtml(fmtMoneyPlain(totals.fruitSpendFinal))})
          </div>
          <div style="margin-top:10px; font-size:16px; font-weight:900; color:${balanceColor};">
            ${escapeHtml(balanceLabel)}: GH₵ ${escapeHtml(fmtMoneyPlain(Math.abs(netOverall)))}
          </div>
        </div>
      </div>
    `;

    return `
      <html>
      <head>
        <title>Consolidated Report</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
          body { font-family: Arial, sans-serif; color:#0f172a; }
          footer { position: fixed; bottom: -8mm; left: 0; right: 0; font-size: 11px; color: #64748b; }
          .page-number:after { content: counter(page); }
          .muted { color:#64748b; }
          .topbar { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding-bottom:10px; border-bottom:1px solid #e2e8f0; }
          .brand { display:flex; align-items:flex-start; gap:12px; }
          .logo { width:52px; height:52px; object-fit:contain; border:1px solid #e2e8f0; border-radius:12px; background:#fff; }
          .card { border:1px solid #e2e8f0; border-radius:16px; padding:12px 14px; background:#ffffff; }
          .kpis { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
          .kpi { min-width:210px; border:1px solid #e2e8f0; border-radius:16px; padding:12px 14px; background:#ffffff; }
          .kpi .label { font-size:12px; color:#64748b; }
          .kpi .value { font-size:18px; font-weight:900; margin-top:4px; }
          .section-title { margin: 14px 0 8px 0; font-size: 15px; font-weight: 900; color:#0f172a; }
          table { width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; }
          thead { background:#f1f5f9; }
          th { text-align:left; font-size:12px; padding:10px; color:#334155; border-bottom:1px solid #e2e8f0; }
          td { font-size:12px; padding:10px; vertical-align:top; }
          .right { text-align:right; }
          .content { margin-bottom: 14mm; }
        </style>
      </head>

      <body>
        <footer>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>${escapeHtml(companyName)} • ${escapeHtml(today)}</div>
            <div>Page <span class="page-number"></span></div>
          </div>
        </footer>

        <div class="content">
          <div class="topbar">
            <div class="brand">
              <img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo" />
              <div>
                <div style="font-size:16px;font-weight:900;">${escapeHtml(companyName)}</div>
                <div class="muted" style="margin-top:2px;">${escapeHtml(companyTagline)}</div>
                <div class="muted" style="margin-top:8px;">
                  Agent: <b style="color:#0f172a;">${escapeHtml(agentName)}</b> • ${escapeHtml(dateFrom)} → ${escapeHtml(dateTo)}
                  <div style="margin-top:2px;">Generated: ${escapeHtml(now)}</div>
                </div>
              </div>
            </div>

            <div class="card" style="min-width:260px; text-align:right;">
              <div class="muted" style="font-size:12px;">Overall Status</div>
              <div style="font-weight:900; margin-top:6px; color:${balanceColor};">${escapeHtml(balanceLabel)}</div>
              <div style="font-size:22px; font-weight:900; margin-top:6px; color:${balanceColor};">
                GH₵ ${escapeHtml(fmtMoneyPlain(Math.abs(netOverall)))}
              </div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi">
              <div class="label">Total Advances</div>
              <div class="value">GH₵ ${escapeHtml(fmtMoneyPlain(totals.totalAdvances))}</div>
            </div>
            <div class="kpi">
              <div class="label">Total Expenses</div>
              <div class="value">GH₵ ${escapeHtml(fmtMoneyPlain(totals.totalExpenses))}</div>
            </div>
            <div class="kpi">
              <div class="label">Total Amount Spent On Fruit</div>
              <div class="value">GH₵ ${escapeHtml(fmtMoneyPlain(totals.fruitSpendFinal))}</div>
            </div>
            <div class="kpi">
              <div class="label">Total Collection Weight</div>
              <div class="value">${escapeHtml(totals.totalCollectionWeight.toFixed(2))} kg</div>
            </div>
          </div>

          ${howItsCalculated}

          <div class="section-title">Surplus / Deficit Breakdown by Agent</div>
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th class="right">Advances</th>
                <th class="right">Expenses</th>
                <th class="right">Fruit Spend</th>
                <th class="right">Net</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRows || `<tr><td colspan="5" style="padding:14px;color:#64748b;">No agent breakdown</td></tr>`}
            </tbody>
          </table>

          <div class="section-title">Highlights</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div style="border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
              <div style="padding:10px; background:#fef2f2; font-weight:900; color:#991b1b;">Top 5 Deficit Agents</div>
              <table><tbody>
                ${topDeficitHtml || `<tr><td style="padding:12px;color:#64748b;">No deficits found</td></tr>`}
              </tbody></table>
            </div>

            <div style="border:1px solid #e2e8f0; border-radius:14px; overflow:hidden;">
              <div style="padding:10px; background:#ecfdf5; font-weight:900; color:#065f46;">Top 5 Surplus Agents</div>
              <table><tbody>
                ${topSurplusHtml || `<tr><td style="padding:12px;color:#64748b;">No surplus found</td></tr>`}
              </tbody></table>
            </div>
          </div>

          <div style="margin-top:12px; padding:12px; border:1px solid #e2e8f0; border-radius:14px; background:#ffffff;">
            <div style="font-weight:900; margin-bottom:6px;">Action Notes</div>
            ${actionNotesHtml}
          </div>

          <div class="section-title">Cash Advances</div>
          <table>
            <thead>
              <tr>
                <th style="width:120px;">Date</th>
                <th>Agent</th>
                <th class="right" style="width:140px;">Amount</th>
                <th style="width:120px;">Method</th>
                <th>Signed By</th>
              </tr>
            </thead>
            <tbody>
              ${advancesRows || `<tr><td colspan="5" style="padding:14px;color:#64748b;">No advances found</td></tr>`}
            </tbody>
          </table>

          <div class="section-title">Expenses</div>
          <table>
            <thead>
              <tr>
                <th style="width:120px;">Date</th>
                <th>Agent</th>
                <th style="width:140px;">Type</th>
                <th class="right" style="width:140px;">Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${expensesRows || `<tr><td colspan="5" style="padding:14px;color:#64748b;">No expenses found</td></tr>`}
            </tbody>
          </table>

          <div class="section-title">Fruit Collections (with Price Breakdown)</div>
          <table>
            <thead>
              <tr>
                <th style="width:120px;">Date</th>
                <th>Agent</th>
                <th class="right" style="width:130px;">Total Weight</th>
                <th style="width:140px;">Driver</th>
                <th>Breakdown</th>
                <th class="right" style="width:140px;">Amount Spent</th>
              </tr>
            </thead>
            <tbody>
              ${collectionsRows || `<tr><td colspan="6" style="padding:14px;color:#64748b;">No collections found</td></tr>`}
            </tbody>
          </table>

          <div style="margin-top:16px;">
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px;">
              <div class="card" style="height:80px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="muted" style="font-size:12px;">Prepared By</div>
                <div style="border-top:1px solid #94a3b8; padding-top:8px; font-size:12px;">${escapeHtml(preparedBy)}</div>
              </div>
              <div class="card" style="height:80px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="muted" style="font-size:12px;">Approved By</div>
                <div style="border-top:1px solid #94a3b8; padding-top:8px; font-size:12px;">${escapeHtml(approvedBy)}</div>
              </div>
              <div class="card" style="height:80px; display:flex; flex-direction:column; justify-content:space-between;">
                <div class="muted" style="font-size:12px;">Date</div>
                <div style="border-top:1px solid #94a3b8; padding-top:8px; font-size:12px;">${escapeHtml(today)}</div>
              </div>
            </div>
          </div>

          <script>
            window.onload = () => window.print();
          </script>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintOrPDF = () => {
    if (collections.length === 0 && advances.length === 0 && expenses.length === 0) {
      showToast("Generate the report first, then print/download PDF.", "error");
      return;
    }

    const html = buildPrintableHtml();
    const w = window.open("about:blank", "_blank");
    if (!w) {
      showToast("Popup blocked. Allow popups to print/download PDF.", "error");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Access denied. Admin only.</p>
      </div>
    );
  }

  const selectedAgentName = selectedAgent ? agents.find((a) => String(a.id) === String(selectedAgent))?.full_name : undefined;

  const netOverall = totals.totalAdvances - (totals.totalExpenses + totals.fruitSpendFinal);
  const overallLabel = netOverall >= 0 ? "CASH BALANCE (SURPLUS)" : "DEFICIT (OVERDRAWN)";
  const overallColor = netOverall >= 0 ? "text-green-700" : "text-red-600";

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Consolidated Report</h1>
            <p className="text-gray-600 mt-2">
              One view combining advances, expenses, collections, and fruit price breakdowns.
            </p>
            {selectedAgentName && (
              <p className="mt-1 text-sm text-gray-500">
                Agent Filter: <span className="font-medium text-gray-700">{selectedAgentName}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePrintOrPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition"
            >
              <Printer className="w-5 h-5" />
              Print / Download PDF
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-6 py-4 flex items-center justify-between font-medium text-gray-800 hover:bg-gray-50 transition lg:hidden"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        <div className={`${showFilters ? "block" : "hidden lg:block"} p-6`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent (Optional)</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">All Agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => setQuickPreset("thisMonth")}
                className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                This Month
              </button>
              <button
                onClick={() => setQuickPreset("last7Days")}
                className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Last 7 Days
              </button>
            </div>
          </div>

          <button
            onClick={loadConsolidated}
            disabled={loading}
            className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
          >
            {loading ? "Loading..." : "Generate Consolidated Report"}
          </button>
        </div>
      </div>

      {/* Overall status card */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-gray-600">Overall Status</div>
          <div className={`text-xl font-bold ${overallColor}`}>
            {overallLabel}: {fmtMoney(Math.abs(netOverall))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Net = Advances − (Expenses + Amount Spent on Fruit)
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Advances</p>
              <p className="text-xl font-bold text-gray-800">{fmtMoney(totals.totalAdvances)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-xl font-bold text-gray-800">{fmtMoney(totals.totalExpenses)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount Spent on Fruit</p>
              <p className="text-xl font-bold text-gray-800">{fmtMoney(totals.fruitSpendFinal)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Collection Weight</p>
              <p className="text-xl font-bold text-gray-800">{totals.totalCollectionWeight.toFixed(2)} kg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Breakdown Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Surplus / Deficit Breakdown by Agent</h2>
          <p className="text-sm text-gray-600 mt-1">Net = Advances − (Expenses + Fruit Spend)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Advances</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Expenses</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Fruit Spend</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agentNetBreakdown.map((r) => {
                const label = r.net >= 0 ? "Surplus" : "Deficit";
                const color = r.net >= 0 ? "text-green-700" : "text-red-600";
                return (
                  <tr key={r.agent_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.agent_name}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{fmtMoney(r.advances)}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{fmtMoney(r.expenses)}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{fmtMoney(r.fruitSpend)}</td>
                    <td className={`px-6 py-4 text-sm text-right font-bold ${color}`}>
                      {label} {fmtMoney(Math.abs(r.net))}
                    </td>
                  </tr>
                );
              })}

              {agentNetBreakdown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                    No agent breakdown available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 + Action Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-bold text-gray-800">Top 5 Deficit Agents</h3>
            <p className="text-sm text-gray-600 mt-1">Most overdrawn (needs follow-up)</p>
          </div>
          <div className="p-4 space-y-3">
            {topDeficitAgents.length === 0 ? (
              <p className="text-sm text-gray-600">No deficits found.</p>
            ) : (
              topDeficitAgents.map((r) => (
                <div key={r.agent_id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{r.agent_name}</div>
                    <div className="text-xs text-gray-600">
                      Advances {fmtMoney(r.advances)} • Outflow {fmtMoney(r.expenses + r.fruitSpend)}
                    </div>
                  </div>
                  <div className="font-bold text-red-700 whitespace-nowrap">Deficit {fmtMoney(Math.abs(r.net))}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-bold text-gray-800">Top 5 Surplus Agents</h3>
            <p className="text-sm text-gray-600 mt-1">Highest remaining cash</p>
          </div>
          <div className="p-4 space-y-3">
            {topSurplusAgents.length === 0 ? (
              <p className="text-sm text-gray-600">No surplus found.</p>
            ) : (
              topSurplusAgents.map((r) => (
                <div key={r.agent_id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{r.agent_name}</div>
                    <div className="text-xs text-gray-600">
                      Advances {fmtMoney(r.advances)} • Outflow {fmtMoney(r.expenses + r.fruitSpend)}
                    </div>
                  </div>
                  <div className="font-bold text-green-700 whitespace-nowrap">Surplus {fmtMoney(Math.abs(r.net))}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-bold text-gray-800">Action Notes</h3>
            <p className="text-sm text-gray-600 mt-1">Quick management guidance</p>
          </div>
          <div className="p-4 space-y-2">
            {actionNotes.length === 0 ? (
              <p className="text-sm text-gray-600">Generate a report to see notes.</p>
            ) : (
              actionNotes.map((n, idx) => (
                <div key={idx} className="text-sm text-gray-700 leading-relaxed">
                  • {n}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="space-y-6">
        {/* Advances */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Cash Advances</h2>
            <p className="text-sm text-gray-600 mt-1">All advances within selected range</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Signed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {advances.map((a) => (
                  <tr key={(a as any).id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-600">{fmtDate((a as any).advance_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{a.agents?.full_name || "Unknown"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{fmtMoney(toNumber((a as any).amount))}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{String((a as any).payment_method || "-")}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{String((a as any).signed_by || "-")}</td>
                  </tr>
                ))}
                {advances.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                      No advances found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Expenses</h2>
            <p className="text-sm text-gray-600 mt-1">All expenses within selected range</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.map((e) => (
                  <tr key={(e as any).id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-600">{fmtDate((e as any).expense_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{e.agents?.full_name || "Unknown"}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{(e as any).expense_type || "-"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">{fmtMoney(toNumber((e as any).amount))}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{(e as any).description || (e as any).notes || "-"}</td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                      No expenses found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Collections */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Fruit Collections (with Price Breakdown)</h2>
            <p className="text-sm text-gray-600 mt-1">Breakdown is grouped by price_per_kg</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Weight</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Driver</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {collections.map((c) => {
                  const breakdown = breakdownForCollection(String(c.id));

                  return (
                    <tr key={String(c.id)} className="align-top hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-600">{fmtDate((c as any).collection_date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{c.agents?.full_name || "Unknown"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {toNumber((c as any).weight_kg).toFixed(2)} kg
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{String((c as any).driver_name || "-")}</td>
                      <td className="px-6 py-4">
                        {breakdown.rows.length === 0 ? (
                          <div>
                            <span className="text-sm text-gray-500">No item breakdown found</span>
                            <div className="text-xs text-gray-500 mt-1">
                              Fallback spend: <b>{fmtMoney(computeCollectionSpend(c))}</b>
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-[280px]">
                            <div className="text-xs font-semibold text-gray-600 uppercase mb-2">
                              Price per kg breakdown
                            </div>
                            <div className="space-y-1">
                              {breakdown.rows.map((r) => (
                                <div key={String(r.price)} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-700">{fmtMoney(r.price)} /kg</span>
                                  <span className="text-gray-700">{r.weight.toFixed(2)} kg</span>
                                  <span className="font-semibold text-gray-900">{fmtMoney(r.amount)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-sm">
                              <span className="text-gray-700 font-medium">Total</span>
                              <span className="text-gray-700 font-medium">{breakdown.totalWeight.toFixed(2)} kg</span>
                              <span className="text-gray-900 font-bold">{fmtMoney(breakdown.totalAmount)}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {collections.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                      No collections found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-700">
            <span className="font-semibold">Note:</span> Amount Spent on Fruit is calculated from collection items as{" "}
            <span className="font-mono">weight_kg × price_per_kg</span> (fallback applied if items are missing).
          </div>
        </div>
      </div>
    </div>
  );
}
