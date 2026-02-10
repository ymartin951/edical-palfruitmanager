import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabaseUntyped } from "../lib/supabase";
import {
  Users,
  DollarSign,
  Apple,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Package,
  Wallet,
} from "lucide-react";
import { PageContext } from "../App";
import { KPICard } from "../components/KPICard";

type Stats = {
  totalAdvancesAllTime: number;
  totalExpensesAllTime: number;
  totalFruitSpendAllTime: number;
  cashBalanceAllTime: number;
  totalWeightAllTime: number;
  activeAgents: number;
  agentsWithOutstanding: number;
  outstandingDeliveries: number;
  deliveredAllTime: number;
  totalReceivedAllTime: number;
};

type AgentRow = {
  id: string;
  full_name: string;
  status: string;
};

type CashAdvanceRow = {
  agent_id: string;
  amount: number | string;
  advance_date: string;
};

type ExpenseRow = {
  amount: number | string;
  expense_date: string;
};

type CollectionRow = {
  agent_id: string;
  weight_kg: number | string;
  total_amount_spent: number | string | null;
  collection_date: string;
};

type PaymentRow = {
  amount: number | string;
  payment_date: string;
};

type OrderRow = {
  id: string;
  order_date: string;
  order_category: string;
  delivery_status: string;
  total_amount: number | string;
  amount_paid: number | string;
  balance_due: number | string;
  customers?: { full_name: string; delivery_address: string | null } | null;
};

type OutstandingAgent = {
  id: string;
  full_name: string;
  total_advances: number;
  total_weight: number;
  status: string;
  last_activity: string | null;
};

type Alert = {
  agent_id: string;
  agent_name: string;
  reason: string;
  severity: "warning" | "error";
};

type PendingOrder = {
  id: string;
  order_date: string;
  order_category: string;
  delivery_status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  customer_name: string;
  delivery_address: string | null;
};

type CardDef = {
  title: string;
  value: string | number;
  subtext?: string;
  icon: any;
  bgColor: string;
  to: string;
};

