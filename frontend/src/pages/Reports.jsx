import { businessDate, formatBusinessDate, shiftCalendarDate } from '../utils/businessDates';
import { providerCostLabel } from '../utils/costLabels';
import { useState, useEffect } from 'react';
import { Printer, Calendar, FileText, TrendingUp, Shield } from 'lucide-react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';
import { CourierLogo } from '../components/CourierLogos';
import { ContentShimmer } from '../components/ContentShimmer';
import { CourierDonutChart, ProgressItem, DailyTrendChart, MonthlyWaterfallChart } from '../components/ReportCharts';

export const Reports = ({ activeTab, refreshKey }) => {
    const { hasPermission } = useAuth();
    const canViewFinancials = hasPermission('viewFinancials');

    const [tab, setTab] = useState('eod');
    const [eodDate, setEodDate] = useState(businessDate());
    const [monthVal, setMonthVal] = useState(businessDate().slice(0, 7));
    const [eodReport, setEodReport] = useState(null);
    const [weeklyReport, setWeeklyReport] = useState(null);
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [rangeStart, setRangeStart] = useState(businessDate().slice(0, 7) + '-01');
    const [rangeEnd, setRangeEnd] = useState(businessDate());
    const [reportError, setReportError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeTab || !['eod', 'weekly', 'monthly', 'custom'].includes(activeTab)) return;
        setTab(activeTab === 'monthly' && !canViewFinancials ? 'eod' : activeTab);
    }, [activeTab, canViewFinancials]);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = formatBusinessDate;

    useEffect(() => {
        if (!canViewFinancials && tab === 'monthly') {
            setTab('eod');
            return;
        }
        let current = true;
        setLoading(true); setReportError('');
        const request = tab === 'eod' ? apiClient.getEODReport(eodDate)
            : tab === 'weekly' ? apiClient.getWeeklyReport(eodDate)
            : tab === 'custom' ? apiClient.getDateRangeReport(rangeStart, rangeEnd)
            : apiClient.getMonthlyPLReport(monthVal);
        request.then(data => {
            if (!current) return;
            if (tab === 'eod') setEodReport(data);
            else if (tab === 'monthly') setMonthlyReport(data);
            else setWeeklyReport(data);
        }).catch(error => {
            if (current) setReportError(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Unable to load this report. Check the dates and try again.');
        }).finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [tab, eodDate, monthVal, rangeStart, rangeEnd, canViewFinancials, refreshKey]);

    const expenseReport = tab === 'monthly' ? monthlyReport : tab === 'eod' ? eodReport : weeklyReport;

    const handlePrintEOD = () => {
        window.print();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Executive Header with Live Single-Entry Badge */}
            <div className="page-header" style={{ marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '21px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📊</span> Executive Reports & Financial P&L Engine
                    </h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Live business reporting pulling directly from Shipments, Customer Payments, Wallets, and Provider Costs.
                    </p>
                </div>
            </div>

            {/* Sub-tabs & Controls Capsule */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div className="fmc-segmented-capsule report-tabs">
                    <button 
                        className={`fmc-segmented-btn ${tab === 'eod' ? 'active' : ''}`}
                        onClick={() => {
                            if (tab !== 'eod') {
                                setLoading(true);
                                setTab('eod');
                            }
                        }}
                    >
                        <FileText size={14} /> EOD Operations Audit
                    </button>
                    <button 
                        className={`fmc-segmented-btn ${tab === 'weekly' ? 'active' : ''}`}
                        onClick={() => {
                            if (tab !== 'weekly') {
                                setLoading(true);
                                setTab('weekly');
                            }
                        }}
                    >
                        <Calendar size={14} /> Weekly Trends
                    </button>
                    <button className={`fmc-segmented-btn ${tab === 'custom' ? 'active' : ''}`} onClick={() => setTab('custom')}><Calendar size={14} /> Custom Date Range</button>
                    {canViewFinancials ? (
                        <button 
                            className={`fmc-segmented-btn ${tab === 'monthly' ? 'active' : ''}`}
                            onClick={() => {
                                if (tab !== 'monthly') {
                                    setLoading(true);
                                    setTab('monthly');
                                }
                            }}
                        >
                            <TrendingUp size={14} /> Monthly Business P&L
                        </button>
                    ) : (
                        <span 
                            className="fmc-segmented-btn" 
                            style={{ opacity: 0.6, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            title="Monthly P&L requires Super Admin / Financial Audit access"
                        >
                            <Shield size={13} /> Monthly P&L (Restricted)
                        </span>
                    )}
                </div>

                {/* Target Date / Period Quick Capsule */}
                {tab === 'weekly' && <div className="report-range-controls">
                    <button className="btn btn-sm btn-outline" onClick={() => setEodDate(shiftCalendarDate(eodDate, -7))}>Previous week</button>
                    <button className="btn btn-sm btn-outline" onClick={() => setEodDate(businessDate())}>This week</button>
                    <button className="btn btn-sm btn-outline" onClick={() => setEodDate(shiftCalendarDate(businessDate(), -7))}>Last week</button>
                    <button className="btn btn-sm btn-outline" onClick={() => setEodDate(shiftCalendarDate(eodDate, 7))}>Next week</button>
                </div>}

                {tab === 'custom' ? <div className="report-range-controls">
                    <label>From <input aria-label="Report start date" type="date" value={rangeStart} max={rangeEnd} onChange={e => setRangeStart(e.target.value)} /></label>
                    <label>To <input aria-label="Report end date" type="date" value={rangeEnd} min={rangeStart} onChange={e => setRangeEnd(e.target.value)} /></label>
                    <small>Up to 366 days</small>
                </div> : tab !== 'monthly' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--card-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                            <Calendar size={14} color="var(--primary-blue)" />
                            <label style={{ fontWeight: 800, fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{tab === 'weekly' ? 'Week containing:' : 'Audit Date:'}</label>
                            <input 
                                type="date" 
                                className="filter-input" 
                                style={{ border: 'none', padding: '0', background: 'transparent', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }} 
                                value={eodDate} 
                                onChange={e => setEodDate(e.target.value)} 
                            />
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--card-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                            <Calendar size={14} color="var(--primary-blue)" />
                            <label style={{ fontWeight: 800, fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Period:</label>
                            <input 
                                type="month" 
                                className="filter-input" 
                                style={{ border: 'none', padding: '0', background: 'transparent', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }} 
                                value={monthVal} 
                                onChange={e => setMonthVal(e.target.value)} 
                            />
                        </div>
                    </div>
                )}
            </div>

            {reportError ? <p role="alert">{reportError}</p> : loading ? (
                <ContentShimmer 
                    message={
                        tab === 'eod' 
                            ? `Auditing EOD Cashflow & Operations for ${formatDate(eodDate)}...` 
                            : (tab === 'weekly' 
                                ? 'Compiling 7-Day Courier Logistics & Shipment Breakdown...' 
                                : `Calculating Executive P&L, Carrier Costs & Net Margins for ${monthVal}...`)
                    }
                />
            ) : (
                <>
                    {canViewFinancials && ((tab === 'eod' ? eodReport : tab === 'monthly' ? monthlyReport : weeklyReport)?.estimated_cost_shipments > 0) && <p className="report-estimate-notice" role="status">
                        Provisional profit: {(tab === 'eod' ? eodReport : tab === 'monthly' ? monthlyReport : weeklyReport).estimated_cost_shipments} shipment(s) still use estimated provider costs. Reconcile their bills to update profit.
                    </p>}
                    {/* Tab 1: EOD Operations Audit */}
                    {tab === 'eod' && eodReport && (
                        <div className="fmc-report-hero-card">
                            {/* Card Top Title Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)', marginBottom: '18px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 900, margin: 0 }}>
                                            End of Day (EOD) Operations & Cashflow Audit Sheet
                                        </h3>
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-blue)' }}>
                                            AUDITED
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>
                                        Statement Date: <strong>{formatDate(eodReport.date)}</strong> • Center: <strong>Bangalore Main Center (HQ)</strong>
                                    </div>
                                </div>
                                <button className="btn btn-primary-blue" onClick={handlePrintEOD} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '8px', fontWeight: 700, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
                                    <Printer size={15} /> Print EOD Sheet
                                </button>
                            </div>

                            {/* 5-Column KPI Stat Cards */}
                            <div className="fmc-kpi-grid">
                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #3b82f6' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">Total Bookings</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>📦</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: 'var(--text-main)' }}>{eodReport.shipments_count}</div>
                                    <div className="fmc-kpi-sub">Shipments Dispatched</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #6366f1' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">Customer Sales</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>💵</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#6366f1' }}>
                                        {formatCurrency(eodReport.invoice_total ?? eodReport.total_sales_with_gst ?? (eodReport.total_sales * 1.18))}
                                    </div>
                                    <small style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {formatCurrency(eodReport.total_sales)} Base + {formatCurrency(eodReport.gst_total)} GST (18%)
                                    </small>
                                    <div className="fmc-kpi-sub">Total Billed with GST</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #10b981' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">Collections</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>💳</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#10b981' }}>{formatCurrency(eodReport.total_collected)}</div>
                                    <div className="fmc-kpi-sub">100% Cash/Bank Realized</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #f59e0b' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">B2B Credit</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>🏢</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#f59e0b' }}>{formatCurrency(eodReport.credit_sales)}</div>
                                    <div className="fmc-kpi-sub">30–60 Day Terms</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag" style={{ color: '#10b981', fontWeight: 800 }}>Net Profit</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>📈</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#10b981' }}>
                                        {canViewFinancials ? formatCurrency(eodReport.net_profit) : '••••••'}
                                    </div>
                                    <div className="fmc-kpi-sub" style={{ color: '#10b981', fontWeight: 700 }}>
                                        {canViewFinancials 
                                            ? (eodReport.total_sales > 0 ? ((eodReport.net_profit / eodReport.total_sales) * 100).toFixed(1) + '% Margin' : '0% Margin')
                                            : 'Super Admin Access Only'}
                                    </div>
                                </div>
                            </div>

                            {/* Visual Charts & Graphs Section (2-Columns) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                                {/* Courier Logistics Donut Chart */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>📦 Courier Distribution & Share</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By Carrier</span>
                                    </div>
                                    <div style={{ padding: '8px 4px' }}>
                                        <CourierDonutChart data={eodReport.courier_counts} />
                                    </div>
                                </div>

                                {/* Revenue & Collections Realization Progress */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>💵 Cashflow & Margin Realization</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Financial Overview</span>
                                    </div>
                                    <div style={{ padding: '8px 4px' }}>
                                        {(() => {
                                            const totalBilled = Number(eodReport.invoice_total ?? eodReport.total_sales_with_gst ?? (eodReport.total_sales * 1.18));
                                            return (
                                                <>
                                                    <ProgressItem 
                                                        label="Gross Invoiced Sales" 
                                                        value={totalBilled} 
                                                        total={totalBilled} 
                                                        color="#6366f1" 
                                                    />
                                                    <ProgressItem 
                                                        label="Realized Collections (Cash/Bank)" 
                                                        value={eodReport.total_collected} 
                                                        total={totalBilled} 
                                                        color="#10b981" 
                                                    />
                                                    <ProgressItem 
                                                        label="B2B Monthly Credit Pending" 
                                                        value={eodReport.credit_sales} 
                                                        total={totalBilled} 
                                                        color="#f59e0b" 
                                                    />
                                                    {canViewFinancials && (
                                                        <ProgressItem 
                                                            label="Net Operating Profit" 
                                                            value={eodReport.net_profit} 
                                                            total={totalBilled} 
                                                            color="#10b981" 
                                                        />
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Traceability Grid (2 Columns) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                                {/* 2. Payment Method Channels */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>💳 Collections by Payment Method</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Channels</span>
                                    </div>
                                    <div className="reports-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 2px' }}>
                                        {Object.entries(eodReport.collections_by_method || {}).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>No collections logged.</div>
                                        ) : (
                                            Object.entries(eodReport.collections_by_method || {}).map(([m, amt]) => (
                                                <ProgressItem 
                                                    key={m} 
                                                    label={m} 
                                                    value={amt} 
                                                    total={eodReport.total_collected || amt} 
                                                    color="#10b981" 
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 3. Staff Audit */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>👤 Staff Collections Audit</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Traceable</span>
                                    </div>
                                    <div className="reports-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '6px 2px' }}>
                                        {Object.entries(eodReport.collections_by_employee || {}).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>No staff collections logged.</div>
                                        ) : (
                                            Object.entries(eodReport.collections_by_employee || {}).map(([e, amt]) => (
                                                <div key={e} className="fmc-breakdown-item">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {e.charAt(0)}
                                                        </div>
                                                        <span style={{ fontWeight: 600 }}>{e}</span>
                                                    </div>
                                                    <strong style={{ color: 'var(--primary-blue)', fontSize: '12.5px' }}>{formatCurrency(amt)}</strong>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2 & 3: Weekly Trends & Custom Date Range */}
                    {(tab === 'weekly' || tab === 'custom') && weeklyReport && (
                        <div className="fmc-report-hero-card weekly-report-card">
                            <div className="weekly-report-heading">
                                <div>
                                    <span className="weekly-report-eyebrow">{weeklyReport.period_days || 7}-day operational overview</span>
                                    <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 900, margin: '2px 0 1px' }}>
                                        {tab === 'custom' ? 'Custom Date Range Report' : 'Weekly Operations Report'}
                                    </h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12.5px' }}>
                                        {formatDate(weeklyReport.period_start)} – {formatDate(weeklyReport.period_end)}
                                    </p>
                                </div>
                                <button className="btn btn-primary-blue" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '8px', fontWeight: 700, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
                                    <Printer size={15} /> Print Report
                                </button>
                            </div>

                            {/* 4-Column KPI Grid */}
                            <div className="weekly-kpi-grid">
                                <div className="weekly-kpi blue"><span>Total bookings</span><strong>{weeklyReport.shipments_count}</strong><small>Across the selected period</small></div>
                                <div className="weekly-kpi violet"><span>Active booking days</span><strong>{weeklyReport.active_days}<em>/{weeklyReport.period_days || 7}</em></strong><small>Days with shipment activity</small></div>
                                <div className="weekly-kpi amber"><span>Couriers used</span><strong>{Object.keys(weeklyReport.courier_counts || {}).length}</strong><small>Active logistics partners</small></div>
                                <div className="weekly-kpi green"><span>Delivered</span><strong>{weeklyReport.status_counts?.Delivered || 0}</strong><small>Completed shipments</small></div>
                            </div>

                            {/* Visual Charts Row: Trend Chart & Courier Donut */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)', gap: '16px', margin: '20px 0', alignItems: 'stretch' }}>
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>📈 Daily Shipment Volume & Revenue Trend</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day-by-Day Activity</span>
                                    </div>
                                    <DailyTrendChart 
                                        dailyData={weeklyReport.daily} 
                                        showFinancials={weeklyReport.financials_visible} 
                                    />
                                </div>

                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>📦 Courier Distribution & Share</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Carriers</span>
                                    </div>
                                    <div style={{ padding: '12px 4px' }}>
                                        <CourierDonutChart data={weeklyReport.courier_counts} />
                                    </div>
                                </div>
                            </div>

                            {weeklyReport.shipments_count === 0 && !weeklyReport.daily.some(day => day.collections !== 0) ? (
                                <div className="weekly-empty-state">
                                    <Calendar size={30} />
                                    <strong>No bookings or receipts in this period</strong>
                                    <span>Choose another date range to review previous activity.</span>
                                </div>
                            ) : (
                                <div className="weekly-report-layout">
                                    <div className="weekly-table-panel">
                                        <div className="weekly-panel-title"><strong>Daily Operations & Collections Ledger</strong><span>Day-by-day audit</span></div>
                                        <div className="table-container reports-table-scroll" tabIndex={0} role="region" aria-label="Daily Operations Ledger">
                                            <table className="data-table weekly-data-table" style={{ minWidth: '760px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: 'left', width: '15%' }}>Date</th>
                                                        <th style={{ textAlign: 'center', width: '11%' }}>Bookings</th>
                                                        <th style={{ textAlign: 'right', width: '14%' }}>Collections</th>
                                                        {weeklyReport.financials_visible && (
                                                            <>
                                                                <th style={{ textAlign: 'right', width: '16%' }}>Revenue (Incl. GST)</th>
                                                                <th style={{ textAlign: 'right', width: '14%' }}>Base Sales</th>
                                                                <th style={{ textAlign: 'right', width: '14%' }}>Provider cost</th>
                                                                <th style={{ textAlign: 'right', width: '16%' }}>Gross Profit</th>
                                                            </>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {weeklyReport.daily.map(day => (
                                                        <tr key={day.date}>
                                                            <td style={{ fontWeight: 600 }}>{formatDate(day.date)}</td>
                                                            <td style={{ textAlign: 'center' }}><strong style={{ color: 'var(--primary-blue)' }}>{day.shipments_count}</strong></td>
                                                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--emerald)' }}>{formatCurrency(day.collections)}</td>
                                                            {weeklyReport.financials_visible && (
                                                                <>
                                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-blue)' }}>{formatCurrency(day.revenue_with_gst ?? (day.revenue ? day.revenue * 1.18 : 0))}</td>
                                                                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(day.revenue)}</td>
                                                                    <td style={{ textAlign: 'right', color: 'var(--rose)' }}>{formatCurrency(day.provider_cost)}</td>
                                                                    <td style={{ textAlign: 'right' }} className="weekly-profit">{formatCurrency(day.gross_profit)}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="weekly-breakdowns">
                                        <div className="fmc-breakdown-box">
                                            <div className="fmc-breakdown-header">
                                                <span>📊 Shipment Lifecycle Status</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status Count</span>
                                            </div>
                                            <div className="reports-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {Object.entries(weeklyReport.status_counts || {}).map(([name, count]) => (
                                                    <div className="fmc-breakdown-item" key={name}>
                                                        <span style={{ fontWeight: 600 }}>{name}</span>
                                                        <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: name === 'Delivered' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)', color: name === 'Delivered' ? 'var(--emerald)' : 'var(--primary-blue)' }}>
                                                            {count}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 4: Monthly Executive P&L */}
                    {tab === 'monthly' && monthlyReport && (
                        <div className="fmc-report-hero-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)', marginBottom: '18px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 900, margin: 0 }}>
                                            Monthly Executive Profit & Loss (P&L) Statement
                                        </h3>
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)' }}>
                                            EXECUTIVE AUDIT
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>
                                        Financial Period: <strong>{monthlyReport.month}</strong> • Center: <strong>Bangalore Main Center (HQ)</strong>
                                    </div>
                                </div>
                                <button className="btn btn-primary-blue" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 18px', borderRadius: '8px', fontWeight: 700, boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
                                    <Printer size={15} /> Print Statement
                                </button>
                            </div>

                            {/* Top Monthly Summary KPI Cards */}
                            <div className="fmc-kpi-grid" style={{ marginBottom: '18px', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #6366f1' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">Gross Sales (Incl. GST)</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>💵</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#6366f1' }}>
                                        {formatCurrency(monthlyReport.invoice_total || monthlyReport.revenue_with_gst || ((monthlyReport.revenue || 0) * 1.18))}
                                    </div>
                                    <div className="fmc-kpi-sub">Total Invoiced to Customers</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #e11d48' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">Provider Costs</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(225, 29, 72, 0.15)', color: '#e11d48' }}>🚛</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#e11d48' }}>
                                        {formatCurrency(monthlyReport.total_actual_cost)}
                                    </div>
                                    <div className="fmc-kpi-sub">Total Carrier Logistics Cost</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #10b981' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag">Gross Profit</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>📊</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#10b981' }}>
                                        {formatCurrency(monthlyReport.gross_profit)}
                                    </div>
                                    <div className="fmc-kpi-sub">Revenue Minus Carrier Costs</div>
                                </div>

                                <div className="fmc-kpi-card" style={{ borderTop: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}>
                                    <div className="fmc-kpi-card-header">
                                        <span className="fmc-kpi-tag" style={{ color: '#10b981', fontWeight: 800 }}>Net Business Profit</span>
                                        <div className="fmc-kpi-badge-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>📈</div>
                                    </div>
                                    <div className="fmc-kpi-val" style={{ color: '#10b981' }}>
                                        {formatCurrency(monthlyReport.net_profit)}
                                    </div>
                                    <div className="fmc-kpi-sub" style={{ color: '#10b981', fontWeight: 700 }}>
                                        {monthlyReport.net_profit_margin || '0'}% Net Profit Margin
                                    </div>
                                </div>
                            </div>

                            {/* Visual P&L Waterfall and Carrier Distribution (2 Columns) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '18px' }}>
                                {/* Waterfall Visual Flow */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>📊 Executive P&L Waterfall Flow</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Step-by-Step</span>
                                    </div>
                                    <div style={{ padding: '8px 2px' }}>
                                        <MonthlyWaterfallChart 
                                            grossSales={Number(monthlyReport.invoice_total || monthlyReport.revenue_with_gst || ((monthlyReport.revenue || 0) * 1.18))}
                                            providerCost={Number(monthlyReport.total_actual_cost || 0)}
                                            grossProfit={Number(monthlyReport.gross_profit || 0)}
                                            refunds={Number(monthlyReport.refunds_total || 0)}
                                            operatingExpenses={Number(monthlyReport.operational_expenses || 0)}
                                            netProfit={Number(monthlyReport.net_profit || 0)}
                                        />
                                    </div>
                                </div>

                                {/* Logistics Provider Cost Breakdown by Carrier */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>🚛 Provider Costs by Carrier Partner</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Carrier Share</span>
                                    </div>
                                    <div className="reports-list-scroll" style={{ padding: '8px 2px', maxHeight: '250px' }}>
                                        {Object.entries(monthlyReport.carrier_costs || monthlyReport.provider_cost_breakdown || {}).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>No carrier provider costs recorded.</div>
                                        ) : (
                                            Object.entries(monthlyReport.carrier_costs || monthlyReport.provider_cost_breakdown || {}).map(([carrier, cost]) => (
                                                <ProgressItem 
                                                    key={carrier} 
                                                    label={providerCostLabel(carrier)} 
                                                    value={cost} 
                                                    total={monthlyReport.total_actual_cost || cost} 
                                                    color="#e11d48" 
                                                    icon={<CourierLogo courier={carrier} height={14} />}
                                                />
                                            ))
                                        )}

                                        {monthlyReport.postpaid_carrier_payments > 0 && (
                                            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--card-border)' }}>
                                                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                                                    Payments & Deposits to Postpaid Carriers this month:
                                                </div>
                                                {Object.entries(monthlyReport.postpaid_payments_breakdown || {}).map(([carrier, amt]) => (
                                                    <div key={carrier} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                                                        <span>{carrier} Payments & Deposits</span>
                                                        <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(amt)}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--card-border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <span>Predicted vs Actual Difference:</span>
                                            <strong style={{ color: monthlyReport.cost_variance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                                                {monthlyReport.cost_variance > 0 ? '+' : ''}{formatCurrency(monthlyReport.cost_variance)}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed P&L Waterfall Financial Ledger Card */}
                            <div className="reports-table-scroll" style={{ background: 'var(--bg-app)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--card-border)', maxHeight: 'none' }}>
                                <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                    Comprehensive Financial Audit Ledger
                                </h4>
                                <div style={{ minWidth: '500px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--card-border)', fontSize: '13px', fontWeight: 700 }}>
                                        <span>1. Customer Sales (Gross Invoiced with GST)</span>
                                        <span style={{ color: 'var(--primary-blue)', fontSize: '14px' }}>{formatCurrency(monthlyReport.invoice_total || monthlyReport.revenue_with_gst || ((monthlyReport.revenue || 0) * 1.18))}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>Base Sales (Excl. GST)</span>
                                        <strong>{formatCurrency(monthlyReport.total_revenue || monthlyReport.revenue)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>GST Output Tax (18%)</span>
                                        <strong>{formatCurrency(monthlyReport.gst_total)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed var(--card-border)', fontSize: '13px', fontWeight: 700 }}>
                                        <span>2. Total Logistics Provider Cost (Carrier Invoices)</span>
                                        <span style={{ color: 'var(--rose)' }}>- {formatCurrency(monthlyReport.total_actual_cost)}</span>
                                    </div>
                                    {monthlyReport.postpaid_carrier_payments > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '12px' }}>
                                            <span>↳ Expenses Paid / Settled to Postpaid Carriers</span>
                                            <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(monthlyReport.postpaid_carrier_payments)}</strong>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--card-border)', fontSize: '13.5px', fontWeight: 800 }}>
                                        <span>3. Gross Profit (Revenue &minus; Carrier Costs)</span>
                                        <span style={{ color: 'var(--emerald)' }}>{formatCurrency(monthlyReport.gross_profit)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>4. Customer Refunds Deducted</span>
                                        <span style={{ color: 'var(--rose)' }}>- {formatCurrency(monthlyReport.refunds_total)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>5. Operating Expenses</span>
                                        <span style={{ color: 'var(--rose)' }}>- {formatCurrency(monthlyReport.operational_expenses)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', borderTop: '2px solid var(--primary-blue)', fontSize: '16px', fontWeight: 900, color: 'var(--primary-blue)' }}>
                                        <span>Net Business Profit</span>
                                        <span style={{ color: '#10b981' }}>{formatCurrency(monthlyReport.net_profit)} ({monthlyReport.net_profit_margin}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {!loading && !reportError && canViewFinancials && expenseReport && (
                <section className="table-card" aria-label="Operating expenses by category">
                    <div className="dash-box-header"><h3>Operating Expenses by Category</h3></div>
                    <div className="table-wrap"><table className="data-table">
                        <thead><tr><th>Category</th><th>Amount</th></tr></thead>
                        <tbody>
                            {Object.entries(expenseReport.expense_breakdown || {}).map(([category, amount]) => (
                                <tr key={category}><td>{category}</td><td>{formatCurrency(amount)}</td></tr>
                            ))}
                            {!Object.keys(expenseReport.expense_breakdown || {}).length && <tr><td colSpan="2">No operating expenses recorded for this period.</td></tr>}
                        </tbody>
                        <tfoot><tr><th>Total Operating Expenses</th><th>{formatCurrency(expenseReport.operational_expenses)}</th></tr></tfoot>
                    </table></div>
                </section>
            )}
        </div>
    );
};
