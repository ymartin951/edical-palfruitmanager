import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../lib/database.types';
import { FileText, Calendar, Plus } from 'lucide-react';

type Reconciliation = Database['public']['Tables']['monthly_reconciliations']['Row'] & {
  agents?: { full_name: string };
};

type Agent = Database['public']['Tables']['agents']['Row'];

export function MonthlyReconciliation() {
  const { userRole } = useAuth();
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const { showToast } = useToast();

  const isAdmin = userRole?.role === 'ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reconciliationsRes, agentsRes] = await Promise.all([
        supabase
          .from('monthly_reconciliations')
          .select('*, agents(full_name)')
          .order('month', { ascending: false }),
        supabase.from('agents').select('*').order('full_name'),
      ]);

      if (reconciliationsRes.error) throw reconciliationsRes.error;
      if (agentsRes.error) throw agentsRes.error;

      setReconciliations(reconciliationsRes.data || []);
      setAgents(agentsRes.data || []);

      if (!isAdmin && userRole?.agentId) {
        setSelectedAgent(userRole.agentId);
      }
    } catch (error: any) {
      showToast(error.message || 'Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateReconciliation = async () => {
    if (!selectedAgent || !selectedMonth) {
      showToast('Please select agent and month', 'error');
      return;
    }

    try {
      const monthDate = new Date(selectedMonth + '-01');
      const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const [advancesRes, collectionsRes] = await Promise.all([
        supabase
          .from('cash_advances')
          .select('amount')
          .eq('agent_id', selectedAgent)
          .gte('advance_date', firstDay)
          .lte('advance_date', lastDay),
        supabase
          .from('fruit_collections')
          .select('weight_kg')
          .eq('agent_id', selectedAgent)
          .gte('collection_date', firstDay)
          .lte('collection_date', lastDay),
      ]);

      const totalAdvance = (advancesRes.data || []).reduce((sum, a) => sum + Number(a.amount), 0);
      const totalWeight = (collectionsRes.data || []).reduce((sum, c) => sum + Number(c.weight_kg), 0);

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('monthly_reconciliations')
        .upsert({
          agent_id: selectedAgent,
          month: firstDay,
          total_advance: totalAdvance,
          total_weight_kg: totalWeight,
          status: 'OPEN',
          created_by: userData.user?.id || null,
        }, {
          onConflict: 'agent_id,month',
        });

      if (error) throw error;

      showToast('Reconciliation updated successfully', 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Error generating reconciliation', 'error');
    }
  };

  const formatMonth = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-100 text-blue-700';
      case 'RENDERED':
        return 'bg-orange-100 text-orange-700';
      case 'CLOSED':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Monthly Reconciliation</h1>
        <p className="text-gray-600 mt-2">{isAdmin ? 'Track monthly agent reconciliations' : 'View your monthly reconciliations'}</p>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Generate Reconciliation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent *</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              >
                <option value="">Select Agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month *</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={generateReconciliation}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Generate / Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Advance
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Weight
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Comments
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reconciliations.map((recon) => (
                <tr key={recon.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-green-700 font-semibold text-sm">
                          {recon.agents?.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">
                        {recon.agents?.full_name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{formatMonth(recon.month)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-800">
                      GH₵ {Number(recon.total_advance).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-800">
                      {Number(recon.total_weight_kg).toFixed(2)} kg
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(recon.status)}`}>
                      {recon.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {recon.comments || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reconciliations.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No reconciliations recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}
