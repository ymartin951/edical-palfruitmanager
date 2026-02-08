import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Apple } from 'lucide-react';

export function AgentDashboard() {
  const { userRole } = useAuth();
  const [stats, setStats] = useState({
    totalAdvances: 0,
    totalCollections: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole?.agentId) {
      loadStats();
    }
  }, [userRole]);

  const loadStats = async () => {
    try {
      const [advancesRes, collectionsRes] = await Promise.all([
        supabase
          .from('cash_advances')
          .select('amount')
          .eq('agent_id', userRole?.agentId || ''),
        supabase
          .from('fruit_collections')
          .select('weight_kg')
          .eq('agent_id', userRole?.agentId || ''),
      ]);

      const totalAdvances = (advancesRes.data || []).reduce((sum, a) => sum + Number(a.amount), 0);
      const totalCollections = (collectionsRes.data || []).reduce((sum, c) => sum + Number(c.weight_kg), 0);

      setStats({ totalAdvances, totalCollections });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold text-gray-800">My Dashboard</h1>
        <p className="text-gray-600 mt-2">Your palm fruit collection overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-500 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">Total Advances</h3>
            <p className="text-2xl font-bold text-gray-800">GH₵ {stats.totalAdvances.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-600 p-3 rounded-lg">
                <Apple className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">Total Collections</h3>
            <p className="text-2xl font-bold text-gray-800">{stats.totalCollections.toFixed(2)} kg</p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition text-left">
            <Apple className="w-6 h-6 text-green-600 mb-2" />
            <p className="font-medium text-gray-800">Record Collection</p>
            <p className="text-sm text-gray-600">Log new fruit collection</p>
          </button>
          <button className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition text-left">
            <DollarSign className="w-6 h-6 text-green-600 mb-2" />
            <p className="font-medium text-gray-800">View Advances</p>
            <p className="text-sm text-gray-600">Check your advances</p>
          </button>
        </div>
      </div>
    </div>
  );
}
