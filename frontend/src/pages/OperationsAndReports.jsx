import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Check, 
    MessageSquare, 
    Printer, 
    Download, 
    Trash2, 
    Calendar, 
    FileText, 
    ShieldCheck, 
    Phone, 
    Send, 
    Settings as SettingsIcon,
    RotateCcw,
    History,
    TrendingUp,
    DollarSign,
    CheckCircle2,
    XCircle,
    UserCheck,
    Clock,
    RefreshCw,
    AlertCircle,
    UserPlus,
    Filter,
    ShieldAlert,
    UserX,
    Mail,
    MapPin,
    Shield,
    Zap,
    Search,
    Users as UsersIcon,
    Loader2
} from 'lucide-react';
import { useAuth, ROLES } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { WhatsAppIcon, CourierLogo } from '../components/CourierLogos';
import { ContentShimmer } from '../components/ContentShimmer';

const normalizeStaffRole = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!raw) return 'operations_staff';
    if (raw === 'superadmin') return 'super_admin';
    if (raw === 'front_counter') return 'counter_staff';
    if (raw === 'front_counter_staff') return 'counter_staff';
    if (raw === 'operations_manager' || raw === 'manager') return 'operations_staff';
    return raw;
};

const normalizeStaffStatus = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'active' || raw === 'approved') return 'Active';
    if (raw === 'pending' || raw === 'pending approval' || raw === 'invited') return 'Pending Approval';
    if (raw === 'rejected') return 'Rejected';
    if (raw === 'suspended' || raw === 'inactive') return 'Suspended';
    return value || 'Pending Approval';
};

const normalizeStaffRecord = (user) => {
    const primaryRole = user?.role || user?.role_id || user?.roles?.[0]?.id || user?.roles?.[0]?.name;
    const normalizedRole = normalizeStaffRole(primaryRole);
    const normalizedStatus = normalizeStaffStatus(user?.status);
    const firstCenter = Array.isArray(user?.centers) && user.centers.length > 0
        ? (typeof user.centers[0] === 'string' ? user.centers[0] : user.centers[0]?.center_id || user.centers[0]?.name)
        : null;

    return {
        ...user,
        name: user?.name || user?.display_name || user?.full_name || user?.user_name || user?.email?.split('@')?.[0] || 'Staff Member',
        email: user?.email || '',
        phone: user?.phone || '',
        role: normalizedRole,
        roles: user?.roles || [],
        status: normalizedStatus,
        is_active: typeof user?.is_active === 'boolean' ? user.is_active : normalizedStatus === 'Active',
        center: user?.center || firstCenter || 'Main Hub (Bangalore)',
        approved_by: user?.approved_by || user?.approved_by_name || null,
        approval_date: user?.approval_date || user?.approved_at || null
    };
};

const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
    const detail = error?.response?.data?.detail;
    if (Array.isArray(detail)) return detail.map(item => item?.msg || item).join(', ');
    if (typeof detail === 'object' && detail?.message) return detail.message;
    return detail || error?.response?.data?.message || error?.message || fallback;
};

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

