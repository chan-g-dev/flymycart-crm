import { useRemoteData } from '../utils/useRemoteData';
import { openWhatsApp, openEmail, CommTemplates } from '../utils/communication';
import { MessageSquare, Mail } from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';
import { ButtonSpinner } from '../components/LoadingSpinner';
import TablePagination from '../components/TablePagination';
import useTablePage from '../components/useTablePage';
import PaymentDetails from '../components/PaymentDetails';
import AccountsOverview from '../components/AccountsOverview';
import { businessDate } from '../utils/businessDates';
import { providerCostLabel } from '../utils/costLabels';
import AccountChecks from '../components/AccountChecks';
import React, { useState, useMemo, useCallback } from 'react';
import { Scale, Plus, Printer, CreditCard, FileText, Download, Building2, RotateCcw, Search, Globe, Plane, Truck, X } from 'lucide-react';
import { DEFAULT_ENTITY, getEntityMeta, getEntityOptions } from '../utils/entityConstants';
import { useAuth } from '../context/authSession';
import { CourierLogo } from '../components/CourierLogos';
import { ContentShimmer } from '../components/ContentShimmer';
import { TrackingLink } from '../components/TrackingLink';
import { apiClient } from '../api/client';

export const Invoices = ({ 
    invoices = [], 
    onPreviewInvoice, 
    selectedCenter, 
    settings, 
    shipments = [], 
    selectedScope = '', 
    onSelectScope, 
    selectedEntity = '', 
    onSelectEntity 
}) => {
    const { hasPermission } = useAuth();
    const canViewPrice = hasPermission('costs.customer_price');
    const [searchVal, setSearchVal] = useState('');
    const [statusVal, setStatusVal] = useState('');
    const entityOptions = useMemo(() => getEntityOptions(settings), [settings]);
    const scopeVal = selectedScope;
    const entityVal = selectedEntity;

    const setEntityVal = (valOrFn) => {
        if (typeof valOrFn === 'function') {
            const next = valOrFn(entityVal);
            onSelectEntity?.(next);
        } else {
            onSelectEntity?.(valOrFn);
        }
    };

    const setScopeVal = (valOrFn) => {
        if (typeof valOrFn === 'function') {
            const next = valOrFn(scopeVal);
            onSelectScope?.(next);
        } else {
            onSelectScope?.(valOrFn);
        }
    };

    const shipmentMap = useMemo(() => {
        const map = new Map();
        (shipments || []).forEach(s => {
            if (s.id) map.set(s.id, s);
            if (s.awb) map.set(s.awb, s);
        });
        return map;
    }, [shipments]);

    const getInvoiceScopeAndEntity = useCallback((inv) => {
        const ship = inv.shipment_id ? shipmentMap.get(inv.shipment_id) : (inv.awb ? shipmentMap.get(inv.awb) : null);
        const entity = inv.entity || ship?.entity || DEFAULT_ENTITY;
        const domIntl = inv.domestic_international || ship?.domestic_international || ((ship?.receiver_country && ship.receiver_country.toLowerCase() === 'india') ? 'Domestic' : 'International');
        const isDom = domIntl === 'Domestic';
        return { entity, isDom };
    }, [shipmentMap]);

    const scopeCounts = useMemo(() => {
        let intl = 0;
        let dom = 0;
        let total = 0;
        (invoices || []).forEach(i => {
            const { entity, isDom } = getInvoiceScopeAndEntity(i);
            if (entityVal && entity !== entityVal) return;

            total += 1;
            if (isDom) dom += 1;
            else intl += 1;
        });
        return { all: total, intl, dom };
    }, [invoices, entityVal, getInvoiceScopeAndEntity]);

    const entityCounts = useMemo(() => {
        const counts = { total: 0 };
        entityOptions.forEach(e => { counts[e.name] = 0; });
        (invoices || []).forEach(i => {
            const { entity, isDom } = getInvoiceScopeAndEntity(i);
            if (scopeVal === 'International' && isDom) return;
            if (scopeVal === 'Domestic' && !isDom) return;

            counts.total += 1;
            const meta = getEntityMeta(entity, settings);
            const key = meta.name;
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [invoices, scopeVal, entityOptions, settings, getInvoiceScopeAndEntity]);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const filtered = (invoices || []).filter(i => {
        const { entity, isDom } = getInvoiceScopeAndEntity(i);
        if (entityVal && entity !== entityVal) return false;
        if (scopeVal === 'International' && isDom) return false;
        if (scopeVal === 'Domestic' && !isDom) return false;

        const matchesSearch = !searchVal || 
            (i.invoice_no || '').toLowerCase().includes(searchVal.toLowerCase()) ||
            (i.customer_name || '').toLowerCase().includes(searchVal.toLowerCase()) ||
            (i.awb || '').toLowerCase().includes(searchVal.toLowerCase());
        const matchesStatus = !statusVal || i.status === statusVal;
        return matchesSearch && matchesStatus;
    });

    const tablePage = useTablePage(filtered, JSON.stringify([searchVal, statusVal, selectedCenter, scopeVal, entityVal]));

    const exportToCSV = () => {
        if (!invoices || invoices.length === 0) return;
        const headers = [
            'Invoice No', 'Date', 'Customer Name', 'AWB', 'Carrier',
            ...(canViewPrice ? ['Subtotal (INR)', 'GST (INR)', 'Total (INR)', 'Amount Paid (INR)', 'Balance Due (INR)'] : []),
            'Status'
        ];
        const rows = filtered.map(i => [
            i.invoice_no || '',
            i.date || '',
            i.customer_name || '',
            i.awb || '',
            i.courier || '',
            ...(canViewPrice ? [Number(i.amount || 0), Number(i.gst || 0), Number(i.total || 0), Number(i.paid || 0), Number(i.balance || 0)] : []),
            i.status || ''
        ]);
        exportToExcel(headers, rows, `FMC_Invoices_${businessDate()}.xlsx`, 'Invoices');
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
                    <button className="btn btn-outline" disabled={!hasPermission('invoices.export')} onClick={exportToCSV} title="Export Invoices to Excel">
                        <Download size={14} /> Export Excel
                    </button>
                </div>
            </div>

            {/* Top Scope & Entity Switcher Bar (Matching Image Design & Entity Colors) */}
            <div className="scope-entity-bar-sticky" style={{ marginBottom: '6px' }}>
                {/* Left: Scope Selection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        SCOPE:
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="scope-pill-btn"
                            onClick={() => setScopeVal('')}
                            style={!scopeVal ? {
                                background: '#eff6ff',
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                fontWeight: 700
                            } : {}}
                        >
                            <Globe size={15} color={!scopeVal ? '#1d4ed8' : '#64748b'} />
                            <span>Both: <strong>{scopeCounts.all}</strong></span>
                        </button>
                        <button
                            type="button"
                            className="scope-pill-btn"
                            onClick={() => setScopeVal(scopeVal === 'International' ? '' : 'International')}
                            style={scopeVal === 'International' ? {
                                background: '#eff6ff',
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                fontWeight: 700
                            } : {}}
                        >
                            <Plane size={15} color={scopeVal === 'International' ? '#1d4ed8' : '#64748b'} />
                            <span>Intl: <strong>{scopeCounts.intl}</strong></span>
                        </button>
                        <button
                            type="button"
                            className="scope-pill-btn"
                            onClick={() => setScopeVal(scopeVal === 'Domestic' ? '' : 'Domestic')}
                            style={scopeVal === 'Domestic' ? {
                                background: '#fffbeb',
                                borderColor: '#fcd34d',
                                color: '#b45309',
                                fontWeight: 700
                            } : {}}
                        >
                            <Truck size={15} color={scopeVal === 'Domestic' ? '#b45309' : '#64748b'} />
                            <span>Dom: <strong>{scopeCounts.dom}</strong></span>
                        </button>
                    </div>
                </div>

                {/* Right: Entity Selection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ENTITY:
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="entity-pill-btn"
                            onClick={() => setEntityVal('')}
                            style={!entityVal ? {
                                background: '#eff6ff',
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                fontWeight: 700
                            } : {}}
                        >
                            <Building2 size={15} color={!entityVal ? '#1d4ed8' : '#64748b'} />
                            <span>All: <strong>{entityCounts.total}</strong></span>
                        </button>
                        {entityOptions.map(ent => {
                            const count = entityCounts[ent.name] ?? 0;
                            const isSelected = entityVal === ent.name;
                            const activeStyle = isSelected ? {
                                background: ent.bg || '#eff6ff',
                                borderColor: ent.border || ent.color || '#93c5fd',
                                color: ent.accentColor || ent.color || '#1d4ed8',
                                fontWeight: 700,
                                boxShadow: `0 1px 3px ${ent.border || 'rgba(0,0,0,0.08)'}`
                            } : {};
                            return (
                                <button
                                    key={ent.id}
                                    type="button"
                                    className="entity-pill-btn"
                                    onClick={() => setEntityVal(isSelected ? '' : ent.name)}
                                    style={activeStyle}
                                    title={`Filter by ${ent.name}`}
                                >
                                    <span>{ent.shortName || ent.name}: <strong>{count}</strong></span>
                                </button>
                            );
                        })}
                        {(entityVal || scopeVal || searchVal || statusVal) && (
                            <button 
                                type="button"
                                className="entity-pill-btn" 
                                onClick={() => {
                                    setEntityVal('');
                                    setScopeVal('');
                                    setSearchVal('');
                                    setStatusVal('');
                                }}
                                style={{
                                    borderColor: '#fecdd3',
                                    background: '#fff1f2',
                                    color: '#e11d48',
                                    fontWeight: 600
                                }}
                                title="Reset all filters"
                            >
                                <X size={13} /> Clear
                            </button>
                        )}
                    </div>
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
                                {canViewPrice && (
                                    <>
                                        <th>Total Amount</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                    </>
                                )}
                                <th>Status</th>
                                <th className="invoice-actions-column">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={canViewPrice ? 9 : 6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No invoices found matching criteria.</td></tr>
                            ) : (
                                tablePage.rows.map(inv => (
                                    <tr key={inv.id}>
                                        <td><strong style={{ color: 'var(--primary-blue)' }}>{inv.invoice_no}</strong></td>
                                        <td style={{ color: 'var(--text-muted)' }}>{formatDate(inv.date)}</td>
                                        <td><strong>{inv.customer_name}</strong></td>
                                        <td>
                                            <div className="invoice-awb-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <TrackingLink awb={inv.awb} courier={inv.courier} className="status-pill in-transit" style={{ fontFamily: 'monospace' }} />
                                                {inv.courier && <CourierLogo courier={inv.courier} height={15} />}
                                                {inv.is_ddp !== undefined && (
                                                    <span className={inv.is_ddp ? 'ddp-tag-paid' : 'ddp-tag-unpaid'} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                                        {inv.is_ddp ? '✓ DDP Paid' : 'DDP Not Paid'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {canViewPrice && (
                                            <>
                                                <td style={{ fontWeight: 800 }}>{formatCurrency(inv.total)}</td>
                                                <td style={{ color: 'var(--emerald)', fontWeight: 700 }}>{formatCurrency(inv.paid)}</td>
                                                <td style={{ color: inv.balance > 0 ? 'var(--rose)' : 'var(--text-muted)', fontWeight: 700 }}>
                                                    {formatCurrency(inv.balance)}
                                                </td>
                                            </>
                                        )}
                                        <td>
                                            <span className={`status-pill ${inv.status === 'Paid' ? 'delivered' : inv.status === 'Partial' ? 'picked-up' : 'delayed'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="invoice-actions-column">
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                {inv.customer_phone && (
                                                    <button
                                                        type="button"
                                                        className="btn-action-icon"
                                                        title="WhatsApp Reminder"
                                                        onClick={() => openWhatsApp({ phone: inv.customer_phone, message: CommTemplates.paymentReminder({ customerName: inv.customer_name, dueAmount: inv.balance || inv.total, invoiceNo: inv.invoice_no, awb: inv.awb }) })}
                                                    >
                                                        <MessageSquare size={13} color="#25D366" />
                                                    </button>
                                                )}
                                                {inv.customer_email && (
                                                    <button
                                                        type="button"
                                                        className="btn-action-icon"
                                                        title="Email Notice"
                                                        onClick={() => openEmail({ email: inv.customer_email, subject: `Invoice #${inv.invoice_no} Payment Notice`, body: CommTemplates.paymentReminder({ customerName: inv.customer_name, dueAmount: inv.balance || inv.total, invoiceNo: inv.invoice_no, awb: inv.awb }) })}
                                                    >
                                                        <Mail size={13} color="#3b82f6" />
                                                    </button>
                                                )}
                                                <button className="btn btn-sm btn-primary-blue" title="View invoice" aria-label={`View invoice ${inv.invoice_no}`} onClick={() => onPreviewInvoice(inv)}>
                                                    <Printer size={12} style={{flexShrink: 0}} /> View
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination {...tablePage} />
            </div>
        </div>
    );
};

export const Accounts = props => {
    const { hasPermission, currentUser } = useAuth();
    if (!hasPermission('accounts.view')) return <div className="dash-box">Accounts access required.</div>;
    return <AccountsOverview
        data={props.overviewData || props.accountsData}
        selectedCenter={props.selectedCenter}
        activeSection={props.activeSection}
        canEdit={currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin'}
        onSectionChange={props.onSectionChange}
        onRefresh={props.onRefresh}
        settings={props.settings}
        renderSection={tab => ['b2b', 'refunds'].includes(tab)
            ? props.renderRelatedSection?.(tab)
            : <LegacyAccounts {...props} activeSection={tab === 'wallets' ? 'prepaid' : tab} />}
    />;
};


const CarrierPayoutLedger = ({ postpaidAccounts = [], onRefresh, carrierFilter = '', onCarrierChange }) => {
    const [accountFilter, setAccountFilter] = useState('');
    const [searchVal, setSearchVal] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 15;
    const loadEntries = useCallback(() => apiClient.getAccountingEntries({
        kind: 'provider_payment,provider_deposit', provider: carrierFilter || undefined,
        date_from: dateFrom || undefined, date_to: dateTo || undefined,
        limit: pageSize, offset: (page - 1) * pageSize,
    }), [carrierFilter, dateFrom, dateTo, page]);
    const { data: entryData, loading, error: entriesError, reload: fetchEntries } = useRemoteData(loadEntries);
    const entries = useMemo(() => entryData?.items || [], [entryData]);
    const totalCount = entryData?.total_count || 0;

    const filteredEntries = useMemo(() => {
        return entries.filter(item => {
            if (accountFilter && item.account !== accountFilter) return false;
            if (searchVal) {
                const s = searchVal.toLowerCase();
                const match = [item.provider, item.account, item.reference, item.payment_mode, item.vendor, item.payment_details?.remarks]
                    .some(val => String(val || '').toLowerCase().includes(s));
                if (!match) return false;
            }
            return true;
        });
    }, [entries, accountFilter, searchVal]);

    const accountsList = useMemo(() => {
        return Array.from(new Set(entries.map(e => e.account).filter(Boolean))).sort();
    }, [entries]);

    const handleExport = () => {
        if (!filteredEntries.length) {
            alert('No carrier payout records to export.');
            return;
        }
        const headers = ['Date', 'Carrier Partner', 'Transaction Type', 'Paid From Account', 'Amount (INR)', 'Payment Mode', 'Reference / UTR', 'Remarks'];
        const rows = filteredEntries.map(e => [
            e.date || '',
            e.provider || '—',
            e.kind === 'provider_deposit' ? 'Security Deposit' : 'Carrier Payout',
            e.account || '—',
            Number(e.amount || 0),
            e.payment_mode || '—',
            e.reference || '—',
            e.payment_details?.remarks || e.vendor || ''
        ]);
        exportToExcel(headers, rows, `FMC_Carrier_Payouts_${businessDate()}.xlsx`, 'Carrier_Payouts');
    };

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const totalAmount = filteredEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return (
        <div className="dash-box" id="carrier-payout-history" style={{ marginTop: '8px' }}>
            {entriesError && <p role="alert">Unable to load payouts. Use Refresh to retry.</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📜 Carrier Payout & Settlement History</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Complete audit trail of payouts sent to courier partners, accounts debited, UTR numbers, and recorded references.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button 
                        type="button" 
                        className="btn btn-outline" 
                        onClick={handleExport}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                        title="Export Carrier Payouts to Excel"
                    >
                        <Download size={13} /> Export Payouts Excel
                    </button>
                    <button 
                        type="button" 
                        className="btn btn-outline" 
                        onClick={() => { fetchEntries(); onRefresh?.(); }}
                        style={{ fontSize: '12px', padding: '6px 10px' }}
                        title="Refresh payout records"
                    >
                        <RotateCcw size={13} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 'min(180px, 100%)' }}>
                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        className="filter-input" 
                        placeholder="Search UTR, notes, accounts..." 
                        style={{ paddingLeft: '30px', fontSize: '12px', width: '100%' }}
                        value={searchVal}
                        onChange={e => setSearchVal(e.target.value)}
                    />
                </div>

                {/* Courier Filter */}
                <select 
                    className="filter-select" 
                    value={carrierFilter} 
                    onChange={e => { onCarrierChange?.(e.target.value); setPage(1); }}
                    style={{ fontSize: '12px', fontWeight: carrierFilter ? 700 : 500 }}
                >
                    <option value="">🏢 All Carrier Partners</option>
                    {postpaidAccounts.map(p => (
                        <option key={p.name} value={p.name}>{p.name} Account</option>
                    ))}
                </select>

                {/* Account Filter */}
                <select 
                    className="filter-select" 
                    value={accountFilter} 
                    onChange={e => setAccountFilter(e.target.value)}
                    style={{ fontSize: '12px', fontWeight: accountFilter ? 700 : 500 }}
                >
                    <option value="">💳 All Payment Accounts</option>
                    {accountsList.map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                    ))}
                </select>

                {/* Date range */}
                <input 
                    type="date" 
                    className="filter-input" 
                    style={{ fontSize: '12px', width: '130px' }}
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    title="From Date"
                />
                <input 
                    type="date" 
                    className="filter-input" 
                    style={{ fontSize: '12px', width: '130px' }}
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    title="To Date"
                />

                {(carrierFilter || accountFilter || searchVal || dateFrom || dateTo) && (
                    <button 
                        type="button" 
                        className="btn btn-outline"
                        style={{ fontSize: '11.5px', padding: '4px 8px' }}
                        onClick={() => { onCarrierChange?.(''); setAccountFilter(''); setSearchVal(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                    >
                        Reset Filters
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '12.5px' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>Date</th>
                            <th style={{ textAlign: 'left' }}>Carrier Partner</th>
                            <th style={{ textAlign: 'left' }}>Type</th>
                            <th style={{ textAlign: 'left' }}>Paid From Account</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th style={{ textAlign: 'left' }}>Mode</th>
                            <th style={{ textAlign: 'left' }}>Reference / UTR</th>
                            <th style={{ textAlign: 'left' }}>Remarks / Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                                    <ButtonSpinner text="Loading carrier payout records..." />
                                </td>
                            </tr>
                        ) : filteredEntries.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>📭</div>
                                    <strong>No carrier payment records found</strong>
                                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                                        {carrierFilter ? `No payouts recorded for ${carrierFilter}.` : 'Record payouts using the Courier Payment form on the right or via Record Financial Transaction.'}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            filteredEntries.map(item => (
                                <tr key={item.id}>
                                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatDate(item.date)}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <CourierLogo courier={item.provider} height={16} />
                                            <strong>{item.provider || 'Carrier Partner'}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${item.kind === 'provider_deposit' ? 'in-transit' : 'delivered'}`} style={{ fontSize: '10.5px' }}>
                                            {item.kind === 'provider_deposit' ? 'Deposit' : 'Payout'}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--primary-blue, #2563eb)' }}>
                                        {item.account || '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--emerald, #10b981)', fontSize: '13.5px' }}>
                                        {formatCurrency(item.amount)}
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>{item.payment_mode || '—'}</span>
                                    </td>
                                    <td>
                                        <code style={{ fontSize: '11.5px', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                                            {item.reference || '—'}
                                        </code>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '12px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.payment_details?.remarks || item.vendor || '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Summary & Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--card-border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div>
                    Showing <strong>{filteredEntries.length}</strong> of <strong>{totalCount}</strong> transactions
                    {filteredEntries.length > 0 && (
                        <span style={{ marginLeft: '12px' }}>
                            Total Filtered Payout: <strong style={{ color: 'var(--emerald, #10b981)' }}>{formatCurrency(totalAmount)}</strong>
                        </span>
                    )}
                </div>
                {totalCount > pageSize && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                            type="button" 
                            className="btn btn-outline" 
                            style={{ padding: '3px 8px', fontSize: '11.5px' }} 
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            &larr; Prev
                        </button>
                        <span style={{ padding: '4px 8px', fontWeight: 700 }}>Page {page} of {Math.ceil(totalCount / pageSize)}</span>
                        <button 
                            type="button" 
                            className="btn btn-outline" 
                            style={{ padding: '3px 8px', fontSize: '11.5px' }} 
                            disabled={page >= Math.ceil(totalCount / pageSize)}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next &rarr;
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const LegacyAccounts = ({
    settings,
    onRefresh,
    accountsData, 
    reconciliations, 
    onOpenWalletModal, 
    onOpenReconciliationModal,
    activeSection,
}) => {
    const { hasPermission, currentUser } = useAuth();
    const [tabSelection, setTabSelection] = useState({ source: activeSection, value: null });
    const setTab = value => setTabSelection({ source: activeSection, value });
    const [selectedPostpaidCarrier, setSelectedPostpaidCarrier] = useState('');
    const [entry, setEntry] = useState({kind: 'expense', category: '', date: new Date().toLocaleDateString('en-CA'), provider: '', amount: '', reference: '', account: '', vendor: '', payment_mode: 'UPI', payment_details: {}});
    const [saving, setSaving] = useState(false);
    const [entryMessage, setEntryMessage] = useState('');

    const submitEntry = async e => {
        e.preventDefault();
        setSaving(true);
        setEntryMessage('');
        try {
            await apiClient.recordAccountingEntry({...entry, category: entry.kind === 'expense' ? entry.category.trim() : null, amount: Number(entry.amount), provider: entry.kind === 'expense' ? null : entry.provider});
            setEntry(prev => ({...prev, amount: '', reference: ''}));
            setEntryMessage('Transaction recorded successfully.');
            await onRefresh();
        } catch (error) {
            setEntryMessage(error.response?.data?.detail || 'Unable to record transaction.');
        } finally { setSaving(false); }
    };

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const section = (activeSection || '').toLowerCase();
    const sectionTab = !section || ['overview', 'shipment_accounts'].includes(section) ? 'overview'
        : /wallet|prepaid/.test(section) ? 'wallets'
        : /provider|aramex|bluedart|fedex|dhl|postpaid/.test(section) ? 'postpaid'
        : /reconcil/.test(section) ? 'reconciliation'
        : /expense|transaction/.test(section) ? 'transactions' : 'collections';
    const tab = tabSelection.source === activeSection && tabSelection.value ? tabSelection.value : sectionTab;

    if (!hasPermission('accounts.view')) {
        return <div className="dash-box" role="status"><h2>Accounts access required</h2><p>Your role does not have permission to view accounts. Contact your administrator if you need access.</p></div>;
    }

    if (!accountsData) {
        return <ContentShimmer message="Synchronizing Bank Ledgers, Provider Wallets & Discrepancy Logs..." />;
    }

    const totalWalletBalance = (accountsData.prepaid_wallets || []).reduce((sum, w) => sum + (Number(w.current_balance) || 0), 0);
    const totalPostpaidPayable = (accountsData.postpaid_accounts || []).reduce((sum, p) => sum + (Number(p.net_payable) || 0), 0);



    return (
        <div className="accounts-page" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 0 }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '21px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💰</span> Financial Accounts & Carrier Ledgers
                    </h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Manage customer receipts, prepaid provider wallets, postpaid monthly billing, and carrier reconciliations.
                    </p>
                </div>
                {hasPermission('runReconciliation') && (
                    <button className="btn btn-primary-blue" onClick={onOpenReconciliationModal} title="Upload carrier bill statement and run reconciliation">
                        <Scale size={15} /> Run Reconciliation
                    </button>
                )}
            </div>

            <button className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => setTab('overview')}>&larr; Back to Accounts Overview</button>
            {/* Segmented Tab Capsule */}
            <div className="fmc-segmented-capsule report-tabs" style={{ alignSelf: 'flex-start' }}>
                <button 
                    className={`fmc-segmented-btn ${tab === 'collections' ? 'active' : ''}`}
                    onClick={() => setTab('collections')}
                >
                    <CreditCard size={14} /> Customer Collections & Receipts
                </button>
                <button 
                    className={`fmc-segmented-btn ${tab === 'wallets' ? 'active' : ''}`}
                    onClick={() => setTab('wallets')}
                >
                    <CreditCard size={14} /> Prepaid Wallets ({accountsData.prepaid_wallets?.length || 0})
                </button>
                <button 
                    className={`fmc-segmented-btn ${tab === 'postpaid' ? 'active' : ''}`}
                    onClick={() => setTab('postpaid')}
                >
                    <FileText size={14} /> Postpaid Accounts ({accountsData.postpaid_accounts?.length || 0})
                </button>
                {(currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin') && (
                    <button 
                        className={`fmc-segmented-btn ${tab === 'transactions' ? 'active' : ''}`}
                        onClick={() => setTab('transactions')}
                    >
                        <Plus size={14} /> Record Expense / Payout
                    </button>
                )}
                <button 
                    className={`fmc-segmented-btn ${tab === 'reconciliation' ? 'active' : ''}`}
                    onClick={() => setTab('reconciliation')}
                >
                    <Scale size={14} /> Bill Reconciliation ({reconciliations?.length || 0})
                </button>
            </div>

            {/* TAB 1: Customer Collections & Receipts */}
            {tab === 'collections' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Top 4 KPI Cards */}
                    <div className="dash-stat-cards-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                        <div className="dash-mini-card" style={{ borderTop: '3px solid var(--primary-blue)' }}>
                            <span className="card-label">Total Customer Sales (With GST)</span>
                            <div className="card-value" style={{ color: 'var(--primary-blue)' }}>
                                {formatCurrency(accountsData.total_sales_with_gst ?? ((accountsData.total_sales || 0) + (accountsData.gst_total || 0)))}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Excl. GST: {formatCurrency(accountsData.total_sales)}</span>
                        </div>
                        <div className="dash-mini-card" style={{ borderTop: '3px solid var(--emerald)' }}>
                            <span className="card-label">Total Collected</span>
                            <div className="card-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(accountsData.total_collected)}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Payments received</span>
                        </div>
                        <div className="dash-mini-card" style={{ borderTop: '3px solid var(--amber)' }}>
                            <span className="card-label">Pending Retail Collection</span>
                            <div className="card-value" style={{ color: 'var(--amber)' }}>{formatCurrency(accountsData.pending_collection)}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending customer payments</span>
                        </div>
                        <div className="dash-mini-card" style={{ borderTop: '3px solid var(--sky)' }}>
                            <span className="card-label">B2B Credit Receivables</span>
                            <div className="card-value" style={{ color: 'var(--sky)' }}>{formatCurrency(accountsData.b2b_credit_sales)}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pending B2B payments</span>
                        </div>
                    </div>

                    {/* Breakdown by Mode and Destination Account */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                        <div className="dash-box">
                            <h4 style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>💳 Collections by Payment Mode</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--card-border)' }}>
                                    <span>💵 Cash at Counter:</span><strong>{formatCurrency(accountsData.cash_collected)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--card-border)' }}>
                                    <span>📱 UPI / QR Payments:</span><strong>{formatCurrency(accountsData.upi_collected)}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                                    <span>🏦 Bank Transfer (NEFT/RTGS):</span><strong>{formatCurrency(accountsData.bank_collected)}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="dash-box">
                            <h4 style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>🏦 Collections by Destination Account (paid_to)</h4>
                            <div className="settings-chips-scroll" style={{ maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                                {Object.entries(accountsData.collections_by_account || {}).length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>No receipts recorded yet.</div>
                                ) : (
                                    Object.entries(accountsData.collections_by_account || {}).map(([acc, amt]) => (
                                        <div key={acc} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--card-border)' }}>
                                            <span>{acc}:</span><strong style={{ color: 'var(--emerald)' }}>{formatCurrency(amt)}</strong>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Receipt Ledger & Account Checks */}
                    <AccountChecks />
                </div>
            )}

            {/* TAB 2: Prepaid Provider Wallets */}
            {tab === 'wallets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="dash-box" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(59, 130, 246, 0.04))', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                    👛 Prepaid Logistics Wallets (ICL, BRV, etc.)
                                </h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                    Recharging a wallet is an internal fund transfer. Charges occur only when the wallet is debited on booking shipments.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="pill-stat" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#047857', fontSize: '12px' }}>
                                    Total Active Balance: <strong>{formatCurrency(totalWalletBalance)}</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                        {accountsData.prepaid_wallets?.map(w => (
                            <div id={`wallet-${encodeURIComponent(w.name)}`} key={w.name} className="dash-box" style={{ borderTop: '3px solid #10b981' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CourierLogo courier={w.name} height={16} />
                                            <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{w.name} Wallet</strong>
                                        </div>
                                        <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--emerald)', margin: '6px 0 2px' }}>
                                            {formatCurrency(w.current_balance)}
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Available Operating Balance</span>
                                    </div>
                                    <button className="btn btn-sm btn-primary-blue" onClick={() => onOpenWalletModal(w.name)}>
                                        <Plus size={13} /> Top-up Wallet
                                    </button>
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--card-border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                    <span>Opening: <strong>{formatCurrency(w.opening_balance)}</strong></span>
                                    <span>Recharged: <strong style={{ color: 'var(--emerald)' }}>+{formatCurrency(w.total_recharges)}</strong></span>
                                    <span>Used: <strong style={{ color: 'var(--rose)' }}>-{formatCurrency(w.total_usage)}</strong></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: Postpaid Provider Accounts */}
            {tab === 'postpaid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="dash-box" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.04))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                    📋 Postpaid Courier Accounts (Aramex, Blue Dart, FedEx, DHL, etc.)
                                </h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                    Shipments accrue predicted carrier values. Month-end carrier bills are reconciled, and supplier payouts reduce net payable.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="pill-stat" style={{ background: '#ffe4e6', color: '#be123c', fontSize: '12px' }}>
                                    Total Net Outstanding: <strong>{formatCurrency(totalPostpaidPayable)}</strong>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                        {accountsData.postpaid_accounts?.map(p => (
                            <div id={`provider-${encodeURIComponent(p.name)}`} key={p.name} className="dash-box" style={{ borderTop: '3px solid #3b82f6' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CourierLogo courier={p.name} height={16} />
                                        <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{p.name} Account</strong>
                                    </div>
                                    <span 
                                        className="status-pill in-transit" 
                                        style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600, 
                                            background: 'rgba(59, 130, 246, 0.12)', 
                                            color: 'var(--primary-blue)', 
                                            border: '1px solid rgba(59, 130, 246, 0.25)', 
                                            padding: '2px 8px', 
                                            borderRadius: '12px' 
                                        }}
                                        title="Carrier Payment Terms (Configurable in Settings > Payments & Carriers)"
                                    >
                                        ⏱️ {p.payment_terms && p.payment_terms !== 'Not set' ? p.payment_terms : '30 Days'}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0', padding: '8px', background: 'var(--bg-app)', borderRadius: '6px' }}>
                                    <div>
                                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Net Payable (Due)</span>
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: Number(p.net_payable) > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                                            {formatCurrency(p.net_payable)}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Unbilled Usage</span>
                                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary-blue)' }}>
                                            {formatCurrency(p.unbilled_usage)}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--card-border)', paddingTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Total Reconciled Bills:</span>
                                        <strong>{formatCurrency(p.actual_billed)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Payouts Made to Carrier:</span>
                                        <strong style={{ color: 'var(--emerald)' }}>{formatCurrency(p.payments_made)}</strong>
                                    </div>
                                    {Number(p.unapplied_payments) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }} title="Recorded payouts exceeding the remaining reconciled shipment values. Review carrier records before treating this as refundable credit.">
                                            <span>Unapplied Payments:</span>
                                            <strong style={{ color: 'var(--emerald)' }}>{formatCurrency(p.unapplied_payments)}</strong>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Security Deposit Held:</span>
                                        <strong>{formatCurrency(p.deposit)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Unbilled Shipments:</span>
                                        <strong>{p.unbilled_shipments_count ?? 0} shipments</strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--card-border)' }}>
                                        <button 
                                            type="button" 
                                            className="btn btn-outline" 
                                            style={{ flex: 1, padding: '4px 8px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                            onClick={() => {
                                                setSelectedPostpaidCarrier(prev => prev === p.name ? '' : p.name);
                                                document.getElementById('carrier-payout-history')?.scrollIntoView({ behavior: 'smooth' });
                                            }}
                                            title={`Filter payout history for ${p.name}`}
                                        >
                                            📜 {selectedPostpaidCarrier === p.name ? 'Showing History' : 'View Payout History'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Carrier Payouts & Transaction History Table */}
                    <CarrierPayoutLedger 
                        postpaidAccounts={accountsData.postpaid_accounts || []} 
                        carrierFilter={selectedPostpaidCarrier}
                        onCarrierChange={setSelectedPostpaidCarrier}
                        onRefresh={onRefresh}
                    />
                </div>
            )}

            {/* TAB 4: Record Expense / Payout Form */}
            {tab === 'transactions' && (currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin') && (
                <div style={{ maxWidth: '720px' }}>
                    <form className="dash-box" onSubmit={submitEntry}>
                        <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                💸 Record Financial Transaction
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                Record office operating expenses, payouts made to postpaid logistics providers, or carrier security deposits.
                            </p>
                        </div>

                        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                            <div className="form-group">
                                <label>Transaction Type</label>
                                <select value={entry.kind} onChange={e => setEntry({...entry, kind: e.target.value})}>
                                    <option value="expense">Operating Expense</option>
                                    <option value="provider_payment">Carrier Provider Payment (Paying Aramex, Blue Dart)</option>
                                    <option value="provider_deposit">Carrier Security Deposit</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input required type="date" value={entry.date} onChange={e => setEntry({...entry, date: e.target.value})} />
                            </div>
                            {entry.kind === 'expense' && (
                                <div className="form-group">
                                    <label htmlFor="expense-category">Expense Category</label>
                                    <input id="expense-category" required maxLength={100} list="expense-categories"
                                        placeholder="Select or type your own category"
                                        value={entry.category} onChange={e => setEntry({...entry, category: e.target.value})} />
                                    <datalist id="expense-categories">
                                        {(accountsData.expense_categories || []).map(category => <option key={category} value={category} />)}
                                    </datalist>
                                    <small>New categories are saved when you record an expense and appear in reports.</small>
                                </div>
                            )}
                            {entry.kind !== 'expense' && (
                                <div className="form-group">
                                    <label>Carrier Provider</label>
                                    <select required value={entry.provider} onChange={e => setEntry({...entry, provider: e.target.value})}>
                                        <option value="">Select carrier partner</option>
                                        {accountsData.postpaid_accounts?.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <input required type="number" min="0.01" step="0.01" placeholder="Enter amount..." value={entry.amount} onChange={e => setEntry({...entry, amount: e.target.value})} />
                            </div>
                            <div className="form-group">
                                <label>Payment Account (Paid From)</label>
                                <input required placeholder="e.g. HDFC Bank, Office QR, Cash" value={entry.account} onChange={e => setEntry({...entry, account: e.target.value})} />
                            </div>
                            {entry.kind === 'expense' && <label className="form-group">Vendor / person paid *<input required maxLength={150} value={entry.vendor} onChange={e => setEntry({...entry, vendor: e.target.value})} /></label>}
                            <label className="form-group">Payment mode<select value={entry.payment_mode} onChange={e => setEntry({...entry, payment_mode: e.target.value})}>{['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other'].map(m => <option key={m}>{m}</option>)}</select></label>
                            <PaymentDetails referenceOnly={entry.kind === 'expense'} onAccountChange={account => setEntry(prev => ({...prev, account}))} method={entry.payment_mode} value={entry.payment_details} onChange={payment_details => setEntry(prev => ({...prev, payment_details}))} reference={entry.reference} onReferenceChange={reference => setEntry({...entry, reference})} profiles={settings?.paymentAccounts || []} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--card-border)' }}>
                            <button className="btn btn-primary-blue" disabled={saving}>
                                {saving ? <ButtonSpinner text="Recording Transaction…" /> : 'Record Transaction'}
                            </button>
                            {entryMessage && (
                                <span style={{ fontSize: '12.5px', fontWeight: 700, color: entryMessage.includes('success') ? 'var(--emerald)' : 'var(--rose)' }}>
                                    {entryMessage}
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* TAB 5: Bill Reconciliation */}
            {tab === 'reconciliation' && (
                <div id="account-reconciliation" className="table-card">
                    <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Carrier Provider Reconciliation History</h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                Audit log of uploaded carrier invoices matched AWB-by-AWB against booking estimates.
                            </p>
                        </div>
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
            )}
        </div>
    );
};

export const B2B = ({ b2bData, selectedCenter, onOpenCustomerDrawer, onOpenB2BModal, onRefresh }) => {
    const { hasPermission } = useAuth();
    const canViewPrice = hasPermission('costs.customer_price');
    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const activeData = b2bData;
    const companyPage = useTablePage(b2bData?.companies || [], selectedCenter);

    if (!activeData) {
        return (
            <div className="b2b-directory-page">
                <div className="page-header">
                    <div>
                        <h2 className="page-title">🏢 B2B Corporate Credit & Aging Receivables</h2>
                        <p className="page-subtitle">Manage corporate credit limits, payment terms, and 5-bucket aging schedule</p>
                    </div>
                </div>
                <ContentShimmer message="Loading corporate accounts..." />
            </div>
        );
    }

    const handleManualRefresh = async () => {
        if (onRefresh && !isRefreshing) {
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
        const headers = [
            'Company', 'Contact Person', 'Mobile',
            ...(canViewPrice ? ['Credit Limit (INR)', 'Total Billed (INR)', 'Outstanding (INR)'] : []),
            'Credit Period (Days)', 'Status'
        ];
        const rows = activeData.companies.map(c => [
            c.company || '',
            c.contact_name || '',
            c.mobile || '',
            ...(canViewPrice ? [Number(c.credit_limit || 0), Number(c.total_billed || 0), Number(c.outstanding || 0)] : []),
            Number(c.credit_period_days || 30),
            c.status || ''
        ]);
        exportToExcel(headers, rows, `FMC_B2B_Accounts_${businessDate()}.xlsx`, 'B2B_Accounts');
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
                        <Download size={14} /> Export Excel
                    </button>
                    <button className="btn btn-primary-blue" onClick={onOpenB2BModal}>
                        <Plus size={15} /> Add B2B Client
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            {canViewPrice && (
                <>
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
                </>
            )}

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
                                {canViewPrice && (
                                    <>
                                        <th style={{ minWidth: '120px' }}>Credit Limit</th>
                                        <th style={{ minWidth: '120px' }}>Outstanding</th>
                                        <th style={{ minWidth: '120px' }}>Limit Utilized</th>
                                    </>
                                )}
                                <th style={{ minWidth: '100px' }}>Terms</th>
                                <th style={{ minWidth: '110px' }}>Status</th>
                                <th style={{ minWidth: '100px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeData.companies && activeData.companies.length > 0 ? (
                                companyPage.rows.map(c => {
                                    const util = c.credit_utilized_percent || 0;
                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <strong style={{ color: 'var(--text-main)' }}>{c.company}</strong>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{c.contact_name}</div>
                                            </td>
                                            <td>{c.mobile}</td>
                                            {canViewPrice && (
                                                <>
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
                                                </>
                                            )}
                                            <td><span className="status-pill in-transit">{c.credit_period_days} Days</span></td>
                                            <td>
                                                <span className={`status-pill ${c.outstanding > c.credit_limit ? 'delayed' : (c.outstanding > 0 ? 'picked-up' : 'delivered')}`}>
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                    {c.mobile && (
                                                        <button
                                                            type="button"
                                                            className="btn-action-icon"
                                                            title="Send WhatsApp to Corporate Contact"
                                                            onClick={() => openWhatsApp({ phone: c.mobile, message: c.outstanding > 0 ? CommTemplates.paymentReminder({ customerName: c.company, dueAmount: c.outstanding }) : CommTemplates.generalGreeting({ customerName: c.company }) })}
                                                        >
                                                            <MessageSquare size={13} color="#25D366" />
                                                        </button>
                                                    )}
                                                    {c.email && (
                                                        <button
                                                            type="button"
                                                            className="btn-action-icon"
                                                            title="Send Corporate Email"
                                                            onClick={() => openEmail({ email: c.email, subject: `Corporate Account Statement - ${c.company}`, body: c.outstanding > 0 ? CommTemplates.paymentReminder({ customerName: c.company, dueAmount: c.outstanding }) : CommTemplates.generalGreeting({ customerName: c.company }) })}
                                                        >
                                                            <Mail size={13} color="#3b82f6" />
                                                        </button>
                                                    )}
                                                    <button className="btn btn-sm btn-outline" onClick={() => onOpenCustomerDrawer(c.id)}>
                                                        Statement
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={canViewPrice ? 8 : 5} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
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
                <TablePagination {...companyPage} />
            </div>
        </div>
    );
};
