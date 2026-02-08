import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#16a34a',
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subTitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 3,
  },
  summarySection: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontWeight: 'bold',
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#16a34a',
    color: '#fff',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 8,
  },
  tableCell: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
});

interface AdvancesReportData {
  date: string;
  agent_name: string;
  amount: number;
  payment_method: string;
  signed_by: string;
}

interface CollectionsReportData {
  date: string;
  agent_name: string;
  weight_kg: number;
  driver: string;
}

interface ReconciliationReportData {
  month: string;
  agent_name: string;
  total_advance: number;
  total_weight_kg: number;
  status: string;
}

export const generateAdvancesPDF = async (
  data: AdvancesReportData[],
  dateFrom: string,
  dateTo: string,
  agentName?: string
) => {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  const MyDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
          <Text style={styles.reportTitle}>Cash Advances Report</Text>
          <Text style={styles.subTitle}>
            Period: {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
          </Text>
          {agentName && <Text style={styles.subTitle}>Agent: {agentName}</Text>}
          <Text style={styles.subTitle}>Generated on: {new Date().toLocaleString()}</Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Records:</Text>
            <Text>{data.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount:</Text>
            <Text>GH₵ {totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Amount</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Method</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Signed By</Text>
          </View>
          {data.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.agent_name}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                GH₵ {item.amount.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.payment_method}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.signed_by || '-'}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Edical Palm Fruit Company LTD - Confidential Report
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(MyDocument).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edical-advances-${dateFrom}-${dateTo}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export const generateCollectionsPDF = async (
  data: CollectionsReportData[],
  dateFrom: string,
  dateTo: string,
  agentName?: string
) => {
  const totalWeight = data.reduce((sum, item) => sum + item.weight_kg, 0);

  const MyDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
          <Text style={styles.reportTitle}>Fruit Collections Report</Text>
          <Text style={styles.subTitle}>
            Period: {new Date(dateFrom).toLocaleDateString()} - {new Date(dateTo).toLocaleDateString()}
          </Text>
          {agentName && <Text style={styles.subTitle}>Agent: {agentName}</Text>}
          <Text style={styles.subTitle}>Generated on: {new Date().toLocaleString()}</Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Records:</Text>
            <Text>{data.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Weight:</Text>
            <Text>{totalWeight.toFixed(2)} kg</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Weight (kg)</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Driver</Text>
          </View>
          {data.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.agent_name}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {item.weight_kg.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.driver || '-'}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Edical Palm Fruit Company LTD - Confidential Report
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(MyDocument).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edical-collections-${dateFrom}-${dateTo}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export const generateReconciliationPDF = async (
  data: ReconciliationReportData[],
  month: string,
  agentName?: string
) => {
  const totalAdvances = data.reduce((sum, item) => sum + item.total_advance, 0);
  const totalWeight = data.reduce((sum, item) => sum + item.total_weight_kg, 0);

  const MyDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
          <Text style={styles.reportTitle}>Monthly Reconciliation Statement</Text>
          <Text style={styles.subTitle}>
            Month: {new Date(month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </Text>
          {agentName && <Text style={styles.subTitle}>Agent: {agentName}</Text>}
          <Text style={styles.subTitle}>Generated on: {new Date().toLocaleString()}</Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Agents:</Text>
            <Text>{data.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Advances:</Text>
            <Text>GH₵ {totalAdvances.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Weight Collected:</Text>
            <Text>{totalWeight.toFixed(2)} kg</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Advances</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Weight (kg)</Text>
            <Text style={[styles.tableCell, { flex: 1.2 }]}>Status</Text>
          </View>
          {data.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.agent_name}</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                GH₵ {item.total_advance.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>
                {item.total_weight_kg.toFixed(2)}
              </Text>
              <Text style={[styles.tableCell, { flex: 1.2 }]}>{item.status}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Edical Palm Fruit Company LTD - Confidential Report
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(MyDocument).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edical-reconciliation-${month}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

interface CashBalanceData {
  dateRange: string;
  summary: {
    totalAdvances: number;
    totalExpenses: number;
    totalFruitSpend: number;
    cashBalance: number;
  };
  advances: Array<{
    advance_date: string;
    agents?: { full_name: string };
    amount: number;
    payment_method?: string;
    signed_by?: string;
  }>;
  expenses: Array<{
    expense_date: string;
    agents?: { full_name: string };
    expense_type: string;
    amount: number;
  }>;
  collections: Array<{
    collection_date: string;
    agents?: { full_name: string };
    total_weight_kg: number;
    total_amount_spent: number;
  }>;
}

export const generateCashBalancePDF = async (data: CashBalanceData) => {
  const MyDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
          <Text style={styles.reportTitle}>Cash Balance Details Report</Text>
          <Text style={styles.subTitle}>Period: {data.dateRange}</Text>
          <Text style={styles.subTitle}>Generated on: {new Date().toLocaleString()}</Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Advances:</Text>
            <Text>GH₵ {data.summary.totalAdvances.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Expenses:</Text>
            <Text>GH₵ {data.summary.totalExpenses.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount Spent on Fruit:</Text>
            <Text>GH₵ {data.summary.totalFruitSpend.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5, marginTop: 5 }]}>
            <Text style={[styles.summaryLabel, { fontSize: 12 }]}>Cash Balance:</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>GH₵ {data.summary.cashBalance.toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>Advances ({data.advances.length} items)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Amount</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Method</Text>
            </View>
            {data.advances.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>
                  {new Date(item.advance_date).toLocaleDateString()}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{item.agents?.full_name || 'N/A'}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>GH₵ {Number(item.amount).toFixed(2)}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.payment_method || 'N/A'}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>Expenses ({data.expenses.length} items)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Type</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Amount</Text>
            </View>
            {data.expenses.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>
                  {new Date(item.expense_date).toLocaleDateString()}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{item.agents?.full_name || 'N/A'}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.expense_type}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>GH₵ {Number(item.amount).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>Amount Spent On Fruit ({data.collections.length} items)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Weight</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Amount</Text>
            </View>
            {data.collections.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>
                  {new Date(item.collection_date).toLocaleDateString()}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{item.agents?.full_name || 'N/A'}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{Number(item.total_weight_kg).toFixed(2)} kg</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>GH₵ {Number(item.total_amount_spent || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          Edical Palm Fruit Company LTD - Confidential Report
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(MyDocument).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edical-cash-balance-details.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

interface FruitSpendData {
  dateRange: string;
  totalAmount: number;
  collections: Array<{
    collection_date: string;
    agents?: { full_name: string };
    total_weight_kg: number;
    total_amount_spent: number;
    has_price_breakdown: boolean;
  }>;
}

export const generateFruitSpendPDF = async (data: FruitSpendData) => {
  const MyDocument = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>Edical Palm Fruit Company LTD</Text>
          <Text style={styles.reportTitle}>Amount Spent on Fruit Details</Text>
          <Text style={styles.subTitle}>Period: {data.dateRange}</Text>
          <Text style={styles.subTitle}>Generated on: {new Date().toLocaleString()}</Text>
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Collections:</Text>
            <Text>{data.collections.length}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5, marginTop: 5 }]}>
            <Text style={[styles.summaryLabel, { fontSize: 12 }]}>Total Amount Spent:</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>GH₵ {data.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 10 }}>Fruit Collections</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Date</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>Agent</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Weight</Text>
              <Text style={[styles.tableCell, { flex: 1.5 }]}>Amount</Text>
            </View>
            {data.collections.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>
                  {new Date(item.collection_date).toLocaleDateString()}
                </Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{item.agents?.full_name || 'N/A'}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{Number(item.total_weight_kg).toFixed(2)} kg</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>GH₵ {Number(item.total_amount_spent || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          Edical Palm Fruit Company LTD - Confidential Report
        </Text>
      </Page>
    </Document>
  );

  const blob = await pdf(MyDocument).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edical-fruit-spend-details.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
