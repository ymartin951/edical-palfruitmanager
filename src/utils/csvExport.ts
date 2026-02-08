export const escapeCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);

  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export const downloadCSV = (data: any[], headers: string[], filename: string) => {
  const csvRows = [];

  csvRows.push(headers.map(escapeCSVValue).join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header.toLowerCase().replace(/ /g, '_')];
      return escapeCSVValue(value);
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToCsv = (data: any[], filename: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.map(escapeCSVValue).join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return escapeCSVValue(value);
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
