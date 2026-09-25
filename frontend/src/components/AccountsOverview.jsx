import { LoadingSpinner } from './LoadingSpinner';
import { ButtonSpinner } from './LoadingSpinner';
import { useAuth } from '../context/authSession';
import React, { useRef, useState } from 'react';
import { ShoppingCart, Truck, Package, ChartNoAxesCombined, HandCoins, FileText, Clock3, Download, Plus, ChevronDown, CalendarDays, X } from 'lucide-react';
import { apiClient } from '../api/client';
import { businessDate } from '../utils/businessDates';
import { money, dateLabel, monthRange, resolveTab, useAccountRequest, exportRows } from './accountsHelpers';
import { EntryLedger } from './AccountsWidgets';
import { ExpenseEntry, TransactionDialog } from './AccountsForms';
import { ShipmentLedger, AccountsCharts } from './AccountsDashboard';
import './AccountsOverview.css';
import './AccountsOverviewPolish.css';

const tabs = [['overview', 'Shipment Accounts'], ['collections', 'Customer Collections'], ['postpaid', 'Courier Payments'], ['expenses', 'Expenses'], ['wallets', 'Wallets'], ['banks', 'Bank Accounts'], ['transfers', 'Account Transfers'], ['b2b', 'B2B Outstanding'], ['refunds', 'Refunds / Adjustments'], ['reconciliation', 'Reconciliation']];
export default function AccountsOverview({ data, selectedCenter, activeSection, canEdit, onSectionChange, onRefresh, renderSection, settings }) {
    const { hasPermission } = useAuth();
    const canViewPrice = hasPermission('costs.customer_price');
    const canViewCost = hasPermission('costs.carrier_cost') || hasPermission('costs.view');
    const financial = (hasPermission('costs.net_value') || hasPermission('reports.view_financial')) && canViewPrice && canViewCost;
    const costAccess = canViewCost;
    const visibleTabs = tabs.filter(([key]) => {
        if (['postpaid', 'expenses', 'wallets'].includes(key)) return canViewCost;
        if (['transfers', 'banks'].includes(key)) return canViewPrice || canViewCost;
        return true;
    });
    const requestedTab = resolveTab(activeSection);
    const tab = visibleTabs.some(([key]) => key === requestedTab) ? requestedTab : 'overview';
    const [range, setRange] = useState(() => monthRange());
    const [draftRange, setDraftRange] = useState(range);
    const [filters, setFilters] = useState({ search: '', courier: '', account: '', status: '', from: '', to: '' });
    const [applied, setApplied] = useState(filters);
    const [pageState, setPageState] = useState({ key: '', page: 1 });
    const [revision, setRevision] = useState(0);
    const [showEntry, setShowEntry] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [notice, setNotice] = useState('');
    const [expenseShipment, setExpenseShipment] = useState(null);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const dateMenu = useRef(null);
    const shipmentDialog = useRef(null);
    const center = selectedCenter && selectedCenter !== 'All Centers' ? selectedCenter : undefined;
    const params = { date_from: range.from || undefined, date_to: range.to || undefined, center };
    const pageKey = JSON.stringify({ range, center, applied });
    const page = pageState.key === pageKey ? pageState.page : 1;
    const setPage = value => setPageState({ key: pageKey, page: value });
    const overview = useAccountRequest('getAccountsOverview', params, revision, data);
    const ledgerParams = { ...params, date_from: applied.from || params.date_from, date_to: applied.to || params.date_to, search: applied.search || undefined, courier: applied.courier || undefined, account: applied.account || undefined, status: applied.status || undefined };
    const ledger = useAccountRequest('getShipmentLedger', { ...ledgerParams, limit: 5, offset: (page - 1) * 5 }, revision, data);
    const go = key => onSectionChange?.(key);
    const refresh = () => { setRevision(value => value + 1); onRefresh?.(); };
    const addExpense = () => { setShowEntry(true); requestAnimationFrame(() => document.getElementById('ao-category')?.focus()); };
    const report = overview.data;
    const totals = report?.totals || {};
    const stats = [
        ['Sales Excluding GST', 'sales', ShoppingCart, '#00b985', 'Base sales amount'],
        ['Sales Including GST', 'gross_sales', ShoppingCart, '#0891b2', 'Total billed amount'],
        ['Total Carrier Cost', 'cost', Truck, '#ff1744', 'Carrier provider costs'],
        ['Total Expenses', 'expenses', Package, '#8b00ef', 'Operating expenses'],
        ['Profit', 'net', ChartNoAxesCombined, '#0755ee', 'Profit shown excluding and including GST'],
        ['Amount Collected', 'collected', HandCoins, '#ff862f', 'Payments received'],
        ['Pending Customer Payments', 'pending', Clock3, '#d97706', 'Unpaid invoice balances, incl. B2B'],
        ['B2B Outstanding', 'b2b', FileText, '#455e80', 'Pending B2B payments'],
    ].filter(([, key]) => financial || !['cost', 'expenses', 'net'].includes(key));
    const exportLedger = async () => {
        setExporting(true); setNotice('');
        try {
            const rows = [];
            let offset = 0, count = 1;
            while (offset < count) {
                const result = await apiClient.getShipmentLedger({ ...ledgerParams, limit: 500, offset });
                rows.push(...result.items); count = result.total_count; offset += 500;
                if (!result.items.length) break;
            }
            if (!financial) {
                exportRows([['Date', 'AWB', 'Courier', 'Customer', 'Destination', 'Customer Sale Incl. GST', ...(costAccess ? ['Carrier Cost'] : []), 'Payment Mode', 'Collection Status', 'Payment to Courier'], ...rows.map(s => [s.date, s.awb, s.courier, s.customer_name, s.destination, s.gross_sale, ...(costAccess ? [s.cost] : []), s.payment_mode, s.collection_status, s.courier_status])], `Shipment_Accounts_${businessDate()}.csv`);
            } else {
            exportRows([['Date', 'AWB', 'Courier', 'Customer', 'Destination', 'Sale Excl. GST INR', 'Sale Incl. GST INR', 'Carrier Cost INR', 'Expense INR', 'Profit Excl. GST INR', 'Profit Incl. GST INR', 'Payment Mode', 'Collection Status', 'Courier Status'], ...rows.map(s => [s.date, s.awb, s.courier, s.customer_name, s.destination, s.sale, s.gross_sale, s.cost, s.expense, s.value, s.value_with_gst, s.payment_mode, s.collection_status, s.courier_status])], `Shipment_Accounts_${businessDate()}.csv`);
            }
        } catch { setNotice('Export failed. Please try again.'); }
        finally { setExporting(false); }
    };
    const accounts = [...new Set([...(settings?.paidToAccounts || []), ...(report?.accounts || [])])];
    const selectRange = next => {
        setRange(next); setDraftRange(next);
        setFilters(old => ({ ...old, from: '', to: '' })); setApplied(old => ({ ...old, from: '', to: '' }));
        if (dateMenu.current) dateMenu.current.open = false;
    };
    const showShipment = shipment => {
        const obj = (shipment && typeof shipment === 'object')
            ? shipment
            : (ledger.data?.items || []).find(i => i.id === shipment) || { id: shipment };
        setSelectedShipment(obj);
        shipmentDialog.current?.showModal();
    };
    return <div className="ao-overview" aria-busy={overview.loading}>
        {overview.loading && <LoadingSpinner inline text="Loading accounts..." />}
        <div className="ao-heading"><div><span className="ao-eyebrow">FINANCIAL WORKSPACE</span><h2>Accounts Overview</h2><p>Complete financial view of your courier business</p></div>
            <div className="ao-actions">
                <details ref={dateMenu} className="ao-range"><summary><CalendarDays size={14} />{range.from ? `${dateLabel(range.from)} – ${dateLabel(range.to)}` : 'All time'}<ChevronDown size={12} /></summary>
                    <div className="ao-range-menu"><button onClick={() => selectRange(monthRange())}>This month</button><button onClick={() => selectRange(monthRange(true))}>Last month</button><button onClick={() => selectRange({ from: '', to: '' })}>All time</button>
                        <form onSubmit={e => { e.preventDefault(); selectRange(draftRange); }}><label>From<input required type="date" max={draftRange.to || undefined} value={draftRange.from} onChange={e => setDraftRange({ ...draftRange, from: e.target.value })} /></label><label>To<input required type="date" min={draftRange.from || undefined} value={draftRange.to} onChange={e => setDraftRange({ ...draftRange, to: e.target.value })} /></label><button className="ao-button primary">Apply dates</button></form>
                    </div>
                </details>
                <button className="ao-button" disabled={exporting || !hasPermission('accounts.export')} onClick={exportLedger}><Download size={14} />{exporting ? <ButtonSpinner text="Exporting…" /> : 'Export'}</button>
                {canEdit && <><button className="ao-button green" onClick={addExpense}><Plus size={15} /> Add Expense</button><TransactionDialog settings={settings} profiles={settings?.paymentAccounts || []} accounts={accounts} providers={data?.postpaid_accounts || []} center={center} onSaved={refresh} /></>}
            </div>
        </div>
        {(overview.error || notice) && <div className="ao-alert" role="alert">{overview.error || notice}<button onClick={refresh}>Retry</button></div>}
        {financial && <details className="ao-calculation-note"><summary>How Profit is calculated <span>GST basis explained</span></summary><p>Profit = sales minus recorded carrier values, expenses and approved refunds. Incl. GST includes sales GST, before GST settlement. Input GST credits are not tracked.</p></details>}
        <div className="ao-stats">{stats.map(([title, key, Icon, color, note]) => {
            const value = overview.loading ? null : totals[key];
            const previous = report?.previous?.[key];
            const change = previous > 0 && value != null ? (value - previous) / previous * 100 : null;
            return <div className={`ao-stat ${key === 'net' ? 'ao-stat-net' : ''}`} key={key} style={{ '--stat-accent': color }}>
                <div className="ao-stat-heading"><span className="ao-stat-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span><h3>{title}</h3></div>
                {key === 'net' ? <div className="ao-net-values"><div><small>Excluding GST</small><strong>{money(value)}</strong></div><div><small>Including GST</small><strong>{money(overview.loading ? null : totals.net_with_gst)}</strong></div></div> : <strong className="ao-stat-amount" title={money(value)}>{money(value)}</strong>}
                <small className="ao-stat-description">{overview.loading ? '\u00a0' : note}</small>
                {change != null && <div className="ao-stat-comparison"><em className={(key === 'cost' || key === 'expenses') === (change > 0) ? 'negative' : 'positive'}>{change >= 0 ? '+' : '-'}{Math.abs(change).toFixed(0)}%</em><small>vs previous period</small></div>}
            </div>;

        })}</div>
        <nav className="ao-tabs" aria-label="Account sections">{visibleTabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => go(key)}>{label}</button>)}</nav>
        <div className={`ao-layout ${canEdit && showEntry ? '' : 'ao-full'}`}><div className="ao-main">
            {tab === 'overview' && <>
                <ShipmentLedger report={report} accounts={accounts} filters={filters} setFilters={setFilters} ledger={ledger} page={page} setPage={setPage} refresh={refresh} onViewShipment={showShipment} onAddShipmentExpense={canEdit ? shipment => { setExpenseShipment(shipment); addExpense(); } : undefined} onSearch={e => { e.preventDefault(); setApplied(filters); setPage(1); }} />
                <AccountsCharts report={report} data={data} range={range} go={go} refresh={refresh} />
            </>}
            {['expenses', 'transfers'].includes(tab) && (report?.financial_access ? <EntryLedger key={tab + JSON.stringify(params)} params={params} revision={revision} kind={tab === 'transfers' ? 'transfer' : 'expense'} onRefresh={refresh} /> : <p className="ao-panel ao-empty">{overview.loading ? '' : 'Financial access is required to view transactions.'}</p>)}
            {tab === 'banks' && <section className="ao-panel ao-bank-page"><header><h3>Bank Accounts</h3></header><p className="ao-note">Recorded net movement includes receipts and incoming transfers, less expenses, courier payments, deposits, wallet recharges, recorded refund payouts and outgoing transfers. Opening bank balances and refunds without a payment-account record are excluded. These figures are not reconciled bank statement balances.{center ? ' Wallet recharges are organization-wide and excluded from center totals.' : ''}</p><div className="ao-table-scroll"><table className="ao-table"><thead><tr><th>Account</th><th>Recorded Net Movement</th></tr></thead><tbody>{(report?.bank_accounts || []).map(account => <tr key={account.name}><td>{account.name}</td><td>{money(account.recorded_balance)}</td></tr>)}{!report?.bank_accounts?.length && <tr><td colSpan={2} className="ao-empty">No account movements available.</td></tr>}</tbody></table></div></section>}
            {!['overview', 'expenses', 'transfers', 'banks'].includes(tab) && <div className="ao-legacy">{renderSection?.(tab)}</div>}
        </div>
        {canEdit && showEntry && <ExpenseEntry providers={data?.postpaid_accounts || []} settings={settings} profiles={settings?.paymentAccounts || []} linkedShipment={expenseShipment} onClearShipment={() => setExpenseShipment(null)} accounts={accounts} expenseCategories={report?.expense_categories || []} center={center} onSaved={refresh} onClose={() => setShowEntry(false)} />}
        </div>
        <dialog ref={shipmentDialog} className="ao-shipment-dialog" aria-labelledby="ao-shipment-title" onClick={e => { if (e.target === shipmentDialog.current) shipmentDialog.current.close(); }}>
            <header className="ao-shipment-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 id="ao-shipment-title">Shipment Account Details</h3>
                    {selectedShipment?.awb && (
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '4px', color: '#60a5fa' }}>
                            {selectedShipment.awb}
                        </span>
                    )}
                </div>
                <button type="button" className="ao-shipment-close-btn" aria-label="Close shipment details" onClick={() => shipmentDialog.current.close()}>
                    <X size={16} />
                </button>
            </header>
            {selectedShipment && (
                <div className="ao-shipment-body">
                    {/* Consignment Routing Card */}
                    <div className="ao-shipment-meta-card">
                        <div className="ao-shipment-meta-row">
                            <span>Customer</span>
                            <strong>{selectedShipment.customer_name || '—'}</strong>
                        </div>
                        <div className="ao-shipment-meta-row">
                            <span>Courier Partner</span>
                            <strong>{selectedShipment.courier || '—'}</strong>
                        </div>
                        <div className="ao-shipment-meta-row">
                            <span>Destination</span>
                            <strong>{selectedShipment.destination || '—'}</strong>
                        </div>
                        <div className="ao-shipment-meta-row">
                            <span>Payment Mode</span>
                            <strong>{selectedShipment.payment_mode || '—'}</strong>
                        </div>
                    </div>

                    {/* Financial Breakdown Grid */}
                    <div className="ao-shipment-financial-grid">
                        <div className="ao-shipment-fin-box highlight">
                            <span className="lbl">Customer Sale (Incl. GST)</span>
                            <span className="val">{money(selectedShipment.gross_sale)}</span>
                        </div>
                        <div className="ao-shipment-fin-box">
                            <span className="lbl">Sale (Excl. GST)</span>
                            <span className="val">{money(selectedShipment.sale)}</span>
                        </div>

                        {costAccess && (
                            <div className="ao-shipment-fin-box">
                                <span className="lbl">Carrier Cost</span>
                                <span className="val" style={{ color: '#ef4444' }}>{money(selectedShipment.cost)}</span>
                            </div>
                        )}

                        {financial && (
                            <>
                                <div className="ao-shipment-fin-box">
                                    <span className="lbl">Operating Expense</span>
                                    <span className="val" style={{ color: '#8b5cf6' }}>{money(selectedShipment.expense)}</span>
                                </div>
                                <div className="ao-shipment-fin-box profit" style={{ gridColumn: 'span 2' }}>
                                    <span className="lbl">Profit</span>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '2px' }}>
                                        <span className="val">{money(selectedShipment.value)}</span>
                                        <small style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>Incl. GST: {money(selectedShipment.value_with_gst)}</small>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Settlement Statuses */}
                    <div className="ao-shipment-meta-card" style={{ marginTop: '2px' }}>
                        <div className="ao-shipment-meta-row">
                            <span>Customer Payment Status</span>
                            <span className={`ao-badge ${selectedShipment.collection_status?.toLowerCase() || ''}`}>
                                {selectedShipment.collection_status || '—'}
                            </span>
                        </div>
                        <div className="ao-shipment-meta-row">
                            <span>Courier Settlement</span>
                            <span className={`ao-badge ${selectedShipment.courier_status?.toLowerCase() || ''}`}>
                                {selectedShipment.courier_status || '—'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </dialog>
    </div>;
}
