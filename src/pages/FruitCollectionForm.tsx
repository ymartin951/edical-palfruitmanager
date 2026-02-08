import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../lib/database.types';
import { ArrowLeft, Plus, Copy, Trash2, X } from 'lucide-react';
import { PageContext } from '../App';

type Agent = Database['public']['Tables']['agents']['Row'];
type PricingMode = 'same' | 'breakdown';

interface PriceRow {
  id: string;
  weight_kg: string;
  price_per_kg: string;
  errors: {
    weight_kg?: string;
    price_per_kg?: string;
  };
}

interface CollectionFormData {
  agent_id: string;
  collection_date: string;
  driver_name: string;
  pricing_mode: PricingMode;
  single_weight_kg: string;
  single_price_per_kg: string;
  price_rows: PriceRow[];
}

/**
 * IMPORTANT:
 * Your Database types do NOT include fruit_collection_items, and fruit_collections insert/select is resolving to `never`.
 * So we define minimal local types that match your error output for fruit_collections,
 * and we send fruit_collection_items insert via a safe cast.
 */
type FruitCollectionInsert = {
  agent_id: string;
  collection_date?: string;
  weight_kg: number;
  notes?: string | null;
  driver_name?: string | null;
  created_by?: string | null;
};

type FruitCollectionRow = {
  id: string;
};

type FruitCollectionItemInsert = {
  collection_id: string;
  weight_kg: number;
  price_per_kg: number;
  line_total: number;
};

const makeEmptyRow = (): PriceRow => ({
  id: crypto.randomUUID(),
  weight_kg: '',
  price_per_kg: '',
  errors: {}
});

