import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase, supabaseUntyped } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../lib/database.types';
import { Plus, Apple, Calendar, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { PageContext } from '../App';
import { formatGHS } from '../utils/currency';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { deleteCollection } from '../services/deleteService';

type Agent = Database['public']['Tables']['agents']['Row'];

type FruitCollectionRow = Database['public']['Tables']['fruit_collections']['Row'] & {
  agents?: { full_name: string };
};

type FruitCollectionItem = {
  id?: string;
  collection_id?: string;
  weight_kg?: number | string | null;
  price_per_kg?: number | string | null;
  line_total?: number | string | null;
  created_at?: string;
};

type FruitCollection = FruitCollectionRow & {
  items: FruitCollectionItem[];
};

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function FruitCollections() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { setCurrentPage } = useContext(PageContext);
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const { showToast } = useToast();
  const isAdmin = userRole?.role === 'ADMIN';

  const [collections, setCollections] = useState<FruitCollection[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [deletingCollection, setDeletingCollection] = useState<FruitCollection | null>(null);

  useEffect(() => {
    setCurrentPage?.('fruit-collections');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from) setDateFrom(from);
    if (to) setDateTo(to);
  }, [searchParams]);

  useEffect(() => {
    loadData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [collectionsRes, agentsRes] = await Promise.all([
        supabase.from('fruit_collections').select('*, agents(full_name)').order('collection_date', { ascending: false }),
        supabase.from('agents').select('*').order('full_name'),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (agentsRes.error) throw agentsRes.error;

      const baseCollections = ((collectionsRes.data || []) as FruitCollectionRow[]).map((c) => ({
        ...c,
        items: [] as FruitCollectionItem[],
      }));

      const ids = baseCollections.map((c) => c.id).filter(Boolean);

      let items: FruitCollectionItem[] = [];
      if (ids.length > 0) {
        // untyped because database.types.ts may not include fruit_collection_items
        const itemsRes = await supabaseUntyped
          .from('fruit_collection_items')
          .select('*')
          .in('collection_id', ids)
          .order('created_at', { ascending: true });

        if (itemsRes.error) throw itemsRes.error;
        items = (itemsRes.data || []) as FruitCollectionItem[];
      }

      const byCollection: Record<string, FruitCollectionItem[]> = {};
      for (const it of items) {
        const cid = String(it.collection_id || '');
        if (!cid) continue;
        (byCollection[cid] ||= []).push(it);
      }

      const merged: FruitCollection[] = baseCollections.map((c) => ({
        ...(c as FruitCollectionRow),
        items: byCollection[String(c.id)] || [],
      }));

      setCollections(merged);
      setAgents((agentsRes.data || []) as Agent[]);

      // If you later allow AGENT role again, keep this filter behavior safe:
      const agentIdMaybe = (userRole as any)?.agentId as string | undefined;
      if (!isAdmin && agentIdMaybe) {
        setSelectedAgent(agentIdMaybe);
      }
    } catch (error: any) {
      showToast(error?.message || 'Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredCollections = useMemo(() => {
    return collections.filter((collection) => {
      if (selectedAgent && collection.agent_id !== selectedAgent) return false;
      if (dateFrom && collection.collection_date < dateFrom) return false;
      if (dateTo && collection.collection_date > dateTo) return false;
      return true;
    });
  }, [collections, selectedAgent, dateFrom, dateTo]);

  const openAddForm = () => navigate('/fruit-collections/new');

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const clearFilters = () => {
    setSelectedAgent('');
    setDateFrom('');
    setDateTo('');
  };

  const toggleRow = (id: string) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const collectionTotalSpent = (c: FruitCollection) =>
    (c.items || []).reduce((sum, it) => sum + toNumber(it.line_total), 0);

  const handleDeleteConfirm = async () => {
    if (!deletingCollection) return;
    try {
      await deleteCollection(deletingCollection.id);
      showToast('Collection deleted successfully', 'success');
      setDeletingCollection(null);
      await loadData();
    } catch (error: any) {
      showToast(error?.message || 'Error deleting collection', 'error');
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Fruit Collections</h1>
          <p className="text-gray-600 mt-2">{isAdmin ? 'Track palm fruit collections from agents' : 'Track your fruit collections'}</p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Add Collection
        </button>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {(dateFrom || dateTo || selectedAgent) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {dateFrom && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <span>From: {dateFrom}</span>
                  <button onClick={() => setDateFrom('')} className="hover:bg-green-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {dateTo && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <span>To: {dateTo}</span>
                  <button onClick={() => setDateTo('')} className="hover:bg-green-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {selectedAgent && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <span>Agent: {agents.find((a) => a.id === selectedAgent)?.full_name || 'Unknown'}</span>
                  <button onClick={() => setSelectedAgent('')} className="hover:bg-green-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Weight / Price</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount Spent</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Driver</th>
                {isAdmin && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filteredCollections.map((collection) => (
                <React.Fragment key={collection.id}>
                  <tr className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-green-700 font-semibold text-sm">
                            {collection.agents?.full_name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800">{collection.agents?.full_name || 'Unknown'}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{formatDate(collection.collection_date)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {collection.items && collection.items.length > 0 ? (
                          collection.items.length === 1 ? (
                            <div className="text-sm">
                              <span className="font-semibold">{toNumber(collection.items[0].weight_kg).toFixed(2)}kg</span>
                              {' @ '}
                              <span className="text-green-700">{formatGHS(toNumber(collection.items[0].price_per_kg))}/kg</span>
                            </div>
                          ) : (
                            <>
                              {collection.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-semibold">{toNumber(item.weight_kg).toFixed(2)}kg</span>
                                  {' @ '}
                                  <span className="text-green-700">{formatGHS(toNumber(item.price_per_kg))}/kg</span>
                                </div>
                              ))}

                              {collection.items.length > 2 && (
                                <button
                                  onClick={() => toggleRow(collection.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  {expandedRows[collection.id] ? (
                                    <>
                                      <ChevronUp className="w-3 h-3" />
                                      Hide
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      +{collection.items.length - 2} more
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )
                        ) : (
                          <span className="text-sm text-gray-400">No breakdown</span>
                        )}

                        <div className="text-xs text-gray-500 border-t pt-1 mt-1">
                          <strong>Total:</strong> {toNumber(collection.weight_kg).toFixed(2)}kg
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-green-700">{formatGHS(collectionTotalSpent(collection))}</span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{collection.driver_name || '-'}</span>
                    </td>

                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2" style={{ pointerEvents: 'auto', zIndex: 10 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/fruit-collections/${collection.id}/edit`);
                            }}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCollection(collection);
                            }}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>

                  {expandedRows[collection.id] && collection.items && collection.items.length > 2 && (
                    <tr className="bg-gray-50">
                      <td colSpan={isAdmin ? 6 : 5} className="px-6 py-3">
                        <div className="ml-12 space-y-1">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Full Breakdown:</p>
                          {collection.items.map((item, idx) => (
                            <div key={idx} className="text-sm text-gray-700">
                              {idx + 1}. <span className="font-semibold">{toNumber(item.weight_kg).toFixed(2)}kg</span>
                              {' @ '}
                              <span className="text-green-700">{formatGHS(toNumber(item.price_per_kg))}/kg</span>
                              {' = '}
                              <span className="font-semibold">{formatGHS(toNumber(item.line_total))}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCollections.length === 0 && (
          <div className="text-center py-12">
            <Apple className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No fruit collections recorded</p>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!deletingCollection}
        title="Delete Fruit Collection"
        description={`Are you sure you want to delete this collection from ${
          deletingCollection ? formatDate(deletingCollection.collection_date) : ''
        }? This will also delete all associated weight/price breakdown items. This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCollection(null)}
      />
    </div>
  );
}
