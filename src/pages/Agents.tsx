import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Phone, MapPin, Edit2, Trash2, FileText, X } from "lucide-react";

import { supabaseUntyped as supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { ConfirmDeleteDialog } from "../components/ConfirmDeleteDialog";
import { archiveAgent } from "../services/deleteService";

type AgentStatus = "ACTIVE" | "INACTIVE";

type Agent = {
  id: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  status: AgentStatus;
  photo_url: string | null; // can be public URL OR storage path
  created_at?: string | null;
};

type AgentFormData = {
  full_name: string;
  phone: string;
  location: string;
  status: AgentStatus;
};

const COMPANY_LOGO_URL = "/company-logo.png"; // ✅ Put logo in: public/company-logo.png

// If your agent photos are stored in Supabase Storage, set the bucket name here.
// If photo_url is already a full URL, this bucket is ignored.
const AGENT_PHOTO_BUCKET =
  (import.meta as any).env?.VITE_AGENT_PHOTO_BUCKET || "agent-photos";

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const isProbablyFullUrl = (value: string) => {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  );
};

/**
 * ✅ Fix: agent.photo_url may be a storage PATH, not a public URL.
 * If it's a path, convert it to a public URL from Supabase Storage.
 */
const resolveAgentPhotoUrl = (photoUrl: string | null): string | null => {
  if (!photoUrl) return null;
  if (isProbablyFullUrl(photoUrl)) return photoUrl;

  // Treat as storage path
  const { data } = supabase.storage.from(AGENT_PHOTO_BUCKET).getPublicUrl(photoUrl);
  return data?.publicUrl || null;
};