export function FruitCollectionForm() {
  const { setCurrentPage } = useContext(PageContext);
  const { userRole } = useAuth();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const isAdmin = userRole?.role === 'ADMIN';
  const agentIdFromRole = (userRole as any)?.agentId as string | undefined;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const defaultDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const createInitialForm = (agentId: string): CollectionFormData => ({
    agent_id: agentId,
    collection_date: defaultDate,
    driver_name: '',
    pricing_mode: 'same',
    single_weight_kg: '',
    single_price_per_kg: '',
    price_rows: [makeEmptyRow()]
  });

  const [formData, setFormData] = useState<CollectionFormData>(() => createInitialForm(''));

  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const agentIdFromUrl = searchParams.get('agentId');
    if (agentIdFromUrl && isAdmin) {
      setFormData(prev => ({ ...prev, agent_id: agentIdFromUrl }));
    }
  }, [searchParams, isAdmin]);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase.from('agents').select('*').order('full_name');
      if (error) throw error;

      setAgents(data || []);

      if (!isAdmin && agentIdFromRole) {
        setFormData(prev => ({ ...prev, agent_id: agentIdFromRole }));
      }
    } catch (error: any) {
      showToast(error.message || 'Error loading agents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const computeTotals = () => {
    if (formData.pricing_mode === 'same') {
      const weight = parseFloat(formData.single_weight_kg) || 0;
      const price = parseFloat(formData.single_price_per_kg) || 0;
      return { totalWeight: weight, totalAmount: weight * price };
    }

    return formData.price_rows.reduce(
      (acc, row) => {
        const weight = parseFloat(row.weight_kg) || 0;
        const price = parseFloat(row.price_per_kg) || 0;
        return {
          totalWeight: acc.totalWeight + weight,
          totalAmount: acc.totalAmount + weight * price
        };
      },
      { totalWeight: 0, totalAmount: 0 }
    );
  };

  const addPriceRow = () => {
    setFormData(prev => ({
      ...prev,
      price_rows: [...prev.price_rows, makeEmptyRow()]
    }));
  };

  const removePriceRow = (id: string) => {
    if (formData.price_rows.length === 1) {
      showToast('At least one row is required', 'error');
      return;
    }
    setFormData(prev => ({
      ...prev,
      price_rows: prev.price_rows.filter(row => row.id !== id)
    }));
  };

  const duplicatePriceRow = (id: string) => {
    setFormData(prev => {
      const index = prev.price_rows.findIndex(r => r.id === id);
      if (index === -1) return prev;

      const row = prev.price_rows[index];
      const newRow: PriceRow = {
        id: crypto.randomUUID(),
        weight_kg: row.weight_kg,
        price_per_kg: row.price_per_kg,
        errors: {}
      };

      const newRows = [...prev.price_rows];
      newRows.splice(index + 1, 0, newRow);
      return { ...prev, price_rows: newRows };
    });
  };

  const clearAllRows = () => {
    setFormData(prev => ({
      ...prev,
      price_rows: [makeEmptyRow()]
    }));
  };

  const updatePriceRow = (id: string, field: 'weight_kg' | 'price_per_kg', value: string) => {
    setFormData(prev => ({
      ...prev,
      price_rows: prev.price_rows.map(row =>
        row.id === id
          ? { ...row, [field]: value, errors: { ...row.errors, [field]: undefined } }
          : row
      )
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.agent_id) {
      showToast('Please select an agent', 'error');
      return false;
    }

    if (formData.pricing_mode === 'same') {
      const weight = parseFloat(formData.single_weight_kg);
      const price = parseFloat(formData.single_price_per_kg);

      if (isNaN(weight) || weight <= 0) {
        showToast('Weight must be greater than 0', 'error');
        return false;
      }

      if (isNaN(price) || price <= 0) {
        showToast('Price per kg must be greater than 0', 'error');
        return false;
      }

      return true;
    }

    let hasError = false;

    const updatedRows = formData.price_rows.map(row => {
      const errors: { weight_kg?: string; price_per_kg?: string } = {};
      const weight = parseFloat(row.weight_kg);
      const price = parseFloat(row.price_per_kg);

      if (isNaN(weight) || weight <= 0) {
        errors.weight_kg = 'Required and must be > 0';
        hasError = true;
      }

      if (isNaN(price) || price <= 0) {
        errors.price_per_kg = 'Required and must be > 0';
        hasError = true;
      }

      return { ...row, errors };
    });

    if (hasError) {
      setFormData(prev => ({ ...prev, price_rows: updatedRows }));
      showToast('Please fix all errors before saving', 'error');
      return false;
    }

    return true;
  };

  const resetFormAfterSuccess = () => {
    const agentIdFromUrl = isAdmin ? searchParams.get('agentId') : null;
    const agentIdToKeep = isAdmin ? (agentIdFromUrl || '') : (agentIdFromRole || '');
    setFormData(createInitialForm(agentIdToKeep));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const totals = computeTotals();

      // ✅ no has_price_breakdown (doesn't exist in your types)
      const collectionPayload: FruitCollectionInsert = {
        agent_id: formData.agent_id,
        collection_date: formData.collection_date,
        weight_kg: totals.totalWeight,
        driver_name: formData.driver_name || null,
        created_by: userData.user?.id ?? null,
        notes: null
      };

      /**
       * ✅ Fix for "never" on fruit_collections:
       * Use a narrow select ('id') and cast the returned shape.
       */
      const { data: created, error: collectionError } = await (supabase as any)
  .from('fruit_collections')
  .insert(collectionPayload)
  .select('id')
  .single();


      if (collectionError) throw collectionError;

      const collectionData = created as FruitCollectionRow | null;
      if (!collectionData?.id) throw new Error('Failed to create collection record.');

      const items: FruitCollectionItemInsert[] =
        formData.pricing_mode === 'same'
          ? [
              {
                collection_id: collectionData.id,
                weight_kg: parseFloat(formData.single_weight_kg),
                price_per_kg: parseFloat(formData.single_price_per_kg),
                line_total:
                  parseFloat(formData.single_weight_kg) * parseFloat(formData.single_price_per_kg)
              }
            ]
          : formData.price_rows.map(row => {
              const w = parseFloat(row.weight_kg);
              const p = parseFloat(row.price_per_kg);
              return {
                collection_id: collectionData.id,
                weight_kg: w,
                price_per_kg: p,
                line_total: w * p
              };
            });

      /**
       * ✅ Fix for "fruit_collection_items does not exist in Database types":
       * We cannot type it through Database, so we insert via a safe cast.
       */
      const { error: itemsError } = await (supabase as any)
        .from('fruit_collection_items')
        .insert(items);

      if (itemsError) throw itemsError;

      showToast('Collection saved successfully', 'success');

      // ✅ clear form after success
      resetFormAfterSuccess();

      setCurrentPage(isAdmin ? 'fruit-collections' : 'my-collections');
    } catch (error: any) {
      showToast(error.message || 'Error saving collection', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCurrentPage(isAdmin ? 'fruit-collections' : 'my-collections');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const totals = computeTotals();

  return (
    <div className="max-w-4xl">
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Fruit Collections
      </button>

      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Add Fruit Collection</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent *</label>
              <select
                value={formData.agent_id}
                onChange={(e) => setFormData(prev => ({ ...prev, agent_id: e.target.value }))}
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
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <input
              type="date"
              value={formData.collection_date}
              onChange={(e) => setFormData(prev => ({ ...prev, collection_date: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Driver</label>
            <input
              type="text"
              value={formData.driver_name}
              onChange={(e) => setFormData(prev => ({ ...prev, driver_name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="Name of the driver who took the load"
            />
          </div>

          <div className="border-t pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Pricing for this load *
            </label>

            <div className="flex gap-4 mb-6">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pricing_mode: 'same' }))}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                  formData.pricing_mode === 'same'
                    ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Same price for all
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pricing_mode: 'breakdown' }))}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                  formData.pricing_mode === 'breakdown'
                    ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Different prices (breakdown)
              </button>
            </div>

            {formData.pricing_mode === 'same' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.single_weight_kg}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, single_weight_kg: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price per kg *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.single_price_per_kg}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, single_price_per_kg: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={addPriceRow}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Row
                  </button>

                  <button
                    type="button"
                    onClick={clearAllRows}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {formData.price_rows.map((row, index) => (
                    <div key={row.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center text-sm font-medium text-gray-600">
                          {index + 1}
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Weight (kg) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={row.weight_kg}
                              onChange={(e) => updatePriceRow(row.id, 'weight_kg', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm ${
                                row.errors.weight_kg ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {row.errors.weight_kg && (
                              <p className="text-xs text-red-600 mt-1">{row.errors.weight_kg}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Price per kg *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={row.price_per_kg}
                              onChange={(e) =>
                                updatePriceRow(row.id, 'price_per_kg', e.target.value)
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm ${
                                row.errors.price_per_kg ? 'border-red-500' : 'border-gray-300'
                              }`}
                            />
                            {row.errors.price_per_kg && (
                              <p className="text-xs text-red-600 mt-1">{row.errors.price_per_kg}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex gap-1">
                          <button
                            type="button"
                            onClick={() => duplicatePriceRow(row.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => removePriceRow(row.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {row.weight_kg && row.price_per_kg && (
                        <div className="mt-2 pt-2 border-t border-gray-300 text-sm text-gray-600">
                          Line Total:{' '}
                          <span className="font-semibold">
                            {(parseFloat(row.weight_kg) * parseFloat(row.price_per_kg)).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Weight:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {totals.totalWeight.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}{' '}
                  kg
                </span>
              </div>

              <div>
                <span className="text-gray-600">Total Amount Spent:</span>
                <span className="ml-2 font-semibold text-green-700">
                  {totals.totalAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            </div>
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
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
            >
              {submitting ? 'Saving...' : 'Save Collection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
