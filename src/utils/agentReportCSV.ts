export interface CSVAdvance {
  date: string;
  amount: number;
  payment_method: string;
  signed_by: string;
}

export interface CSVCollection {
  date: string;
  driver: string;
  item_weight_kg: number;
  item_price_per_kg: number;
  line_total: number;
  collection_total_weight: number;
  collection_total_amount: number;
}

export interface CSVExpense {
  date: string;
  expense_type: string;
  amount: number;
}

export interface CSVReconciliation {
  month: string;
  total_advance: number;
  total_weight_kg: number;
  total_fruit_spend: number;
  total_expenses: number;
  cash_balance: number;
  status: string;
}

const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const generateAdvancesCSV = (advances: CSVAdvance[]): string => {
  const headers = ['Date', 'Amount (GHS)', 'Payment Method', 'Signed By'];
  const rows = advances.map(adv => [
    adv.date,
    adv.amount.toFixed(2),
    adv.payment_method,
    adv.signed_by || '-'
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return csvContent;
};

export const generateCollectionsCSV = (collections: CSVCollection[]): string => {
  const headers = [
    'Date',
    'Driver',
    'Item Weight (kg)',
    'Item Price (GHS/kg)',
    'Line Total (GHS)',
    'Collection Total Weight (kg)',
    'Collection Total Amount (GHS)'
  ];

  const rows = collections.map(col => [
    col.date,
    col.driver || '-',
    col.item_weight_kg.toFixed(2),
    col.item_price_per_kg.toFixed(2),
    col.line_total.toFixed(2),
    col.collection_total_weight.toFixed(2),
    col.collection_total_amount.toFixed(2)
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return csvContent;
};

export const generateExpensesCSV = (expenses: CSVExpense[]): string => {
  const headers = ['Date', 'Expense Type', 'Amount (GHS)'];
  const rows = expenses.map(exp => [
    exp.date,
    exp.expense_type,
    exp.amount.toFixed(2)
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return csvContent;
};

export const generateReconciliationsCSV = (reconciliations: CSVReconciliation[]): string => {
  const headers = [
    'Month',
    'Total Advance (GHS)',
    'Total Weight (kg)',
    'Total Amount Spent On Fruit (GHS)',
    'Total Expenses (GHS)',
    'Cash Balance (GHS)',
    'Status'
  ];

  const rows = reconciliations.map(recon => [
    recon.month,
    recon.total_advance.toFixed(2),
    recon.total_weight_kg.toFixed(2),
    recon.total_fruit_spend.toFixed(2),
    recon.total_expenses.toFixed(2),
    recon.cash_balance.toFixed(2),
    recon.status
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return csvContent;
};

export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
