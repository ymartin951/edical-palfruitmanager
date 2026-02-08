import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { formatGHS } from './currency';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  agentInfo: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 100,
  },
  infoValue: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#e5e5e5',
    padding: 5,
  },
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 5,
    fontWeight: 'bold',
    borderBottom: '1 solid #000',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottom: '0.5 solid #ddd',
  },
  col1: { width: '25%' },
  col2: { width: '25%' },
  col3: { width: '25%' },
  col4: { width: '25%' },
  colFull: { width: '100%' },
  subtotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
    padding: 5,
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  breakdown: {
    marginLeft: 20,
    padding: 5,
    backgroundColor: '#fafafa',
    fontSize: 9,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  kpiCard: {
    width: '48%',
    margin: '1%',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    border: '1 solid #ddd',
  },
  kpiLabel: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666',
    borderTop: '0.5 solid #ccc',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cashBalanceBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e8f5e9',
    border: '2 solid #4caf50',
    borderRadius: 4,
  },
  cashBalanceLabel: {
    fontSize: 11,
    marginBottom: 5,
  },
  cashBalanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
});

interface Agent {
  full_name: string;
  phone: string | null;
  location: string | null;
  status: string;
}

interface Advance {
  advance_date: string;
  amount: number;
  payment_method: string;
  signed_by: string | null;
}

interface CollectionItem {
  weight_kg: number;
  price_per_kg: number;
  line_total: number;
}

interface Collection {
  collection_date: string;
  driver_name: string | null;
  total_weight_kg: number;
  total_amount_spent: number;
  items?: CollectionItem[];
}

interface Expense {
  expense_date: string;
  expense_type: string;
  amount: number;
}

interface Reconciliation {
  month: string;
  total_advance: number;
  total_weight_kg: number;
  total_fruit_spend: number;
  total_expenses: number;
  cash_balance: number;
  status: string;
}

