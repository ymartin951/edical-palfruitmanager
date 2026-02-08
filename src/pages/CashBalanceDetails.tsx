import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { Database } from "../lib/database.types";
import { Download, FileText, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { exportToCsv } from "../utils/csvExport";
import { generateCashBalancePDF } from "../utils/pdfExport";

type CashAdvance = Database["public"]["Tables"]["cash_advances"]["Row"] & {
  agents?: { full_name: string };
};

type AgentExpense = Database["public"]["Tables"]["agent_expenses"]["Row"] & {
  agents?: { full_name: string };
};

// NOTE: Your generated DB type for fruit_collections may not include total_weight_kg / total_amount_spent.
// We still fetch rows from fruit_collections, but compute “weight” and “spend” safely.
type FruitCollection = Database["public"]["Tables"]["fruit_collections"]["Row"] & {
  agents?: { full_name: string };

  // optional fields (some schemas have them, some don't)
  total_weight_kg?: number | string | null;
  total_amount_spent?: number | string | null;

  // common alternative columns that may exist
  weight_kg?: number | string | null;
  amount_spent?: number | string | null;
  total_amount?: number | string | null;
};

interface Summary {
  totalAdvances: number;
  totalExpenses: number;
  totalFruitSpend: number;
  cashBalance: number;
}

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString();
}

