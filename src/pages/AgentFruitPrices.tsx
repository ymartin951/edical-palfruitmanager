import React, { useEffect, useMemo, useState } from "react";
import { supabase, supabaseUntyped } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Database } from "../lib/database.types";
import { Plus, Save, History } from "lucide-react";
import { formatGHS } from "../utils/currency";

type Agent = Database["public"]["Tables"]["agents"]["Row"];

/**
 * Use untyped for the price-change table to avoid:
 * - "property does not exist"
 * - "overload" / "never"
 * even if database.types.ts isn't updated yet.
 */
type PriceChangeRow = {
  id: string;
  agent_id: string;
  price_per_kg: number;
  effective_at: string; // timestamptz
  carryover_kg: number;
  note?: string | null;
  created_at?: string;
  created_by?: string | null;
};

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PRICE_TABLE = "agent_fruit_price_changes"; // <-- change ONLY if your table name differs

export function AgentFruitPrices() {
  const { userRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = userRole?.role === "ADMIN";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [pricePerKg, setPricePerKg] = useState<string>("");
  const [carryoverKg, setCarryoverKg] = useState<string>("0");
  const [note, setNote] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<PriceChangeRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadAgentsAndDefault().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadAgentsAndDefault = async () => {
    try {
      setLoading(true);

      const { data: agentsData, error: agentsErr } = await supabase
        .from("agents")
        .select("*")
        .order("full_name");

      if (agentsErr) throw agentsErr;
      const list = (agentsData || []) as Agent[];

      setAgents(list);

      // optional: auto-pick first agent
      if (list.length > 0) {
        setSelectedAgentId(list[0].id);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to load agents", "error");
    } finally {
      setLoading(false);
    }
  };

  // Load history whenever agent changes
  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedAgentId) {
      setHistory([]);
      return;
    }
    loadHistory(selectedAgentId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId]);

  const loadHistory = async (agentId: string) => {
    try {
      setHistoryLoading(true);

      const { data, error } = await supabaseUntyped
        .from(PRICE_TABLE)
        .select("*")
        .eq("agent_id", agentId)
        .order("effective_at", { ascending: false });

      if (error) throw error;

      setHistory((data || []) as PriceChangeRow[]);

      // Also prefill form with current/latest price (nice UX)
      const latest = (data && data[0]) as PriceChangeRow | undefined;
      if (latest) {
        setPricePerKg(String(toNumber(latest.price_per_kg)));
        setCarryoverKg("0"); // carryover only matters at the moment of changing price
        setNote("");
      } else {
        setPricePerKg("");
        setCarryoverKg("0");
        setNote("");
      }
    } catch (err: any) {
      // If table doesn't exist yet, you'll see the message here
      showToast(err?.message || "Failed to load price history", "error");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  const currentPrice = useMemo(() => {
    const latest = history[0];
    return latest ? toNumber(latest.price_per_kg) : 0;
  }, [history]);

  const handleSaveNewPrice = async () => {
    if (!selectedAgentId) {
      showToast("Select an agent first", "error");
      return;
    }

    const p = toNumber(pricePerKg);
    if (p <= 0) {
      showToast("Enter a valid price per kg", "error");
      return;
    }

    const carry = toNumber(carryoverKg);
    if (carry < 0) {
      showToast("Carryover (fruit on ground) cannot be negative", "error");
      return;
    }

    try {
      setSaving(true);

      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData.user?.id || null;

      // Insert a new price change row
      const { error } = await supabaseUntyped.from(PRICE_TABLE).insert({
        agent_id: selectedAgentId,
        price_per_kg: p,
        carryover_kg: carry,
        note: note?.trim() ? note.trim() : null,
        created_by: createdBy,
        effective_at: new Date().toISOString(),
      });

      if (error) throw error;

      showToast("Price updated successfully", "success");
      setCarryoverKg("0");
      setNote("");
      await loadHistory(selectedAgentId);
    } catch (err: any) {
      showToast(err?.message || "Failed to update price", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Admin access required</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Set Clerk Price</h1>
          <p className="text-gray-600 mt-1">
            Set an agent’s current buying price and record “fruit on ground” to prevent price manipulation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Set price form */}
        <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-1">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Price Change
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent *</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
              {selectedAgent && (
                <p className="text-xs text-gray-500 mt-2">
                  Current price:{" "}
                  <span className="font-semibold text-gray-900">
                    {currentPrice > 0 ? `${formatGHS(currentPrice)}/kg` : "Not set"}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New price per kg *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder="e.g. 1.40"
              />
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="block text-sm font-semibold text-yellow-900 mb-1">
                Fruit on ground (kg) at OLD price *
              </label>
              <p className="text-xs text-yellow-800 mb-2">
                Enter the quantity already bought at the previous price but not yet recorded as a collection.
                This is what allows automatic breakdown later.
              </p>
              <input
                type="number"
                step="0.01"
                min="0"
                value={carryoverKg}
                onChange={(e) => setCarryoverKg(e.target.value)}
                className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder="e.g. 500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder="Reason for change, market update, etc."
              />
            </div>

            <button
              onClick={handleSaveNewPrice}
              disabled={saving || !selectedAgentId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Price Change"}
            </button>
          </div>
        </div>

        {/* Right: History */}
        <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Price History
          </h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-gray-600">
              No price history found for this agent yet. Set the first price on the left.
              <div className="mt-3 text-xs text-gray-500">
                If you see an error like “relation does not exist”, create the table <b>{PRICE_TABLE}</b> in Supabase.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Effective</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fruit on Ground (kg)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{fmtDateTime(h.effective_at)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-700">
                        {formatGHS(toNumber(h.price_per_kg))}/kg
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {toNumber(h.carryover_kg).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{h.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 text-xs text-gray-500">
                Rule: Carryover is used to allocate the first part of the next collections to the old price, then the new price applies.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
