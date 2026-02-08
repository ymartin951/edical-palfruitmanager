import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import type { Database } from "../lib/database.types";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Weight,
  Users,
} from "lucide-react";
import { downloadCSV } from "../utils/csvExport";
import {
  generateAdvancesPDF,
  generateCollectionsPDF,
  generateReconciliationPDF,
} from "../utils/pdfExport";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

type CashAdvanceRow = Database["public"]["Tables"]["cash_advances"]["Row"];
type FruitCollectionRow = Database["public"]["Tables"]["fruit_collections"]["Row"];
type MonthlyReconciliationRow =
  Database["public"]["Tables"]["monthly_reconciliations"]["Row"];

type CashAdvance = CashAdvanceRow & { agents?: { full_name: string } | null };
type FruitCollection = FruitCollectionRow & { agents?: { full_name: string } | null };
type MonthlyReconciliation =
  MonthlyReconciliationRow & { agents?: { full_name: string } | null };

type TabType = "advances" | "collections" | "reconciliation";

export function Reports() {
  const { userRole } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isAdmin = userRole?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<TabType>("advances");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const [advancesData, setAdvancesData] = useState<CashAdvance[]>([]);
  const [collectionsData, setCollectionsData] = useState<FruitCollection[]>([]);
  const [reconciliationData, setReconciliationData] = useState<MonthlyReconciliation[]>([]);

  useEffect(() => {
    void loadAgents();
    setQuickPreset("thisMonth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setAgents((data ?? []) as Agent[]);
    } catch (error: any) {
      showToast(error?.message || "Error loading agents", "error");
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

  const loadAdvancesReport = async () => {
    if (!dateFrom || !dateTo) {
      showToast("Please select date range", "error");
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("cash_advances")
        .select("id, advance_date, agent_id, amount, payment_method, signed_by, agents(full_name)")
        .gte("advance_date", dateFrom)
        .lte("advance_date", dateTo)
        .order("advance_date", { ascending: false });

      if (selectedAgent) query = query.eq("agent_id", selectedAgent);

      const { data, error } = await query;
      if (error) throw error;

      setAdvancesData((data ?? []) as CashAdvance[]);
    } catch (error: any) {
      showToast(error?.message || "Error loading advances report", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionsReport = async () => {
    if (!dateFrom || !dateTo) {
      showToast("Please select date range", "error");
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("fruit_collections")
        .select("id, collection_date, agent_id, weight_kg, driver_name, agents(full_name)")
        .gte("collection_date", dateFrom)
        .lte("collection_date", dateTo)
        .order("collection_date", { ascending: false });

      if (selectedAgent) query = query.eq("agent_id", selectedAgent);

      const { data, error } = await query;
      if (error) throw error;

      setCollectionsData((data ?? []) as FruitCollection[]);
    } catch (error: any) {
      showToast(error?.message || "Error loading collections report", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadReconciliationReport = async () => {
    if (!selectedMonth) {
      showToast("Please select a month", "error");
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("monthly_reconciliations")
        .select("id, month, agent_id, total_advance, total_weight_kg, status, agents(full_name)")
        .eq("month", selectedMonth)
        .order("month", { ascending: false });

      if (selectedAgent) query = query.eq("agent_id", selectedAgent);

      const { data, error } = await query;
      if (error) throw error;

      setReconciliationData((data ?? []) as MonthlyReconciliation[]);
    } catch (error: any) {
      showToast(error?.message || "Error loading reconciliation report", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    if (activeTab === "advances") void loadAdvancesReport();
    else if (activeTab === "collections") void loadCollectionsReport();
    else void loadReconciliationReport();
  };

  const agentNameSelected = useMemo(() => {
    if (!selectedAgent) return undefined;
    return agents.find((a) => a.id === selectedAgent)?.full_name;
  }, [agents, selectedAgent]);

  const handleExportCSV = () => {
    if (activeTab === "advances") {
      if (advancesData.length === 0) return showToast("No data to export", "error");

      const csvData = advancesData.map((item) => ({
        date: new Date(item.advance_date).toLocaleDateString(),
        agent_name: item.agents?.full_name || "Unknown",
        amount: Number(item.amount),
        payment_method: item.payment_method,
        signed_by: item.signed_by || "-",
      }));

      downloadCSV(
        csvData,
        ["Date", "Agent Name", "Amount", "Payment Method", "Signed By"],
        `edical-advances-${dateFrom}-${dateTo}.csv`
      );
      showToast("CSV exported successfully", "success");
      return;
    }

    if (activeTab === "collections") {
      if (collectionsData.length === 0) return showToast("No data to export", "error");

      const csvData = collectionsData.map((item) => ({
        date: new Date(item.collection_date).toLocaleDateString(),
        agent_name: item.agents?.full_name || "Unknown",
        weight_kg: Number(item.weight_kg),
        driver: item.driver_name || "-",
      }));

      downloadCSV(
        csvData,
        ["Date", "Agent Name", "Weight (kg)", "Driver"],
        `edical-collections-${dateFrom}-${dateTo}.csv`
      );
      showToast("CSV exported successfully", "success");
      return;
    }

    if (reconciliationData.length === 0) return showToast("No data to export", "error");

    const csvData = reconciliationData.map((item) => ({
      month: new Date(item.month).toLocaleDateString("en-US", { year: "numeric", month: "long" }),
      agent_name: item.agents?.full_name || "Unknown",
      total_advance: Number(item.total_advance),
      total_weight_kg: Number(item.total_weight_kg),
      status: item.status,
    }));

    downloadCSV(
      csvData,
      ["Month", "Agent Name", "Total Advance", "Total Weight (kg)", "Status"],
      `edical-reconciliation-${selectedMonth}.csv`
    );
    showToast("CSV exported successfully", "success");
  };

  const handleExportPDF = async () => {
    try {
      if (activeTab === "advances") {
        if (advancesData.length === 0) return showToast("No data to export", "error");

        const pdfData = advancesData.map((item) => ({
          date: item.advance_date,
          agent_name: item.agents?.full_name || "Unknown",
          amount: Number(item.amount),
          payment_method: item.payment_method,
          signed_by: item.signed_by || "-",
        }));

        await generateAdvancesPDF(pdfData, dateFrom, dateTo, agentNameSelected);
        showToast("PDF generated successfully", "success");
        return;
      }

      if (activeTab === "collections") {
        if (collectionsData.length === 0) return showToast("No data to export", "error");

        const pdfData = collectionsData.map((item) => ({
          date: item.collection_date,
          agent_name: item.agents?.full_name || "Unknown",
          weight_kg: Number(item.weight_kg),
          driver: item.driver_name || "-",
        }));

        await generateCollectionsPDF(pdfData, dateFrom, dateTo, agentNameSelected);
        showToast("PDF generated successfully", "success");
        return;
      }

      if (reconciliationData.length === 0) return showToast("No data to export", "error");

      const pdfData = reconciliationData.map((item) => ({
        month: item.month,
        agent_name: item.agents?.full_name || "Unknown",
        total_advance: Number(item.total_advance),
        total_weight_kg: Number(item.total_weight_kg),
        status: item.status,
      }));

      await generateReconciliationPDF(pdfData, selectedMonth, agentNameSelected);
      showToast("PDF generated successfully", "success");
    } catch (error: any) {
      showToast(error?.message || "Error generating PDF", "error");
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const totals = useMemo(() => {
    const totalAdvances = advancesData.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalWeight = collectionsData.reduce((sum, item) => sum + Number(item.weight_kg), 0);
    const totalReconAdvances = reconciliationData.reduce((sum, item) => sum + Number(item.total_advance), 0);
    const totalReconWeight = reconciliationData.reduce((sum, item) => sum + Number(item.total_weight_kg), 0);

    return { totalAdvances, totalWeight, totalReconAdvances, totalReconWeight };
  }, [advancesData, collectionsData, reconciliationData]);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
        <p className="text-gray-600 mt-2">Generate and export financial reports</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("advances")}
          className={`px-4 py-3 font-medium transition ${
            activeTab === "advances"
              ? "text-green-600 border-b-2 border-green-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Advances Report
        </button>
        <button
          onClick={() => setActiveTab("collections")}
          className={`px-4 py-3 font-medium transition ${
            activeTab === "collections"
              ? "text-green-600 border-b-2 border-green-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Collections Report
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`px-4 py-3 font-medium transition ${
            activeTab === "reconciliation"
              ? "text-green-600 border-b-2 border-green-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Reconciliation Report
        </button>
         <button
  onClick={() => navigate("/reports/consolidated")}
  className="px-4 py-3 font-medium transition text-gray-600 hover:text-gray-800"
>
  Consolidated Report
</button>
      </div>

     


      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md mb-6">
        <button
          onClick={() => setShowFilters((v) => !v)}
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
            {activeTab !== "reconciliation" ? (
              <>
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
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month *</label>
                <input
                  type="month"
                  value={selectedMonth ? selectedMonth.slice(0, 7) : ""}
                  onChange={(e) => {
                    const v = e.target.value; // "YYYY-MM"
                    setSelectedMonth(v ? `${v}-01` : "");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent (Optional)</label>
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
          </div>

          {activeTab !== "reconciliation" && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setQuickPreset("thisMonth")}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                This Month
              </button>
              <button
                onClick={() => setQuickPreset("lastMonth")}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Last Month
              </button>
              <button
                onClick={() => setQuickPreset("last7Days")}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Last 7 Days
              </button>
            </div>
          )}

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
          >
            {loading ? "Loading..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Results */}
      {activeTab === "advances" && advancesData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-800">GH₵ {totals.totalAdvances.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold text-gray-800">{advancesData.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                  {advancesData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(item.advance_date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        {item.agents?.full_name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        GH₵ {Number(item.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.payment_method}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.signed_by || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {advancesData.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{item.agents?.full_name || "Unknown"}</p>
                      <p className="text-sm text-gray-600">{formatDate(item.advance_date)}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-800">GH₵ {Number(item.amount).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Method:</span>
                    <span className="font-medium">{item.payment_method}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Signed By:</span>
                    <span className="font-medium">{item.signed_by || "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "collections" && collectionsData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Weight className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Weight</p>
                  <p className="text-2xl font-bold text-gray-800">{totals.totalWeight.toFixed(2)} kg</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Records</p>
                  <p className="text-2xl font-bold text-gray-800">{collectionsData.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Weight (kg)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {collectionsData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(item.collection_date)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        {item.agents?.full_name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {Number(item.weight_kg).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.driver_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {collectionsData.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{item.agents?.full_name || "Unknown"}</p>
                      <p className="text-sm text-gray-600">{formatDate(item.collection_date)}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-800">{Number(item.weight_kg).toFixed(2)} kg</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Driver:</span>
                    <span className="font-medium">{item.driver_name || "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "reconciliation" && reconciliationData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Advances</p>
                  <p className="text-2xl font-bold text-gray-800">GH₵ {totals.totalReconAdvances.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-lg">
                  <Weight className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Weight</p>
                  <p className="text-2xl font-bold text-gray-800">{totals.totalReconWeight.toFixed(2)} kg</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Agents</p>
                  <p className="text-2xl font-bold text-gray-800">{reconciliationData.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Advance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Total Weight (kg)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reconciliationData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        {item.agents?.full_name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        GH₵ {Number(item.total_advance).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {Number(item.total_weight_kg).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === "CLOSED"
                              ? "bg-gray-100 text-gray-700"
                              : item.status === "RENDERED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {reconciliationData.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-medium text-gray-800">{item.agents?.full_name || "Unknown"}</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.status === "CLOSED"
                          ? "bg-gray-100 text-gray-700"
                          : item.status === "RENDERED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Advance:</span>
                      <span className="font-semibold">GH₵ {Number(item.total_advance).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Weight:</span>
                      <span className="font-semibold">{Number(item.total_weight_kg).toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading &&
        ((activeTab === "advances" && advancesData.length === 0) ||
          (activeTab === "collections" && collectionsData.length === 0) ||
          (activeTab === "reconciliation" && reconciliationData.length === 0)) && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No data available. Generate a report to view results.</p>
          </div>
        )}
    </div>
  );
}
