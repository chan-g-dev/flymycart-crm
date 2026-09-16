import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { businessDate } from '../utils/businessDates';

export const money = value => value == null ? '—' : '₹ ' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const dateLabel = value => value ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'All time';
export const colors = ['#00b985', '#0755ee', '#ff862f', '#963bef', '#647b99', '#20b7df', '#e94986', '#f2b624'];
export const categories = ['Rent', 'Employee Salary', 'Courier Partner Bill (Monthly)', 'Porter / Local Transport', 'Purchase of Boxes', 'Packing Material', 'Office / Stationery', 'Fuel / Travel', 'Other Small Expenses'];
export function monthRange(previous = false) {
    const [year, month] = businessDate().split('-').map(Number);
    const first = new Date(year, month - 1 - Number(previous), 1);
    const last = new Date(year, month - Number(previous), 0);
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: iso(first), to: iso(last) };
}
export function resolveTab(section) {
    if (!section || ['overview', 'shipment_accounts'].includes(section)) return 'overview';
    if (section === 'prepaid' || section.includes('wallet')) return 'wallets';
    if (section === 'postpaid' || section.startsWith('provider-')) return 'postpaid';
    if (['customer_money', 'account_checks', 'collections'].includes(section)) return 'collections';
    if (section === 'transactions') return 'expenses';
    return section;
}
export function useAccountRequest(method, params, revision) {
    const [result, setResult] = useState(null);
    const encoded = JSON.stringify(params);
    const key = `${method}:${encoded}:${revision}`;
    useEffect(() => {
        let current = true;
        const requestKey = `${method}:${encoded}:${revision}`;
        apiClient[method](JSON.parse(encoded)).then(data => {
            if (current) setResult({ key: requestKey, data, loading: false, error: '' });
        }).catch(error => {
            if (current) setResult({ key: requestKey, data: null, loading: false, error: typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Unable to load accounts. Please retry.' });
        });
        return () => { current = false; };
    }, [method, encoded, revision]);
    return result?.key === key ? result : { data: null, loading: true, error: '' };
}
export function exportRows(rows, name) {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