export function CashBalanceDetails() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [expenses, setExpenses] = useState<AgentExpense[]>([]);
  const [collections, setCollections] = useState<FruitCollection[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    advances: true,
    expenses: true,
    collections: true,
  });

  const { showToast } = useToast();

  const preset = searchParams.get("preset");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Compute date range once per param change
  const { dateFrom, dateTo, displayDateRange } = useMemo(() => {
    let df = "";
    let dt = "";
    let display = "";

    if (preset === "this_month") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      df = firstDay.toISOString().split("T")[0];
      dt = lastDay.toISOString().split("T")[0];
      display = `${firstDay.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} - ${lastDay.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } else {
      df = fromParam || "";
      dt = toParam || "";
      const fromDate = df ? new Date(df) : null;
      const toDate = dt ? new Date(dt) : null;

      display =
        fromDate && toDate
          ? `${fromDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })} - ${toDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`
          : "Custom Range";
    }

    return { dateFrom: df, dateTo: dt, displayDateRange: display };
  }, [preset, fromParam, toParam]);

  // ✅ Safely read “collection weight” from whatever your schema has
  const getCollectionWeightKg = (c: FruitCollection) => {
    // prefer total_weight_kg if it exists, otherwise fall back
    return toNumber((c as any).total_weight_kg ?? (c as any).weight_kg ?? 0);
  };

  // ✅ Safely read “fruit spend” from whatever your schema has
  const getCollectionAmountSpent = (c: FruitCollection) => {
    // prefer total_amount_spent if it exists, otherwise fall back to other common names
    return toNumber(
      (c as any).total_amount_spent ??
        (c as any).amount_spent ??
        (c as any).total_amount ??
        0
    );
  };

  const [summary, setSummary] = useState<Summary>({
    totalAdvances: 0,
    totalExpenses: 0,
    totalFruitSpend: 0,
    cashBalance: 0,
  });

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [advancesRes, expensesRes, collectionsRes] = await Promise.all([
        supabase
          .from("cash_advances")
          .select("*, agents(full_name)")
          .gte("advance_date", dateFrom)
          .lte("advance_date", dateTo)
          .order("advance_date", { ascending: false }),

        supabase
          .from("agent_expenses")
          .select("*, agents(full_name)")
          .gte("expense_date", dateFrom)
          .lte("expense_date", dateTo)
          .order("expense_date", { ascending: false }),

        supabase
          .from("fruit_collections")
          .select("*, agents(full_name)")
          .gte("collection_date", dateFrom)
          .lte("collection_date", dateTo)
          .order("collection_date", { ascending: false }),
      ]);

      if (advancesRes.error) throw advancesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (collectionsRes.error) throw collectionsRes.error;

      const advancesData = (advancesRes.data || []) as CashAdvance[];
      const expensesData = (expensesRes.data || []) as AgentExpense[];
      const collectionsData = (collectionsRes.data || []) as FruitCollection[];

      setAdvances(advancesData);
      setExpenses(expensesData);
      setCollections(collectionsData);

      const totalAdvances = advancesData.reduce((sum, a) => sum + toNumber(a.amount), 0);
      const totalExpenses = expensesData.reduce((sum, e) => sum + toNumber(e.amount), 0);
      const totalFruitSpend = collectionsData.reduce((sum, c) => sum + getCollectionAmountSpent(c), 0);

      const cashBalance = totalAdvances - (totalExpenses + totalFruitSpend);

      setSummary({
        totalAdvances,
        totalExpenses,
        totalFruitSpend,
        cashBalance,
      });
    } catch (error: any) {
      showToast(error?.message || "Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: "advances" | "expenses" | "collections") => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleExportCSV = () => {
    const advancesCSV = advances.map((a) => ({
      Date: formatShortDate(a.advance_date),
      Agent: a.agents?.full_name || "N/A",
      Amount: `GH₵ ${toNumber(a.amount).toFixed(2)}`,
      "Payment Method": a.payment_method || "N/A",
      "Signed By": a.signed_by || "N/A",
    }));

    const expensesCSV = expenses.map((e) => ({
      Date: formatShortDate(e.expense_date),
      Agent: e.agents?.full_name || "N/A",
      "Expense Type": (e as any).expense_type || "N/A",
      Amount: `GH₵ ${toNumber(e.amount).toFixed(2)}`,
    }));

    const collectionsCSV = collections.map((c) => ({
      Date: formatShortDate(c.collection_date),
      Agent: c.agents?.full_name || "N/A",
      "Total Weight (kg)": getCollectionWeightKg(c).toFixed(2),
      "Amount Spent": `GH₵ ${getCollectionAmountSpent(c).toFixed(2)}`,
    }));

    exportToCsv(advancesCSV, `advances_${dateFrom}_${dateTo}.csv`);
    exportToCsv(expensesCSV, `expenses_${dateFrom}_${dateTo}.csv`);
    exportToCsv(collectionsCSV, `fruit_spend_${dateFrom}_${dateTo}.csv`);

    showToast("CSV files exported successfully", "success");
  };

  const handleDownloadPDF = async () => {
    try {
      // ✅ Fix: map to EXACT shapes the PDF generator expects (prevents type mismatch errors)
      const advancesForPdf = advances.map((a) => ({
        advance_date: a.advance_date,
        agents: a.agents,
        amount: toNumber(a.amount),
        payment_method: a.payment_method || undefined,
        signed_by: a.signed_by || undefined,
      }));

      const expensesForPdf = expenses.map((e) => ({
        expense_date: e.expense_date,
        agents: e.agents,
        amount: toNumber(e.amount),
        expense_type: (e as any).expense_type || undefined,
      }));

      const collectionsForPdf = collections.map((c) => ({
        collection_date: c.collection_date,
        agents: c.agents,
        total_weight_kg: getCollectionWeightKg(c),
        total_amount_spent: getCollectionAmountSpent(c),
      }));

      await generateCashBalancePDF({
        dateRange: displayDateRange,
        summary,
        advances: advancesForPdf,
        expenses: expensesForPdf,
        collections: collectionsForPdf,
      });

      showToast("PDF downloaded successfully", "success");
    } catch (error: any) {
      showToast(error?.message || "Error generating PDF", "error");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cash Balance Details</h1>
            <p className="text-gray-600 mt-1">{displayDateRange}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Advances</h3>
          <p className="text-2xl font-bold text-gray-900">GH₵ {summary.totalAdvances.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Expenses</h3>
          <p className="text-2xl font-bold text-gray-900">GH₵ {summary.totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-600">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Amount Spent on Fruit</h3>
          <p className="text-2xl font-bold text-gray-900">GH₵ {summary.totalFruitSpend.toFixed(2)}</p>
        </div>
        <div
          className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
            summary.cashBalance >= 0 ? "border-blue-600" : "border-red-700"
          }`}
        >
          <h3 className="text-sm font-medium text-gray-600 mb-2">Cash Balance</h3>
          <p className={`text-2xl font-bold ${summary.cashBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
            GH₵ {summary.cashBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Advances */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <button
            onClick={() => toggleSection("advances")}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">Advances Included</h2>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {advances.length} items
              </span>
            </div>
            {expandedSections.advances ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.advances && (
            <div className="border-t border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment Method</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Signed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {advances.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{formatShortDate(a.advance_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{a.agents?.full_name || "N/A"}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">GH₵ {toNumber(a.amount).toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{a.payment_method || "N/A"}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{a.signed_by || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-6 py-4 text-sm font-bold text-gray-900">
                        Subtotal
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">GH₵ {summary.totalAdvances.toFixed(2)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>

                {advances.length === 0 && <div className="text-center py-8 text-gray-600">No advances in this period</div>}
              </div>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <button
            onClick={() => toggleSection("expenses")}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">Expenses Included</h2>
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                {expenses.length} items
              </span>
            </div>
            {expandedSections.expenses ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.expenses && (
            <div className="border-t border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expense Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{formatShortDate(e.expense_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{e.agents?.full_name || "N/A"}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{(e as any).expense_type || "N/A"}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">GH₵ {toNumber(e.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900">
                        Subtotal
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">GH₵ {summary.totalExpenses.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>

                {expenses.length === 0 && <div className="text-center py-8 text-gray-600">No expenses in this period</div>}
              </div>
            </div>
          )}
        </div>

        {/* Collections */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <button
            onClick={() => toggleSection("collections")}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">Amount Spent On Fruit Included</h2>
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                {collections.length} items
              </span>
            </div>
            {expandedSections.collections ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedSections.collections && (
            <div className="border-t border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Weight</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {collections.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{formatShortDate(c.collection_date)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{c.agents?.full_name || "N/A"}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{getCollectionWeightKg(c).toFixed(2)} kg</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          GH₵ {getCollectionAmountSpent(c).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900">
                        Subtotal
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">GH₵ {summary.totalFruitSpend.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>

                {collections.length === 0 && <div className="text-center py-8 text-gray-600">No collections in this period</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Calculation */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Calculation</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex justify-between items-center">
            <span>Total Advances (This Period):</span>
            <span className="font-semibold">GH₵ {summary.totalAdvances.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Less: Total Expenses:</span>
            <span className="font-semibold text-red-600">- GH₵ {summary.totalExpenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-blue-300">
            <span>Less: Amount Spent on Fruit:</span>
            <span className="font-semibold text-red-600">- GH₵ {summary.totalFruitSpend.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-lg font-bold">Cash Balance:</span>
            <span className={`text-lg font-bold ${summary.cashBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
              GH₵ {summary.cashBalance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
