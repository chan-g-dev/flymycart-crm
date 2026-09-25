import ShipmentPaymentCells from '../components/ShipmentPaymentCells';
import '../components/DashboardSummary.css';
import React, { useRef, useState, useMemo } from 'react';
import { Package, CircleDollarSign, Wallet, Building2, PhoneCall, RotateCcw, Plus, FileText, ClipboardList, RefreshCw, Phone, ShieldCheck, X, Globe, Plane, Truck } from 'lucide-react';
import { CourierLogo } from '../components/CourierLogos';
import { useAuth } from '../context/authSession';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSpinner';
import { TrackingLink } from '../components/TrackingLink';
import BookingsChart from '../components/BookingsChart';
import useRecentBookings from '../components/useRecentBookings';
import '../components/RecentBookings.css';
import '../components/FleetCards.css';
import ChartVisualization, { ChartTypeSelect } from '../components/ChartVisualization';
import { getEntityOptions } from '../utils/entityConstants';

export const Dashboard = ({
    data,
    selectedCenter,
    selectedScope = '',
    onSelectScope,
    selectedEntity = '',
    onSelectEntity,
    shipments = [],
    accountsData,
    b2bData,
    followups = [],
    settings,
    onNavigate,
    onOpenShipmentModal,
    onOpenStatusModal,
    onOpenReconciliationModal,
    onOpenCustomerDrawer,
    isLoading = false
}) => {
    const { currentUser, hasPermission } = useAuth();
    const canViewPrice = hasPermission('costs.customer_price');
    const canViewCost = hasPermission('costs.carrier_cost') || hasPermission('costs.view');
    const financial = (hasPermission('costs.net_value') || hasPermission('reports.view_financial')) && canViewPrice && canViewCost;

    // Granular Dashboard permissions
    const canViewKpis = hasPermission('dashboards.view');
    const canViewBookingTrends = hasPermission('dashboards.booking_trends');
    const canViewRecentBookings = hasPermission('dashboards.recent_bookings');
    const canViewFleetVolume = hasPermission('dashboards.fleet_volume');
    const canViewAccountsSnapshot = financial && hasPermission('dashboards.accounts_snapshot');
    const canViewFinancialAnalytics = hasPermission('dashboards.financial_analytics');
    const canViewFollowupsWidget = hasPermission('dashboards.followups');
    const canUseQuickActions = hasPermission('dashboards.quick_actions');

    const recent = useRecentBookings(selectedCenter, shipments, selectedScope, selectedEntity);
    const recentPageCount = Math.max(1, Math.ceil(recent.total / 10));
    const recentPages = [...new Set([1, recentPageCount, recent.page - 2, recent.page - 1, recent.page, recent.page + 1, recent.page + 2])]
        .filter(page => page >= 1 && page <= recentPageCount).sort((a, b) => a - b);

    const quickActionsDialog = useRef(null);
    const [carrierGstMode, setCarrierGstMode] = useState('excl');
    const entityOptions = useMemo(() => getEntityOptions(settings), [settings]);
    const [chartTypes, setChartTypes] = useState({ sales: 'donut', margin: 'donut', aging: 'donut' });
    const chartSelector = (key, title) => <ChartTypeSelect title={title} value={chartTypes[key]} onChange={value => setChartTypes(previous => ({ ...previous, [key]: value }))} options={[[ 'donut', 'Donut' ], [ 'bar', 'Bar' ], [ 'horizontal', 'Horizontal bar' ], [ 'dot', 'Dot' ]]} />;
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
    // Summary and facet counts come from database aggregates, never the recent ten rows.
    const entityStats = useMemo(() => Object.fromEntries(entityOptions.map(e => {
        const row = safeData.entity_summaries?.[e.name] || {};
        return [e.name, { count: Number(row.total_count || 0), todayCount: Number(row.today_shipments_count || 0),
            todaySales: Number(row.today_sales || 0), todayGst: Number(row.today_gst || 0),
            todayBilledSales: Number(row.today_sales_with_gst || 0), totalSales: Number(row.total_sales || 0),
            totalGst: Number(row.total_gst || 0), totalBilledSales: Number(row.total_sales_with_gst || 0) }];
    })), [entityOptions, safeData.entity_summaries]);
    const todayBookingsCount = safeData.today_shipments_count ?? 0;
    const todaySales = safeData.today_sales ?? 0;
    const todayGst = safeData.today_gst ?? 0;
    const todaySalesWithGst = safeData.today_sales_with_gst ?? 0;
    const todayCollected = safeData.today_collected ?? 0;
    const b2bOutstanding = safeData.b2b_outstanding ?? 0;
    const b2bOverdueCount = safeData.b2b_overdue_count ?? 0;
    const totalPendingFollowups = safeData.followups_pending ?? 0;
    const dueFollowupsCount = safeData.followups_due ?? 0;
    const upcomingFollowupsCount = safeData.followups_upcoming ?? 0;
    const refundsPending = safeData.refunds_pending ?? 0;
    const activeCourierMap = safeData.active_courier_counts || {};

    // Configured Couriers List
    const configuredCouriers = (settings?.couriers && settings.couriers.length > 0)
        ? settings.couriers
        : ['FedEx', 'Aramex', 'DHL', 'Blue Dart', 'Delhivery', 'UPS', 'Sree Maruthi', 'ICL', 'BRV'];

    const allCourierNames = Array.from(new Set([
        ...configuredCouriers,
        ...Object.keys(activeCourierMap).filter(k => k && k !== 'DHL Express')
    ]));

    const courierDistributionList = allCourierNames.map(name => {
        let count = activeCourierMap[name] || 0;
        if (name.toLowerCase() === 'dhl') {
            count += (activeCourierMap['DHL Express'] || 0);
        }
        return { name, count };
    });

    const totalFleetVolume = safeData.active_volume ?? 0;
    const inTransitVolume = safeData.in_transit_count ?? 0;
    const deliveredVolume = safeData.delivered_count ?? 0;
    const totalSales = safeData.total_sales ?? 0;
    const totalCollected = safeData.total_collected ?? 0;
    const totalExpenses = safeData.total_expenses ?? 0;
    const totalRefunds = safeData.total_refunds ?? 0;
    const billedSales = safeData.total_sales_with_gst ?? 0;
    const pendingCollection = safeData.pending_collection ?? 0;
    const collectionPercent = billedSales > 0 ? Math.min(100, Math.round((totalCollected / billedSales) * 100)) : 0;
    const providerCost = safeData.total_provider_cost ?? 0;
    const carrierRevenue = carrierGstMode === 'incl' ? billedSales : totalSales;
    const carrierValue = carrierGstMode === 'incl' ? (safeData.total_net_value_with_gst ?? 0) : (safeData.total_net_value ?? 0);
    const carrierGstLabel = carrierGstMode === 'incl' ? 'Incl. GST' : 'Excl. GST';
    const marginPercent = carrierRevenue > 0 ? Math.round((carrierValue / carrierRevenue) * 100) : 0;
    const agingNotDue = b2bData?.aging?.not_due ?? 0;
    const aging1To30 = b2bData?.aging?.days1_30 ?? 0;
    const aging31To60 = b2bData?.aging?.days31_60 ?? 0;
    const agingTotal = agingNotDue + aging1To30 + aging31To60;
    const agingNotDuePercent = agingTotal > 0 ? (agingNotDue / agingTotal) * 100 : 0;
    const aging1To30Percent = agingTotal > 0 ? (aging1To30 / agingTotal) * 100 : 0;
    const aging31To60Percent = agingTotal > 0 ? (aging31To60 / agingTotal) * 100 : 0;

    // Top followups
    const pendingFollowups = (followups || []).filter(f => f.status === 'Pending').slice(0, 3);

    const computedTrend = safeData.booking_trend;

    const showSalesChart = canViewPrice && canViewFinancialAnalytics;
    const showCarrierValueChart = financial && canViewFinancialAnalytics;
    const showAgingChart = canViewPrice && canViewFinancialAnalytics;
    const showFollowups = canViewFollowupsWidget;
    const bottomCardsCount = Number(showSalesChart) + Number(showCarrierValueChart) + Number(showAgingChart) + Number(showFollowups);

    const hasAnyDashboardAccess = canViewKpis || canViewBookingTrends || canViewRecentBookings || canViewFleetVolume || canViewAccountsSnapshot || canViewFinancialAnalytics || canViewFollowupsWidget;

    const scopeCounts = safeData.scope_counts || { all: 0, intl: 0, dom: 0 };

    const entityTotalCount = useMemo(() => {
        return Object.values(entityStats).reduce((acc, curr) => acc + (curr?.count ?? 0), 0);
    }, [entityStats]);

    if (!hasAnyDashboardAccess) {
        return (
            <div className="dash-box" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <ShieldCheck size={24} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--text-main)' }}>Dashboard Access Restricted</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                    You currently do not have permission to view dashboard widgets. Contact your administrator or check your role permissions.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* TOP DASHBOARD SCOPE & ENTITY SWITCHER TOOLBAR */}
            {canViewKpis && (
                <div className="scope-entity-bar dashboard-scope-bar" style={{ marginBottom: '2px' }}>
                    {/* Left: Scope Selection */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            SCOPE:
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="scope-pill-btn"
                                onClick={() => onSelectScope?.('')}
                                style={!selectedScope ? {
                                    background: '#eff6ff',
                                    borderColor: '#93c5fd',
                                    color: '#1d4ed8',
                                    fontWeight: 700
                                } : {}}
                            >
                                <Globe size={15} color={!selectedScope ? '#1d4ed8' : '#64748b'} />
                                <span>Both: <strong>{scopeCounts.all}</strong></span>
                            </button>
                            <button
                                type="button"
                                className="scope-pill-btn"
                                onClick={() => onSelectScope?.(selectedScope === 'International' ? '' : 'International')}
                                style={selectedScope === 'International' ? {
                                    background: '#eff6ff',
                                    borderColor: '#93c5fd',
                                    color: '#1d4ed8',
                                    fontWeight: 700
                                } : {}}
                            >
                                <Plane size={15} color={selectedScope === 'International' ? '#1d4ed8' : '#64748b'} />
                                <span>Intl: <strong>{scopeCounts.intl}</strong></span>
                            </button>
                            <button
                                type="button"
                                className="scope-pill-btn"
                                onClick={() => onSelectScope?.(selectedScope === 'Domestic' ? '' : 'Domestic')}
                                style={selectedScope === 'Domestic' ? {
                                    background: '#fffbeb',
                                    borderColor: '#fcd34d',
                                    color: '#b45309',
                                    fontWeight: 700
                                } : {}}
                            >
                                <Truck size={15} color={selectedScope === 'Domestic' ? '#b45309' : '#64748b'} />
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
                                onClick={() => onSelectEntity?.('')}
                                style={!selectedEntity ? {
                                    background: '#eff6ff',
                                    borderColor: '#93c5fd',
                                    color: '#1d4ed8',
                                    fontWeight: 700
                                } : {}}
                            >
                                <Building2 size={15} color={!selectedEntity ? '#1d4ed8' : '#64748b'} />
                                <span>All: <strong>{entityTotalCount}</strong></span>
                            </button>
                            {entityOptions.map(ent => {
                                const count = entityStats[ent.name]?.count ?? 0;
                                const isSelected = selectedEntity === ent.name;
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
                                        onClick={() => onSelectEntity?.(isSelected ? '' : ent.name)}
                                        style={activeStyle}
                                        title={`Filter by ${ent.name}`}
                                    >
                                        <span>{ent.shortName || ent.name}: <strong>{count}</strong></span>
                                    </button>
                                );
                            })}
                            {(selectedEntity || selectedScope) ? (
                                <button 
                                    type="button"
                                    className="entity-pill-btn" 
                                    onClick={() => {
                                        onSelectEntity?.('');
                                        onSelectScope?.('');
                                    }}
                                    style={{
                                        borderColor: '#fecdd3',
                                        background: '#fff1f2',
                                        color: '#e11d48',
                                        fontWeight: 600
                                    }}
                                    title="Reset to All Entities and Both scopes"
                                >
                                    <X size={13} /> Clear
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* TIER 1: Core Primary Executive KPI Cards */}
            {canViewKpis && (isLoading && !data ? (
                <CardSkeleton count={3} />
            ) : (
                <div className="dash-stat-cards-grid dashboard-kpi-grid">
                    {/* 1. Today's Bookings */}
                    <div className="dash-mini-card kpi-bookings">
                        <div className="dash-mini-card-header">
                            <div className="dash-mini-icon-box">
                                <Package size={16} />
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
                    {canViewPrice && (
                        <div className="dash-mini-card kpi-sales">
                            <div className="dash-mini-card-header">
                                <div className="dash-mini-icon-box">
                                    <CircleDollarSign size={16} />
                                </div>
                                <span className="card-label">Today's Sales</span>
                            </div>
                            <div className="card-value">{formatCurrency(todaySalesWithGst)}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {formatCurrency(todaySales)} Base + {formatCurrency(todayGst)} GST
                                </span>
                                <a href="javascript:void(0)" onClick={() => onNavigate('reports')} className="card-link">
                                    <span>Reports</span> &rarr;
                                </a>
                            </div>
                        </div>
                    )}

                    {/* 3. Today's Collection */}
                    {canViewPrice && (
                        <div className="dash-mini-card kpi-collection">
                            <div className="dash-mini-card-header">
                                <div className="dash-mini-icon-box">
                                    <Wallet size={16} />
                                </div>
                                <span className="card-label">Today's Collection</span>
                            </div>
                            <div className="card-value" style={{ color: 'var(--emerald)' }}>
                                {formatCurrency(todayCollected)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Collected: {formatCurrency(totalCollected)}
                                </span>
                                <a href="javascript:void(0)" onClick={() => onNavigate('accounts')} className="card-link">
                                    <span>Ledger</span> &rarr;
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* TIER 2: Operating Divisions & Entities (3 KPI cards) */}
            {canViewKpis && entityOptions.length > 0 && (
                <div className="dash-stat-cards-grid dashboard-kpi-grid">
                    {entityOptions.map(ent => {
                        const stats = entityStats[ent.name] || { 
                            count: 0, 
                            todayCount: 0, 
                            todaySales: 0, 
                            totalSales: 0, 
                            todayCost: 0, 
                            todayMargin: 0 
                        };
                        const EntityIcon = ent.icon === 'Plane' ? Plane : ent.icon === 'Building2' ? Building2 : Globe;
                        const kpiClass = ent.code === 'GC' ? 'kpi-entity-gc' : ent.code === 'USU' ? 'kpi-entity-usu' : 'kpi-entity-via';
                        return (
                            <div key={ent.id} className={`dash-mini-card ${kpiClass}`}>
                                <div className="dash-mini-card-header">
                                    <div className="dash-mini-icon-box">
                                        <EntityIcon size={16} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, gap: '6px' }}>
                                        <span className="card-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ent.name}
                                        </span>
                                        <span className="dash-entity-code-badge" style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px' }}>
                                            {ent.code || ent.shortName}
                                        </span>
                                    </div>
                                </div>
                                <div className="card-value">
                                    {stats.todayCount} <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>today</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {canViewPrice ? `Today: ${formatCurrency(stats.todaySales)} Base + ${formatCurrency(stats.todayGst)} GST` : `Active Division`}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Lifetime: <strong>{stats.count}</strong>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TIER 3: Operations & Exceptions Row */}
            {canViewKpis && (
                <div className="dash-stat-cards-grid dashboard-kpi-grid">
                    {/* B2B Outstanding */}
                    {canViewPrice && (
                        <div className="dash-mini-card kpi-b2b">
                            <div className="dash-mini-card-header">
                                <div className="dash-mini-icon-box">
                                    <Building2 size={16} />
                                </div>
                                <span className="card-label">B2B Outstanding</span>
                            </div>
                            <div className="card-value" style={{ color: '#d97706' }}>
                                {formatCurrency(b2bOutstanding)}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {b2bOverdueCount > 0 ? `${b2bOverdueCount} Account${b2bOverdueCount === 1 ? '' : 's'} Overdue` : 'All accounts settled'}
                                </span>
                                <a href="javascript:void(0)" onClick={() => onNavigate('b2b')} className="card-link">
                                    <span>Manage</span> &rarr;
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Follow-ups & Retention */}
                    <div className="dash-mini-card kpi-followups">
                        <div className="dash-mini-card-header">
                            <div className="dash-mini-icon-box">
                                <PhoneCall size={16} />
                            </div>
                            <span className="card-label">Follow-ups Active</span>
                        </div>
                        <div className="card-value" style={{ color: '#0284c7' }}>{totalPendingFollowups}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {dueFollowupsCount > 0 ? (
                                    <span style={{ color: 'var(--rose)', fontWeight: 700 }}>🚨 {dueFollowupsCount} Due Today</span>
                                ) : (upcomingFollowupsCount > 0 ? (
                                    <span style={{ color: '#0284c7', fontWeight: 600 }}>📅 {upcomingFollowupsCount} Upcoming</span>
                                ) : (
                                    'All caught up'
                                ))}
                            </span>
                            <a href="javascript:void(0)" onClick={() => onNavigate('followups')} className="card-link">
                                <span>Follow-ups</span> &rarr;
                            </a>
                        </div>
                    </div>

                    {/* Refunds Pending */}
                    <div className="dash-mini-card kpi-refunds">
                        <div className="dash-mini-card-header">
                            <div className="dash-mini-icon-box">
                                <RotateCcw size={16} />
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

            {/* TIER 4: 14-Day Booking Trends Chart */}
            {canViewBookingTrends && (
                <BookingsChart 
                    trend={computedTrend} 
                    selectedCenter={selectedCenter} 
                    isLoading={isLoading} 
                    selectedDate={recent.date}
                    onSelectDate={(date) => {
                        recent.setDate(date);
                        if (date) {
                            setTimeout(() => {
                                const el = document.getElementById('recent-bookings-section');
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                        }
                    }}
                />
            )}

            {/* TIER 5: Financial & Operational Analytics Summary Grid */}
            {bottomCardsCount > 0 && (
                <div className="dash-bottom-grid" style={{ gridTemplateColumns: `repeat(${bottomCardsCount}, minmax(0, 1fr))` }}>
                    {/* 1. Sales vs Collection */}
                    {showSalesChart && (
                        <div className="dash-box donut-widget dashboard-summary-card">
                            <div className="dash-box-header">
                                <h3>Sales vs Collection</h3>
                                {chartSelector('sales', 'Sales vs Collection')}
                            </div>
                            <div className="summary-chart-context">Collection against sales incl. GST</div>
                            {chartTypes.sales === 'donut' ? (<div className="donut-chart-container">
                                <svg viewBox="0 0 36 36" style={{ width: '84px', height: '84px' }}>
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#dbe3ef" strokeWidth="4.2" strokeDasharray="100, 100" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4.2" strokeDasharray={`${collectionPercent}, 100`} />
                                </svg>
                                <div className="donut-center-label" title={`Sales: ${formatCurrency(billedSales)} | Collected: ${formatCurrency(totalCollected)} (${collectionPercent}%)`}>
                                    <strong>{collectionPercent}%</strong>
                                    <small>Collected</small>
                                </div>
                            </div>) : <ChartVisualization title="Sales vs Collection" type={chartTypes.sales} data={[{ label: 'Sales', value: billedSales, color: '#2563eb' }, { label: 'Total Collected', value: totalCollected, color: '#10b981' }, { label: 'Total Pending', value: pendingCollection, color: '#94a3b8' }]} formatValue={formatCompactCurrency} />}
                            <div className="donut-legend">
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Sales Incl. GST"><span className="legend-dot" style={{ background: '#2563eb' }}></span> Sales Incl. GST</span>
                                    <strong title={formatCurrency(billedSales)}>{formatCurrency(billedSales)}</strong>
                                </div>
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Total Collected"><span className="legend-dot" style={{ background: '#10b981' }}></span> Total Collected</span>
                                    <strong style={{ color: 'var(--emerald)' }} title={formatCurrency(totalCollected)}>{formatCurrency(totalCollected)}</strong>
                                </div>
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Pending Collection"><span className="legend-dot" style={{ background: '#94a3b8' }}></span> Total Pending</span>
                                    <strong title={formatCurrency(pendingCollection)}>{formatCurrency(pendingCollection)}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Provider Cost vs Profit */}
                    {showCarrierValueChart && (
                        <div className="dash-box donut-widget dashboard-summary-card carrier-value-card">
                            <div className="dash-box-header">
                                <h3>Carrier Charges & Profit</h3>
                                {chartSelector('margin', 'Carrier Charges & Profit')}
                            </div>
                            <div className="carrier-gst-toggle" role="group" aria-label="Carrier chart GST basis">
                                <button type="button" aria-pressed={carrierGstMode === 'excl'} onClick={() => setCarrierGstMode('excl')}>Excl. GST</button>
                                <button type="button" aria-pressed={carrierGstMode === 'incl'} onClick={() => setCarrierGstMode('incl')}>Incl. GST</button>
                            </div>
                            {chartTypes.margin === 'donut' ? (<div className="donut-chart-container">
                                <svg viewBox="0 0 36 36" style={{ width: '84px', height: '84px' }}>
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#dbe3ef" strokeWidth="4.2" strokeDasharray="100, 100" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4.2" strokeDasharray={`${Math.min(100, Math.max(0, marginPercent))}, 100`} />
                                </svg>
                                <div className="donut-center-label" title={`Revenue: ${formatCurrency(carrierRevenue)} | Profit ${carrierGstLabel}: ${formatCurrency(carrierValue)} (${marginPercent}%)`}>
                                    <strong style={{ color: 'var(--emerald)' }}>{marginPercent}%</strong>
                                    <small>Profit / Revenue</small>
                                </div>
                            </div>) : <ChartVisualization title="Carrier Charges & Profit" type={chartTypes.margin} data={[{ label: `Revenue (${carrierGstLabel})`, value: carrierRevenue, color: '#10b981' }, { label: 'Carrier Cost', value: providerCost, color: '#64748b' }, ...(totalRefunds > 0 ? [{ label: 'Refunds', value: totalRefunds, color: '#f59e0b' }] : []), ...(totalExpenses > 0 ? [{ label: 'Operating Expenses', value: totalExpenses, color: '#8b5cf6' }] : []), { label: `Profit (${carrierGstLabel})`, value: carrierValue, color: '#10b981' }]} formatValue={formatCompactCurrency} />}
                            <div className="donut-legend">
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title={`Revenue ${carrierGstLabel}`}><span className="legend-dot" style={{ background: '#10b981' }}></span> Revenue {carrierGstLabel}</span>
                                    <strong title={formatCurrency(carrierRevenue)}>{formatCurrency(carrierRevenue)}</strong>
                                </div>
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Carrier Cost"><span className="legend-dot" style={{ background: '#64748b' }}></span> Carrier Cost</span>
                                    <strong title={formatCurrency(providerCost)}>{formatCurrency(providerCost)}</strong>
                                </div>
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Customer Refunds Deducted"><span className="legend-dot" style={{ background: '#f59e0b' }}></span> Refunds</span>
                                    <strong style={{ color: totalRefunds > 0 ? '#d97706' : '#64748b' }} title={formatCurrency(totalRefunds)}>
                                        {totalRefunds > 0 ? `-${formatCurrency(totalRefunds)}` : formatCurrency(0)}
                                    </strong>
                                </div>
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Operating & Other Expenses Deducted"><span className="legend-dot" style={{ background: '#8b5cf6' }}></span> Operating Expenses</span>
                                    <strong style={{ color: totalExpenses > 0 ? '#8b5cf6' : '#64748b' }} title={formatCurrency(totalExpenses)}>
                                        {totalExpenses > 0 ? `-${formatCurrency(totalExpenses)}` : formatCurrency(0)}
                                    </strong>
                                </div>
                                <div className="donut-legend-item">
                                    <span className="donut-legend-label" title="Profit after carrier cost, refunds and operating expenses"><span className="legend-dot" style={{ background: '#059669' }}></span> Profit {carrierGstLabel}</span>
                                    <strong style={{ color: 'var(--emerald)' }} title={formatCurrency(carrierValue)}>{formatCurrency(carrierValue)}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. B2B Outstanding Aging */}
                    {showAgingChart && (
                        <div className="dash-box donut-widget dashboard-summary-card">
                            <div className="dash-box-header">
                                <h3>B2B Outstanding Aging</h3>
                                {chartSelector('aging', 'B2B Outstanding Aging')}
                            </div>
                            <div className="summary-chart-context">Outstanding by payment age</div>
                            {chartTypes.aging === 'donut' ? (<div className="donut-chart-container">
                                <svg viewBox="0 0 36 36" style={{ width: '84px', height: '84px' }}>
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#dbe3ef" strokeWidth="4.2" strokeDasharray="100, 100" />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="4.2" strokeDasharray={`${agingNotDuePercent}, 100`} />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2563eb" strokeWidth="4" strokeDasharray={`${aging1To30Percent}, 100`} strokeDashoffset={-agingNotDuePercent} />
                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray={`${aging31To60Percent}, 100`} strokeDashoffset={-(agingNotDuePercent + aging1To30Percent)} />
                                </svg>
                                <div className="donut-center-label" title={`Total Outstanding: ${formatCurrency(b2bOutstanding)}`}>
                                    <strong style={{ fontSize: b2bOutstanding >= 100000 ? '12px' : '13px' }}>
                                        {formatCompactCurrency(b2bOutstanding)}
                                    </strong>
                                    <small>Due</small>
                                </div>
                            </div>) : <ChartVisualization title="B2B Outstanding Aging" type={chartTypes.aging} data={[{ label: 'Not due', value: agingNotDue, color: '#10b981' }, { label: '1-30 days', value: aging1To30, color: '#2563eb' }, { label: '31-60 days', value: aging31To60, color: '#f59e0b' }]} formatValue={formatCompactCurrency} />}
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
                    )}

                    {/* 4. Top Follow-ups Due */}
                    {showFollowups && (
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
                    )}
                </div>
            )}

            {/* TIER 6: Recent Shipments / Live Bookings Master Table */}
            {canViewRecentBookings && (
                <div className="table-card" id="recent-bookings-section">
                    <div className="dash-box-header recent-bookings-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0 }}>Recent Bookings</h3>
                            <span className="pill-stat" style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                                {recent.loading ? 'Loading...' : `${recent.total} Total Records`}
                            </span>
                        </div>
                        <div className="recent-bookings-controls">
                            <label>Booking date <input type="date" value={recent.date} onChange={event => recent.setDate(event.target.value)} /></label>
                            {recent.date && <button type="button" className="recent-bookings-button" onClick={() => recent.setDate('')}>All dates</button>}
                            <a href="javascript:void(0)" onClick={() => onNavigate('shipments')} className="box-link" style={{ fontWeight: 600 }}>
                                View All Shipments &rarr;
                            </a>
                        </div>
                    </div>

                    <div className="dash-bookings-scroll-wrap" role="region" aria-label="Recent bookings" aria-busy={recent.loading} tabIndex={0}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ minWidth: '150px', textAlign: 'left' }}>AWB No.</th>
                                    <th style={{ minWidth: '120px', textAlign: 'center' }}>Date</th>
                                    <th style={{ minWidth: '190px', textAlign: 'left' }}>Customer</th>
                                    <th style={{ minWidth: '110px', textAlign: 'center' }}>Courier</th>
                                    <th style={{ minWidth: '140px', textAlign: 'left' }}>Destination</th>
                                    <th style={{ minWidth: '95px', textAlign: 'center' }}>Weight</th>
                                    {canViewPrice && <th style={{ minWidth: '110px', textAlign: 'right' }}>Customer Sale</th>}
                                    {canViewCost && <th style={{ minWidth: '110px', textAlign: 'right' }}>Carrier Cost</th>}
                                    {financial && <th style={{ minWidth: '110px', textAlign: 'right' }}>Profit</th>}
                                    <th>Payment Mode</th><th>Collection Status</th><th>Payment to Courier</th><th style={{ minWidth: '125px', textAlign: 'center' }}>Status</th><th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const totalCols = 8 + (canViewPrice ? 1 : 0) + (canViewCost ? 1 : 0) + (financial ? 1 : 0);
                                    if (recent.loading) {
                                        return <TableSkeleton rows={5} columns={totalCols} />;
                                    }
                                    if (recent.error) {
                                        return <tr><td colSpan={totalCols} style={{ textAlign: 'center', padding: '32px' }}><p role="alert">{recent.error}</p><button type="button" className="recent-bookings-button" onClick={recent.retry}>Retry</button></td></tr>;
                                    }
                                    if (recent.items.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={totalCols} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                                    {recent.date ? `No bookings found for ${formatDate(recent.date)}.` : 'No bookings found.'}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return recent.items.map(s => {
                                        const flag = (s.receiver_country === 'USA') ? '🇺🇸' :
                                                     (s.receiver_country === 'UAE') ? '🇦🇪' :
                                                     (s.receiver_country === 'United Kingdom' || s.receiver_country === 'UK') ? '🇬🇧' :
                                                     (s.receiver_country === 'Germany') ? '🇩🇪' :
                                                     (s.receiver_country === 'Saudi Arabia') ? '🇸🇦' :
                                                     (s.receiver_country === 'Singapore') ? '🇸🇬' :
                                                     (s.receiver_country === 'Australia') ? '🇦🇺' :
                                                     (s.receiver_country === 'Canada') ? '🇨🇦' : '🇮🇳';
                                        const billed = Number(s.total_amount ?? (Number(s.price || 0) + Number(s.gst_amount || 0)));
                                        const cost = s.cost_reconciled ? (s.actual_provider_cost ?? s.provider_cost) : s.provider_cost;
                                        const refund = Number(s.refund_amount || 0);
                                        const profit = s.gross_profit !== undefined && s.gross_profit !== null
                                            ? s.gross_profit
                                            : billed - (s.cost_reconciled ? (s.actual_provider_cost ?? s.provider_cost ?? 0) : (s.provider_cost || 0)) - refund;

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
                                                    {(s.domestic_international === 'International' || (s.receiver_country && s.receiver_country !== 'India')) && (
                                                        <div style={{ marginTop: '2px' }}>
                                                            <span className={s.is_ddp ? 'ddp-tag-paid' : 'ddp-tag-unpaid'}>
                                                                {s.is_ddp ? '✓ DDP Paid' : 'DDP Not Paid'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <strong>{s.chargeable_weight || s.actual_weight}</strong> kg
                                                </td>
                                                {canViewPrice && (
                                                    <td style={{ textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(billed)}</div>
                                                        <div style={{ fontSize: '9.5px', fontWeight: 700, color: s.is_gst_applicable !== false && (s.gst_amount > 0 || s.gst_rate > 0) ? '#2563eb' : '#64748b' }}>
                                                            {s.is_gst_applicable !== false && (s.gst_amount > 0 || s.gst_rate > 0) ? `GST Applicable (${s.gst_rate || 18}%)` : 'Non-GST'}
                                                        </div>
                                                    </td>
                                                )}
                                                {canViewCost && (
                                                    <td style={{ fontWeight: 600, color: '#475569', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                        {cost !== null && cost !== undefined ? formatCurrency(cost) : '—'}
                                                    </td>
                                                )}
                                                {financial && (
                                                    <td style={{ textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                        <strong style={{ color: profit >= 0 ? 'var(--emerald)' : 'var(--rose)', fontSize: '11.5px' }}>
                                                            {formatCurrency(profit)}
                                                        </strong>
                                                        {refund > 0 && (
                                                            <div style={{ fontSize: '9.5px', color: '#d97706', fontWeight: 600 }}>
                                                                (-{formatCurrency(refund)} refund)
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                                <ShipmentPaymentCells shipment={s} />
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <span className={`status-pill ${s.status === 'Delivered' ? 'delivered' : s.status === 'Delayed' ? 'delayed' : 'in-transit'}`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td>{hasPermission('shipments.edit') ? <button type="button" className="recent-bookings-button" onClick={() => onOpenStatusModal(s)}>Update status</button> : <span>—</span>}</td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                    {!recent.loading && !recent.error && recent.total > 0 && <div className="recent-bookings-pagination">
                        <span role="status">Showing {(recent.page - 1) * 10 + 1}-{Math.min(recent.page * 10, recent.total)} of {recent.total} bookings</span>
                        <nav aria-label="Recent bookings pages">
                            <button type="button" className="recent-bookings-button" disabled={recent.page === 1} onClick={() => recent.setPage(recent.page - 1)}>Previous</button>
                            {recentPages.map((page, index) => <React.Fragment key={page}>
                                {index > 0 && page - recentPages[index - 1] > 1 && <span aria-hidden="true">...</span>}
                                <button type="button" className="recent-bookings-button" aria-label={`Page ${page}`} aria-current={page === recent.page ? 'page' : undefined} onClick={() => recent.setPage(page)}>{page}</button>
                            </React.Fragment>)}
                            <button type="button" className="recent-bookings-button" disabled={recent.page === recentPageCount} onClick={() => recent.setPage(recent.page + 1)}>Next</button>
                        </nav>
                    </div>}
                </div>
            )}

            {/* TIER 7: Operational Volume & Accounts Snapshot */}
            {(canViewFleetVolume || canViewAccountsSnapshot) && (
                <div className="dash-middle-grid" style={{ gridTemplateColumns: (canViewFleetVolume && canViewAccountsSnapshot) ? undefined : '1fr' }}>
                    {/* 1. Active Operational Volume & Fleet Distribution */}
                    {canViewFleetVolume && (
                        <div className="dash-box dashboard-volume-panel">
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
                                marginBottom: '10px',
                                flexShrink: 0
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

                            {/* Courier Partner Grid Header */}
                            <div className="fleet-distribution-heading" style={{ flexShrink: 0, marginBottom: '8px' }}>
                                <span>Courier distribution</span>
                                <small>Share of active fleet</small>
                            </div>

                            {/* Scrollable Courier Partner Grid */}
                            <div className="fleet-courier-grid-scroll" tabIndex={0} role="region" aria-label="Courier distribution list">
                                <div className="fleet-courier-grid">
                                    {courierDistributionList.map(item => {
                                        const total = totalFleetVolume || 1;
                                        const pct = Math.min(100, Math.round((item.count / total) * 100));
                                        return (
                                            <div key={item.name} className={`fleet-courier-card ${item.count > 0 ? 'has-shipments' : 'is-empty'}`}>
                                                <div className="fleet-courier-top">
                                                    <CourierLogo courier={item.name} height={16} customLogos={settings?.courierLogos} />
                                                    <span className="fleet-share-badge" title={`${pct}% of active fleet`}>{pct}<small>%</small></span>
                                                </div>
                                                <div className="fleet-courier-count"><strong>{item.count}</strong><span>{item.count === 1 ? 'active shipment' : 'active shipments'}</span></div>
                                                <div className="fleet-share-track" role="meter" aria-label={`${item.name} share of active fleet`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${item.count} shipments, ${pct}% of active fleet`} title={`${item.count} of ${totalFleetVolume} active shipments (${pct}%)`}>
                                                    <div style={{ width: `${pct}%` }} />
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
                                paddingTop: '8px',
                                marginTop: 'auto',
                                flexShrink: 0
                            }}>
                                <span>Hub: <strong>{currentUser?.center || 'Main Hub (Bangalore)'}</strong></span>
                                <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>● 100% Operational</span>
                            </div>
                        </div>
                    )}

                    {/* 2. Accounts Snapshot */}
                    {canViewAccountsSnapshot && (
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
                                    {(accountsData?.prepaid_wallets || configuredCouriers.map(c => ({
                                        name: c, opening_balance: 0, total_usage: 0, current_balance: 0
                                    }))).map(w => (
                                        <tr key={w.name}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                                    <CourierLogo courier={w.name} height={14} customLogos={settings?.courierLogos} />
                                                    <span style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                                                </div>
                                            </td>
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
                                    {(accountsData?.postpaid_accounts || configuredCouriers.map(c => ({
                                        name: c, deposit: 0, unbilled_usage: 0, net_payable: 0
                                    }))).map(p => (
                                        <tr key={p.name}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                                    <CourierLogo courier={p.name} height={14} customLogos={settings?.courierLogos} />
                                                    <strong style={{ fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</strong>
                                                </div>
                                            </td>
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
                    )}
                </div>
            )}

            {/* TIER 8: Integrated Carrier Logistics Network Banner (at the bottom) */}
            {(canViewFleetVolume || canViewKpis) && (
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={18} color="var(--primary-blue)" />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Integrated Courier Partners:
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                        {configuredCouriers.map(courier => (
                            <div key={courier} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <CourierLogo courier={courier} height={20} customLogos={settings?.courierLogos} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Floating Quick Actions button and modal */}
            {canUseQuickActions && (
                <>
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
                        {hasPermission('reconciliation.run') && <button type="button" className="quick-act-full-btn" onClick={() => runQuickAction(onOpenReconciliationModal)}>
                            <RefreshCw size={14} /> Carrier Bill Reconciliation
                        </button>}
                    </dialog>
                </>
            )}
        </div>
    );
};

