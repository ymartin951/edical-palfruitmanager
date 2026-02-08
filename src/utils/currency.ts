export const formatGHS = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) return 'GHS 0.00';

  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatGHSCompact = (amount: number | string): string => {
  const formatted = formatGHS(amount);
  return formatted.replace('GH₵', 'GHS');
};