export const Reports = () => {
    const [tab, setTab] = useState('eod');
    const [eodDate, setEodDate] = useState(new Date().toISOString().slice(0, 10));
    const [monthVal, setMonthVal] = useState(new Date().toISOString().slice(0, 7));
    const [eodReport, setEodReport] = useState(null);
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [loading, setLoading] = useState(true);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            if (tab === 'eod') {
                apiClient.getEODReport(eodDate).then(data => {
                    setEodReport(data);
                    setLoading(false);
                }).catch(() => setLoading(false));
            } else if (tab === 'monthly' || tab === 'weekly') {
                apiClient.getMonthlyPLReport(monthVal).then(data => {
                    setMonthlyReport(data);
                    setLoading(false);
                }).catch(() => setLoading(false));
            }
        }, 320);
        return () => clearTimeout(timer);
    }, [tab, eodDate, monthVal]);

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '4px 10px', 
                        borderRadius: '999px', 
                        background: 'rgba(16, 185, 129, 0.12)', 
                        color: 'var(--emerald, #10b981)', 
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                        Single-Entry Live Sync
                    </span>
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
                </div>

                {/* Target Date / Period Quick Capsule */}
                {tab === 'eod' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--card-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                            <Calendar size={14} color="var(--primary-blue)" />
                            <label style={{ fontWeight: 800, fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Audit Date:</label>
                            <input 
                                type="date" 
                                className="filter-input" 
                                style={{ border: 'none', padding: '0', background: 'transparent', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }} 
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
                                    <div className="fmc-kpi-val" style={{ color: '#10b981' }}>{formatCurrency(eodReport.net_profit)}</div>
                                    <div className="fmc-kpi-sub" style={{ color: '#10b981', fontWeight: 700 }}>
                                        {eodReport.total_sales > 0 ? ((eodReport.net_profit / eodReport.total_sales) * 100).toFixed(1) + '% Margin' : '0% Margin'}
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

                    {/* Tab 2 & 3: Monthly / Weekly Executive P&L */}
                    {(tab === 'monthly' || tab === 'weekly') && monthlyReport && (
                        <div className="fmc-report-hero-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 900, margin: 0 }}>
                                        {tab === 'weekly' ? 'Weekly Business Summary & Trend Analytics' : 'Monthly Executive Profit & Loss (P&L) Statement'}
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

export const Users = ({ settings, onDataMutated }) => {
    const { roles, currentUser, currentRole, switchUserRole, hasPermission } = useAuth();
    const rootAdminProfile = {
        name: currentUser?.name || 'Gangabathina Chanakya',
        email: currentUser?.email || 'chanakyagangabathina77@gmail.com',
        center: currentUser?.center || 'Main Hub (Bangalore)'
    };
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, PENDING, ACTIVE, REJECTED
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [actionType, setActionType] = useState(null); // 'approve' | 'reject' | 'toggle' | 'delete' | 'role'
    const [feedbackMessage, setFeedbackMessage] = useState(null);
    const [staffLoadError, setStaffLoadError] = useState(null);

    const fetchUsers = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await apiClient.getUsers();
            const records = Array.isArray(data) ? data : (data?.data || []);
            setStaffList(records.map(normalizeStaffRecord));
            setStaffLoadError(null);
        } catch (err) {
            console.error('Failed to fetch staff directory:', err);
            setStaffLoadError(err.response?.status === 403
                ? 'Staff directory access is available to Super Admin only.'
                : 'Unable to load the staff directory. Please try Refresh Staff.');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const showFeedback = (text, type = 'success') => {
        setFeedbackMessage({ text, type });
        setTimeout(() => setFeedbackMessage(null), 4000);
    };

    const handleApproveStaff = async (userId, staffName, customRole, customCenter) => {
        setActionLoadingId(userId);
        setActionType('approve');

        // Optimistic UI update for instant feedback
        const prevList = [...staffList];
        setStaffList(prev => prev.map(u => u.id === userId ? {
            ...u,
            status: 'Active',
            is_active: true,
            role: customRole || u.role,
            center: customCenter || u.center,
            approved_by: currentUser?.name || 'Super Admin'
        } : u));

        try {
            await apiClient.approveStaff(userId, {
                action: 'approve',
                role: customRole,
                center: customCenter
            });
            showFeedback(`✓ Staff "${staffName}" has been ACCEPTED & ACTIVATED for CRM access!`, 'success');
            fetchUsers(true);
            if (onDataMutated) onDataMutated();
        } catch (err) {
            setStaffList(prevList);
            showFeedback(`Failed to approve staff: ${getApiErrorMessage(err)}`, 'error');
        } finally {
            setActionLoadingId(null);
            setActionType(null);
        }
    };

    const handleRejectStaff = async (userId, staffName) => {
        if (!window.confirm(`Are you sure you want to decline authorization for "${staffName}"?`)) return;
        setActionLoadingId(userId);
        setActionType('reject');

        // Optimistic UI update for instant feedback
        const prevList = [...staffList];
        setStaffList(prev => prev.map(u => u.id === userId ? {
            ...u,
            status: 'Rejected',
            is_active: false,
            approved_by: `Rejected by ${currentUser?.name || 'Super Admin'}`
        } : u));

        try {
            await apiClient.rejectStaff(userId, { action: 'reject' });
            showFeedback(`Declined authorization for "${staffName}".`, 'warning');
            await fetchUsers(true);
            if (onDataMutated) onDataMutated();
        } catch (err) {
            setStaffList(prevList);
            showFeedback(`Failed to decline: ${getApiErrorMessage(err)}`, 'error');
        } finally {
            setActionLoadingId(null);
            setActionType(null);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        setActionLoadingId(userId);
        setActionType('role');

        const prevList = [...staffList];
        setStaffList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

        try {
            await apiClient.updateUserRoles(userId, [newRole]);
            showFeedback(`Updated staff role to ${ROLES[newRole]?.name || newRole}.`, 'success');
            await fetchUsers(true);
            if (onDataMutated) onDataMutated();
        } catch (err) {
            setStaffList(prevList);
            showFeedback(`Failed to update role: ${getApiErrorMessage(err)}`, 'error');
        } finally {
            setActionLoadingId(null);
            setActionType(null);
        }
    };

    const handleToggleActive = async (user) => {
        const nextActive = !user.is_active;
        setActionLoadingId(user.id);
        setActionType('toggle');

        const prevList = [...staffList];
        setStaffList(prev => prev.map(u => u.id === user.id ? {
            ...u,
            is_active: nextActive,
            status: nextActive ? 'Active' : 'Suspended'
        } : u));

        try {
            if (nextActive) {
                await apiClient.reactivateUser(user.id);
            } else {
                await apiClient.suspendUser(user.id);
            }
            showFeedback(`Staff "${user.name}" is now ${nextActive ? 'Active' : 'Suspended'}.`, 'success');
            await fetchUsers(true);
            if (onDataMutated) onDataMutated();
        } catch (err) {
            setStaffList(prevList);
            showFeedback(`Failed to change status: ${getApiErrorMessage(err)}`, 'error');
        } finally {
            setActionLoadingId(null);
            setActionType(null);
        }
    };

    const handleDeleteUser = async (userId, staffName) => {
        if (!window.confirm(`Permanently remove staff record for "${staffName}"?`)) return;
        setActionLoadingId(userId);
        setActionType('delete');

        const prevList = [...staffList];
        setStaffList(prev => prev.filter(u => u.id !== userId));

        try {
            await apiClient.deleteUser(userId);
            showFeedback(`Removed staff "${staffName}".`, 'warning');
            await fetchUsers(true);
            if (onDataMutated) onDataMutated();
        } catch (err) {
            setStaffList(prevList);
            showFeedback(`Failed to remove: ${getApiErrorMessage(err)}`, 'error');
        } finally {
            setActionLoadingId(null);
            setActionType(null);
        }
    };

    const pendingStaff = staffList.filter(u => u.status === 'Pending Approval');
    const activeStaff = staffList.filter(u => u.status === 'Active');
    const otherStaff = staffList.filter(u => u.status !== 'Pending Approval' && u.status !== 'Active');

    const filteredList = staffList.filter(u => {
        if (filterStatus === 'PENDING' && u.status !== 'Pending Approval') return false;
        if (filterStatus === 'ACTIVE' && u.status !== 'Active') return false;
        if (filterStatus === 'REJECTED' && u.status !== 'Rejected' && u.status !== 'Suspended') return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = u.name?.toLowerCase().includes(q);
            const matchEmail = u.email?.toLowerCase().includes(q);
            const matchCenter = u.center?.toLowerCase().includes(q);
            const matchRole = u.role?.toLowerCase().includes(q);
            if (!matchName && !matchEmail && !matchCenter && !matchRole) return false;
        }
        return true;
    });

    const isSuperAdmin = currentRole.id === 'super_admin';

    return (
        <div>
            {/* Header & Quick KPI Bar */}
            <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(30, 100, 240, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldCheck size={13} color="var(--primary-blue)" />
                            </div>
                            <h2 className="page-title" style={{ fontSize: '13px', fontWeight: 800, margin: 0, letterSpacing: '-0.2px' }}>
                                Users & Staff Access Management
                            </h2>
                        </div>
                        <p className="page-subtitle" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            Enterprise role-based access control (RBAC), multi-hub assignments, and Super Admin authorization queue.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>

                        <button 
                            type="button"
                            className="btn btn-secondary" 
                            onClick={fetchUsers}
                            disabled={loading}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                height: '26px',
                                borderRadius: '5px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                            }}
                        >
                            <RefreshCw size={11} className={loading ? 'spin' : ''} />
                            <span>Refresh Staff</span>
                        </button>
                    </div>
                </div>

                {/* Top Metrics Strip (4-Column Clean Ultra-Compact Grid) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(30, 100, 240, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UsersIcon size={12} color="var(--primary-blue)" />
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Total Staff</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1 }}>{staffLoadError ? '—' : staffList.length}</div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', border: pendingStaff.length > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--card-border)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: pendingStaff.length > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(100, 116, 139, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Clock size={12} color={pendingStaff.length > 0 ? '#d97706' : 'var(--text-muted)'} />
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: pendingStaff.length > 0 ? '#b45309' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Awaiting Onboarding</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: pendingStaff.length > 0 ? '#b45309' : 'var(--text-main)', lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{staffLoadError ? '—' : pendingStaff.length}</span>
                                {!staffLoadError && pendingStaff.length > 0 && <span style={{ fontSize: '8.5px', fontWeight: 700, padding: '0 4px', borderRadius: '3px', background: '#fef3c7', color: '#b45309' }}>Invite Sent</span>}
                            </div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UserCheck size={12} color="#059669" />
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Active Authorized</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669', lineHeight: 1.1 }}>{staffLoadError ? '—' : activeStaff.length}</div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MapPin size={12} color="#7c3aed" />
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Headquarters Hub</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.1, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>Main Hub (Bangalore)</div>
                        </div>
                    </div>
                </div>
            </div>

            {loading && staffList.length === 0 && (
                <div className="staff-directory-loader" role="status" aria-live="polite">
                    <Loader2 size={18} className="spin" />
                    <div>
                        <strong>Loading staff directory</strong>
                        <span>Fetching the latest staff details and authorization status...</span>
                    </div>
                </div>
            )}

            {/* Feedback Notification Alert */}
            {feedbackMessage && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '7px',
                    background: feedbackMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : (feedbackMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                    border: `1px solid ${feedbackMessage.type === 'success' ? '#10b981' : (feedbackMessage.type === 'warning' ? '#f59e0b' : '#ef4444')}`,
                    color: feedbackMessage.type === 'success' ? '#047857' : (feedbackMessage.type === 'warning' ? '#b45309' : '#b91c1c'),
                    fontSize: '11.5px',
                    fontWeight: 700,
                    marginBottom: '10px',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <CheckCircle2 size={15} />
                    <span>{feedbackMessage.text}</span>
                </div>
            )}

            {staffLoadError && (
                <div style={{
                    padding: '8px 12px',
                    marginBottom: '10px',
                    borderRadius: '7px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    color: '#b45309',
                    fontSize: '11.5px',
                    fontWeight: 700
                }}>
                    {staffLoadError}
                </div>
            )}

            {/* Executive Super Admin Profile Card */}
            <div style={{
                marginBottom: '12px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #090e1a 0%, #111a2e 50%, #0d1527 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '10px 14px',
                color: '#ffffff',
                boxShadow: '0 4px 16px -2px rgba(10, 17, 34, 0.25)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar */}
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '15px',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                        }}>
                            {currentUser?.avatar || '👑'}
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.2px', color: '#ffffff' }}>
                                    {rootAdminProfile.name}
                                </span>
                                <span style={{ 
                                    fontSize: '9.5px', 
                                    fontWeight: 800, 
                                    padding: '2px 7px', 
                                    borderRadius: '4px', 
                                    background: 'rgba(239, 68, 68, 0.2)', 
                                    color: '#fca5a5', 
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px'
                                }}>
                                    {currentRole?.name || 'Staff Member'}
                                </span>
                                <span style={{ 
                                    fontSize: '9.5px', 
                                    fontWeight: 700, 
                                    padding: '2px 7px', 
                                    borderRadius: '4px', 
                                    background: 'rgba(16, 185, 129, 0.2)', 
                                    color: '#6ee7b7', 
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                }}>
                                    ● Active / Authorized
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px', fontSize: '11px', color: '#94a3b8', flexWrap: 'wrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Mail size={12} color="#60a5fa" />
                                    <strong style={{ color: '#e2e8f0' }}>{rootAdminProfile.email}</strong>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <MapPin size={12} color="#f59e0b" />
                                    <span>Center: <strong style={{ color: '#e2e8f0' }}>{rootAdminProfile.center}</strong></span>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Shield size={12} color="#34d399" />
                                    <span>Level: <strong style={{ color: '#34d399' }}>{currentRole?.description || 'Role-based workspace access'}</strong></span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Authority Pill */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ 
                            fontSize: '10.5px', 
                            fontWeight: 700, 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            background: 'rgba(16, 185, 129, 0.15)', 
                            color: '#34d399', 
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <ShieldCheck size={12} /> {isSuperAdmin ? 'Full Management Authority' : 'Role-Limited Access'}
                        </span>
                        {false && pendingStaff.length > 0 && isSuperAdmin && (
                            <span style={{ 
                                fontSize: '9.5px', 
                                color: '#fde68a', 
                                background: 'rgba(245, 158, 11, 0.2)', 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                fontWeight: 700
                            }}>
                                ⚡ {pendingStaff.length} Approval{pendingStaff.length > 1 ? 's' : ''} Awaiting Review
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* PENDING STAFF APPROVALS & ROLE AUTHORIZATION QUEUE */}
            {isSuperAdmin && pendingStaff.length > 0 && (
                <div style={{
                    marginBottom: '14px',
                    borderRadius: '9px',
                    border: pendingStaff.length > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--card-border)',
                    background: 'var(--card-bg)',
                    boxShadow: 'var(--card-shadow)',
                    overflow: 'hidden'
                }}>
                    {/* Card Header */}
                    <div style={{
                        padding: '8px 12px',
                        background: pendingStaff.length > 0 ? 'linear-gradient(90deg, rgba(254, 243, 199, 0.4) 0%, rgba(255, 251, 235, 0.2) 100%)' : 'var(--bg-app)',
                        borderBottom: '1px solid var(--card-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                                width: '22px', 
                                height: '22px', 
                                borderRadius: '6px', 
                                background: pendingStaff.length > 0 ? '#f59e0b' : '#64748b', 
                                color: '#ffffff', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontWeight: 800, 
                                fontSize: '11px'
                            }}>
                                {pendingStaff.length}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    Staff Awaiting Super Admin Acceptance
                                </h3>
                                <p style={{ margin: '1px 0 0', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                    Review identity, choose role authorization, and grant CRM access.
                                </p>
                            </div>
                        </div>

                        {pendingStaff.length > 0 ? (
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                                Action Required
                            </span>
                        ) : (
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                                ✓ All Staff Approved
                            </span>
                        )}
                    </div>

                    {/* Pending Items List */}
                    <div style={{ padding: '10px 12px' }}>
                        {pendingStaff.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '22px', marginBottom: '4px' }}>🎉</div>
                                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>No staff awaiting onboarding</div>
                                <div style={{ fontSize: '11px', marginTop: '2px' }}>New invitations will appear after they are sent.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {pendingStaff.map((staff) => (
                                    <div 
                                        key={staff.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            gap: '10px',
                                            padding: '8px 12px',
                                            borderRadius: '7px',
                                            background: 'var(--bg-app)',
                                            border: '1px solid var(--card-border)',
                                            transition: 'var(--transition)'
                                        }}
                                    >
                                        {/* Applicant Bio */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
                                            <div style={{
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '7px',
                                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                color: '#ffffff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 800,
                                                fontSize: '12px',
                                                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)',
                                                flexShrink: 0
                                            }}>
                                                {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{staff.name}</strong>
                                                    <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                                                        ⏳ Pending Review
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                        <Mail size={11} /> {staff.email}
                                                    </span>
                                                    {staff.phone && (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                            <Phone size={11} /> {staff.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Meta: Center & Date */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '160px' }}>
                                            <div>
                                                <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned Hub</div>
                                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                                                    <MapPin size={11} color="var(--primary-blue)" /> {staff.center || 'Main Hub (Bangalore)'}
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Registered</div>
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-main)', marginTop: '1px' }}>
                                                    {staff.created_at ? new Date(staff.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Role Assignment Selector & Decision Buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <label htmlFor={`role-select-${staff.id}`} style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    Authorize Role
                                                </label>
                                                <select
                                                    id={`role-select-${staff.id}`}
                                                    defaultValue={staff.role || 'operations_staff'}
                                                    style={{
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        height: '26px',
                                                        border: '1px solid var(--card-border)',
                                                        background: 'var(--card-bg)',
                                                        color: 'var(--text-main)',
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        minWidth: '145px'
                                                    }}
                                                >
                                                    <option value="counter_staff">📝 Front Counter Staff</option>
                                                    <option value="operations_staff">💼 Operations Staff</option>
                                                    <option value="super_admin">👑 Super Admin</option>
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '13px' }}>
                                                <button
                                                    type="button"
                                                    className="btn"
                                                    disabled={actionLoadingId === staff.id}
                                                    onClick={() => {
                                                        const el = document.getElementById(`role-select-${staff.id}`);
                                                        const chosenRole = el ? el.value : staff.role;
                                                        handleApproveStaff(staff.id, staff.name, chosenRole, staff.center);
                                                    }}
                                                    style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        height: '26px',
                                                        background: actionLoadingId === staff.id && actionType === 'approve'
                                                            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                                                            : '#059669',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        cursor: actionLoadingId === staff.id ? 'wait' : 'pointer',
                                                        boxShadow: actionLoadingId === staff.id && actionType === 'approve'
                                                            ? '0 0 10px rgba(16, 185, 129, 0.6)'
                                                            : '0 1px 4px rgba(5, 150, 105, 0.25)',
                                                        opacity: actionLoadingId && actionLoadingId !== staff.id ? 0.6 : 1,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    title="Accept staff & grant active access"
                                                >
                                                    {actionLoadingId === staff.id && actionType === 'approve' ? (
                                                        <>
                                                            <Loader2 size={12} className="spin" />
                                                            <span>Activating...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check size={12} />
                                                            <span>Accept & Activate</span>
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn"
                                                    disabled={actionLoadingId === staff.id}
                                                    onClick={() => handleRejectStaff(staff.id, staff.name)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        height: '26px',
                                                        background: actionLoadingId === staff.id && actionType === 'reject'
                                                            ? 'rgba(239, 68, 68, 0.2)'
                                                            : 'rgba(239, 68, 68, 0.08)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.35)',
                                                        borderRadius: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px',
                                                        cursor: actionLoadingId === staff.id ? 'wait' : 'pointer',
                                                        boxShadow: actionLoadingId === staff.id && actionType === 'reject'
                                                            ? '0 0 10px rgba(239, 68, 68, 0.4)'
                                                            : 'none',
                                                        opacity: actionLoadingId && actionLoadingId !== staff.id ? 0.6 : 1,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    title="Decline staff registration"
                                                >
                                                    {actionLoadingId === staff.id && actionType === 'reject' ? (
                                                        <>
                                                            <Loader2 size={12} className="spin" />
                                                            <span>Declining...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle size={12} />
                                                            <span>Decline</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Staff Directory & Active Team Table */}
              <div className="table-card" style={{ marginBottom: '14px' }} aria-busy={loading}>
                <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '8px 12px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '12.5px', fontWeight: 800 }}>
                            Staff Directory & Authorization Matrix ({staffList.length})
                        </h3>
                        <p style={{ margin: '1px 0 0', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {activeStaff.length} Active Members &bull; {pendingStaff.length} Awaiting Onboarding &bull; {otherStaff.length} Suspended/Inactive
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative' }}>
                            <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                                type="text"
                                placeholder="Search staff name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    padding: '4px 8px 4px 26px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--card-border)',
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-main)',
                                    fontSize: '11px',
                                    height: '26px',
                                    minWidth: '190px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Status Filter Buttons */}
                        <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--card-border)', background: 'var(--bg-app)', padding: '1px' }}>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('ALL')}
                                style={{
                                    padding: '3px 8px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    border: 'none',
                                    borderRadius: '5px',
                                    background: filterStatus === 'ALL' ? 'var(--primary-blue)' : 'transparent',
                                    color: filterStatus === 'ALL' ? '#ffffff' : 'var(--text-main)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)'
                                }}
                            >
                                All ({staffList.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('PENDING')}
                                style={{
                                    padding: '3px 8px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    border: 'none',
                                    borderRadius: '5px',
                                    background: filterStatus === 'PENDING' ? '#f59e0b' : 'transparent',
                                    color: filterStatus === 'PENDING' ? '#ffffff' : 'var(--text-main)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)'
                                }}
                            >
                                Awaiting Onboarding ({pendingStaff.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatus('ACTIVE')}
                                style={{
                                    padding: '3px 8px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    border: 'none',
                                    borderRadius: '5px',
                                    background: filterStatus === 'ACTIVE' ? '#10b981' : 'transparent',
                                    color: filterStatus === 'ACTIVE' ? '#ffffff' : 'var(--text-main)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)'
                                }}
                            >
                                Active ({activeStaff.length})
                            </button>
                        </div>
                    </div>
                </div>

                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Staff Member</th>
                                <th>Contact Information</th>
                                <th>Operating Center</th>
                                <th>Assigned Role</th>
                                <th>Status</th>
                                <th>Approval Details</th>
                                {isSuperAdmin && <th style={{ textAlign: 'center' }}>Management Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600 }}>No staff members match the selected filter criteria.</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((staff) => {
                                    const isPending = staff.status === 'Pending Approval';
                                    const isUserActive = staff.status === 'Active';

                                    return (
                                        <tr key={staff.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '26px',
                                                        height: '26px',
                                                        borderRadius: '6px',
                                                        background: staff.role === 'super_admin' ? '#fee2e2' : (staff.role === 'operations_staff' ? '#dbeafe' : '#fef3c7'),
                                                        color: staff.role === 'super_admin' ? '#991b1b' : (staff.role === 'operations_staff' ? '#1e40af' : '#92400e'),
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 800,
                                                        fontSize: '12px',
                                                        flexShrink: 0
                                                    }}>
                                                        {staff.role === 'super_admin' ? '👑' : (staff.role === 'operations_staff' ? '💼' : '📝')}
                                                    </div>
                                                    <div>
                                                        <strong style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>{staff.name}</strong>
                                                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {staff.id.slice(0, 8)}...</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>{staff.email}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{staff.phone || 'No phone'}</div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                    <MapPin size={11} color="var(--primary-blue)" /> {staff.center || 'Main Hub (Bangalore)'}
                                                </span>
                                            </td>
                                            <td>
                                                {isSuperAdmin && staff.role !== 'super_admin' ? (
                                                    <select
                                                        value={staff.role || 'operations_staff'}
                                                        disabled={actionLoadingId === staff.id}
                                                        onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                                                        style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '5px',
                                                            fontSize: '10.5px',
                                                            fontWeight: 600,
                                                            height: '24px',
                                                            border: '1px solid var(--card-border)',
                                                            background: 'var(--bg-card)',
                                                            color: 'var(--text-main)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="counter_staff">Front Counter Staff</option>
                                                        <option value="operations_staff">Operations Staff</option>
                                                        <option value="super_admin">Super Admin</option>
                                                    </select>
                                                ) : (
                                                    <span className={`status-pill ${staff.role === 'super_admin' ? 'delayed' : (staff.role === 'operations_staff' ? 'picked-up' : 'in-transit')}`}>
                                                        {ROLES[staff.role]?.name || staff.role}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`status-pill ${isUserActive ? 'delivered' : (isPending ? 'in-transit' : 'cancelled')}`} style={{ fontWeight: 700 }}>
                                                    {isPending ? '⏳ Pending' : (isUserActive ? '● Active' : (staff.status || 'Suspended'))}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                                    {staff.approved_by ? (
                                                        <>
                                                            <strong>By:</strong> {staff.approved_by}
                                                            {staff.approval_date && (
                                                                <div>{new Date(staff.approval_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>Invitation Sent</span>
                                                    )}
                                                </div>
                                            </td>
                                            {isSuperAdmin && (
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        {isPending ? (
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                                Awaiting onboarding
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {staff.role !== 'super_admin' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-secondary"
                                                                        disabled={actionLoadingId === staff.id}
                                                                        onClick={() => handleToggleActive(staff)}
                                                                        style={{ padding: '3px 8px', height: '24px', fontSize: '10.5px', fontWeight: 600 }}
                                                                        title={isUserActive ? 'Suspend Account' : 'Reactivate Account'}
                                                                    >
                                                                        {isUserActive ? 'Suspend' : 'Activate'}
                                                                    </button>
                                                                )}
                                                                {staff.role !== 'super_admin' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-danger"
                                                                        disabled={actionLoadingId === staff.id}
                                                                        onClick={() => handleDeleteUser(staff.id, staff.name)}
                                                                        style={{ padding: '3px 6px', height: '24px', fontSize: '10.5px' }}
                                                                        title="Delete Staff Record"
                                                                    >
                                                                        <Trash2 size={11} />
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Granular Permissions Matrix */}
            <div className="dash-box" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Shield size={18} color="var(--primary-blue)" />
                    <h3 style={{ fontSize: '15.5px', fontWeight: 800, margin: 0 }}>
                        Role Permissions & Financial Masking Matrix
                    </h3>
                </div>
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Permission Capability</th>
                                <th style={{ textAlign: 'center' }}>Super Admin</th>
                                <th style={{ textAlign: 'center' }}>Operations Staff</th>
                                <th style={{ textAlign: 'center' }}>Front Counter Staff</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>View Full Financials & P&L Reports</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Full Access</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill cancelled" style={{ fontWeight: 700 }}>🔒 Masked</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill cancelled" style={{ fontWeight: 700 }}>🔒 Masked</span></td>
                            </tr>
                            <tr>
                                <td>View Provider Cost & Gross Margins</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Full Access</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill cancelled" style={{ fontWeight: 700 }}>🔒 Masked</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill cancelled" style={{ fontWeight: 700 }}>🔒 Masked</span></td>
                            </tr>
                            <tr>
                                <td>Book New Master Shipments & Invoices</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Granted</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Granted</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Granted</span></td>
                            </tr>
                            <tr>
                                <td>Run Provider Reconciliation & Commit Actuals</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Full Access</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delayed" style={{ fontWeight: 700 }}>🛡️ Restricted</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delayed" style={{ fontWeight: 700 }}>🛡️ Restricted</span></td>
                            </tr>
                            <tr>
                                <td>Approve & Process Customer Refunds</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Full Access</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill in-transit" style={{ fontWeight: 700 }}>Request Only</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill in-transit" style={{ fontWeight: 700 }}>Request Only</span></td>
                            </tr>
                            <tr>
                                <td>Accept Staff & Manage Users / Access</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Full Access</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delayed" style={{ fontWeight: 700 }}>🛡️ Restricted</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delayed" style={{ fontWeight: 700 }}>🛡️ Restricted</span></td>
                            </tr>
                            <tr>
                                <td>Manage System Configurations & Wallets</td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delivered" style={{ fontWeight: 700 }}>✓ Full Access</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delayed" style={{ fontWeight: 700 }}>🛡️ Restricted</span></td>
                                <td style={{ textAlign: 'center' }}><span className="status-pill delayed" style={{ fontWeight: 700 }}>🛡️ Restricted</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const Settings = ({ settings, onUpdateSettings }) => {
    const { hasPermission } = useAuth();
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
            couriers: [...(settings?.couriers || []), newCourier.trim()]
        };
        onUpdateSettings(updated);
        setNewCourier('');
    };

    const handleAddCenter = () => {
        if (!newCenter.trim()) return;
        const updated = {
            ...settings,
            centers: [...(settings?.centers || []), newCenter.trim()]
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
                        {settings?.couriers?.map(c => (
                            <span key={c} className="status-pill in-transit" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={c} height={14} />
                                <span>{c}</span>
                            </span>
                        ))}
                    </div>
                    {hasPermission('manageSettings') && (
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
                        {settings?.centers?.map(c => (
                            <span key={c} className="status-pill delivered" style={{ fontSize: '12px', padding: '5px 10px' }}>{c}</span>
                        ))}
                    </div>
                    {hasPermission('manageSettings') && (
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
