import { providerCostLabel } from '../utils/costLabels';
import AccountChecks from '../components/AccountChecks';
import React, { useState } from 'react';
import { 
    Scale, 
    Plus, 
    Printer,
    CreditCard, 
    FileText, 
    Download, 
    Building2, 
    RotateCcw,
    Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CourierLogo } from '../components/CourierLogos';
import { ContentShimmer } from '../components/ContentShimmer';
import { TrackingLink } from '../components/TrackingLink';
import { apiClient } from '../api/client';

export const Invoices = ({ invoices, onPreviewInvoice }) => {
    const [searchVal, setSearchVal] = useState('');
    const [statusVal, setStatusVal] = useState('');

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const filtered = (invoices || []).filter(i => {
        const matchesSearch = !searchVal || 
            (i.invoice_no || '').toLowerCase().includes(searchVal.toLowerCase()) ||
            (i.customer_name || '').toLowerCase().includes(searchVal.toLowerCase()) ||
            (i.awb || '').toLowerCase().includes(searchVal.toLowerCase());
        const matchesStatus = !statusVal || i.status === statusVal;
        return matchesSearch && matchesStatus;
    });

    const exportToCSV = () => {
        if (!invoices || invoices.length === 0) return;
        const headers = ['Invoice No', 'Date', 'Customer Name', 'AWB', 'Carrier', 'Subtotal (INR)', 'GST (INR)', 'Total (INR)', 'Amount Paid (INR)', 'Balance Due (INR)', 'Status'];
        const rows = invoices.map(i => [
            `"${i.invoice_no}"`,
            `"${i.date}"`,
            `"${i.customer_name}"`,
            `"${i.awb || ''}"`,
            `"${i.courier || ''}"`,
            i.amount || 0,
            i.gst || 0,
            i.total || 0,
            i.paid || 0,
            i.balance || 0,
            `"${i.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `FMC_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="invoice-directory-page">
            <div className="page-header">
                <div>
                    <h2 className="page-title">🧾 Invoices & Billing</h2>
                    <p className="page-subtitle">Auto-generated tax invoices connected to shipment bookings</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pill-stat">Total: <strong>{invoices?.length || 0}</strong></span>
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Invoices to CSV">
                        <Download size={14} /> Export CSV
                    </button>
                </div>
            </div>

            <div className="filter-bar invoice-filters">
                <input 
                    type="text" 
                    className="filter-input" 
                    aria-label="Search invoices"
                    placeholder="Search by Invoice #, Customer or AWB..." 
                    value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                />
                <select className="filter-select" aria-label="Payment status" value={statusVal} onChange={e => setStatusVal(e.target.value)}>
                    <option value="">All Payment Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Due">Due / Unpaid</option>
                    <option value="Overdue">Overdue</option>
                </select>
            </div>

            <div className="table-card invoice-table-card">
                <div className="table-wrap invoice-table-wrap" tabIndex={0} role="region" aria-label="Invoices table, scroll to view more invoices">
                    <table className="data-table invoice-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Customer Name</th>
                                <th>AWB &amp; Courier</th>
                                <th>Total Amount</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Status</th>
                                <th className="invoice-actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No invoices found matching criteria.</td></tr>
                            ) : (
                                filtered.map(inv => (
                                    <tr key={inv.id}>
                                        <td><strong style={{ color: 'var(--primary-blue)' }}>{inv.invoice_no}</strong></td>
                                        <td style={{ color: 'var(--text-muted)' }}>{formatDate(inv.date)}</td>
                                        <td><strong>{inv.customer_name}</strong></td>
                                        <td>
                                            <div className="invoice-awb-cell">
                                                <TrackingLink awb={inv.awb} courier={inv.courier} className="status-pill in-transit" style={{ fontFamily: 'monospace' }} />
                                                {inv.courier && <CourierLogo courier={inv.courier} height={15} />}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 800 }}>{formatCurrency(inv.total)}</td>
                                        <td style={{ color: 'var(--emerald)', fontWeight: 700 }}>{formatCurrency(inv.paid)}</td>
                                        <td style={{ color: inv.balance > 0 ? 'var(--rose)' : 'var(--text-muted)', fontWeight: 700 }}>
                                            {formatCurrency(inv.balance)}
                                        </td>
                                        <td>
                                            <span className={`status-pill ${inv.status === 'Paid' ? 'delivered' : inv.status === 'Partial' ? 'picked-up' : 'delayed'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="invoice-actions-column">
                                            <button className="btn btn-sm btn-primary-blue" title="View invoice" aria-label={`View invoice ${inv.invoice_no}`} onClick={() => onPreviewInvoice(inv)}>
                                                <Printer size={12} style={{flexShrink: 0}} /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const Accounts = ({ 
    onRefresh,
    accountsData, 
    reconciliations, 
    onOpenWalletModal, 
    onOpenReconciliationModal,
    activeSection,
}) => {
    const { hasPermission, currentUser } = useAuth();
    const [entry, setEntry] = useState({kind: 'expense', date: new Date().toLocaleDateString('en-CA'), provider: '', amount: '', reference: '', account: ''});
    const [saving, setSaving] = useState(false);
    const [entryMessage, setEntryMessage] = useState('');
    const submitEntry = async e => {
        e.preventDefault();
        setSaving(true);
        setEntryMessage('');
        try {
            await apiClient.recordAccountingEntry({...entry, amount: Number(entry.amount), provider: entry.kind === 'expense' ? null : entry.provider});
            setEntry(prev => ({...prev, amount: '', reference: ''}));
            setEntryMessage('Entry recorded successfully.');
            await onRefresh();
        } catch (error) {
            setEntryMessage(error.response?.data?.detail || 'Unable to record entry.');
        } finally { setSaving(false); }
    };
    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    React.useEffect(() => {
        if (!activeSection) return;
        const targetMap = {
            customer_money: 'account-collections',
            account_checks: 'account-checks',
            aramex_account: 'provider-Aramex',
            bluedart_account: 'provider-Blue%20Dart',
            reconciliation: 'account-reconciliation',
        };
        const targetId = targetMap[activeSection] || (/^(wallet|provider)-/.test(activeSection) ? activeSection : null);
        if (!targetId) return;
        window.requestAnimationFrame(() => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [activeSection, accountsData]);

    if (!hasPermission('accounts.view')) {
        return <div className="dash-box" role="status"><h2>Accounts access required</h2><p>Your role does not have permission to view accounts. Contact your administrator if you need access.</p></div>;
    }

    if (!accountsData) {
        return <ContentShimmer message="Synchronizing Bank Ledgers, Provider Wallets & Discrepancy Logs..." />;
    }

    return (
        <div className="accounts-page">
            <div className="page-header">
                <div>
                    <h2 className="page-title">💰 Financial Accounts & Provider Ledgers</h2>
                    <p className="page-subtitle">Customer sales & collections, Prepaid provider wallets (ICL, BRV) & Postpaid accounts (Aramex, Blue Dart)</p>
                </div>
                {hasPermission('runReconciliation') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline" onClick={onOpenReconciliationModal} title="Upload carrier billing statement (Excel, CSV or PDF)">
                            <Upload size={14} /> Upload Carrier Bill
                        </button>
                        <button className="btn btn-primary-blue" onClick={onOpenReconciliationModal}>
                            <Scale size={15} /> Run Provider Reconciliation
                        </button>
                    </div>
                )}
            </div>

            {/* 1. Customer Sales & Collection Highlights */}
            <div id="account-collections" className="dash-stat-cards-grid account-nav-target" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '10px' }}>
                <div className="dash-mini-card">
                    <span className="card-label">Total Customer Sales</span>
                    <div className="card-value" style={{ color: 'var(--primary-blue)' }}>{formatCurrency(accountsData.total_sales)}</div>
                </div>
                <div className="dash-mini-card">
                    <span className="card-label">Total Collected</span>
                    <div className="card-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(accountsData.total_collected)}</div>
                </div>
                <div className="dash-mini-card">
                    <span className="card-label">Pending Retail Collection</span>
                    <div className="card-value" style={{ color: 'var(--amber)' }}>{formatCurrency(accountsData.pending_collection)}</div>
                </div>
                <div className="dash-mini-card">
                    <span className="card-label">B2B Credit Receivables</span>
                    <div className="card-value" style={{ color: 'var(--sky)' }}>{formatCurrency(accountsData.b2b_credit_sales)}</div>
                </div>
            </div>

            {/* Collections by Payment Method and Account Destination */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px', marginBottom: '12px' }}>
                <div className="dash-box">
                    <h4 style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>💳 Collections by Payment Mode</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                            <span>💵 Cash at Counter:</span><strong>{formatCurrency(accountsData.cash_collected)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                            <span>📱 UPI / QR Payments:</span><strong>{formatCurrency(accountsData.upi_collected)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                            <span>🏦 Bank Transfer (NEFT/RTGS):</span><strong>{formatCurrency(accountsData.bank_collected)}</strong>
                        </div>
                    </div>
                </div>

                <div className="dash-box">
                    <h4 style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>🏦 Collections by Destination Account (paid_to)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                        {Object.entries(accountsData.collections_by_account || {}).map(([acc, amt]) => (
                            <div key={acc} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                                <span>{acc}:</span><strong style={{ color: 'var(--emerald)' }}>{formatCurrency(amt)}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2 & 3. Prepaid vs Postpaid Providers */}
            {(currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin') && <form className="dash-box account-transaction-form" onSubmit={submitEntry} style={{marginBottom: 12}}>
                <h3>Record account transaction</h3>
                <div className="form-grid">
                    <div className="form-group"><label>Transaction</label><select value={entry.kind} onChange={e => setEntry({...entry, kind: e.target.value})}><option value="expense">Operating expense</option><option value="provider_payment">Provider payment</option><option value="provider_deposit">Security deposit</option></select></div>
                    <div className="form-group"><label>Date</label><input required type="date" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})} /></div>
                    {entry.kind !== 'expense' && <div className="form-group"><label>Provider</label><select required value={entry.provider} onChange={e => setEntry({...entry, provider: e.target.value})}><option value="">Select provider</option>{accountsData.postpaid_accounts?.map(p => <option key={p.name}>{p.name}</option>)}</select></div>}
                    <div className="form-group"><label>Amount (₹)</label><input required type="number" min="0.01" step="0.01" value={entry.amount} onChange={e => setEntry({...entry, amount: e.target.value})} /></div>
                    <div className="form-group"><label>Payment account</label><input required value={entry.account} onChange={e => setEntry({...entry, account: e.target.value})} /></div>
                    <div className="form-group"><label>Reference / description</label><input required value={entry.reference} onChange={e => setEntry({...entry, reference: e.target.value})} /></div>
                </div>
                <button className="btn btn-primary-blue" disabled={saving}>{saving ? 'Recording…' : 'Record transaction'}</button>
                {entryMessage && <p role="status">{typeof entryMessage === 'string' ? entryMessage : 'Please check the transaction details.'}</p>}
            </form>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '12px', marginBottom: '10px' }}>
                {/* Prepaid Wallets */}
                <div className="dash-box provider-accounts-panel">
                    <div className="dash-box-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CreditCard size={17} color="var(--primary-blue)" />
                            <h3>Prepaid Provider Wallets (Rule 1 & 2)</h3>
                        </div>
                    </div>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Recharge is a bank transfer to wallet. Cost occurs only when the wallet is debited on a shipment.
                    </p>
                    <div className="provider-accounts-scroll" tabIndex={0} role="region" aria-label="Provider accounts">
                    {accountsData.prepaid_wallets?.map(w => (
                        <div id={`wallet-${encodeURIComponent(w.name)}`} key={w.name} className="dash-mini-card account-nav-target provider-account-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <CourierLogo courier={w.name} height={16} />
                                        <div className="card-label" style={{ margin: 0 }}>{w.name} Provider Wallet</div>
                                    </div>
                                    <div className="card-value" style={{ color: 'var(--emerald)', margin: '4px 0' }}>{formatCurrency(w.current_balance)}</div>
                                </div>
                                <button className="btn btn-sm btn-primary-blue" onClick={() => onOpenWalletModal(w.name)}>
                                    <Plus size={13} /> Top-up Wallet
                                </button>
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--card-border)', paddingTop: '6px' }}>
                                Opening: {formatCurrency(w.opening_balance)} • Recharges: {formatCurrency(w.total_recharges)} • Used: {formatCurrency(w.total_usage)}
                            </div>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Postpaid Accounts */}
                <div className="dash-box provider-accounts-panel">
                    <div className="dash-box-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={17} color="var(--primary-blue)" />
                            <h3>Postpaid Provider Accounts (Rule 3 & 4)</h3>
                        </div>
                    </div>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Shipments accumulate unbilled predicted charges. Month-end bill upload matches AWB-by-AWB.
                    </p>
                    <div className="provider-accounts-scroll" tabIndex={0} role="region" aria-label="Provider accounts">
                    {accountsData.postpaid_accounts?.map(p => (
                        <div id={`provider-${encodeURIComponent(p.name)}`} key={p.name} className="dash-mini-card account-nav-target provider-account-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <CourierLogo courier={p.name} height={16} />
                                <div className="card-label" style={{ margin: 0 }}>{p.name} Postpaid Account</div>
                            </div>
                            <div className="card-value" style={{ color: 'var(--rose)', margin: '4px 0' }}>{formatCurrency(p.unbilled_usage)}</div>
                            <p>{providerCostLabel(p.name)}: {formatCurrency(p.actual_billed)} · Paid: {formatCurrency(p.payments_made)} · Payable: {formatCurrency(p.net_payable)}</p>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Unbilled Usage ({p.shipments_count} Shipments)</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--card-border)', paddingTop: '6px' }}>
                                Security Deposit: <strong>{formatCurrency(p.deposit)}</strong> • Terms: {p.payment_terms}
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            </div>

            <AccountChecks />
            {/* 4. Reconciliation History */}
            <div id="account-reconciliation" className="table-card account-nav-target">
                <div className="dash-box-header">
                    <h3>Reconciliation Audit Log (Rule 4 & 6)</h3>
                    {hasPermission('runReconciliation') && (
                        <button className="btn btn-sm btn-primary-blue" onClick={onOpenReconciliationModal}>
                            <Scale size={13} /> Run Reconciliation
                        </button>
                    )}
                </div>
                <div className="table-wrap reconciliation-history-scroll" tabIndex={0} role="region" aria-label="Reconciliation audit log">
                    <table className="data-table reconciliation-history-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '150px' }}>Batch #</th>
                                <th style={{ minWidth: '100px' }}>Date</th>
                                <th style={{ minWidth: '110px' }}>Provider</th>
                                <th style={{ minWidth: '130px' }}>Predicted Cost</th>
                                <th style={{ minWidth: '130px' }}>Provider Cost</th>
                                <th style={{ minWidth: '110px' }}>Difference</th>
                                <th style={{ minWidth: '100px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reconciliations?.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No reconciliation batches executed yet.</td></tr>
                            ) : (
                                reconciliations?.map(r => (
                                    <tr key={r.id}>
                                        <td><strong>{r.batch_no}</strong></td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>{formatDate(r.date)}</td>
                                        <td><span className="status-pill in-transit">{r.provider}</span></td>
                                        <td>{formatCurrency(r.predicted_total)}</td>
                                        <td><div className="text-muted" style={{ fontSize: '9.5px' }}>{providerCostLabel(r.provider)}</div><strong>{formatCurrency(r.actual_bill)}</strong></td>
                                        <td style={{ fontWeight: 800, color: r.variance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                                            {r.variance > 0 ? '+' : ''}{formatCurrency(r.variance)}
                                        </td>
                                        <td><span className="status-pill delivered">{r.status}</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const B2B = ({ b2bData, onOpenCustomerDrawer, onOpenB2BModal, onRefresh }) => {
    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const [timeoutExpired, setTimeoutExpired] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Timeout safety fallback: if b2bData is null for more than 2 seconds, transition out of shimmer
    React.useEffect(() => {
        if (!b2bData) {
            const timer = setTimeout(() => {
                setTimeoutExpired(true);
            }, 2000);
            return () => clearTimeout(timer);
        } else {
            setTimeoutExpired(false);
        }
    }, [b2bData]);

    const activeData = b2bData || (timeoutExpired ? {
        total_credit_sales: 0,
        collected: 0,
        outstanding: 0,
        due_this_week: 0,
        overdue: 0,
        aging: { not_due: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90_plus: 0, total_outstanding: 0, overdue_total: 0 },
        companies: []
    } : null);

    if (!activeData) {
        return <ContentShimmer message="Calculating Corporate Aging Schedules (30–90 Days) & Credit Limits..." />;
    }

    const handleManualRefresh = async () => {
        if (onRefresh) {
            setIsRefreshing(true);
            try {
                await onRefresh();
            } finally {
                setTimeout(() => setIsRefreshing(false), 500);
            }
        }
    };

    const exportToCSV = () => {
        if (!activeData.companies || activeData.companies.length === 0) return;
        const headers = ['Company', 'Contact Person', 'Mobile', 'Credit Limit (INR)', 'Total Billed (INR)', 'Outstanding (INR)', 'Credit Period (Days)', 'Status'];
        const rows = activeData.companies.map(c => [
            `"${c.company}"`,
            `"${c.contact_name}"`,
            `"${c.mobile}"`,
            c.credit_limit || 0,
            c.total_billed || 0,
            c.outstanding || 0,
            c.credit_period_days || 30,
            `"${c.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `FMC_B2B_Accounts_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="b2b-directory-page">
            <div className="page-header">
                <div>
                    <h2 className="page-title">🏢 B2B Corporate Credit & Aging Receivables</h2>
                    <p className="page-subtitle">Manage corporate credit limits, payment terms, and 5-bucket aging schedule</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onRefresh && (
                        <button 
                            className="btn btn-outline" 
                            onClick={handleManualRefresh}
                            title="Refresh corporate aging and balances"
                            disabled={isRefreshing}
                        >
                            <RotateCcw size={14} className={isRefreshing ? 'spin-icon' : ''} /> Refresh
                        </button>
                    )}
                    <button className="btn btn-outline" onClick={exportToCSV}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn btn-primary-blue" onClick={onOpenB2BModal}>
                        <Plus size={15} /> Add B2B Client
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="dash-stat-cards-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '10px' }}>
                <div className="dash-mini-card"><span className="card-label">Total Credit Sales</span><div className="card-value">{formatCurrency(activeData.total_credit_sales)}</div></div>
                <div className="dash-mini-card"><span className="card-label">Collected</span><div className="card-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(activeData.collected)}</div></div>
                <div className="dash-mini-card"><span className="card-label">Total Outstanding</span><div className="card-value" style={{ color: 'var(--amber)' }}>{formatCurrency(activeData.outstanding)}</div></div>
                <div className="dash-mini-card"><span className="card-label">Due This Week</span><div className="card-value" style={{ color: 'var(--rose)' }}>{formatCurrency(activeData.due_this_week)}</div></div>
                <div className="dash-mini-card"><span className="card-label">Overdue &gt; Terms</span><div className="card-value" style={{ color: 'var(--rose)' }}>{formatCurrency(activeData.overdue)}</div></div>
            </div>

            {/* 5-Bucket Aging Schedule */}
            <div className="dash-box" style={{ marginBottom: '12px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px' }}>📊 5-Bucket Receivables Aging Schedule</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--emerald)' }}>NOT DUE</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px' }}>{formatCurrency(activeData.aging?.not_due)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--sky)' }}>1 - 30 DAYS</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px' }}>{formatCurrency(activeData.aging?.days1_30)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--amber)' }}>31 - 60 DAYS</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px' }}>{formatCurrency(activeData.aging?.days31_60)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#8b5cf6' }}>61 - 90 DAYS</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px' }}>{formatCurrency(activeData.aging?.days61_90)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-app)', padding: '8px', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--card-border)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--rose)' }}>90+ DAYS OVERDUE</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '4px', color: 'var(--rose)' }}>{formatCurrency(activeData.aging?.days90_plus)}</div>
                    </div>
                </div>
            </div>

            {/* Companies Table */}
            <div className="table-card">
                <div className="dash-box-header">
                    <h3>Registered B2B Corporate Clients</h3>
                </div>
                <div className="table-wrap b2b-directory-scroll" tabIndex={0} role="region" aria-label="B2B corporate clients">
                    <table className="data-table b2b-directory-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '180px' }}>Company / Contact</th>
                                <th style={{ minWidth: '120px' }}>Mobile</th>
                                <th style={{ minWidth: '120px' }}>Credit Limit</th>
                                <th style={{ minWidth: '120px' }}>Outstanding</th>
                                <th style={{ minWidth: '120px' }}>Limit Utilized</th>
                                <th style={{ minWidth: '100px' }}>Terms</th>
                                <th style={{ minWidth: '110px' }}>Status</th>
                                <th style={{ minWidth: '100px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeData.companies && activeData.companies.length > 0 ? (
                                activeData.companies.map(c => {
                                    const util = c.credit_utilized_percent || 0;
                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <strong style={{ color: 'var(--text-main)' }}>{c.company}</strong>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{c.contact_name}</div>
                                            </td>
                                            <td>{c.mobile}</td>
                                            <td>{formatCurrency(c.credit_limit)}</td>
                                            <td><strong style={{ color: c.outstanding > 0 ? 'var(--rose)' : 'var(--emerald)' }}>{formatCurrency(c.outstanding)}</strong></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ flex: 1, height: '6px', background: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${Math.min(100, util)}%`, height: '100%', background: util > 85 ? 'var(--rose)' : (util > 50 ? 'var(--amber)' : 'var(--emerald)') }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{util}%</span>
                                                </div>
                                            </td>
                                            <td><span className="status-pill in-transit">{c.credit_period_days} Days</span></td>
                                            <td>
                                                <span className={`status-pill ${c.outstanding > c.credit_limit ? 'delayed' : (c.outstanding > 0 ? 'picked-up' : 'delivered')}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn btn-sm btn-outline" onClick={() => onOpenCustomerDrawer(c.id)}>
                                                    Statement
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                                        <Building2 size={32} style={{ opacity: 0.35, marginBottom: '8px' }} />
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>No Corporate B2B Clients Registered</div>
                                        <div style={{ fontSize: '12px', marginTop: '4px', marginBottom: '14px' }}>
                                            Add enterprise accounts to assign customized credit periods (30–90 days) and automated aging limits.
                                        </div>
                                        <button className="btn btn-primary-blue btn-sm" onClick={onOpenB2BModal}>
                                            <Plus size={14} /> Add First B2B Client
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