interface ReportData {
  agent: Agent;
  period: { from: string; to: string } | null;
  advances?: Advance[];
  collections?: Collection[];
  expenses?: Expense[];
  reconciliations?: Reconciliation[];
  lifetimeStats?: {
    totalAdvances: number;
    totalExpenses: number;
    totalFruitSpend: number;
    totalCollections: number;
    cashBalance: number;
  };
  monthStats?: {
    totalAdvances: number;
    totalExpenses: number;
    totalFruitSpend: number;
    totalCollections: number;
    cashBalance: number;
  };
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const OverviewReportPDF: React.FC<{ data: ReportData; logoUrl?: string }> = ({ data, logoUrl }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
        <Text style={styles.reportTitle}>Agent Account Statement</Text>
      </View>

      <View style={styles.agentInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent:</Text>
          <Text style={styles.infoValue}>{data.agent.full_name}</Text>
        </View>
        {data.agent.phone && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{data.agent.phone}</Text>
          </View>
        )}
        {data.agent.location && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location:</Text>
            <Text style={styles.infoValue}>{data.agent.location}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={styles.infoValue}>{data.agent.status}</Text>
        </View>
        {data.period && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Period:</Text>
            <Text style={styles.infoValue}>{formatDate(data.period.from)} - {formatDate(data.period.to)}</Text>
          </View>
        )}
      </View>

      {data.lifetimeStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LIFETIME SUMMARY</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Advances</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.lifetimeStats.totalAdvances)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Expenses</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.lifetimeStats.totalExpenses)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Amount Spent on Fruit</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.lifetimeStats.totalFruitSpend)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Collections</Text>
              <Text style={styles.kpiValue}>{data.lifetimeStats.totalCollections.toFixed(2)} kg</Text>
            </View>
          </View>
          <View style={styles.cashBalanceBox}>
            <Text style={styles.cashBalanceLabel}>CASH BALANCE (LIFETIME)</Text>
            <Text style={styles.cashBalanceValue}>{formatGHS(data.lifetimeStats.cashBalance)}</Text>
          </View>
        </View>
      )}

      {data.monthStats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CURRENT MONTH SUMMARY</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Advances</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.monthStats.totalAdvances)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Expenses</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.monthStats.totalExpenses)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Amount Spent On Fruit</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.monthStats.totalFruitSpend)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Cash Balance</Text>
              <Text style={styles.kpiValue}>{formatGHS(data.monthStats.cashBalance)}</Text>
            </View>
          </View>
        </View>
      )}

      {data.advances && data.advances.length > 0 && (
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>ADVANCES</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Date</Text>
              <Text style={styles.col2}>Amount</Text>
              <Text style={styles.col2}>Method</Text>
              <Text style={styles.col2}>Signed By</Text>
            </View>
            {data.advances.map((adv, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.col1}>{formatDate(adv.advance_date)}</Text>
                <Text style={styles.col2}>{formatGHS(adv.amount)}</Text>
                <Text style={styles.col2}>{adv.payment_method}</Text>
                <Text style={styles.col2}>{adv.signed_by || '-'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.subtotal}>
            <Text>Subtotal: {formatGHS(data.advances.reduce((sum, a) => sum + a.amount, 0))}</Text>
          </View>
        </View>
      )}

      {data.collections && data.collections.length > 0 && (
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>FRUIT COLLECTIONS (WITH BREAKDOWN)</Text>
          {data.collections.map((col, idx) => (
            <View key={idx} style={{ marginBottom: 15 }}>
              <View style={styles.tableRow}>
                <Text style={styles.col1}>{formatDate(col.collection_date)}</Text>
                <Text style={styles.col2}>Driver: {col.driver_name || '-'}</Text>
                <Text style={styles.col2}>Total: {col.total_weight_kg.toFixed(2)}kg</Text>
                <Text style={styles.col2}>{formatGHS(col.total_amount_spent)}</Text>
              </View>
              {col.items && col.items.length > 0 && (
                <View style={styles.breakdown}>
                  {col.items.map((item, itemIdx) => (
                    <Text key={itemIdx}>
                      • {item.weight_kg.toFixed(2)}kg @ {formatGHS(item.price_per_kg)}/kg = {formatGHS(item.line_total)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
          <View style={styles.subtotal}>
            <Text>
              Total Weight: {data.collections.reduce((sum, c) => sum + c.total_weight_kg, 0).toFixed(2)}kg |
              Total Spent: {formatGHS(data.collections.reduce((sum, c) => sum + c.total_amount_spent, 0))}
            </Text>
          </View>
        </View>
      )}

      {data.expenses && data.expenses.length > 0 && (
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>EXPENSES</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Date</Text>
              <Text style={styles.col3}>Expense Type</Text>
              <Text style={styles.col2}>Amount</Text>
            </View>
            {data.expenses.map((exp, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.col1}>{formatDate(exp.expense_date)}</Text>
                <Text style={styles.col3}>{exp.expense_type}</Text>
                <Text style={styles.col2}>{formatGHS(exp.amount)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.subtotal}>
            <Text>Subtotal: {formatGHS(data.expenses.reduce((sum, e) => sum + e.amount, 0))}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>Generated on: {new Date().toLocaleString('en-GB')}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);

export const AdvancesReportPDF: React.FC<{ data: ReportData; logoUrl?: string }> = ({ data, logoUrl }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
        <Text style={styles.reportTitle}>Agent Advances Report</Text>
      </View>

      <View style={styles.agentInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent:</Text>
          <Text style={styles.infoValue}>{data.agent.full_name}</Text>
        </View>
        {data.period && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Period:</Text>
            <Text style={styles.infoValue}>{formatDate(data.period.from)} - {formatDate(data.period.to)}</Text>
          </View>
        )}
      </View>

      {data.advances && data.advances.length > 0 && (
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Date</Text>
              <Text style={styles.col2}>Amount</Text>
              <Text style={styles.col2}>Method</Text>
              <Text style={styles.col2}>Signed By</Text>
            </View>
            {data.advances.map((adv, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.col1}>{formatDate(adv.advance_date)}</Text>
                <Text style={styles.col2}>{formatGHS(adv.amount)}</Text>
                <Text style={styles.col2}>{adv.payment_method}</Text>
                <Text style={styles.col2}>{adv.signed_by || '-'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.subtotal}>
            <Text>Total: {formatGHS(data.advances.reduce((sum, a) => sum + a.amount, 0))}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>Generated on: {new Date().toLocaleString('en-GB')}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);

export const CollectionsReportPDF: React.FC<{ data: ReportData; logoUrl?: string }> = ({ data, logoUrl }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
        <Text style={styles.reportTitle}>Agent Fruit Collections Report</Text>
      </View>

      <View style={styles.agentInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent:</Text>
          <Text style={styles.infoValue}>{data.agent.full_name}</Text>
        </View>
        {data.period && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Period:</Text>
            <Text style={styles.infoValue}>{formatDate(data.period.from)} - {formatDate(data.period.to)}</Text>
          </View>
        )}
      </View>

      {data.collections && data.collections.length > 0 && (
        <View style={styles.section}>
          {data.collections.map((col, idx) => (
            <View key={idx} style={{ marginBottom: 15 }}>
              <View style={styles.tableRow}>
                <Text style={styles.col1}>{formatDate(col.collection_date)}</Text>
                <Text style={styles.col2}>Driver: {col.driver_name || '-'}</Text>
                <Text style={styles.col2}>Total: {col.total_weight_kg.toFixed(2)}kg</Text>
                <Text style={styles.col2}>{formatGHS(col.total_amount_spent)}</Text>
              </View>
              {col.items && col.items.length > 0 && (
                <View style={styles.breakdown}>
                  {col.items.map((item, itemIdx) => (
                    <Text key={itemIdx}>
                      • {item.weight_kg.toFixed(2)}kg @ {formatGHS(item.price_per_kg)}/kg = {formatGHS(item.line_total)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
          <View style={styles.subtotal}>
            <Text>
              Total Weight: {data.collections.reduce((sum, c) => sum + c.total_weight_kg, 0).toFixed(2)}kg |
              Total Spent: {formatGHS(data.collections.reduce((sum, c) => sum + c.total_amount_spent, 0))}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>Generated on: {new Date().toLocaleString('en-GB')}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);

export const ExpensesReportPDF: React.FC<{ data: ReportData; logoUrl?: string }> = ({ data, logoUrl }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
        <Text style={styles.reportTitle}>Agent Expenses Report</Text>
      </View>

      <View style={styles.agentInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Agent:</Text>
          <Text style={styles.infoValue}>{data.agent.full_name}</Text>
        </View>
        {data.period && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Period:</Text>
            <Text style={styles.infoValue}>{formatDate(data.period.from)} - {formatDate(data.period.to)}</Text>
          </View>
        )}
      </View>

      {data.expenses && data.expenses.length > 0 && (
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Date</Text>
              <Text style={styles.col3}>Expense Type</Text>
              <Text style={styles.col2}>Amount</Text>
            </View>
            {data.expenses.map((exp, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.col1}>{formatDate(exp.expense_date)}</Text>
                <Text style={styles.col3}>{exp.expense_type}</Text>
                <Text style={styles.col2}>{formatGHS(exp.amount)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.subtotal}>
            <Text>Total: {formatGHS(data.expenses.reduce((sum, e) => sum + e.amount, 0))}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer} fixed>
        <Text>Generated on: {new Date().toLocaleString('en-GB')}</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);
