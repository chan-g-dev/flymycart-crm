import { businessDate } from '../utils/businessDates';
import React, { useRef } from 'react';
import { 
    Package, 
    CircleDollarSign, 
    Wallet, 
    Building2, 
    PhoneCall, 
    RotateCcw, 
    Plus, 
    FileText, 
    ClipboardList, 
    RefreshCw, 
    Phone,
    ShieldCheck,
    X
} from 'lucide-react';
import { CourierLogo } from '../components/CourierLogos';
import { useAuth } from '../context/AuthContext';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSpinner';
import { TrackingLink } from '../components/TrackingLink';

export const Dashboard = ({ 
    data, 
    shipments = [],
    accountsData, 
    b2bData, 
    followups = [], 
    onNavigate, 
    onOpenShipmentModal, 
    onOpenReconciliationModal,
    onOpenCustomerDrawer,
    isLoading = false
}) => {
    const { currentUser } = useAuth();
    const quickActionsDialog = useRef(null);
    const runQuickAction = (action) => {
        quickActionsDialog.current?.close();
        action?.();
    };
    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatCompactCurrency = (n) => {
        const num = Number(n || 0);
        if (Math.abs(num) >= 10000000) {
            return '₹' + (num / 10000000).toFixed(2).replace(/\.00$/, '') + 'Cr';
        }
        if (Math.abs(num) >= 100000) {
            return '₹' + (num / 100000).toFixed(2).replace(/\.00$/, '') + 'L';
        }
        if (Math.abs(num) >= 10000) {
            return '₹' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return '₹' + num.toLocaleString('en-IN');
    };
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const safeData = data || {};
    const effectiveShipments = (safeData.recent_shipments && safeData.recent_shipments.length > 0) 
        ? safeData.recent_shipments 
        : (shipments || []);

    const todayStr = businessDate();
    const todayShipments = effectiveShipments.filter(s => s.date === todayStr);

    // Active operational metrics
    const todayBookingsCount = safeData.today_shipments_count ?? todayShipments.length;
    const todaySales = safeData.today_sales ?? todayShipments.reduce((acc, s) => acc + (s.price || 0), 0);
    const todayCollected = safeData.today_collected ?? todayShipments.reduce((acc, s) => s.payment_status === 'Paid' ? acc + (s.price || 0) : acc, 0);
    const b2bOutstanding = safeData.b2b_outstanding ?? b2bData?.total_outstanding ?? 0;
    const b2bOverdueCount = safeData.b2b_overdue_count ?? b2bData?.overdue_count ?? (b2bData?.companies || []).filter(c => (c.outstanding_balance || 0) > 0).length;
    const followupsDue = safeData.followups_due ?? followups.filter(f => f.status === 'Pending').length;
    const refundsPending = safeData.refunds_pending ?? 0;

    // Operational Volume counts only shipments still in the active fleet.
    const courierMap = {};
    effectiveShipments.filter(s => ['Booked', 'Picked Up', 'In Transit', 'Delayed'].includes(s.status)).forEach(s => {
        if (s.courier) courierMap[s.courier] = (courierMap[s.courier] || 0) + 1;
    });
    const activeCourierMap = safeData.active_courier_counts ?? courierMap;
    const fedexCount = activeCourierMap['FedEx'] ?? 0;
    const aramexCount = activeCourierMap['Aramex'] ?? 0;
    const delhiveryCount = activeCourierMap['Delhivery'] ?? 0;
    const bluedartCount = activeCourierMap['Blue Dart'] ?? 0;
    const dhlCount = (activeCourierMap['DHL'] ?? 0) + (activeCourierMap['DHL Express'] ?? 0);

    const totalFleetVolume = safeData.active_volume ?? effectiveShipments.length;
    const inTransitVolume = safeData.in_transit_count ?? effectiveShipments.filter(s => ['In Transit', 'Picked Up', 'Booked'].includes(s.status)).length;
    const deliveredVolume = safeData.delivered_count ?? effectiveShipments.filter(s => s.status === 'Delivered').length;

    // Financial totals for Donut
    const totalSales = safeData.total_sales ?? accountsData?.total_sales ?? 0;
    const totalCollected = safeData.total_collected ?? accountsData?.total_collected ?? 0;
    const pendingCollection = Math.max(0, totalSales - totalCollected);
    const providerCost = safeData.total_provider_cost ?? 0;
    const grossProfit = safeData.total_gross_profit ?? 0;
    const collectionPercent = totalSales > 0 ? Math.min(100, Math.round((totalCollected / totalSales) * 100)) : 0;
    const marginPercent = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;
    const agingNotDue = b2bData?.aging?.not_due ?? 0;
    const aging1To30 = b2bData?.aging?.days1_30 ?? 0;
    const aging31To60 = b2bData?.aging?.days31_60 ?? 0;
    const agingTotal = agingNotDue + aging1To30 + aging31To60;
    const agingNotDuePercent = agingTotal > 0 ? (agingNotDue / agingTotal) * 100 : 0;
    const aging1To30Percent = agingTotal > 0 ? (aging1To30 / agingTotal) * 100 : 0;
    const aging31To60Percent = agingTotal > 0 ? (aging31To60 / agingTotal) * 100 : 0;

    // Top followups
    const pendingFollowups = (followups || []).filter(f => f.status === 'Pending').slice(0, 3);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top 6 Corporate KPI Stat Cards */}
            {isLoading && !data && effectiveShipments.length === 0 ? (
                <CardSkeleton count={6} />
            ) : (
                <div className="dash-stat-cards-grid dashboard-kpi-grid">
                    {/* 1. Today's Bookings */}
                <div className="dash-mini-card">
                    <div className="dash-mini-card-header">
                        <div className="dash-mini-icon-box">
                            <Package size={15} />
                        </div>
                        <span className="card-label">Today's Bookings</span>
                    </div>
                    <div className="card-value">{todayBookingsCount}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fleet Active: {totalFleetVolume}</span>
                        <a href="javascript:void(0)" onClick={() => onNavigate('shipments')} className="card-link">
                            <span>View all</span> &rarr;
                        </a>
                    </div>
                </div>

                {/* 2. Today's Sales */}
                <div className="dash-mini-card">
                    <div className="dash-mini-card-header">
                        <div className="dash-mini-icon-box">
                            <CircleDollarSign size={15} />
                        </div>
                        <span className="card-label">Today's Sales</span>
                    </div>
                    <div className="card-value">{formatCurrency(safeData.today_sales_with_gst ?? (todaySales > 0 ? todaySales * 1.18 : 0))}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatCurrency(todaySales)} Base • M-T-D: {formatCurrency(safeData.total_sales_with_gst ?? (totalSales > 0 ? totalSales * 1.18 : 0))} with GST
                        </span>
                        <a href="javascript:void(0)" onClick={() => onNavigate('reports')} className="card-link">
                            <span>Reports</span> &rarr;
                        </a>
                    </div>
                </div>

                {/* 3. Today's Collection */}
                <div className="dash-mini-card">
                    <div className="dash-mini-card-header">
                        <div className="dash-mini-icon-box">
                            <Wallet size={15} />
                        </div>
                        <span className="card-label">Today's Collection</span>
                    </div>
                    <div className="card-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(todayCollected)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Collected: {formatCurrency(totalCollected)}</span>
                        <a href="javascript:void(0)" onClick={() => onNavigate('accounts')} className="card-link">
                            <span>Ledger</span> &rarr;
                        </a>
                    </div>
                </div>

                {/* 4. B2B Outstanding */}
                <div className="dash-mini-card">
                    <div className="dash-mini-card-header">
                        <div className="dash-mini-icon-box">
                            <Building2 size={15} />
                        </div>
                        <span className="card-label">B2B Outstanding</span>
                    </div>
                    <div className="card-value" style={{ color: '#d97706' }}>{formatCurrency(b2bOutstanding)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {b2bOverdueCount > 0 ? `${b2bOverdueCount} Account${b2bOverdueCount === 1 ? '' : 's'} Overdue` : 'All accounts settled'}
                        </span>
                        <a href="javascript:void(0)" onClick={() => onNavigate('b2b')} className="card-link">
                            <span>Manage</span> &rarr;
                        </a>
                    </div>
                </div>

                {/* 5. Follow-ups Due */}
                <div className="dash-mini-card">
                    <div className="dash-mini-card-header">
                        <div className="dash-mini-icon-box">
                            <PhoneCall size={15} />
                        </div>
                        <span className="card-label">Follow-ups Due</span>
                    </div>
                    <div className="card-value" style={{ color: '#2563eb' }}>{followupsDue}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Awaiting action</span>
                        <a href="javascript:void(0)" onClick={() => onNavigate('followups')} className="card-link">
                            <span>Follow-ups</span> &rarr;
                        </a>
                    </div>
                </div>

                {/* 6. Refunds Pending */}
                <div className="dash-mini-card">
                    <div className="dash-mini-card-header">
                        <div className="dash-mini-icon-box">
                            <RotateCcw size={15} />
                        </div>
                        <span className="card-label">Refunds Pending</span>
                    </div>
                    <div className="card-value" style={{ color: '#e11d48' }}>{refundsPending}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Review claims</span>
                        <a href="javascript:void(0)" onClick={() => onNavigate('refunds')} className="card-link">
                            <span>Review</span> &rarr;
                        </a>
                    </div>
                </div>
                </div>
            )}

            <div className="dashboard-actions-toolbar">
                <button type="button" className="quick-act-btn dashboard-quick-actions-trigger"
                    aria-label="Quick Actions" title="Quick Actions"
                    aria-haspopup="dialog" aria-controls="dashboard-quick-actions"
                    onClick={() => quickActionsDialog.current?.showModal()}>
                    <Plus size={20} />
                </button>
            </div>
            <dialog ref={quickActionsDialog} id="dashboard-quick-actions"
                className="dashboard-quick-actions-dialog" aria-labelledby="quick-actions-title"
                onClick={(event) => {
                    if (event.target === event.currentTarget) {
                        const bounds = event.currentTarget.getBoundingClientRect();
                        if (event.clientX < bounds.left || event.clientX > bounds.right ||
                            event.clientY < bounds.top || event.clientY > bounds.bottom) {
                            event.currentTarget.close();
                        }
                    }
                }}>
                <div className="dash-box-header">
                    <h3 id="quick-actions-title">Quick Actions</h3>
                    <button type="button" className="quick-act-btn" aria-label="Close quick actions"
                        onClick={() => quickActionsDialog.current?.close()}><X size={16} /></button>
                </div>
                <div className="quick-actions-2x2">
                    <button type="button" className="quick-act-btn" onClick={() => runQuickAction(onOpenShipmentModal)}>
                        <Plus size={14} color="#2563eb" /> New Shipment
                    </button>
                    <button type="button" className="quick-act-btn" onClick={() => runQuickAction(() => onNavigate('invoices'))}>
                        <FileText size={14} color="#d97706" /> Invoices
                    </button>
                    <button type="button" className="quick-act-btn" onClick={() => runQuickAction(() => onNavigate('reports'))}>
                        <ClipboardList size={14} color="#7c3aed" /> EOD Report
                    </button>
                </div>
                <button type="button" className="quick-act-full-btn" onClick={() => runQuickAction(onOpenReconciliationModal)}>
                    <RefreshCw size={14} /> Carrier Cost Reconciliation
                </button>
            </dialog>

            {/* Middle Row (2 Column Grid) */}
            <div className="dash-middle-grid">
                {/* 1. Today's Bookings Breakdown */}
                <div className="dash-box dashboard-volume-panel">
                    <div>
                        <div className="dash-box-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Package size={15} color="var(--primary-blue)" />
                                <h3>Operational Volume</h3>
                            </div>
                            <a href="javascript:void(0)" onClick={() => onNavigate('shipments')} className="box-link">
                                View all &rarr;
                            </a>
                        </div>

                        {/* Top Highlights Strip */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: '#f8fafc', 
                            padding: '10px 14px', 
                            borderRadius: '6px', 
                            border: '1px solid #e2e8f0',
                            marginBottom: '12px'
                        }}>
                            <div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Active Fleet Volume</span>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                    {totalFleetVolume} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>Shipments</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <span className="status-pill in-transit" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                    In Transit: {inTransitVolume}
                                </span>
                                <span className="status-pill delivered" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                    Delivered: {deliveredVolume}
                                </span>
                            </div>
                        </div>

                        {/* Courier Partner Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                            {[
                                { name: 'FedEx', count: fedexCount },
                                { name: 'Aramex', count: aramexCount },
                                { name: 'Delhivery', count: delhiveryCount },
                                { name: 'Blue Dart', count: bluedartCount },
                                { name: 'DHL', count: dhlCount },
                                ...Object.entries(activeCourierMap)
                                    .filter(([name]) => !['FedEx', 'Aramex', 'Delhivery', 'Blue Dart', 'DHL', 'DHL Express'].includes(name))
                                    .map(([name, count]) => ({ name, count }))
                            ].map(item => {
                                const total = totalFleetVolume || 1;
                                const pct = Math.min(100, Math.round((item.count / total) * 100));
                                return (
                                    <div 
                                        key={item.name}
                                        style={{ 
                                            background: '#ffffff', 
                                            border: '1px solid #e2e8f0', 
                                            borderRadius: '6px', 
                                            padding: '8px 10px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '5px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <CourierLogo courier={item.name} height={14} />
                                            <strong style={{ fontSize: '12px', color: item.count > 0 ? '#0f172a' : '#94a3b8' }}>
                                                {item.count}
                                            </strong>
                                        </div>
                                        <div style={{ height: '3px', width: '100%', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: item.count > 0 ? '#2563eb' : 'transparent' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer Info Strip */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '11px', 
                        color: 'var(--text-muted)', 
                        borderTop: '1px solid var(--card-border)', 
                        paddingTop: '8px'
                    }}>
                        <span>Hub: <strong>{currentUser?.center || 'Main Hub (Bangalore)'}</strong></span>
                        <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>● 100% Operational</span>
                    </div>
                </div>

                {/* 3. Accounts Snapshot */}
                <div className="dash-box dashboard-accounts-panel">
                    <div className="dash-box-header">
                        <h3>Accounts Snapshot</h3>
                        <a href="javascript:void(0)" onClick={() => onNavigate('accounts')} className="box-link">
                            View all &rarr;
                        </a>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                        Prepaid Wallets
                    </div>
                    <div className="dashboard-accounts-scroll" tabIndex={0} role="region" aria-label="Prepaid wallets">
                    <table className="acc-mini-table">
                        <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Opening</th>
                                <th>Used</th>
                                <th style={{ textAlign: 'right' }}>Available Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(accountsData?.prepaid_wallets || [
                                { name: 'ICL', opening_balance: 50000, total_usage: 6700, current_balance: 78300 },
                                { name: 'BRV', opening_balance: 30000, total_usage: 5600, current_balance: 44400 }
                            ]).map(w => (
                                <tr key={w.name}>
                                    <td><span className="provider-pill" style={{ background: '#0f172a', color: 'white' }}>{w.name}</span></td>
                                    <td>{formatCurrency(w.opening_balance)}</td>
                                    <td>{formatCurrency(w.total_usage)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald)' }}>{formatCurrency(w.current_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', marginTop: '8px' }}>
                        Postpaid Accounts
                    </div>
                    <div className="dashboard-accounts-scroll" tabIndex={0} role="region" aria-label="Postpaid accounts">
                    <table className="acc-mini-table">
                        <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Deposit</th>
                                <th>Unbilled</th>
                                <th style={{ textAlign: 'right' }}>Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(accountsData?.postpaid_accounts || [
                                { name: 'Aramex', deposit: 200000, unbilled_usage: 0, net_payable: 0 },
                                { name: 'Blue Dart', deposit: 150000, unbilled_usage: 0, net_payable: 0 }
                            ]).map(p => (
                                <tr key={p.name}>
                                    <td><strong style={{ color: p.name === 'Aramex' ? '#dc2626' : '#1d4ed8' }}>{p.name}</strong></td>
                                    <td>{formatCurrency(p.deposit)}</td>
                                    <td>{formatCurrency(p.unbilled_usage ?? p.predicted_cost ?? 0)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: (p.net_payable || 0) > 0 ? '#e11d48' : 'var(--emerald)' }}>
                                        {formatCurrency(p.net_payable ?? 0)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            {/* Partner Logistics Network Banner */}
            <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '12px 18px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                flexWrap: 'wrap', 
                gap: '12px' 
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color="var(--primary-blue)" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Integrated Carrier Network:
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <CourierLogo courier="FedEx" height={20} />
                    <CourierLogo courier="Aramex" height={20} />
                    <CourierLogo courier="Delhivery" height={20} />
                    <CourierLogo courier="Blue Dart" height={20} />
                    <CourierLogo courier="DHL" height={20} />
                    <CourierLogo courier="UPS" height={20} />
                    <CourierLogo courier="ICL" height={20} />
                    <CourierLogo courier="BRV" height={20} />
                </div>
            </div>

            {/* Recent Shipments Table (Live Data) */}
            <div className="table-card">
                <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0 }}>Recent Bookings</h3>
                        <span className="pill-stat" style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            {effectiveShipments.length} Total Records
                        </span>
                    </div>
                    <a href="javascript:void(0)" onClick={() => onNavigate('shipments')} className="box-link" style={{ fontWeight: 600 }}>
                        View All Shipments &rarr;
                    </a>
                </div>

                <div className="dash-bookings-scroll-wrap" role="region" aria-label="Recent bookings" tabIndex={0}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '150px', textAlign: 'left' }}>AWB No.</th>
                                <th style={{ minWidth: '120px', textAlign: 'center' }}>Date</th>
                                <th style={{ minWidth: '190px', textAlign: 'left' }}>Customer</th>
                                <th style={{ minWidth: '110px', textAlign: 'center' }}>Courier</th>
                                <th style={{ minWidth: '140px', textAlign: 'left' }}>Destination</th>
                                <th style={{ minWidth: '95px', textAlign: 'center' }}>Weight</th>
                                <th style={{ minWidth: '105px', textAlign: 'right' }}>Price</th>
                                <th style={{ minWidth: '125px', textAlign: 'center' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && effectiveShipments.length === 0 ? (
                                <TableSkeleton rows={5} columns={8} />
                            ) : effectiveShipments.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                        No shipments found. Click "+ New Shipment" to create a shipment.
                                    </td>
                                </tr>
                            ) : (
                                effectiveShipments.slice(0, 10).map(s => {
                                    const flag = (s.receiver_country === 'USA') ? '🇺🇸' : 
                                                 (s.receiver_country === 'UAE') ? '🇦🇪' : 
                                                 (s.receiver_country === 'United Kingdom' || s.receiver_country === 'UK') ? '🇬🇧' : 
                                                 (s.receiver_country === 'Germany') ? '🇩🇪' : 
                                                 (s.receiver_country === 'Saudi Arabia') ? '🇸🇦' : 
                                                 (s.receiver_country === 'Singapore') ? '🇸🇬' : 
                                                 (s.receiver_country === 'Australia') ? '🇦🇺' : 
                                                 (s.receiver_country === 'Canada') ? '🇨🇦' : '🇮🇳';
                                    return (
                                        <tr key={s.id || s.awb}>
                                            <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                                                <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '12px' }}>
                                                    <TrackingLink awb={s.awb} courier={s.courier} />
                                                </strong>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', textAlign: 'center', verticalAlign: 'middle' }}>
                                                {formatDate(s.date)}
                                            </td>
                                            <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <a 
                                                        href="javascript:void(0)" 
                                                        onClick={() => onOpenCustomerDrawer(s.customer_id || s.customer_name)}
                                                        style={{ fontWeight: 600, color: '#0f172a', textDecoration: 'none' }}
                                                    >
                                                        {s.customer_name}
                                                    </a>
                                                    <span style={{ 
                                                        fontSize: '10px', 
                                                        padding: '1px 5px', 
                                                        borderRadius: '4px', 
                                                        background: s.customer_type === 'B2B' ? '#eff6ff' : '#f1f5f9',
                                                        color: s.customer_type === 'B2B' ? '#1d4ed8' : '#475569',
                                                        fontWeight: 600
                                                    }}>
                                                        {s.customer_type}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                    <CourierLogo courier={s.courier} height={16} />
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>{flag}</span>
                                                    <span>{s.receiver_city || s.receiver_country}</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                <strong>{s.chargeable_weight || s.actual_weight}</strong> kg
                                            </td>
                                            <td style={{ fontWeight: 700, color: '#0f172a', textAlign: 'right', verticalAlign: 'middle' }}>
                                                {formatCurrency(s.price)}
                                            </td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                <span className={`status-pill ${s.status === 'Delivered' ? 'delivered' : s.status === 'Delayed' ? 'delayed' : 'in-transit'}`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom 4 Column Row (Charts & Follow-ups) */}
            <div className="dash-bottom-grid">
                {/* 1. Sales vs Collection */}
                <div className="dash-box donut-widget dashboard-summary-card">
                    <div className="dash-box-header">
                        <h3>Sales vs Collection</h3>
                    </div>
                    <div className="donut-chart-container">
                        <svg viewBox="0 0 36 36" style={{ width: '84px', height: '84px' }}>
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#dbe3ef" strokeWidth="4.2" strokeDasharray="100, 100" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4.2" strokeDasharray={`${collectionPercent}, 100`} />
                        </svg>
                        <div className="donut-center-label" title={`Sales: ${formatCurrency(totalSales)} | Collected: ${formatCurrency(totalCollected)} (${collectionPercent}%)`}>
                            <strong>{collectionPercent}%</strong>
                            <small>Collected</small>
                        </div>
                    </div>
                    <div className="donut-legend">
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Total Sales"><span className="legend-dot" style={{ background: '#2563eb' }}></span> Total Sales</span>
                            <strong title={formatCurrency(totalSales)}>{formatCurrency(totalSales)}</strong>
                        </div>
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Total Collected"><span className="legend-dot" style={{ background: '#10b981' }}></span> Collected</span>
                            <strong style={{ color: 'var(--emerald)' }} title={formatCurrency(totalCollected)}>{formatCurrency(totalCollected)}</strong>
                        </div>
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Pending Collection"><span className="legend-dot" style={{ background: '#94a3b8' }}></span> Pending</span>
                            <strong title={formatCurrency(pendingCollection)}>{formatCurrency(pendingCollection)}</strong>
                        </div>
                    </div>
                </div>

                {/* 2. Provider Cost vs Profit */}
                <div className="dash-box donut-widget dashboard-summary-card">
                    <div className="dash-box-header">
                        <h3>Carrier Cost vs Gross Margin</h3>
                    </div>
                    <div className="donut-chart-container">
                        <svg viewBox="0 0 36 36" style={{ width: '84px', height: '84px' }}>
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#dbe3ef" strokeWidth="4.2" strokeDasharray="100, 100" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4.2" strokeDasharray={`${Math.max(0, marginPercent)}, 100`} />
                        </svg>
                        <div className="donut-center-label" title={`Revenue: ${formatCurrency(totalSales)} | Profit: ${formatCurrency(grossProfit)} (${marginPercent}%)`}>
                            <strong style={{ color: 'var(--emerald)' }}>{marginPercent}%</strong>
                            <small>Margin</small>
                        </div>
                    </div>
                    <div className="donut-legend">
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Total Revenue"><span className="legend-dot" style={{ background: '#10b981' }}></span> Total Revenue</span>
                            <strong title={formatCurrency(totalSales)}>{formatCurrency(totalSales)}</strong>
                        </div>
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Carrier Cost"><span className="legend-dot" style={{ background: '#64748b' }}></span> Carrier Cost</span>
                            <strong title={formatCurrency(providerCost)}>{formatCurrency(providerCost)}</strong>
                        </div>
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Gross Profit"><span className="legend-dot" style={{ background: '#10b981' }}></span> Gross Profit</span>
                            <strong style={{ color: 'var(--emerald)' }} title={formatCurrency(grossProfit)}>{formatCurrency(grossProfit)}</strong>
                        </div>
                    </div>
                </div>

                {/* 3. B2B Outstanding Aging */}
                <div className="dash-box donut-widget dashboard-summary-card">
                    <div className="dash-box-header">
                        <h3>B2B Outstanding Aging</h3>
                    </div>
                    <div className="donut-chart-container">
                        <svg viewBox="0 0 36 36" style={{ width: '84px', height: '84px' }}>
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#dbe3ef" strokeWidth="4" strokeDasharray="100, 100" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray={`${agingNotDuePercent}, 100`} />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="4" strokeDasharray={`${aging1To30Percent}, 100`} strokeDashoffset={-agingNotDuePercent} />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray={`${aging31To60Percent}, 100`} strokeDashoffset={-(agingNotDuePercent + aging1To30Percent)} />
                        </svg>
                        <div className="donut-center-label" title={`Total Outstanding: ${formatCurrency(b2bOutstanding)}`}>
                            <strong style={{ fontSize: b2bOutstanding >= 100000 ? '12px' : '13px' }}>
                                {formatCompactCurrency(b2bOutstanding)}
                            </strong>
                            <small>Due</small>
                        </div>
                    </div>
                    <div className="donut-legend">
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="Not Due"><span className="legend-dot" style={{ background: '#10b981' }}></span> Not Due</span>
                            <strong title={formatCurrency(agingNotDue)}>{formatCurrency(agingNotDue)}</strong>
                        </div>
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="1 - 30 Days Overdue"><span className="legend-dot" style={{ background: '#2563eb' }}></span> 1 - 30 Days</span>
                            <strong title={formatCurrency(aging1To30)}>{formatCurrency(aging1To30)}</strong>
                        </div>
                        <div className="donut-legend-item">
                            <span className="donut-legend-label" title="31 - 60 Days Overdue"><span className="legend-dot" style={{ background: '#f59e0b' }}></span> 31 - 60 Days</span>
                            <strong title={formatCurrency(aging31To60)}>{formatCurrency(aging31To60)}</strong>
                        </div>
                    </div>
                </div>

                {/* 4. Top Follow-ups Due */}
                <div className="dash-box dashboard-summary-card followups-summary-card">
                    <div className="dash-box-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PhoneCall size={14} color="#2563eb" />
                            <h3>Top Follow-ups Due</h3>
                        </div>
                        <a href="javascript:void(0)" onClick={() => onNavigate('followups')} className="box-link">
                            View all &rarr;
                        </a>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pendingFollowups.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', padding: '12px 0', textAlign: 'center' }}>
                                No pending follow-ups.
                            </div>
                        ) : (
                            pendingFollowups.map(f => (
                                <div 
                                    key={f.id} 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        padding: '8px 12px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                        <div 
                                            style={{ 
                                                width: '28px', 
                                                height: '28px', 
                                                borderRadius: '6px', 
                                                background: '#ffffff', 
                                                border: '1px solid #e2e8f0',
                                                color: '#0f172a',
                                                fontWeight: 700,
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}
                                        >
                                            {(f.customer || 'C').charAt(0)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {f.customer}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {f.category}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
                                        <span 
                                            className={`status-pill ${f.priority === 'High' ? 'delayed' : 'picked-up'}`}
                                            style={{ fontSize: '10px', padding: '1px 6px' }}
                                        >
                                            {f.priority}
                                        </span>
                                        <button 
                                            onClick={() => {
                                                const msg = encodeURIComponent(`Hello ${f.customer}, greeting from Fly My Cart! Following up regarding: ${f.notes || f.category}.`);
                                                window.open(`https://wa.me/?text=${msg}`, '_blank');
                                            }}
                                            title={`Call / WhatsApp ${f.customer}`}
                                            style={{ 
                                                width: '26px', 
                                                height: '26px', 
                                                borderRadius: '5px', 
                                                background: '#ffffff', 
                                                color: '#059669', 
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Phone size={12} color="#059669" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
