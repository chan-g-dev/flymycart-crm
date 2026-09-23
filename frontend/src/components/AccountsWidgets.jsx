import { LoadingSpinner } from './LoadingSpinner';
import ChartVisualization, { ChartTypeSelect } from './ChartVisualization';
import PaymentDetailsSummary from './PaymentDetailsSummary';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { apiClient } from '../api/client';
import { money, dateLabel, colors, useAccountRequest } from './accountsHelpers';

export function Breakdown({ title, data, label, onDetails, initialType = 'donut', horizontalView }) {
    const [chartType, setChartType] = useState(initialType);
    const entries = Object.entries(data || {}).filter(([, value]) => Number(value) > 0);
    const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
    let offset = 0;
    const gradient = entries.map(([, value], index) => {
        const start = offset;
        offset += Number(value) / total * 100;
        return `${colors[index % colors.length]} ${start}% ${offset}%`;
    }).join(',');
    return <section className="ao-panel ao-chart-panel">
        <header><h3>{title}</h3><div className="ao-chart-controls">
            <button type="button" onClick={onDetails}>View details &rarr;</button>
            <ChartTypeSelect title={title} value={chartType} onChange={setChartType} options={[[ 'donut', 'Donut' ], [ 'bar', 'Bar' ], [ 'horizontal', 'Horizontal bar' ], [ 'dot', 'Dot' ]]} />
        </div></header>
        {chartType === 'donut' ? (
        <div className="ao-breakdown">
            <div className="ao-donut" style={{ background: total ? `conic-gradient(${gradient})` : 'var(--ao-line)' }}><div><strong>{data == null ? '—' : money(total)}</strong><small>{label}</small></div></div>
            <div className="ao-legend">{entries.map(([name, value], index) => <div key={name}><i style={{ background: colors[index % colors.length] }} /><span>{name}</span><em>{Math.round(value / total * 100)}%</em><strong>{money(value)}</strong></div>)}
                {!entries.length && <p className="ao-muted">{data == null ? 'Financial access required' : 'No transactions in this period.'}</p>}
            </div>
        </div>
        ) : <div className="ao-chart-alternative">
            <p className="ao-chart-total">{label}: <strong>{data == null ? '\u2014' : money(total)}</strong></p>
            {!entries.length ? <p className="ao-empty">{data == null ? 'Financial access required' : 'No transactions in this period.'}</p>
                : chartType === 'horizontal' && horizontalView ? horizontalView
                : <div className={`ao-chart-canvas ${chartType === 'bar' ? 'ao-chart-canvas-bars' : ''}`} style={chartType === 'bar' ? { '--chart-width': `${Math.max(360, entries.length * 130)}px` } : undefined}>
                    <ChartVisualization title={title} type={chartType} data={entries.map(([name, value], index) => ({ label: name, value: Number(value), color: colors[index % colors.length] }))} formatValue={money} />
                </div>}
        </div>}
    </section>;
}
export function Pager({ page, count, size = 5, onChange }) {
    const pages = Math.max(1, Math.ceil(count / size));
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    return <div className="ao-pagination">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={13} /></button>
        {Array.from({ length: Math.min(5, pages) }, (_, index) => start + index).map(value => <button key={value} aria-label={`Page ${value}`} aria-current={page === value ? 'page' : undefined} className={page === value ? 'active' : ''} onClick={() => onChange(value)}>{value}</button>)}
        {start + 4 < pages && <><span>…</span><button onClick={() => onChange(pages)}>{pages}</button></>}
        <button aria-label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={13} /></button>
    </div>;
}
export function EntryLedger({ params, revision, kind, onRefresh }) {
    const [page, setPage] = useState(1);
    const [notice, setNotice] = useState('');
    const request = useAccountRequest('getAccountingEntries', { ...params, kind, limit: 20, offset: (page - 1) * 20 }, revision);
    const items = request.data?.items || [];
    const download = async row => {
        try {
            const blob = await apiClient.downloadExpenseBill(row.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = row.bill_name; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { setNotice('Unable to download bill. Please retry.'); }
    };
    return <section className="ao-panel ao-entry-ledger">
        <header><h3>{kind === 'transfer' ? 'Account Transfers' : 'Expense Ledger'}</h3></header>
        <p className="ao-note">{kind === 'transfer' ? 'Use Add Transaction to record a transfer. Transfers move funds between accounts and do not change sales or expenses.' : 'Operating expenses for the selected period. Use Expense Entry to add an expense.'}</p>
        {request.error && <p role="alert">{request.error} <button onClick={onRefresh}>Retry</button></p>}{notice && <p role="status">{notice}</p>}
        <div className="ao-table-scroll"><table className="ao-table"><thead><tr>
            {(kind === 'transfer' ? ['Date', 'From Account', 'To Account', 'Amount', 'Payment Mode', 'Reference'] : ['Date', 'Category', 'Vendor / Person', 'Paid From', 'Amount', 'Payment Mode', 'Remarks', 'Bill']).map(name => <th key={name}>{name}</th>)}
        </tr></thead><tbody>{items.map(row => <tr key={row.id}><td>{dateLabel(row.date)}</td>
            {kind === 'transfer' ? <><td>{row.account}</td><td>{row.transfer_to}</td><td>{money(row.amount)}</td><td>{row.payment_mode || '—'}</td><td>{row.reference}<PaymentDetailsSummary details={row.payment_details} /></td></> : <><td>{row.category || 'General'}</td><td>{row.vendor || '—'}</td><td>{row.account}</td><td>{money(row.amount)}</td><td>{row.payment_mode || '—'}</td><td>{row.reference}<PaymentDetailsSummary details={row.payment_details} /></td><td>{row.bill_name ? <button onClick={() => download(row)}><Download size={13} /> Bill</button> : '—'}</td></>}
        </tr>)}{!items.length && <tr><td colSpan={8} className="ao-empty">{request.loading ? <LoadingSpinner inline text="Loading transactions…" /> : 'No transactions in this period.'}</td></tr>}</tbody></table></div>
        <footer><span>{request.data?.total_count || 0} transactions</span><Pager page={page} count={request.data?.total_count || 0} size={20} onChange={setPage} /></footer>
    </section>;
}
