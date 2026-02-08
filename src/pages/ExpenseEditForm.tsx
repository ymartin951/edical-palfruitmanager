import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft } from 'lucide-react';

interface ExpenseFormData {
  agent_id: string;
  expense_type: string;
  amount: string;
  expense_date: string;
}

export function ExpenseEditForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<ExpenseFormData>({
    agent_id: '',
    expense_type: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
  });
  const { showToast } = useToast();

  useEffect(() => {
    console.log('🔧 ============ EXPENSE EDIT FORM MOUNTED ============');
    console.log('🔧 EXPENSE ID FROM URL:', id);
    console.log('🔧 ROUTE PATH:', window.location.pathname);
    if (id) {
      loadExpense();
    }
  }, [id]);

  const loadExpense = async () => {
    if (!id) return;

    try {
      console.log('LOADING EXPENSE FOR EDIT:', id);
      const { data, error } = await supabase
        .from('agent_expenses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          agent_id: data.agent_id,
          expense_type: data.expense_type,
          amount: data.amount.toString(),
          expense_date: data.expense_date.split('T')[0],
        });
      } else {
        showToast('Expense not found', 'error');
        navigate('/expenses');
      }
    } catch (error: any) {
      showToast(error.message || 'Error loading expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('EXPENSE FORM SUBMIT:', { id, formData });

    if (!formData.expense_type.trim()) {
      showToast('Expense type is required', 'error');
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('agent_expenses')
        .update({
          expense_type: formData.expense_type.trim(),
          amount: amount,
          expense_date: formData.expense_date,
        })
        .eq('id', id);

      if (error) throw error;

      showToast('Expense updated successfully', 'success');
      navigate(`/agents/${formData.agent_id}/report?tab=expenses`);
    } catch (error: any) {
      showToast(error.message || 'Error updating expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (formData.agent_id) {
      navigate(`/agents/${formData.agent_id}/report?tab=expenses`);
    } else {
      navigate('/expenses');
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
    <div className="max-w-3xl">
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Agent Report
      </button>

      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Edit Expense</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Type *
            </label>
            <input
              type="text"
              value={formData.expense_type}
              onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
              placeholder="e.g., Transport, Fuel, Food, etc."
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
              Date *
            </label>
            <input
              type="date"
              value={formData.expense_date}
              onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
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
              {submitting ? 'Updating...' : 'Update Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
