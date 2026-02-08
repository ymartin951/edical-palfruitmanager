import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { ArrowLeft, Plus, Copy, Trash2, X, Save } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type Agent = Database['public']['Tables']['agents']['Row'];
type ExpenseInsert = Database['public']['Tables']['agent_expenses']['Insert'];

interface ExpenseRow {
  id: string;
  expense_type: string;
  amount: string;
  expense_date: string;
  errors: {
    expense_type?: string;
    amount?: string;
    expense_date?: string;
  };
}

export default function ExpensesBatchForm() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, userRole } = useAuth();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<ExpenseRow[]>([
    {
      id: crypto.randomUUID(),
      expense_type: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      errors: {}
    }
  ]);

  const [recentExpenseTypes, setRecentExpenseTypes] = useState<string[]>([]);

  useEffect(() => {
    if (userRole?.role !== 'ADMIN') {
      showToast('Access denied', 'error');
      navigate('/agents');
      return;
    }
    if (agentId) {
      loadAgentAndExpenseTypes();
    }
  }, [agentId, userRole]);

  const loadAgentAndExpenseTypes = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agentData) {
        showToast('Agent not found', 'error');
        navigate('/agents');
        return;
      }

      setAgent(agentData);

      const { data: expensesData } = await supabase
        .from('agent_expenses')
        .select('expense_type')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (expensesData) {
        const uniqueTypes = Array.from(new Set(expensesData.map(e => e.expense_type)));
        setRecentExpenseTypes(uniqueTypes.slice(0, 10));
      }
    } catch (error: unknown) {
      console.error('Error loading data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        expense_type: lastRow?.expense_type || '',
        amount: '',
        expense_date: lastRow?.expense_date || new Date().toISOString().split('T')[0],
        errors: {}
      }
    ]);
  };

  const duplicateRow = (index: number) => {
    const rowToDuplicate = rows[index];
    const newRow: ExpenseRow = {
      id: crypto.randomUUID(),
      expense_type: rowToDuplicate.expense_type,
      amount: rowToDuplicate.amount,
      expense_date: rowToDuplicate.expense_date,
      errors: {}
    };
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      showToast('At least one row is required', 'error');
      return;
    }
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to clear all rows?')) {
      setRows([
        {
          id: crypto.randomUUID(),
          expense_type: '',
          amount: '',
          expense_date: new Date().toISOString().split('T')[0],
          errors: {}
        }
      ]);
    }
  };

  const updateRow = (index: number, field: keyof ExpenseRow, value: string) => {
    const newRows = [...rows];
    newRows[index] = {
      ...newRows[index],
      [field]: value,
      errors: {
        ...newRows[index].errors,
        [field]: undefined
      }
    };
    setRows(newRows);
  };

  const validateRows = (): boolean => {
    let isValid = true;
    const newRows = rows.map(row => {
      const errors: ExpenseRow['errors'] = {};

      if (!row.expense_type.trim()) {
        errors.expense_type = 'Expense type is required';
        isValid = false;
      }

      const amount = parseFloat(row.amount);
      if (!row.amount.trim() || isNaN(amount) || amount <= 0) {
        errors.amount = 'Amount must be greater than 0';
        isValid = false;
      }

      if (!row.expense_date) {
        errors.expense_date = 'Date is required';
        isValid = false;
      }

      return { ...row, errors };
    });

    setRows(newRows);
    return isValid;
  };

  const handleSave = async () => {
    if (!validateRows()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    if (!agentId || !user) {
      showToast('Missing required information', 'error');
      return;
    }

    setSaving(true);
    try {
      const expensesToInsert: ExpenseInsert[] = rows.map(row => ({
        agent_id: agentId,
        expense_type: row.expense_type.trim(),
        amount: parseFloat(row.amount),
        expense_date: new Date(row.expense_date).toISOString(),
        created_by: user.id
      }));

      const { error } = await supabase
        .from('agent_expenses')
        .insert(expensesToInsert);

      if (error) throw error;

      showToast(`${rows.length} expense${rows.length > 1 ? 's' : ''} saved successfully`, 'success');
      navigate(`/agents/${agentId}/report?tab=expenses`);
    } catch (error: unknown) {
      console.error('Error saving expenses:', error);
      showToast('Failed to save expenses', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'expense_type' | 'amount' | 'expense_date') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'expense_type') {
        document.getElementById(`amount-${index}`)?.focus();
      } else if (field === 'amount') {
        document.getElementById(`date-${index}`)?.focus();
      } else if (field === 'expense_date') {
        if (index === rows.length - 1) {
          addRow();
          setTimeout(() => {
            document.getElementById(`expense_type-${index + 1}`)?.focus();
          }, 50);
        } else {
          document.getElementById(`expense_type-${index + 1}`)?.focus();
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Agent not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/agents/${agentId}/report?tab=expenses`)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Expenses (Batch)</h1>
          <p className="text-sm text-gray-500">Agent: {agent.full_name}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <X className="w-4 h-4" />
            Clear All
          </button>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Expense Type *</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount (GH₵) *</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date *</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input
                      id={`expense_type-${index}`}
                      type="text"
                      list={`expense-types-${index}`}
                      value={row.expense_type}
                      onChange={(e) => updateRow(index, 'expense_type', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'expense_type')}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        row.errors.expense_type ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Enter expense type"
                    />
                    <datalist id={`expense-types-${index}`}>
                      {recentExpenseTypes.map((type) => (
                        <option key={type} value={type} />
                      ))}
                    </datalist>
                    {row.errors.expense_type && (
                      <p className="text-xs text-red-600 mt-1">{row.errors.expense_type}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      id={`amount-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.amount}
                      onChange={(e) => updateRow(index, 'amount', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'amount')}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        row.errors.amount ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                    {row.errors.amount && (
                      <p className="text-xs text-red-600 mt-1">{row.errors.amount}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      id={`date-${index}`}
                      type="date"
                      value={row.expense_date}
                      onChange={(e) => updateRow(index, 'expense_date', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index, 'expense_date')}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        row.errors.expense_date ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {row.errors.expense_date && (
                      <p className="text-xs text-red-600 mt-1">{row.errors.expense_date}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => duplicateRow(index)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Duplicate row"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeRow(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove row"
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {rows.map((row, index) => (
            <div key={row.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Row {index + 1}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => duplicateRow(index)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeRow(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expense Type *
                </label>
                <input
                  id={`expense_type-${index}`}
                  type="text"
                  list={`expense-types-${index}`}
                  value={row.expense_type}
                  onChange={(e) => updateRow(index, 'expense_type', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, 'expense_type')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    row.errors.expense_type ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter expense type"
                />
                <datalist id={`expense-types-${index}`}>
                  {recentExpenseTypes.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
                {row.errors.expense_type && (
                  <p className="text-xs text-red-600 mt-1">{row.errors.expense_type}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (GH₵) *
                </label>
                <input
                  id={`amount-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={(e) => updateRow(index, 'amount', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, 'amount')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    row.errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {row.errors.amount && (
                  <p className="text-xs text-red-600 mt-1">{row.errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  id={`date-${index}`}
                  type="date"
                  value={row.expense_date}
                  onChange={(e) => updateRow(index, 'expense_date', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, 'expense_date')}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    row.errors.expense_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {row.errors.expense_date && (
                  <p className="text-xs text-red-600 mt-1">{row.errors.expense_date}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            Total rows: <span className="font-semibold">{rows.length}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/agents/${agentId}/report?tab=expenses`)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save All Expenses'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Tips for Fast Entry:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Press Enter to move to the next field</li>
          <li>Expense types are suggested from recent entries</li>
          <li>Use "Duplicate Row" to copy the previous row's data</li>
          <li>Date defaults to today for new rows</li>
        </ul>
      </div>
    </div>
  );
}
