import * as XLSX from 'xlsx';

/**
 * Clean cell values and prevent formula injection
 */
function sanitizeCell(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return val;
    const str = String(val);
    if (/^[=+@-]/.test(str)) {
        return "'" + str;
    }
    return val;
}

/**
 * Export data to authentic Microsoft Excel (.xlsx) file
 * @param {Array<string>} headers - Column header names
 * @param {Array<Array<any>>} rows - 2D array of data rows
 * @param {string} filename - Output filename (e.g. 'Customers_Export.xlsx')
 * @param {string} [sheetName='Data'] - Name of the worksheet
 */
export function exportToExcel(headers, rows, filename, sheetName = 'Report') {
    try {
        const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.csv$/, '')}.xlsx`;
        
        // Prepare rows with sanitized values
        const data = [
            headers,
            ...rows.map(row => row.map(cell => sanitizeCell(cell)))
        ];

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Auto-fit column widths based on max content length
        const colWidths = headers.map((header, colIndex) => {
            let maxLen = String(header || '').length;
            for (let i = 0; i < rows.length; i++) {
                const cellVal = rows[i]?.[colIndex];
                if (cellVal !== undefined && cellVal !== null) {
                    maxLen = Math.max(maxLen, String(cellVal).length);
                }
            }
            return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
        });
        ws['!cols'] = colWidths;

        // Create workbook and append sheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

        // Trigger native download
        XLSX.writeFile(wb, cleanFilename, { compression: true });
    } catch (err) {
        console.error('Failed to export Excel file, falling back to CSV:', err);
        exportToCSVFallback(headers, rows, filename.replace(/\.xlsx$/, '.csv'));
    }
}

/**
 * Fallback CSV export with UTF-8 BOM
 */
export function exportToCSVFallback(headers, rows, filename) {
    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    const formatCell = v => '"' + String(sanitizeCell(v)).replaceAll('"', '""') + '"';
    const csvContent = [
        headers.map(formatCell).join(','),
        ...rows.map(r => r.map(formatCell).join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
