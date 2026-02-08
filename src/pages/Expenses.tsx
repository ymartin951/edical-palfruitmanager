import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase, supabaseUntyped } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Database } from "../lib/database.types";
import { Calendar, DollarSign, Filter, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { PageContext } from "../App";

type Expense = Database["public"]["Tables"]["agent_expenses"]["Row"] & {
  agents?: { full_name: string } | null;
};

type Agent = Database["public"]["Tables"]["agents"]["Row"];

export function Expenses() {
  const { userRole } = useAuth();
  const { setCurrentPage } = useContext(PageContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);

  // ✅ Action Sheet row
  const [actionExpense, setActionExpense] = useState<Expense | null>(null);

  const isAdmin = userRole?.role === "ADMIN";

  useEffect(() => {
    setCurrentPage("expenses");
  }, [setCurrentPage]);

  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (from) setDateFrom(from);
    if (to) setDateTo(to);
  }, [searchParams]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expensesRes, agentsRes] = await Promise.all([
        supabase.from("agent_expenses").select("*, agents(full_name)").order("expense_date", { ascending: false }),
        supabase.from("agents").select("*").order("full_name"),
      ]);

      if (expensesRes.error) throw expensesRes.error;
      if (agentsRes.error) throw agentsRes.error;

      setExpenses((expensesRes.data as any) || []);
      setAgents(agentsRes.data || []);
    } catch (error: any) {
      showToast(error.message || "Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (selectedAgent && expense.agent_id !== selectedAgent) return false;

      // expense_date might be ISO; compare as Date safely
      if (dateFrom) {
        const expDate = new Date(expense.expense_date).toISOString().slice(0, 10);
        if (expDate < dateFrom) return false;
      }
      if (dateTo) {
        const expDate = new Date(expense.expense_date).toISOString().slice(0, 10);
        if (expDate > dateTo) return false;
      }

      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        const type = (expense.expense_type || "").toLowerCase();
        if (!type.includes(t)) return false;
      }

      return true;
    });
  }, [expenses, selectedAgent, dateFrom, dateTo, searchTerm]);

  const subtotal = useMemo(
    () => filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [filteredExpenses]
  );

  const clearFilters = () => {
    setSelectedAgent("");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const onEdit = (expense: Expense) => {
    // Your App.tsx route uses: /agent-expenses/:id/edit
    navigate(`/agent-expenses/${expense.id}/edit`);
  };

  const onDelete = async (expense: Expense) => {
    const ok = window.confirm("Delete this expense? This action cannot be undone.");
    if (!ok) return;

    setBusyId(expense.id);
    try {
      // ✅ use untyped for delete to avoid any type mismatch / never issues
      const res = await supabaseUntyped.from("agent_expenses").delete().eq("id", expense.id).select("id");
      if (res.error) throw res.error;

      showToast("Expense deleted", "success");
      await loadData();
    } catch (error: any) {
      showToast(error.message || "Failed to delete expense", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Access denied</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Expenses</h1>
          <p className="text-gray-600 mt-2">Track agent expenses</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-800">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Agent</label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="">All Agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expense Type</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search expense type..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
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

          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {(dateFrom || dateTo || selectedAgent || searchTerm) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {dateFrom && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <span>From: {dateFrom}</span>
                <button onClick={() => setDateFrom("")} className="hover:bg-green-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {dateTo && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <span>To: {dateTo}</span>
                <button onClick={() => setDateTo("")} className="hover:bg-green-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedAgent && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <span>Agent: {agents.find((a) => a.id === selectedAgent)?.full_name}</span>
                <button onClick={() => setSelectedAgent("")} className="hover:bg-green-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {searchTerm && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <span>Type: {searchTerm}</span>
                <button onClick={() => setSearchTerm("")} className="hover:bg-green-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Expense Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-green-700 font-semibold text-sm">
                          {expense.agents?.full_name?.charAt(0) || "?"}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">{expense.agents?.full_name || "Unknown"}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{formatDate(expense.expense_date)}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-800">{expense.expense_type}</span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-600" />
                      <span className="font-semibold text-gray-800">GH₵ {Number(expense.amount).toFixed(2)}</span>
                    </div>
                  </td>

                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => setActionExpense(expense)}
                      disabled={busyId === expense.id}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 disabled:opacity-60"
                      title="Actions"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-700" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

            {filteredExpenses.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-semibold text-gray-800">
                    Total:
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-900 text-lg">GH₵ {subtotal.toFixed(2)}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No expenses recorded</p>
          </div>
        )}
      </div>

      {/* ✅ Action Sheet (Edit/Delete) */}
      {actionExpense && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Actions for</p>
                <p className="text-base font-bold text-gray-900">{actionExpense.expense_type}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {actionExpense.agents?.full_name || "Unknown"} • GH₵ {Number(actionExpense.amount).toFixed(2)}
                </p>
              </div>

              <button onClick={() => setActionExpense(null)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={() => {
                  const e = actionExpense;
                  setActionExpense(null);
                  onEdit(e);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl hover:bg-gray-50 font-semibold text-gray-900"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={() => {
                  const e = actionExpense;
                  setActionExpense(null);
                  void onDelete(e);
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
    </div>
  );
}