type DashboardSummaryRPC = {
  totalAdvances?: number | string | null;
  totalExpenses?: number | string | null;
  totalFruitSpend?: number | string | null;
  totalWeight?: number | string | null;
  cashBalance?: number | string | null;
  activeAgents?: number | string | null;
  outstandingDeliveries?: number | string | null;
  deliveredAllTime?: number | string | null;
  totalReceivedAllTime?: number | string | null;
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

function DashboardSection({
  title,
  description,
  cards,
}: {
  title: string;
  description: string;
  cards: CardDef[];
}) {
  return (
    <section className="mb-6 sm:mb-8">
      <div className="mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-brand-text">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {cards.map((card) => (
          <KPICard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            bgColor={card.bgColor}
            to={card.to}
            subtext={card.subtext}
          />
        ))}
      </div>
    </section>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function tryLoadSummaryFromRPC(): Promise<DashboardSummaryRPC | null> {
  // If you created the SQL function earlier (dashboard_admin_summary), this will be FAST.
  // If not created, it will error; we safely fall back to normal queries.
  const res = await supabaseUntyped.rpc("dashboard_admin_summary");
  if (res?.error) return null;
  return (res?.data ?? null) as DashboardSummaryRPC | null;
}

export function Dashboard() {
  const { userRole } = useAuth();
  const { setCurrentPage } = useContext(PageContext);
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats>({
    totalAdvancesAllTime: 0,
    totalExpensesAllTime: 0,
    totalFruitSpendAllTime: 0,
    cashBalanceAllTime: 0,
    totalWeightAllTime: 0,
    activeAgents: 0,
    agentsWithOutstanding: 0,
    outstandingDeliveries: 0,
    deliveredAllTime: 0,
    totalReceivedAllTime: 0,
  });

  const [outstandingAgents, setOutstandingAgents] = useState<OutstandingAgent[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => setCurrentPage("dashboard"), [setCurrentPage]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (userRole?.role === "ADMIN") {
        await loadAdminDashboard(alive);
      } else {
        if (alive) setLoading(false);
      }
    }

    void run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  const loadAdminDashboard = async (aliveFlag: boolean) => {
    if (!aliveFlag) return;
    setLoading(true);

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoMs = sevenDaysAgo.getTime();

      // 1) Try FAST path: RPC (if you created it in Supabase SQL editor)
      //    This prevents totals showing wrong/zero due to large datasets/timeouts
      const summary = await tryLoadSummaryFromRPC();

      // 2) Load operational lists (needed for tables/alerts)
      //    Keep these reasonably sized: orders list can get big, but you already use it.
      const [agentsRes, allAdvancesRes, allCollectionsRes, ordersRes] = await Promise.all([
        supabaseUntyped.from("agents").select("id, full_name, status"),
        supabaseUntyped.from("cash_advances").select("agent_id, amount, advance_date"),
        supabaseUntyped.from("fruit_collections").select("agent_id, weight_kg, collection_date"),
        supabaseUntyped
          .from("orders")
          .select(
            "id, order_date, order_category, delivery_status, total_amount, amount_paid, balance_due, customers(full_name, delivery_address)"
          )
          .order("order_date", { ascending: false }),
      ]);

      if (agentsRes.error) throw agentsRes.error;
      if (allAdvancesRes.error) throw allAdvancesRes.error;
      if (allCollectionsRes.error) throw allCollectionsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const agents = (agentsRes.data ?? []) as AgentRow[];
      const activeAgents = agents.filter((a) => a.status === "ACTIVE").length;

      const allAdvances = (allAdvancesRes.data ?? []) as CashAdvanceRow[];
      const allCollections = (allCollectionsRes.data ?? []) as {
        agent_id: string;
        weight_kg: number | string;
        collection_date: string;
      }[];

      // 3) If RPC not available, compute totals using DB aggregations safely
      //    (Still ok, but can be heavier than RPC. This avoids returning 0 due to partial/failed loads.)
      let totalAdvancesAllTime = 0;
      let totalExpensesAllTime = 0;
      let totalFruitSpendAllTime = 0;
      let totalWeightAllTime = 0;
      let cashBalanceAllTime = 0;
      let outstandingDeliveries = 0;
      let deliveredAllTime = 0;
      let totalReceivedAllTime = 0;

      if (summary) {
        totalAdvancesAllTime = toNumber(summary.totalAdvances);
        totalExpensesAllTime = toNumber(summary.totalExpenses);
        totalFruitSpendAllTime = toNumber(summary.totalFruitSpend);
        totalWeightAllTime = toNumber(summary.totalWeight);
        cashBalanceAllTime =
          summary.cashBalance !== undefined && summary.cashBalance !== null
            ? toNumber(summary.cashBalance)
            : totalAdvancesAllTime - (totalExpensesAllTime + totalFruitSpendAllTime);

        outstandingDeliveries = toNumber(summary.outstandingDeliveries);
        deliveredAllTime = toNumber(summary.deliveredAllTime);
        totalReceivedAllTime = toNumber(summary.totalReceivedAllTime);
      } else {
        // Fallback totals (ALL TIME)
        // Use sum via Postgres when possible; here we keep your original approach but add guards.
        const [advRes, expRes, colRes, payRes] = await Promise.all([
          supabaseUntyped.from("cash_advances").select("amount"),
          supabaseUntyped.from("agent_expenses").select("amount"),
          supabaseUntyped.from("fruit_collections").select("weight_kg, total_amount_spent"),
          supabaseUntyped.from("payments").select("amount"),
        ]);

        if (advRes.error) throw advRes.error;
        if (expRes.error) throw expRes.error;
        if (colRes.error) throw colRes.error;
        if (payRes.error) throw payRes.error;

        totalAdvancesAllTime = ((advRes.data ?? []) as { amount: number | string }[]).reduce(
          (sum, a) => sum + toNumber(a.amount),
          0
        );

        totalExpensesAllTime = ((expRes.data ?? []) as { amount: number | string }[]).reduce(
          (sum, e) => sum + toNumber(e.amount),
          0
        );

        const cols = (colRes.data ?? []) as { weight_kg: number | string; total_amount_spent: number | string | null }[];
        totalFruitSpendAllTime = cols.reduce((sum, c) => sum + toNumber(c.total_amount_spent ?? 0), 0);
        totalWeightAllTime = cols.reduce((sum, c) => sum + toNumber(c.weight_kg), 0);

        cashBalanceAllTime = totalAdvancesAllTime - (totalExpensesAllTime + totalFruitSpendAllTime);

        totalReceivedAllTime = ((payRes.data ?? []) as { amount: number | string }[]).reduce(
          (sum, p) => sum + toNumber(p.amount),
          0
        );
      }

      // 4) Outstanding + last activity (same logic, but make date checks robust)
      const agentAdvances = allAdvances.reduce((acc, adv) => {
        if (!acc[adv.agent_id]) acc[adv.agent_id] = { total: 0, lastDate: null as string | null };
        acc[adv.agent_id].total += toNumber(adv.amount);

        const advDate = new Date(adv.advance_date);
        const accDate = acc[adv.agent_id].lastDate ? new Date(acc[adv.agent_id].lastDate!) : null;
        if (!accDate || (Number.isFinite(advDate.getTime()) && advDate > accDate)) {
          acc[adv.agent_id].lastDate = adv.advance_date;
        }
        return acc;
      }, {} as Record<string, { total: number; lastDate: string | null }>);

      const agentCollections = allCollections.reduce((acc, col) => {
        if (!acc[col.agent_id]) acc[col.agent_id] = { total: 0, lastDate: null as string | null };
        acc[col.agent_id].total += toNumber(col.weight_kg);

        const colDate = new Date(col.collection_date);
        const accDate = acc[col.agent_id].lastDate ? new Date(acc[col.agent_id].lastDate!) : null;
        if (!accDate || (Number.isFinite(colDate.getTime()) && colDate > accDate)) {
          acc[col.agent_id].lastDate = col.collection_date;
        }
        return acc;
      }, {} as Record<string, { total: number; lastDate: string | null }>);

      const outstandingData: OutstandingAgent[] = agents
        .map((agent) => {
          const advances = agentAdvances[agent.id] || { total: 0, lastDate: null };
          const collections = agentCollections[agent.id] || { total: 0, lastDate: null };

          const lastAdvanceDate = advances.lastDate ? new Date(advances.lastDate) : null;
          const lastCollectionDate = collections.lastDate ? new Date(collections.lastDate) : null;

          let lastActivity: Date | null = null;
          if (lastAdvanceDate && lastCollectionDate) lastActivity = lastAdvanceDate > lastCollectionDate ? lastAdvanceDate : lastCollectionDate;
          else lastActivity = lastAdvanceDate || lastCollectionDate;

          return {
            id: agent.id,
            full_name: agent.full_name,
            total_advances: advances.total,
            total_weight: collections.total,
            status: agent.status,
            last_activity: lastActivity && Number.isFinite(lastActivity.getTime()) ? lastActivity.toISOString() : null,
          };
        })
        .sort((a, b) => b.total_advances - a.total_advances);

      const agentsWithOutstanding = outstandingData.filter((a) => a.total_advances > 0).length;

      const orders = (ordersRes.data ?? []) as unknown as OrderRow[];

      // If RPC provided these, keep them; otherwise compute from orders list
      if (!summary) {
        outstandingDeliveries = orders.filter(
          (o) => o.delivery_status === "PENDING" || o.delivery_status === "PARTIALLY_DELIVERED"
        ).length;

        deliveredAllTime = orders.filter((o) => o.delivery_status === "DELIVERED").length;
      }

      const pendingOrdersData: PendingOrder[] = orders
        .filter((o) => o.delivery_status === "PENDING" || o.delivery_status === "PARTIALLY_DELIVERED")
        .slice(0, 10)
        .map((o) => ({
          id: o.id,
          order_date: o.order_date,
          order_category: o.order_category,
          delivery_status: o.delivery_status,
          total_amount: toNumber(o.total_amount),
          amount_paid: toNumber(o.amount_paid),
          balance_due: toNumber(o.balance_due),
          customer_name: o.customers?.full_name || "Unknown",
          delivery_address: o.customers?.delivery_address || null,
        }));

      // 5) Alerts (last 7 days)
      const alertsData: Alert[] = [];

      for (const agent of agents) {
        const recentAdvances = allAdvances.filter((a) => {
          if (a.agent_id !== agent.id) return false;
          const t = new Date(a.advance_date).getTime();
          return Number.isFinite(t) && t >= sevenDaysAgoMs;
        });

        const recentCollections = allCollections.filter((c) => {
          if (c.agent_id !== agent.id) return false;
          const t = new Date(c.collection_date).getTime();
          return Number.isFinite(t) && t >= sevenDaysAgoMs;
        });

        if (recentAdvances.length > 0 && recentCollections.length === 0) {
          alertsData.push({
            agent_id: agent.id,
            agent_name: agent.full_name,
            reason: "Received advance in last 7 days but no collections recorded",
            severity: "warning",
          });
        }

        const agentData = outstandingData.find((a) => a.id === agent.id);
        if (agentData && agentData.total_advances > 0 && agentData.last_activity) {
          const lastMs = new Date(agentData.last_activity).getTime();
          if (Number.isFinite(lastMs)) {
            const daysSinceActivity = (now.getTime() - lastMs) / (1000 * 60 * 60 * 24);
            if (daysSinceActivity >= 14) {
              alertsData.push({
                agent_id: agent.id,
                agent_name: agent.full_name,
                reason: `No activity for ${Math.floor(daysSinceActivity)} days with outstanding advances`,
                severity: "error",
              });
            }
          }
        }
      }

      if (!aliveFlag) return;

      setStats({
        totalAdvancesAllTime,
        totalExpensesAllTime,
        totalFruitSpendAllTime,
        cashBalanceAllTime,
        totalWeightAllTime,
        activeAgents,
        agentsWithOutstanding,
        outstandingDeliveries,
        deliveredAllTime,
        totalReceivedAllTime,
      });

      setPendingOrders(pendingOrdersData);
      setOutstandingAgents(outstandingData.slice(0, 5));
      setAlerts(alertsData);
    } catch {
      // keep UI clean; add toast if you want
    } finally {
      if (aliveFlag) setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (userRole?.role !== "ADMIN") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Dashboard not available for your role</p>
      </div>
    );
  }

  // ✅ Orders & Receipts (All Time)
  const ordersAndReceiptsCards: CardDef[] = [
    {
      title: "Outstanding Deliveries",
      value: stats.outstandingDeliveries,
      subtext: "Pending + Partially Delivered",
      icon: Package,
      bgColor: "bg-orange-600",
      to: "/orders?status=OUTSTANDING",
    },
    {
      title: "Delivered (All Time)",
      value: stats.deliveredAllTime,
      icon: ShoppingCart,
      bgColor: "bg-green-600",
      to: `/orders?status=DELIVERED`,
    },
    {
      title: "Total Received (All Time)",
      value: `GH₵ ${stats.totalReceivedAllTime.toFixed(2)}`,
      subtext: "From all payments",
      icon: Wallet,
      bgColor: "bg-blue-600",
      to: `/orders`,
    },
  ];

  // ✅ Operations Overview (All Time)
  const operationsCards: CardDef[] = [
    {
      title: "Total Advances (All Time)",
      value: `GH₵ ${stats.totalAdvancesAllTime.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-brand-orange",
      to: `/cash-advances`,
    },
    {
      title: "Total Expenses (All Time)",
      value: `GH₵ ${stats.totalExpensesAllTime.toFixed(2)}`,
      icon: DollarSign,
      bgColor: "bg-red-600",
      to: `/expenses`,
    },
    {
      title: "Cash Balance (All Time)",
      value: `GH₵ ${stats.cashBalanceAllTime.toFixed(2)}`,
      subtext: "Advances − (Expenses + Total Amount Spent on fruit)",
      icon: TrendingUp,
      bgColor: stats.cashBalanceAllTime >= 0 ? "bg-brand-primary" : "bg-red-700",
      to: `/cash-balance/details`,
    },
    {
      title: "Amount Spent on Fruit (All Time)",
      value: `GH₵ ${stats.totalFruitSpendAllTime.toFixed(2)}`,
      icon: Apple,
      bgColor: "bg-green-600",
      to: `/fruit-spend/details`,
    },
    {
      title: "Total Weight (All Time)",
      value: `${stats.totalWeightAllTime.toFixed(2)} kg`,
      icon: Apple,
      bgColor: "bg-brand-secondary",
      to: `/fruit-collections`,
    },
    {
      title: "Active Agents",
      value: stats.activeAgents,
      icon: Users,
      bgColor: "bg-brand-primary",
      to: "/agents?status=ACTIVE",
    },
    {
      title: "Agents with Outstanding",
      value: stats.agentsWithOutstanding,
      icon: TrendingUp,
      bgColor: "bg-brand-gold",
      to: "/agents?filter=outstanding",
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-text">Admin Dashboard</h1>
          <span className="px-3 py-1 bg-brand-primary text-white text-xs sm:text-sm font-semibold rounded-full w-fit">
            Main Admin
          </span>
        </div>
        <p className="text-brand-secondary mt-2 text-sm sm:text-base font-medium">
          Overview of palm fruit operations
        </p>
      </div>

      <DashboardSection
        title="Orders & Receipts"
        description="Track customer orders, deliveries, and how much money has been received overall."
        cards={ordersAndReceiptsCards}
      />

      <DashboardSection
        title="Operations Overview"
        description="All-time view: cash movement, expenses, fruit buying, collections, and agent performance."
        cards={operationsCards}
      />

      {/* Existing lower dashboard panels (unchanged UI) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Top Outstanding Agents */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-brand-muted/20">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-brand-muted/20 bg-brand-bg/50">
            <h2 className="text-base sm:text-lg font-bold text-brand-text">Top Outstanding Agents</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Highest outstanding advances and last activity
            </p>
          </div>

          {/* Mobile */}
          <div className="block sm:hidden">
            {outstandingAgents.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {outstandingAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}/report`)}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">{agent.full_name}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          agent.status === "ACTIVE"
                            ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30"
                            : "bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Advances:</span>
                        <span className="ml-1 font-semibold">GH₵ {agent.total_advances.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Weight:</span>
                        <span className="ml-1 font-semibold">{agent.total_weight.toFixed(2)} kg</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Last Activity:</span>
                        <span className="ml-1">{formatDate(agent.last_activity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">No outstanding agents</div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Advances</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Weight</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {outstandingAgents.map((agent) => (
                  <tr
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}/report`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{agent.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">GH₵ {agent.total_advances.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{agent.total_weight.toFixed(2)} kg</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          agent.status === "ACTIVE"
                            ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30"
                            : "bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(agent.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {outstandingAgents.length === 0 && (
              <div className="text-center py-8 text-gray-600">No outstanding agents</div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Alerts</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Risks that need attention (e.g., advances with no collections)
            </p>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  alert.severity === "error" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 flex-shrink-0 ${
                    alert.severity === "error" ? "text-red-600" : "text-yellow-600"
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{alert.agent_name}</p>
                  <p className="text-gray-600 text-sm mt-1">{alert.reason}</p>
                </div>
              </div>
            ))}

            {alerts.length === 0 && <div className="text-center py-8 text-gray-600">No alerts at this time</div>}
          </div>
        </div>
      </div>

      {/* Pending Deliveries */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-brand-muted/20">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-brand-muted/20 bg-brand-bg/50">
          <h2 className="text-base sm:text-lg font-bold text-brand-text">Pending Deliveries</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Orders awaiting delivery</p>
        </div>

        <div className="block md:hidden">
          {pendingOrders.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-800">{order.customer_name}</p>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        order.delivery_status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {order.delivery_status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-500">Date:</span>{" "}
                      <span className="text-gray-800">{new Date(order.order_date).toLocaleDateString()}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Category:</span>{" "}
                      <span className="text-gray-800">{order.order_category.replace("_", " ")}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Total:</span>{" "}
                      <span className="font-semibold text-gray-800">GH₵ {order.total_amount.toFixed(2)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Paid:</span>{" "}
                      <span className="font-semibold text-green-700">GH₵ {order.amount_paid.toFixed(2)}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Balance:</span>{" "}
                      <span className={`font-semibold ${order.balance_due > 0 ? "text-red-600" : "text-gray-600"}`}>
                        GH₵ {order.balance_due.toFixed(2)}
                      </span>
                    </p>
                    {order.delivery_address && (
                      <p className="text-xs text-gray-500 mt-1">📍 {order.delivery_address}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600 text-sm">No pending deliveries</div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Paid</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{order.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(order.order_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        order.delivery_status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {order.delivery_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">GH₵ {order.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-green-700 font-semibold">GH₵ {order.amount_paid.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                    <span className={order.balance_due > 0 ? "text-red-600" : "text-gray-600"}>
                      GH₵ {order.balance_due.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pendingOrders.length === 0 && <div className="text-center py-8 text-gray-600">No pending deliveries</div>}
        </div>
      </div>
    </div>
  );
}