export function Agents() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userRole } = useAuth();

  const isAdmin = userRole?.role === "ADMIN";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentAdvances, setAgentAdvances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | AgentStatus>("");
  const [outstandingFilter, setOutstandingFilter] = useState(false);

  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);

  // Track images that failed to load so we can fallback reliably
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState<AgentFormData>({
    full_name: "",
    phone: "",
    location: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    void loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      let agentsRes = await supabase
        .from("agents")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (
        agentsRes.error &&
        String(agentsRes.error.message || "").toLowerCase().includes("archived_at")
      ) {
        agentsRes = await supabase
          .from("agents")
          .select("*")
          .order("created_at", { ascending: false });
      }

      if (agentsRes.error) throw agentsRes.error;

      const agentsData = (agentsRes.data || []) as Agent[];
      setAgents(agentsData);

      const [advancesRes, collectionsRes] = await Promise.all([
        supabase.from("cash_advances").select("agent_id, amount"),
        supabase.from("fruit_collections").select("agent_id, weight_kg"),
      ]);

      const advances = (advancesRes.data || []).reduce((acc: Record<string, number>, adv: any) => {
        const id = String(adv.agent_id);
        acc[id] = (acc[id] || 0) + Number(adv.amount || 0);
        return acc;
      }, {});

      const collections = (collectionsRes.data || []).reduce((acc: Record<string, number>, col: any) => {
        const id = String(col.agent_id);
        acc[id] = (acc[id] || 0) + Number(col.weight_kg || 0);
        return acc;
      }, {});

      const outstanding = Object.keys(advances).reduce((acc: Record<string, number>, agentId) => {
        acc[agentId] = advances[agentId];
        return acc;
      }, {});

      void collections;
      setAgentAdvances(outstanding);
    } catch (err: any) {
      showToast(err?.message || "Error loading agents", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.location || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.phone || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || agent.status === statusFilter;
    const matchesOutstanding = !outstandingFilter || (agentAdvances[agent.id] || 0) > 0;

    return matchesSearch && matchesStatus && matchesOutstanding;
  });

  const openAddForm = () => {
    setEditingAgent(null);
    setFormData({ full_name: "", phone: "", location: "", status: "ACTIVE" });
  };

  const openEditForm = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      full_name: agent.full_name,
      phone: agent.phone || "",
      location: agent.location || "",
      status: agent.status,
    });
  };

  // Photo upload is OPTIONAL — we are not requiring it anywhere in this form.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      showToast("Full name is required", "error");
      return;
    }

    try {
      const payload = {
        full_name: formData.full_name.trim(),
        phone: formData.phone ? formData.phone : null,
        location: formData.location ? formData.location : null,
        status: formData.status,
      };

      if (editingAgent) {
        const { error } = await supabase.from("agents").update(payload).eq("id", editingAgent.id);
        if (error) throw error;
        showToast("Agent updated successfully", "success");
      } else {
        const { error } = await supabase.from("agents").insert(payload);
        if (error) throw error;
        showToast("Agent added successfully", "success");
      }

      setEditingAgent(null);
      await loadAgents();
    } catch (err: any) {
      showToast(err?.message || "Error saving agent", "error");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAgent) return;
    try {
      await archiveAgent(deletingAgent.id);
      showToast("Agent archived successfully", "success");
      setDeletingAgent(null);
      await loadAgents();
    } catch (err: any) {
      showToast(err?.message || "Error archiving agent", "error");
    }
  };

  // Pre-resolve photo URLs to avoid repeated work in render
  const photoUrlByAgentId = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const a of agents) {
      map[a.id] = resolveAgentPhotoUrl(a.photo_url);
    }
    return map;
  }, [agents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Agents</h1>
          <p className="text-gray-600 mt-2">Manage field agents</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              openAddForm();
              navigate("/agents/new");
            }}
            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Add Agent
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search agents by name, location, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | AgentStatus)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={outstandingFilter}
              onChange={(e) => setOutstandingFilter(e.target.checked)}
            />
            Has outstanding balance
          </label>

          {(statusFilter || outstandingFilter) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setOutstandingFilter(false);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => {
          const resolvedPhotoUrl = photoUrlByAgentId[agent.id];
          const shouldUseFallbackLogo = !resolvedPhotoUrl || !!imgFailed[agent.id];

          return (
            <div
              key={agent.id}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="bg-gradient-to-r from-green-600 to-green-700 h-2" />
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  {/* ✅ New behavior:
                      - If agent photo exists and loads -> show it
                      - Else show company logo
                      - If company logo fails too -> show initials */}
                  {!shouldUseFallbackLogo ? (
                    <img
                      src={resolvedPhotoUrl || undefined}
                      alt={agent.full_name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-green-100"
                      onError={() => setImgFailed((p) => ({ ...p, [agent.id]: true }))}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img
                      src={COMPANY_LOGO_URL}
                      alt="Company Logo"
                      className="w-16 h-16 rounded-full object-contain bg-white border-2 border-green-100 p-1"
                      onError={() => {
                        // If logo is missing, fallback to initials (keep UI stable)
                        setImgFailed((p) => ({ ...p, [agent.id]: true }));
                      }}
                      loading="lazy"
                    />
                  )}

                  {/* If both photo and logo fail, show initials */}
                  {shouldUseFallbackLogo && COMPANY_LOGO_URL && imgFailed[agent.id] && (
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center border-2 border-green-200 -ml-20">
                      <span className="text-green-700 font-bold text-lg">
                        {getInitials(agent.full_name)}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-800 truncate">{agent.full_name}</h3>
                    <span
                      className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${
                        agent.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {agent.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{agent.phone}</span>
                    </div>
                  )}
                  {agent.location && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm truncate">{agent.location}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => navigate(`/agents/${agent.id}/report`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    View Account Report
                  </button>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/agents/${agent.id}/edit`)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-green-600 hover:bg-green-50 rounded-lg transition font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingAgent(agent)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Archive
                      </button>
                    </div>
                  )}
                </div>

                {editingAgent?.id === agent.id && (
                  <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.full_name}
                      onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Full name"
                    />
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone"
                    />
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      value={formData.location}
                      onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Location"
                    />
                    <div className="flex gap-2">
                      <button className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                        Save
                      </button>
                      <button
                        type="button"
                        className="flex-1 border py-2 rounded-lg"
                        onClick={() => setEditingAgent(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {isAdmin && editingAgent?.id !== agent.id && (
                  <button
                    className="mt-4 w-full border border-green-200 text-green-700 py-2 rounded-lg hover:bg-green-50"
                    onClick={() => openEditForm(agent)}
                  >
                    Quick edit on this page
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAgents.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <p className="text-gray-600">No agents found</p>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deletingAgent}
        title="Archive Agent"
        description={`Are you sure you want to archive ${deletingAgent?.full_name}? This will set their status to INACTIVE and hide them from the main view.`}
        confirmText="Archive"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingAgent(null)}
      />
    </div>
  );
}
