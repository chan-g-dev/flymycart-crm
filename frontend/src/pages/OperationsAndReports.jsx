import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Check, 
    MessageSquare, 
    Printer, 
    Calendar, 
    FileText,
    TrendingUp,
    Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { WhatsAppIcon, CourierLogo } from '../components/CourierLogos';
import { ContentShimmer } from '../components/ContentShimmer';

export const Refunds = ({ refunds, onOpenRefundModal, onApproveRefund, onProcessRefund, onRejectRefund }) => {
    const { hasPermission } = useAuth();
    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '18px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>🔄 Customer Refunds & Adjustments</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        5-state permission-gated lifecycle (Requested &rarr; Approved &rarr; Refunded / Rejected). Deducts automatically from Net Profit.
                    </p>
                </div>
                <button className="btn btn-primary-blue" onClick={onOpenRefundModal}>
                    <Plus size={15} /> New Refund Request
                </button>
            </div>

            <div className="table-card">
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '160px' }}>Customer Name</th>
                                <th style={{ minWidth: '120px' }}>AWB Number</th>
                                <th style={{ minWidth: '120px' }}>Refund Amount</th>
                                <th style={{ minWidth: '200px' }}>Reason</th>
                                <th style={{ minWidth: '110px' }}>Status</th>
                                <th style={{ minWidth: '100px' }}>Request Date</th>
                                <th style={{ minWidth: '140px' }}>Approved By</th>
                                <th style={{ minWidth: '140px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {refunds?.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No customer refund requests recorded.</td></tr>
                            ) : (
                                refunds?.map(r => (
                                    <tr key={r.id}>
                                        <td><strong>{r.customer}</strong></td>
                                        <td><strong style={{ color: 'var(--primary-blue)', fontFamily: 'monospace' }}>{r.awb}</strong></td>
                                        <td style={{ fontWeight: 800, color: 'var(--rose)' }}>{formatCurrency(r.amount)}</td>
                                        <td style={{ fontSize: '12px' }}>{r.reason}</td>
                                        <td>
                                            <span className={`status-pill ${r.status === 'Refunded' ? 'delivered' : (r.status === 'Approved' ? 'picked-up' : (r.status === 'Rejected' ? 'delayed' : 'in-transit'))}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatDate(r.request_date)}</td>
                                        <td style={{ fontSize: '12px' }}>{r.approved_by || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                {r.status === 'Requested' && hasPermission('approveRefunds') && (
                                                    <>
                                                        <button className="btn btn-sm btn-success" onClick={() => onApproveRefund(r.id)} title="Approve refund request">
                                                            <Check size={12} /> Approve
                                                        </button>
                                                        <button className="btn btn-sm btn-outline" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }} onClick={() => onRejectRefund && onRejectRefund(r.id)} title="Reject refund">
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {r.status === 'Approved' && hasPermission('approveRefunds') && (
                                                    <button className="btn btn-sm btn-primary-blue" onClick={() => onProcessRefund(r.id)}>
                                                        Process Payout
                                                    </button>
                                                )}
                                                {r.status === 'Refunded' && (
                                                    <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 700 }}>Settled</span>
                                                )}
                                            </div>
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

export const Followups = ({ followups, onCompleteFollowup, onOpenCommModal }) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const dueToday = (followups || []).filter(f => f.status === 'Pending' && f.due_date === todayStr);
    const overdue = (followups || []).filter(f => f.status === 'Pending' && f.due_date < todayStr);
    const upcoming = (followups || []).filter(f => f.status === 'Pending' && f.due_date > todayStr);

    const handleWhatsAppFollowup = (customerName, notes) => {
        const msg = encodeURIComponent(`Hello ${customerName}, greeting from Fly My Cart Logistics! Following up regarding: ${notes || 'your recent courier bookings'}. Let us know how we can assist you.`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '18px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>🔔 Follow-ups & Customer Retention</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Automated retention alerts (5, 10, 15, 30 days inactivity), due invoice reminders, and communication logs.
                    </p>
                </div>
            </div>

            <div className="dash-stat-cards-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '18px' }}>
                <div className="dash-mini-card">
                    <span className="card-label" style={{ color: 'var(--amber)' }}>Due Today</span>
                    <div className="card-value" style={{ color: 'var(--amber)' }}>{dueToday.length}</div>
                </div>
                <div className="dash-mini-card">
                    <span className="card-label" style={{ color: 'var(--rose)' }}>Overdue Follow-ups</span>
                    <div className="card-value" style={{ color: 'var(--rose)' }}>{overdue.length}</div>
                </div>
                <div className="dash-mini-card">
                    <span className="card-label" style={{ color: 'var(--sky)' }}>Upcoming (Next 7 Days)</span>
                    <div className="card-value" style={{ color: 'var(--sky)' }}>{upcoming.length}</div>
                </div>
            </div>

            <div className="table-card">
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: '160px' }}>Customer Name</th>
                                <th style={{ minWidth: '150px' }}>Category</th>
                                <th style={{ minWidth: '100px' }}>Due Date</th>
                                <th style={{ minWidth: '90px' }}>Priority</th>
                                <th style={{ minWidth: '220px' }}>Follow-up Task Notes</th>
                                <th style={{ minWidth: '100px' }}>Status</th>
                                <th style={{ minWidth: '180px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {followups?.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No follow-up reminders scheduled.</td></tr>
                            ) : (
                                followups?.map(f => (
                                    <tr key={f.id}>
                                        <td><strong>{f.customer}</strong></td>
                                        <td><span className="status-pill picked-up">{f.category}</span></td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatDate(f.due_date)}</td>
                                        <td>
                                            <span className={`status-pill ${f.priority === 'High' ? 'delayed' : 'in-transit'}`}>
                                                {f.priority}
                                            </span>
                                        </td>
                                        <td><div style={{ fontSize: '12px', lineHeight: 1.4 }}>{f.notes}</div></td>
                                        <td>
                                            <span className={`status-pill ${f.status === 'Done' ? 'delivered' : (f.due_date < todayStr ? 'delayed' : 'in-transit')}`}>
                                                {f.status === 'Done' ? 'Completed' : (f.due_date < todayStr ? 'Overdue' : 'Pending')}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                {f.status !== 'Done' && (
                                                    <button className="btn btn-sm btn-success" onClick={() => onCompleteFollowup(f.id)} title="Mark as completed">
                                                        <Check size={12} /> Done
                                                    </button>
                                                )}
                                                <button className="btn btn-sm btn-outline" onClick={() => handleWhatsAppFollowup(f.customer, f.notes)} title="Send WhatsApp">
                                                    <WhatsAppIcon size={14} color="#25D366" />
                                                </button>
                                                <button className="btn btn-sm btn-outline" onClick={() => onOpenCommModal(f.customer)} title="Log Phone Call / Meeting">
                                                    <MessageSquare size={12} /> Log
                                                </button>
                                            </div>
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

export const Reports = ({ activeTab }) => {
    const { hasPermission } = useAuth();
    const canViewFinancials = hasPermission('viewFinancials');

    const [tab, setTab] = useState('eod');
    const [eodDate, setEodDate] = useState(new Date().toISOString().slice(0, 10));
    const [monthVal, setMonthVal] = useState(new Date().toISOString().slice(0, 7));
    const [eodReport, setEodReport] = useState(null);
    const [weeklyReport, setWeeklyReport] = useState(null);
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeTab || !['eod', 'weekly', 'monthly'].includes(activeTab)) return;
        setTab(activeTab === 'monthly' && !canViewFinancials ? 'eod' : activeTab);
    }, [activeTab, canViewFinancials]);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    useEffect(() => {
        if (!canViewFinancials && tab === 'monthly') {
            setTab('eod');
            return;
        }
        setLoading(true);
        if (tab === 'eod') {
                apiClient.getEODReport(eodDate).then(data => {
                    setEodReport(data);
                    setLoading(false);
                }).catch(() => setLoading(false));
            } else if (tab === 'weekly') {
                apiClient.getWeeklyReport(eodDate).then(data => {
                    setWeeklyReport(data);
                    setLoading(false);
                }).catch(() => setLoading(false));
            } else if (tab === 'monthly' && canViewFinancials) {
                apiClient.getMonthlyPLReport(monthVal).then(data => {
                    setMonthlyReport(data);
                    setLoading(false);
                }).catch(() => setLoading(false));
            } else {
                setLoading(false);
            }
    }, [tab, eodDate, monthVal, canViewFinancials]);

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
                <div className="fmc-segmented-capsule">
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
                {tab !== 'monthly' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--card-bg)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--card-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                            <Calendar size={14} color="var(--primary-blue)" />
                            <label style={{ fontWeight: 800, fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{tab === 'weekly' ? 'Week Ending:' : 'Audit Date:'}</label>
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

            {loading ? (
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
                    {/* Tab 1: EOD Operations Audit */}
                    {tab === 'eod' && eodReport && (
                        <div className="fmc-report-hero-card">
                            {/* Card Top Title Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 900, margin: 0 }}>
                                            End of Day (EOD) Operations & Cashflow Audit Sheet
                                        </h3>
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-blue)' }}>
                                            AUDITED
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '3px' }}>
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
                                    <div className="fmc-kpi-val" style={{ color: '#6366f1' }}>{formatCurrency(eodReport.total_sales)}</div>
                                    <div className="fmc-kpi-sub">Gross Billed Value</div>
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

                            {/* 3 Breakdown Cards */}
                            <div className="fmc-breakdown-grid">
                                {/* 1. Courier Logistics */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>📦 Courier Distribution</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>By Carrier</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {Object.keys(eodReport.courier_counts || {}).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>No bookings on this date.</div>
                                        ) : (
                                            Object.entries(eodReport.courier_counts).map(([c, count]) => (
                                                <div key={c} className="fmc-breakdown-item">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <CourierLogo courier={c} height={16} />
                                                    </div>
                                                    <span style={{ 
                                                        fontSize: '11.5px', 
                                                        fontWeight: 800, 
                                                        padding: '2px 8px', 
                                                        borderRadius: '6px', 
                                                        background: 'rgba(59, 130, 246, 0.12)', 
                                                        color: 'var(--primary-blue)' 
                                                    }}>
                                                        {count} {count === 1 ? 'shipment' : 'shipments'}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* 2. Payment Method */}
                                <div className="fmc-breakdown-box">
                                    <div className="fmc-breakdown-header">
                                        <span>💳 Collections by Method</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Channel</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {Object.entries(eodReport.collections_by_method || {}).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>No collections logged.</div>
                                        ) : (
                                            Object.entries(eodReport.collections_by_method || {}).map(([m, amt]) => (
                                                <div key={m} className="fmc-breakdown-item">
                                                    <span style={{ fontWeight: 600 }}>{m}</span>
                                                    <strong style={{ color: '#10b981' }}>{formatCurrency(amt)}</strong>
                                                </div>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {Object.entries(eodReport.collections_by_employee || {}).length === 0 ? (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>No staff collections.</div>
                                        ) : (
                                            Object.entries(eodReport.collections_by_employee || {}).map(([e, amt]) => (
                                                <div key={e} className="fmc-breakdown-item">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {e.charAt(0)}
                                                        </div>
                                                        <span style={{ fontWeight: 600 }}>{e}</span>
                                                    </div>
                                                    <strong style={{ color: 'var(--primary-blue)' }}>{formatCurrency(amt)}</strong>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'weekly' && weeklyReport && (
                        <div className="fmc-report-hero-card weekly-report-card">
                            <div className="weekly-report-heading">
                                <div>
                                    <span className="weekly-report-eyebrow">7-day operational overview</span>
                                    <h3>Weekly Operations Report</h3>
                                    <p>{formatDate(weeklyReport.period_start)} – {formatDate(weeklyReport.period_end)}</p>
                                </div>
                                <button className="btn btn-outline" onClick={() => window.print()}><Printer size={14} /> Print Report</button>
                            </div>

                            <div className="weekly-kpi-grid">
                                <div className="weekly-kpi blue"><span>Total bookings</span><strong>{weeklyReport.shipments_count}</strong><small>Across the selected week</small></div>
                                <div className="weekly-kpi violet"><span>Active booking days</span><strong>{weeklyReport.active_days}<em>/7</em></strong><small>Days with shipment activity</small></div>
                                <div className="weekly-kpi amber"><span>Couriers used</span><strong>{Object.keys(weeklyReport.courier_counts || {}).length}</strong><small>Active logistics partners</small></div>
                                <div className="weekly-kpi green"><span>Delivered</span><strong>{weeklyReport.status_counts?.Delivered || 0}</strong><small>Completed shipments</small></div>
                            </div>

                            {weeklyReport.shipments_count === 0 ? (
                                <div className="weekly-empty-state">
                                    <Calendar size={30} />
                                    <strong>No bookings in this week</strong>
                                    <span>Choose another week-ending date to review previous shipment activity.</span>
                                </div>
                            ) : (
                                <div className="weekly-report-layout">
                                    <div className="weekly-table-panel">
                                        <div className="weekly-panel-title"><strong>Daily booking trend</strong><span>Day-by-day activity</span></div>
                                        <div className="table-container">
                                            <table className="data-table weekly-data-table"><thead><tr><th>Date</th><th>Bookings</th>{weeklyReport.financials_visible && <><th>Revenue</th><th>Gross Profit</th></>}</tr></thead>
                                                <tbody>{weeklyReport.daily.map(day => <tr key={day.date}><td>{formatDate(day.date)}</td><td><strong>{day.shipments_count}</strong></td>{weeklyReport.financials_visible && <><td>{formatCurrency(day.revenue)}</td><td className="weekly-profit">{formatCurrency(day.gross_profit)}</td></>}</tr>)}</tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="weekly-breakdowns">
                                        <div className="fmc-breakdown-box"><div className="fmc-breakdown-header">Courier Distribution</div>{Object.entries(weeklyReport.courier_counts || {}).map(([name, count]) => <div className="fmc-breakdown-item" key={name}><CourierLogo courier={name} height={16} /><strong>{count}</strong></div>)}</div>
                                        <div className="fmc-breakdown-box"><div className="fmc-breakdown-header">Shipment Status</div>{Object.entries(weeklyReport.status_counts || {}).map(([name, count]) => <div className="fmc-breakdown-item" key={name}><span>{name}</span><strong>{count}</strong></div>)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Monthly Executive P&L */}
                    {tab === 'monthly' && monthlyReport && (
                        <div className="fmc-report-hero-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 900, margin: 0 }}>
                                        Monthly Executive Profit & Loss (P&L) Statement
                                    </h3>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '3px' }}>
                                        Financial Period: <strong>{monthlyReport.period}</strong> • Verified Against Single-Entry DB
                                    </div>
                                </div>
                                <button className="btn btn-outline" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '7px 16px', borderRadius: '8px' }}>
                                    <Printer size={14} color="var(--primary-blue)" /> Print Statement
                                </button>
                            </div>

                            {/* Waterfall P&L Breakdown Card */}
                            <div style={{ background: 'var(--bg-app)', padding: '24px', borderRadius: '14px', border: '1px solid var(--card-border)', maxWidth: '720px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1.5px solid var(--card-border)', fontSize: '15px', fontWeight: 800 }}>
                                    <span>1. Total Customer Sales (Revenue)</span>
                                    <span style={{ color: 'var(--primary-blue)', fontSize: '16px' }}>{formatCurrency(monthlyReport.total_revenue || monthlyReport.revenue)}</span>
                                </div>

                                <div style={{ padding: '14px 0 6px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                    2. Less: Actual Logistics Provider Costs (By Carrier)
                                </div>

                                {Object.entries(monthlyReport.carrier_costs || monthlyReport.provider_cost_breakdown || {}).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 6px 18px', fontSize: '12.5px' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
                                            <CourierLogo courier={k} height={15} />
                                        </div>
                                        <strong>{formatCurrency(v)}</strong>
                                    </div>
                                ))}

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px dashed var(--card-border)', fontWeight: 800, fontSize: '13.5px' }}>
                                    <span>Total Logistics Provider Cost:</span>
                                    <span style={{ color: 'var(--rose)' }}>{formatCurrency(monthlyReport.total_actual_cost)}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <span>Predicted vs Actual Cost Variance:</span>
                                    <span style={{ color: monthlyReport.cost_variance > 0 ? 'var(--rose)' : 'var(--emerald)', fontWeight: 700 }}>
                                        {monthlyReport.cost_variance > 0 ? '+' : ''}{formatCurrency(monthlyReport.cost_variance)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid var(--card-border)', fontSize: '15.5px', fontWeight: 800 }}>
                                    <span>3. Gross Profit (Revenue &minus; Actual Provider Costs)</span>
                                    <span style={{ color: 'var(--emerald)' }}>{formatCurrency(monthlyReport.gross_profit)}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px' }}>
                                    <span>4. Less: Approved Customer Refunds</span>
                                    <span style={{ color: 'var(--rose)' }}>{formatCurrency(monthlyReport.refunds_total)}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 8px', borderTop: '2.5px solid var(--primary-blue)', fontSize: '19px', fontWeight: 900, color: 'var(--primary-blue)' }}>
                                    <span>5. Net Business Profit</span>
                                    <span style={{ color: '#10b981' }}>{formatCurrency(monthlyReport.net_profit)} ({monthlyReport.net_profit_margin}%)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export { Users } from './UsersSection';

export const Settings = ({ settings, onUpdateSettings }) => {
    const { hasPermission, currentUser } = useAuth();
    const canManageSettings = Boolean(currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin');
    const visibleCouriers = settings?.couriers?.length
        ? settings.couriers
        : ['FedEx', 'Aramex', 'DHL', 'Blue Dart', 'Delhivery', 'UPS', 'Sree Maruthi', 'LTL'];
    const visibleCenters = settings?.centers?.length
        ? settings.centers
        : [
            settings?.centerName || 'Main Hub (Bangalore)',
            'Delhi Regional Hub',
            'Mumbai Branch',
            'Hyderabad Hub',
            'Kolkata Center',
        ];
    const [newCourier, setNewCourier] = useState('');
    const [newCenter, setNewCenter] = useState('');
    const [auditLogs, setAuditLogs] = useState([]);

    useEffect(() => {
        if (hasPermission('viewFinancials')) {
            apiClient.getAuditLogs().then(setAuditLogs).catch(() => {});
        }
    }, []);

    const handleAddCourier = () => {
        if (!newCourier.trim()) return;
        const updated = {
            ...settings,
            couriers: [...visibleCouriers, newCourier.trim()]
        };
        onUpdateSettings(updated);
        setNewCourier('');
    };

    const handleAddCenter = () => {
        if (!newCenter.trim()) return;
        const updated = {
            ...settings,
            centers: [...visibleCenters, newCenter.trim()]
        };
        onUpdateSettings(updated);
        setNewCenter('');
    };

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '18px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>⚙️ Global System Configuration</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Configure business centers, couriers, wallets, bank accounts, and GST parameters with zero code changes.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '22px' }}>
                {/* 1. Couriers */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>📦 Configurable Couriers</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {visibleCouriers.map(c => (
                            <span key={c} className="status-pill in-transit" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={c} height={14} />
                                <span>{c}</span>
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" className="filter-input" placeholder="Add custom courier..." value={newCourier} onChange={e => setNewCourier(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddCourier}>Add</button>
                        </div>
                    )}
                </div>

                {/* 2. Centers */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏢 Business Hubs & Centers</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {visibleCenters.map(c => (
                            <span key={c} className="status-pill delivered" style={{ fontSize: '12px', padding: '5px 10px' }}>{c}</span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" className="filter-input" placeholder="Add business center..." value={newCenter} onChange={e => setNewCenter(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddCenter}>Add</button>
                        </div>
                    )}
                </div>

                {/* 3. Wallets */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>💳 Prepaid Partner Wallets</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {settings?.prepaidWallets?.map(w => (
                            <span key={w.name} className="status-pill delivered" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={w.name} height={14} />
                                <span>{w.name} (Opening: ₹{w.openingBalance?.toLocaleString('en-IN')})</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* 4. Postpaid Accounts */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>📋 Postpaid Courier Accounts</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {settings?.postpaidProviders?.map(p => (
                            <span key={p.name} className="status-pill picked-up" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={p.name} height={14} />
                                <span>{p.name} (Deposit: ₹{p.deposit?.toLocaleString('en-IN')})</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Financial Audit Trail */}
            {hasPermission('viewFinancials') && (
                <div className="table-card">
                    <div className="dash-box-header">
                        <h3>Financial Modifications Audit Log</h3>
                    </div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Staff User</th>
                                    <th>Entity</th>
                                    <th>Action</th>
                                    <th>Entity ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No audit events logged.</td></tr>
                                ) : (
                                    auditLogs.map(l => (
                                        <tr key={l.id}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(l.timestamp).toLocaleString('en-IN')}</td>
                                            <td><strong>{l.user_name}</strong></td>
                                            <td><span className="status-pill in-transit">{l.entity_type}</span></td>
                                            <td><strong>{l.action}</strong></td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{l.entity_id}</td>
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
