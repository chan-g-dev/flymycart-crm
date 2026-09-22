import { useAuth } from '../context/authSession';
import GstValuePair from './GstValuePair';
import React from 'react';
import { Search, Eye, MoreHorizontal, Wallet, Building2, ArrowLeftRight, FileText, HandCoins, Truck, CircleCheck, RotateCcw } from 'lucide-react';
import { CourierLogo } from './CourierLogos';
import { TrackingLink } from './TrackingLink';
import { Breakdown, Pager } from './AccountsWidgets';
import { money, dateLabel, colors } from './accountsHelpers';

export function ShipmentLedger({ report, accounts, filters, setFilters, onSearch, ledger, page, setPage, refresh, onViewShipment, onAddShipmentExpense }) {
    const { hasPermission } = useAuth();
    const financial = hasPermission('reports.view_financial');
    const costs = financial || hasPermission('costs.view');
    const columns = 10 + Number(costs) + (financial ? 3 : 0);
    const items = ledger.data?.items || [];
    const count = ledger.data?.total_count || 0;
    return <section className="ao-panel ao-ledger">
        <form className="ao-filters" onSubmit={onSearch}>
            <h3>Shipment Accounts</h3>
            {[['courier', 'All Couriers', report?.couriers || []], ['account', 'All Accounts', accounts], ['status', 'All Payment Status', ['Paid', 'Partial', 'Unpaid', 'B2B Credit']]].map(([key, label, options]) => <select key={key} aria-label={label} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}><option value="">{label}</option>{options.map(value => <option key={value}>{value}</option>)}</select>)}
            <input aria-label="Ledger from date" type="date" max={filters.to || undefined} value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
            <input aria-label="Ledger to date" type="date" min={filters.from || undefined} value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
            <label className="ao-search"><Search size={13} /><input aria-label="Search shipment accounts" placeholder="Search AWB, customer…" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></label>
            <button className="ao-button primary"><Search size={12} /> Search</button>
        </form>
        {ledger.error && <p role="alert" className="ao-alert">{ledger.error}<button onClick={refresh}>Retry</button></p>}
        <div className="ao-table-scroll" tabIndex={0} role="region" aria-label="Shipment accounts ledger">
            <table className="ao-table"><thead><tr>{['Date', 'AWB', 'Courier', 'Customer', 'Destination', 'Customer Sale (Incl. GST)', ...(costs ? ['Courier Cost'] : []), ...(financial ? ['Sale Excl. GST', 'Expense', 'Net Value'] : []), 'Payment Mode', 'Collection Status', 'Payment to Courier', 'Action'].map(name => <th key={name}>{name}</th>)}</tr></thead>
                <tbody>{!ledger.loading && items.map(s => <tr key={s.id}>
                    <td>{dateLabel(s.date)}</td><td><TrackingLink awb={s.awb} courier={s.courier} /></td><td><CourierLogo courier={s.courier} height={13} /></td>
                    <td title={s.customer_name}>{s.customer_name}</td><td>{s.destination}</td><td>{money(s.gross_sale)}</td>
                    {costs && <td>{money(s.cost)}</td>}
                    {financial && <><td>{money(s.sale)}</td><td>{money(s.expense)}</td><td><GstValuePair excluding={s.value} including={s.value_with_gst} formatValue={money} /></td></>}
                    <td>{s.payment_mode || '-'}</td><td><span className={`ao-status ${s.collection_status === 'Paid' ? 'paid' : 'due'}`}>{s.collection_status}</span></td>
                    <td><span className={`ao-status ${s.courier_status === 'Paid' ? 'paid' : 'due'}`}>{['Paid', 'Pending', 'Processing'].includes(s.courier_status) ? s.courier_status : 'Pending'}</span></td>
                    <td><button className="ao-eye" aria-label={`View shipment ${s.awb}`} onClick={() => onViewShipment(s)}><Eye size={13} /></button>{financial && onAddShipmentExpense && <button className="ao-eye" aria-label={`Add expense to ${s.awb}`} onClick={() => onAddShipmentExpense(s)}><MoreHorizontal size={13} /></button>}</td>
                </tr>)}
                {(ledger.loading || !items.length) && <tr><td colSpan={columns} className="ao-empty ao-ledger-empty">{ledger.loading ? 'Loading shipments...' : 'No shipments match this period and filters.'}</td></tr>}
                </tbody>
            </table>
        </div>
        <footer><span>Showing {count ? (page - 1) * 5 + 1 : 0} to {Math.min(page * 5, count)} of {count} shipments</span><Pager page={page} count={count} onChange={setPage} /></footer>
    </section>;
}
export function AccountsCharts({ report, data, range, go, refresh }) {
    const { hasPermission } = useAuth();
    const financial = hasPermission('reports.view_financial');
    const partners = Object.entries(report?.by_partner || {});
    const partnerTotal = partners.reduce((sum, [, value]) => sum + Number(value), 0);
    const totals = report?.totals || {};
    const wallets = [...(data?.prepaid_wallets || []).map(w => ({ name: w.name, type: 'Prepaid', balance: w.current_balance })), ...(data?.postpaid_accounts || []).map(p => ({ name: p.name, type: 'Postpaid', balance: -Number(p.net_payable || 0) }))];
    const payable = (data?.postpaid_accounts || []).reduce((sum, p) => sum + Number(p.net_payable || 0), 0);
    return <>
        <div className="ao-charts">
            {financial && <Breakdown title="Expense Breakdown" data={report?.by_category} label="Total Expenses" onDetails={() => go('expenses')} />}
            <Breakdown title="Collection by Payment Mode" data={report?.by_mode} label="Collected" onDetails={() => go('collections')} />
            {financial && <Breakdown title="Courier Cost by Partner" data={report?.by_partner} label="Total Courier Cost" onDetails={() => go('postpaid')} initialType="horizontal" horizontalView={
                <div className="ao-partners">{partners.map(([name, value], index) => <div key={name}><span><CourierLogo courier={name} height={13} /></span><i><b style={{ width: `${partnerTotal ? value / partnerTotal * 100 : 0}%`, background: colors[index % colors.length] }} /></i><strong>{money(value)}</strong><em>{partnerTotal ? Math.round(value / partnerTotal * 100) : 0}%</em></div>)}{!partners.length && <p className="ao-empty">No courier costs in this period.</p>}</div>
            } />}
        </div>
        {financial && <div className="ao-bottom">
            <section className="ao-panel"><header><h3>Wallet Balances</h3><button onClick={() => go('wallets')}>View all →</button></header><div className="ao-balance-head"><span>Courier Wallet</span><span>Balance (₹)</span></div>
                <div className="ao-balance-list">{wallets.map(w => <div className="ao-balance" key={w.name + w.type}><span><Wallet size={12} /> {w.name} ({w.type})</span><strong className={w.balance < 0 ? 'negative' : 'positive'}>{money(w.balance)}</strong></div>)}{!wallets.length && <p className="ao-empty">No wallets available.</p>}</div><small className="ao-note">Current balances · All accessible centers</small>
            </section>
            <section className="ao-panel"><header><h3>Bank & Cash Accounts</h3><button onClick={() => go('banks')}>View all →</button></header><div className="ao-balance-head"><span>Account</span><span>Recorded net (₹)</span></div>
                <div className="ao-balance-list">{(report?.bank_accounts || []).map(account => <div className="ao-balance" key={account.name}><span><Building2 size={12} /> {account.name}</span><strong className={account.recorded_balance < 0 ? 'negative' : 'positive'}>{money(account.recorded_balance)}</strong></div>)}{!report?.bank_accounts?.length && <p className="ao-empty">No account movements.</p>}</div><small className="ao-note">Recorded movements through {range.to ? dateLabel(range.to) : 'today'}.</small>
            </section>
            <div className="ao-mini-grid">{[
                ['Account Transfers', report?.transfer_count, 'Transfers in period', ArrowLeftRight, '#0755ee', 'transfers'],
                ['Refunds / Adjustments', report?.refund_count, 'Refunds / Credits', FileText, '#ff862f', 'refunds'],
                ['Pending from Customers', money(totals.pending), 'Current dues for period shipments', HandCoins, '#ff1744', 'collections'],
                ['Pending to Couriers', report?.financial_access ? money(payable) : '—', 'Current provider balances', Truck, '#8b00ef', 'postpaid'],
            ].map(([title, value, note, Icon, color, key]) => <section className="ao-panel ao-mini" key={key}><h3>{title}</h3><div><span style={{ background: color }}><Icon size={19} /></span><div><strong>{value ?? '—'}</strong><small>{note}</small><button onClick={() => go(key)}>View details →</button></div></div></section>)}</div>
            <section className="ao-sync"><div><CircleCheck size={38} /><h3>Accounts in Sync</h3></div><p>Financial data is updated from your recorded shipments and transactions.</p><button onClick={refresh}><RotateCcw size={12} /> Refresh accounts</button></section>
        </div>}
    </>;
}
