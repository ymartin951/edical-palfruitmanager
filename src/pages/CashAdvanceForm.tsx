import { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Database } from '../lib/database.types';
import { ArrowLeft } from 'lucide-react';
import { PageContext } from '../App';

type Agent = Database['public']['Tables']['agents']['Row'];

interface AdvanceFormData {
  agent_id: string;
  advance_date: string;
  amount: string;
  payment_method: 'CASH' | 'MOMO' | 'BANK';
  signed_by: string;
}

export function CashAdvanceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setCurrentPage } = useContext(PageContext);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<AdvanceFormData>({
    agent_id: '',
    advance_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'CASH',
    signed_by: '',
  });
  const { showToast } = useToast();

  const isEditMode = !!id;

  useEffect(() => {
    console.log('💰 ============ CASH ADVANCE FORM MOUNTED ============');
    console.log('💰 ID FROM URL:', id);
    console.log('💰 IS EDIT MODE:', isEditMode);
    console.log('💰 ROUTE PATH:', window.location.pathname);
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const agentsPromise = supabase.from('agents').select('*').order('full_name');

      if (isEditMode && id) {
        console.log('LOADING ADVANCE FOR EDIT:', id);
        const [agentsRes, advanceRes] = await Promise.all([
          agentsPromise,
          supabase.from('cash_advances').select('*').eq('id', id).maybeSingle()
        ]);

        if (agentsRes.error) throw agentsRes.error;
        if (advanceRes.error) throw advanceRes.error;

        setAgents(agentsRes.data || []);

        if (advanceRes.data) {
          setFormData({
            agent_id: advanceRes.data.agent_id,
            advance_date: advanceRes.data.advance_date,
            amount: advanceRes.data.amount.toString(),
            payment_method: advanceRes.data.payment_method,
            signed_by: advanceRes.data.signed_by || '',
          });
        } else {
          showToast('Advance not found', 'error');
          navigate('/cash-advances');
        }
      } else {
        const agentsRes = await agentsPromise;
        if (agentsRes.error) throw agentsRes.error;
        setAgents(agentsRes.data || []);
      }
    } catch (error: any) {
      showToast(error.message || 'Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('ADVANCE FORM SUBMIT:', { isEditMode, id, formData });

    if (!formData.agent_id) {
      showToast('Please select an agent', 'error');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }

    setSubmitting(true);

    try {
      if (isEditMode && id) {
        const { error } = await supabase
          .from('cash_advances')
          .update({
            agent_id: formData.agent_id,
            advance_date: formData.advance_date,
            amount: amount,
            payment_method: formData.payment_method,
            signed_by: formData.signed_by || null,
          })
          .eq('id', id);

        if (error) throw error;
        showToast('Advance updated successfully', 'success');
      } else {
        const { data: userData } = await supabase.auth.getUser();

        const { error } = await supabase.from('cash_advances').insert({
          agent_id: formData.agent_id,
          advance_date: formData.advance_date,
          amount: amount,
          payment_method: formData.payment_method,
          signed_by: formData.signed_by || null,
          created_by: userData.user?.id || null,
        });

        if (error) throw error;
        showToast('Advance saved successfully', 'success');
      }

      navigate('/cash-advances');
    } catch (error: any) {
      showToast(error.message || 'Error saving advance', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/cash-advances');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Cash Advances
      </button>

      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isEditMode ? 'Edit Cash Advance' : 'Add Cash Advance'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agent *
            </label>
            <select
              value={formData.agent_id}
              onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={formData.advance_date}
              onChange={(e) => setFormData({ ...formData, advance_date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (GH₵) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'CASH' | 'MOMO' | 'BANK' })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="CASH">Cash</option>
              <option value="MOMO">Mobile Money</option>
              <option value="BANK">Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Signed By
            </label>
            <input
              type="text"
              value={formData.signed_by}
              onChange={(e) => setFormData({ ...formData, signed_by: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="Name of the person who gave the advance to the agent"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
