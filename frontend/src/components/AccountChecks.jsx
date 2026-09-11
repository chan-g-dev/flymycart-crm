import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

const today = () => new Date().toLocaleDateString('en-CA');
const currency = value => Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const errorText = error => typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Unable to load or save the account details. Please try again.';

function useAccountData(loader, params, revision) {
    const encoded = JSON.stringify(params);
    const key = `${encoded}:${revision}`;
    const [result, setResult] = useState(null);
    useEffect(() => {
        let current = true;
        const requestKey = `${encoded}:${revision}`;
        loader(JSON.parse(encoded)).then(data => {
            if (current) setResult({ key: requestKey, data });
        }).catch(error => {
            if (current) setResult({ key: requestKey, error: errorText(error) });
        });
        return () => { current = false; };
    }, [loader, encoded, revision]);
    return result?.key === key ? result : {};
}

export default function AccountChecks() {
    const { hasPermission } = useAuth();
    const [options, setOptions] = useState({ accounts: [], centers: [], all_centers_allowed: false });
    const [filters, setFilters] = useState({ date_from: today().slice(0, 7) + '-01', date_to: today(), account: '', center: '' });
    const [query, setQuery] = useState(filters);
    const [receiptPage, setReceiptPage] = useState(0);
    const [historyPage, setHistoryPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [form, setForm] = useState({ date: today(), account: '', center: '', counted_amount: '', notes: '' });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const receiptResult = useAccountData(apiClient.getAccountReceipts, { ...query, limit: 50, offset: receiptPage * 50 }, revision);
    const historyResult = useAccountData(apiClient.getAccountChecks, { limit: 20, offset: historyPage * 20 }, revision);
    const receipts = receiptResult.data;
    const history = historyResult.data;

    useEffect(() => {
        let current = true;
        apiClient.getAccountCheckOptions().then(data => { if (current) setOptions(data); }).catch(err => { if (current) setError(errorText(err)); });
        return () => { current = false; };
    }, []);

    const submit = async event => {
        event.preventDefault();
        setSaving(true); setError(''); setMessage('');
        try {
            const saved = await apiClient.recordAccountCheck({ ...form, center: form.center || null });
            setMessage(`Check saved. Recorded receipts: ${currency(saved.expected_amount)}. Counted: ${currency(saved.counted_amount)}. ${saved.difference === 0 ? 'Matched.' : `${saved.difference < 0 ? 'Shortage' : 'Overage'}: ${currency(Math.abs(saved.difference))}.`}`);
            setForm(previous => ({ ...previous, counted_amount: '', notes: '' }));
            setHistoryPage(0); setRevision(value => value + 1);
        } catch (err) { setError(errorText(err)); }
        finally { setSaving(false); }
    };
    return <section id="account-checks" className="account-nav-target account-checks">
        <div className="dash-box">
            <h3>Receipt ledger</h3>
            <p>Review customer receipts by payment date, destination account and center.</p>
            <form className="form-grid" onSubmit={event => { event.preventDefault(); setError(''); setReceiptPage(0); setQuery({ ...filters }); }}>
                <div className="form-group"><label htmlFor="receipt-from">From</label><input id="receipt-from" required type="date" value={filters.date_from} max={filters.date_to} onChange={e => setFilters({ ...filters, date_from: e.target.value })} /></div>
                <div className="form-group"><label htmlFor="receipt-to">To</label><input id="receipt-to" required type="date" min={filters.date_from} value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} /></div>
                <div className="form-group"><label htmlFor="receipt-account">Payment account</label><select id="receipt-account" value={filters.account} onChange={e => setFilters({ ...filters, account: e.target.value })}><option value="">All payment accounts</option>{options.accounts.map(a => <option key={a}>{a}</option>)}</select></div>
                <div className="form-group"><label htmlFor="receipt-center">Center</label><select id="receipt-center" value={filters.center} onChange={e => setFilters({ ...filters, center: e.target.value })}><option value="">All accessible centers</option>{options.centers.map(c => <option key={c}>{c}</option>)}</select></div>
                <button className="btn btn-outline" type="submit">View receipts</button>
            </form>
            {receipts && <p><strong>{receipts.total_count} receipts · {currency(receipts.total_amount)}</strong> across the selected filters</p>}
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>AWB</th><th>Customer</th><th>Amount</th><th>Method</th><th>Paid to</th><th>Collected by</th><th>Reference</th></tr></thead><tbody>
                {receiptResult.error ? <tr><td colSpan="8" role="alert">{receiptResult.error} <button className="btn btn-sm btn-outline" onClick={() => setRevision(value => value + 1)}>Retry</button></td></tr> : !receipts ? <tr><td colSpan="8">Loading receipts…</td></tr> : receipts.items.length === 0 ? <tr><td colSpan="8">No receipts in this period.</td></tr> : receipts.items.map(r => <tr key={r.id}><td>{r.date}</td><td>{r.awb || '—'}</td><td>{r.customer || '—'}</td><td>{currency(r.amount)}</td><td>{r.payment_method}</td><td>{r.paid_to}</td><td>{r.collected_by}</td><td>{r.reference || '—'}</td></tr>)}
            </tbody></table></div>
            <div className="account-check-pagination"><button className="btn btn-sm btn-outline" disabled={!receiptPage} onClick={() => setReceiptPage(p => p - 1)}>Previous</button><span>Page {receiptPage + 1}</span><button className="btn btn-sm btn-outline" disabled={!receipts || (receiptPage + 1) * 50 >= receipts.total_count} onClick={() => setReceiptPage(p => p + 1)}>Next</button></div>
        </div>
        <div className="dash-box">
            <h3>Account checks</h3>
            <p>Compare a day's recorded customer receipts with the amount actually counted or verified on a statement. This checks receipts, not the account's closing balance.</p>
            {hasPermission('accounts.edit') && <form onSubmit={submit}>
                <fieldset disabled={saving} className="account-check-fieldset"><div className="form-grid">
                    <div className="form-group"><label htmlFor="check-account">Payment account</label><input id="check-account" list="check-account-options" maxLength="100" required value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} /><datalist id="check-account-options">{options.accounts.map(a => <option key={a} value={a} />)}</datalist></div>
                    <div className="form-group"><label htmlFor="check-center">Center</label><select id="check-center" required={!options.all_centers_allowed} value={form.center} onChange={e => setForm({ ...form, center: e.target.value })}><option value="">{options.all_centers_allowed ? 'All centers' : 'Select center'}</option>{options.centers.map(c => <option key={c}>{c}</option>)}</select></div>
                    <div className="form-group"><label htmlFor="check-date">Receipt date</label><input id="check-date" required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                    <div className="form-group"><label htmlFor="check-counted">Amount actually counted (₹)</label><input id="check-counted" required type="number" min="0" step="0.01" value={form.counted_amount} onChange={e => setForm({ ...form, counted_amount: e.target.value })} /></div>
                    <div className="form-group"><label htmlFor="check-notes">Notes / statement reference</label><textarea id="check-notes" maxLength="1000" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                </div><button className="btn btn-primary-blue" type="submit">{saving ? 'Recording…' : 'Record account check'}</button></fieldset>
            </form>}
            {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
            <p>History preserves the receipt total at the time of each check. Later receipts require a new check.</p>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Receipt date</th><th>Account / center</th><th>Receipts</th><th>Recorded</th><th>Counted</th><th>Result</th><th>Checked by</th><th>Notes</th></tr></thead><tbody>
                {historyResult.error ? <tr><td colSpan="8" role="alert">{historyResult.error} <button className="btn btn-sm btn-outline" onClick={() => setRevision(value => value + 1)}>Retry</button></td></tr> : !history ? <tr><td colSpan="8">Loading checks…</td></tr> : history.items.length === 0 ? <tr><td colSpan="8">No account checks recorded.</td></tr> : history.items.map(c => <tr key={c.id}><td>{c.date}</td><td>{c.account}<br /><small>{c.center || 'All centers'}</small></td><td>{c.receipt_count}</td><td>{currency(c.expected_amount)}</td><td>{currency(c.counted_amount)}</td><td>{c.difference === 0 ? 'Matched' : `${c.difference < 0 ? 'Shortage' : 'Overage'} ${currency(Math.abs(c.difference))}`}</td><td>{c.checked_by}<br /><small>{c.created_at ? new Date(c.created_at + (c.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN') : ''}</small></td><td>{c.notes || '—'}</td></tr>)}
            </tbody></table></div>
            <div className="account-check-pagination"><button className="btn btn-sm btn-outline" disabled={!historyPage} onClick={() => setHistoryPage(p => p - 1)}>Previous</button><span>Page {historyPage + 1}</span><button className="btn btn-sm btn-outline" disabled={!history || (historyPage + 1) * 20 >= history.total_count} onClick={() => setHistoryPage(p => p + 1)}>Next</button></div>
        </div>
    </section>;
}
