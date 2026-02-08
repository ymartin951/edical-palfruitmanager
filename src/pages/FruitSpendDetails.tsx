import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Database } from '../lib/database.types';
import { Download, FileText, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';
import { generateFruitSpendPDF } from '../utils/pdfExport';

type FruitCollection = Database['public']['Tables']['fruit_collections']['Row'] & {
  agents?: { full_name: string };
  fruit_pricing?: Array<{
    weight_kg: number;
    price_per_kg: number;
  }>;
};

export function FruitSpendDetails() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<FruitCollection[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const { showToast } = useToast();

  const preset = searchParams.get('preset');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let dateFrom: string;
  let dateTo: string;
  let displayDateRange: string;

  if (preset === 'this_month') {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    dateFrom = firstDay.toISOString().split('T')[0];
    dateTo = lastDay.toISOString().split('T')[0];
    displayDateRange = `${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } else {
    dateFrom = fromParam || '';
    dateTo = toParam || '';
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    displayDateRange = `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);

      const collectionsRes = await supabase
        .from('fruit_collections')
        .select('*, agents(full_name)')
        .gte('collection_date', dateFrom)
        .lte('collection_date', dateTo)
        .order('collection_date', { ascending: false });

      if (collectionsRes.error) throw collectionsRes.error;

      const collectionsData = collectionsRes.data || [];

      for (const collection of collectionsData) {
        if (collection.has_price_breakdown) {
          const pricingRes = await supabase
            .from('fruit_pricing')
            .select('weight_kg, price_per_kg')
            .eq('collection_id', collection.id);

          if (!pricingRes.error && pricingRes.data) {
            collection.fruit_pricing = pricingRes.data;
          }
        }
      }

      setCollections(collectionsData);

      const total = collectionsData.reduce((sum, c) => sum + Number(c.total_amount_spent || 0), 0);
      setTotalAmount(total);
    } catch (error: any) {
      showToast(error.message || 'Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCSV = () => {
    const collectionsCSV = collections.map(c => ({
      Date: new Date(c.collection_date).toLocaleDateString(),
      Agent: c.agents?.full_name || 'N/A',
      'Total Weight (kg)': Number(c.total_weight_kg).toFixed(2),
      'Amount Spent': `GH₵ ${Number(c.total_amount_spent || 0).toFixed(2)}`,
      'Has Breakdown': c.has_price_breakdown ? 'Yes' : 'No',
    }));

    exportToCsv(collectionsCSV, `fruit_spend_${dateFrom}_${dateTo}.csv`);
    showToast('CSV exported successfully', 'success');
  };

  const handleDownloadPDF = async () => {
    try {
      await generateFruitSpendPDF({
        dateRange: displayDateRange,
        totalAmount,
        collections,
      });
      showToast('PDF downloaded successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error generating PDF', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Amount Spent on Fruit Details</h1>
            <p className="text-gray-600 mt-1">{displayDateRange}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-600 mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-2">Total Amount Spent on Fruit</h3>
        <p className="text-3xl font-bold text-gray-900">GH₵ {totalAmount.toFixed(2)}</p>
        <p className="text-sm text-gray-600 mt-2">{collections.length} collections in this period</p>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Fruit Collections</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Weight</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount Spent</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {collections.map((collection) => (
                <>
                  <tr key={collection.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(collection.collection_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{collection.agents?.full_name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {Number(collection.total_weight_kg).toFixed(2)} kg
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      GH₵ {Number(collection.total_amount_spent || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {collection.has_price_breakdown && collection.fruit_pricing ? (
                        <button
                          onClick={() => toggleRow(collection.id)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          {expandedRows[collection.id] ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Hide Breakdown
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              View Breakdown
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-500">Same price</span>
                      )}
                    </td>
                  </tr>
                  {expandedRows[collection.id] && collection.fruit_pricing && (
                    <tr key={`${collection.id}-breakdown`}>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50">
                        <div className="ml-8">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Price Breakdown:</h4>
                          <table className="w-full max-w-md">
                            <thead>
                              <tr className="text-xs text-gray-600">
                                <th className="text-left pb-2">Weight (kg)</th>
                                <th className="text-left pb-2">Price per kg</th>
                                <th className="text-left pb-2">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm">
                              {collection.fruit_pricing.map((pricing, idx) => (
                                <tr key={idx} className="border-t border-gray-200">
                                  <td className="py-1">{Number(pricing.weight_kg).toFixed(2)} kg</td>
                                  <td className="py-1">GH₵ {Number(pricing.price_per_kg).toFixed(2)}</td>
                                  <td className="py-1 font-semibold">
                                    GH₵ {(Number(pricing.weight_kg) * Number(pricing.price_per_kg)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900">Total</td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                  GH₵ {totalAmount.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          {collections.length === 0 && (
            <div className="text-center py-8 text-gray-600">No collections in this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
