import { businessDate } from '../utils/businessDates';
import { providerCostLabel } from '../utils/costLabels';
import ScheduleFollowup from '../components/ScheduleFollowup';
import { dateAfter, followupBuckets } from '../utils/followupDates';
import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Check, 
    MessageSquare, 
    Printer, 
    Calendar, 
    FileText,
    TrendingUp,
    Shield,
    Search,
    Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { WhatsAppIcon, CourierLogo } from '../components/CourierLogos';
import { ContentShimmer } from '../components/ContentShimmer';
import { CourierDonutChart, ProgressItem, DailyTrendChart, MonthlyWaterfallChart } from '../components/ReportCharts';

export const Refunds = ({ refunds = [], onOpenRefundModal, onApproveRefund, onProcessRefund, onRejectRefund }) => {
    const { hasPermission } = useAuth();
    const [searchVal, setSearchVal] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const totalCount = refunds?.length || 0;
    const requestedCount = (refunds || []).filter(r => r.status === 'Requested').length;
    const approvedCount = (refunds || []).filter(r => r.status === 'Approved').length;
    const refundedCount = (refunds || []).filter(r => r.status === 'Refunded').length;
    const totalAmount = (refunds || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const filteredRefunds = (refunds || []).filter(r => {
        const matchesSearch = !searchVal || 
            (r.customer && r.customer.toLowerCase().includes(searchVal.toLowerCase())) ||
            (r.awb && r.awb.toLowerCase().includes(searchVal.toLowerCase())) ||
            (r.reason && r.reason.toLowerCase().includes(searchVal.toLowerCase())) ||
            (r.approved_by && r.approved_by.toLowerCase().includes(searchVal.toLowerCase()));
        const matchesStatus = !statusFilter || r.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const exportToCSV = () => {
        if (!refunds || refunds.length === 0) return;
        const headers = ['Customer Name', 'AWB Number', 'Refund Amount (INR)', 'Reason', 'Status', 'Request Date', 'Approved By'];
        const rows = refunds.map(r => [
            `"${r.customer || ''}"`,
            `"${r.awb || ''}"`,
            r.amount || 0,
            `"${(r.reason || '').replace(/"/g, '""')}"`,
            `"${r.status || ''}"`,
            `"${r.request_date || ''}"`,
            `"${r.approved_by || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `FMC_Refunds_${businessDate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="refund-directory-page">
            {/* Header with KPI chips */}
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>🔄 Customer Refunds & Adjustments</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        5-state permission-gated lifecycle (Requested &rarr; Approved &rarr; Refunded / Rejected). Deducts automatically from Net Profit.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="pill-stat">Total: <strong>{totalCount}</strong></span>
                        <span className="pill-stat" style={{ background: '#fef3c7', color: '#92400e' }}>Requested: <strong>{requestedCount}</strong></span>
                        <span className="pill-stat" style={{ background: '#e0f2fe', color: '#0369a1' }}>Approved: <strong>{approvedCount}</strong></span>
                        <span className="pill-stat" style={{ background: '#dcfce7', color: '#15803d' }}>Settled: <strong>{refundedCount}</strong></span>
                        <span className="pill-stat" style={{ background: '#ffe4e6', color: '#be123c' }}>Amount: <strong>{formatCurrency(totalAmount)}</strong></span>
                    </div>
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Refunds to CSV">
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn btn-primary-blue" onClick={onOpenRefundModal}>
                        <Plus size={15} /> New Refund Request
                    </button>
                </div>
            </div>

            {/* Filter Search Bar */}
            <div className="filter-bar" style={{ marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        className="filter-input" 
                        style={{ paddingLeft: '32px', width: '100%', height: '32px', fontSize: '11.5px' }}
                        placeholder="Search customer, AWB, reason..." 
                        value={searchVal}
                        onChange={(e) => setSearchVal(e.target.value)}
                    />
                </div>
                <select 
                    className="filter-select" 
                    style={{ width: '180px', height: '32px', fontSize: '11.5px' }}
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All Refund Statuses</option>
                    <option value="Requested">Requested (Pending Review)</option>
                    <option value="Approved">Approved (Awaiting Payout)</option>
                    <option value="Refunded">Refunded (Settled)</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>

            {/* Refunds Table */}
            <div className="table-card">
                <div className="table-wrap refund-directory-scroll" role="region" aria-label="Refund directory" tabIndex={0}>
                    <table className="data-table refund-directory-table">
                        <thead>
                            <tr>
                                <th style={{ width: '18%' }}>Customer Name</th>
                                <th style={{ width: '14%' }}>AWB Number</th>
                                <th style={{ width: '12%' }}>Refund Amount</th>
                                <th style={{ width: '22%' }}>Reason</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                                <th style={{ width: '11%' }}>Request Date</th>
                                <th style={{ width: '13%' }}>Approved By</th>
                                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRefunds.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                                        {searchVal || statusFilter ? 'No refund requests found matching search filters.' : 'No customer refund requests recorded.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredRefunds.map(r => (
                                    <tr key={r.id}>
                                        <td>
                                            <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{r.customer}</strong>
                                        </td>
                                        <td>
                                            <strong style={{ color: 'var(--primary-blue)', fontFamily: 'monospace', fontSize: '12px' }}>{r.awb}</strong>
                                        </td>
                                        <td>
                                            <strong style={{ fontWeight: 800, color: 'var(--rose)', fontSize: '12.5px' }}>{formatCurrency(r.amount)}</strong>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.reason || '-'}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`status-pill ${r.status === 'Refunded' ? 'delivered' : (r.status === 'Approved' ? 'picked-up' : (r.status === 'Rejected' ? 'delayed' : 'in-transit'))}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                            {formatDate(r.request_date)}
                                        </td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                                            {r.approved_by || '-'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
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
                                                    <span style={{ fontSize: '11.5px', color: 'var(--emerald)', fontWeight: 700 }}>Settled</span>
                                                )}
                                                {r.status === 'Rejected' && (
                                                    <span style={{ fontSize: '11.5px', color: 'var(--rose)', fontWeight: 600 }}>Rejected</span>
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

export const Followups = ({ followups = [], customers = [], onRefresh, onCompleteFollowup, onOpenCommModal }) => {
    const { hasPermission } = useAuth();
    const [scheduling, setScheduling] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const [filterVal, setFilterVal] = useState('');
    const todayStr = dateAfter();
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const { dueToday, overdue, upcoming } = followupBuckets(followups, todayStr);

    const filteredFollowups = (followups || []).filter(f => {
        const matchesSearch = !searchVal || 
            (f.customer && f.customer.toLowerCase().includes(searchVal.toLowerCase())) ||
            (f.category && f.category.toLowerCase().includes(searchVal.toLowerCase())) ||
            (f.notes && f.notes.toLowerCase().includes(searchVal.toLowerCase()));
        
        let matchesFilter = true;
        if (filterVal === 'dueToday') {
            matchesFilter = f.status !== 'Done' && (f.due_date === todayStr || dueToday.some(d => d.id === f.id));
        } else if (filterVal === 'overdue') {
            matchesFilter = f.status !== 'Done' && (f.due_date < todayStr || overdue.some(o => o.id === f.id));
        } else if (filterVal === 'upcoming') {
            matchesFilter = f.status !== 'Done' && upcoming.some(u => u.id === f.id);
        } else if (filterVal === 'Done') {
            matchesFilter = f.status === 'Done';
        } else if (filterVal === 'High') {
            matchesFilter = f.priority === 'High';
        }

        return matchesSearch && matchesFilter;
    });

    const exportToCSV = () => {
        if (!followups || followups.length === 0) return;
        const headers = ['Customer Name', 'Category', 'Due Date', 'Priority', 'Follow-up Notes', 'Status'];
        const rows = followups.map(f => [
            `"${f.customer || ''}"`,
            `"${f.category || ''}"`,
            `"${f.due_date || ''}"`,
            `"${f.priority || ''}"`,
            `"${(f.notes || '').replace(/"/g, '""')}"`,
            `"${f.status || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `FMC_Followups_${businessDate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleWhatsAppFollowup = (customerName, notes) => {
        const msg = encodeURIComponent(`Hello ${customerName}, greeting from Fly My Cart Logistics! Following up regarding: ${notes || 'your recent courier bookings'}. Let us know how we can assist you.`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    return (
        <div className="followup-directory-page">
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>🔔 Follow-ups & Customer Retention</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Automated retention alerts (5, 10, 15, 30 days inactivity), due invoice reminders, and communication logs.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="pill-stat">Total: <strong>{followups?.length || 0}</strong></span>
                        <span className="pill-stat" style={{ background: '#fef3c7', color: '#92400e' }}>Due Today: <strong>{dueToday.length}</strong></span>
                        <span className="pill-stat" style={{ background: '#ffe4e6', color: '#be123c' }}>Overdue: <strong>{overdue.length}</strong></span>
                        <span className="pill-stat" style={{ background: '#e0f2fe', color: '#0369a1' }}>Upcoming: <strong>{upcoming.length}</strong></span>
                    </div>
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Follow-ups to CSV">
                        <Download size={14} /> Export CSV
                    </button>
                    {hasPermission('followups.add') && (
                        <button className="btn btn-primary-blue" onClick={() => setScheduling(true)}>
                            <Plus size={15} /> Schedule Follow-up
                        </button>
                    )}
                </div>
            </div>

            {scheduling && <ScheduleFollowup customers={customers} onSaved={onRefresh} onClose={() => setScheduling(false)} />}

            {/* Top KPI Cards */}
            <div className="dash-stat-cards-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px', gap: '12px' }}>
                <div className="dash-mini-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px' }}>
                    <span className="card-label" style={{ color: 'var(--amber)', fontWeight: 700, fontSize: '11.5px' }}>Due Today</span>
                    <div className="card-value" style={{ color: 'var(--amber)', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{dueToday.length}</div>
                </div>
                <div className="dash-mini-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px' }}>
                    <span className="card-label" style={{ color: 'var(--rose)', fontWeight: 700, fontSize: '11.5px' }}>Overdue Follow-ups</span>
                    <div className="card-value" style={{ color: 'var(--rose)', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{overdue.length}</div>
                </div>
                <div className="dash-mini-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px' }}>
                    <span className="card-label" style={{ color: 'var(--sky)', fontWeight: 700, fontSize: '11.5px' }}>Upcoming (Next 7 Days)</span>
                    <div className="card-value" style={{ color: 'var(--sky)', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{upcoming.length}</div>
                </div>
            </div>

            {/* Filter Search Bar */}
            <div className="filter-bar" style={{ marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        className="filter-input" 
                        style={{ paddingLeft: '32px', width: '100%', height: '32px', fontSize: '11.5px' }}
                        placeholder="Search customer, notes..." 
                        value={searchVal}
                        onChange={(e) => setSearchVal(e.target.value)}
                    />
                </div>
                <select 
                    className="filter-select" 
                    style={{ width: '190px', height: '32px', fontSize: '11.5px' }}
                    value={filterVal} 
                    onChange={(e) => setFilterVal(e.target.value)}
                >
                    <option value="">All Follow-up Reminders</option>
                    <option value="dueToday">Due Today</option>
                    <option value="overdue">Overdue</option>
                    <option value="upcoming">Upcoming (Next 7 Days)</option>
                    <option value="High">High Priority Only</option>
                    <option value="Done">Completed Tasks</option>
                </select>
            </div>

            {/* Followups Table */}
            <div className="table-card">
                <div className="table-wrap followup-directory-scroll" role="region" aria-label="Follow-up directory" tabIndex={0}>
                    <table className="data-table followup-directory-table">
                        <thead>
                            <tr>
                                <th style={{ width: '18%', textAlign: 'left' }}>Customer Name</th>
                                <th style={{ width: '14%', textAlign: 'center' }}>Category</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>Due Date</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Priority</th>
                                <th style={{ width: '22%', textAlign: 'left' }}>Follow-up Task Notes</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                                <th style={{ width: '14%', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredFollowups?.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                                        {searchVal || filterVal ? 'No follow-up reminders found matching search filters.' : 'No follow-up reminders scheduled.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredFollowups?.map(f => (
                                    <tr key={f.id}>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{f.customer}</strong>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span className="status-pill picked-up">{f.category}</span>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: '12px' }}>
                                            {formatDate(f.due_date)}
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span className={`status-pill ${f.priority === 'High' ? 'delayed' : 'in-transit'}`}>
                                                {f.priority}
                                            </span>
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            <div style={{ fontSize: '12px', lineHeight: 1.4, color: 'var(--text-main)' }}>{f.notes || '-'}</div>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <span className={`status-pill ${f.status === 'Done' ? 'delivered' : (f.due_date < todayStr ? 'delayed' : 'in-transit')}`}>
                                                {f.status === 'Done' ? 'Completed' : f.status !== 'Pending' ? f.status : (f.due_date < todayStr ? 'Overdue' : 'Pending')}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                {f.status === 'Pending' && hasPermission('followups.edit') && (
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

export const Reports = ({ activeTab, refreshKey }) => {
    const { hasPermission } = useAuth();
    const canViewFinancials = hasPermission('viewFinancials');

    const [tab, setTab] = useState('eod');
    const [eodDate, setEodDate] = useState(businessDate());
    const [monthVal, setMonthVal] = useState(businessDate().slice(0, 7));
    const [eodReport, setEodReport] = useState(null);
    const [weeklyReport, setWeeklyReport] = useState(null);
    const [monthlyReport, setMonthlyReport] = useState(null);
    const [rangeStart, setRangeStart] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7) + '-01');
    const [rangeEnd, setRangeEnd] = useState(new Date().toLocaleDateString('en-CA'));
    const [reportError, setReportError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeTab || !['eod', 'weekly', 'monthly', 'custom'].includes(activeTab)) return;
        setTab(activeTab === 'monthly' && !canViewFinancials ? 'eod' : activeTab);
    }, [activeTab, canViewFinancials]);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

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
                {tab === 'custom' ? <div className="report-range-controls">
                    <label>From <input aria-label="Report start date" type="date" value={rangeStart} max={rangeEnd} onChange={e => setRangeStart(e.target.value)} /></label>
                    <label>To <input aria-label="Report end date" type="date" value={rangeEnd} min={rangeStart} onChange={e => setRangeEnd(e.target.value)} /></label>
                    <small>Up to 366 days</small>
                </div> : tab !== 'monthly' ? (
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
        </div>
    );
};

export { Users } from './UsersSection';

export const Settings = ({ settings, onUpdateSettings }) => {
    const { hasPermission, currentUser } = useAuth();
    const canManageSettings = Boolean(currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin');
    const visibleCouriers = settings?.couriers?.length
        ? settings.couriers
        : ['FedEx', 'Aramex', 'DHL', 'Blue Dart', 'Delhivery', 'UPS', 'Sree Maruthi'];
    const visibleCenters = settings?.centers?.length
        ? settings.centers
        : [
            settings?.centerName || 'Main Hub (Bangalore)',
            'Delhi Regional Hub',
            'Mumbai Branch',
            'Hyderabad Hub',
            'Kolkata Center',
        ];
    const visibleEmployees = (settings?.employees?.length
        ? settings.employees
        : ['Nawaz', 'Lata', 'Umesh', 'Uma']).map(e => (typeof e === 'string' ? e : e.name));
    const visiblePaidToAccounts = settings?.paidToAccounts?.length
        ? settings.paidToAccounts
        : ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];
    const visiblePrepaidWallets = settings?.prepaidWallets?.length
        ? settings.prepaidWallets
        : [
            { name: 'ICL', openingBalance: 0.0, currency: 'INR' },
            { name: 'BRV', openingBalance: 0.0, currency: 'INR' }
        ];
    const visiblePostpaidProviders = settings?.postpaidProviders?.length
        ? settings.postpaidProviders
        : [
            { name: 'Aramex', deposit: 0.0, paymentTerms: '30 Days' },
            { name: 'Blue Dart', deposit: 0.0, paymentTerms: '30 Days' },
            { name: 'FedEx', deposit: 0.0, paymentTerms: '30 Days' },
            { name: 'DHL Express', deposit: 0.0, paymentTerms: '30 Days' }
        ];

    const [newCourier, setNewCourier] = useState('');
    const [newCenter, setNewCenter] = useState('');
    const [newEmployee, setNewEmployee] = useState('');
    const [newPaidTo, setNewPaidTo] = useState('');
    const [newWalletName, setNewWalletName] = useState('');
    const [newWalletOpening, setNewWalletOpening] = useState('');
    const [newPostpaidName, setNewPostpaidName] = useState('');
    const [newPostpaidDeposit, setNewPostpaidDeposit] = useState('');
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

    const handleAddEmployee = () => {
        if (!newEmployee.trim() || visibleEmployees.includes(newEmployee.trim())) return;
        const updated = {
            ...settings,
            employees: [...visibleEmployees, newEmployee.trim()]
        };
        onUpdateSettings(updated);
        setNewEmployee('');
    };

    const handleRemoveEmployee = (empName) => {
        const updated = {
            ...settings,
            employees: visibleEmployees.filter(e => e !== empName)
        };
        onUpdateSettings(updated);
    };

    const handleAddPaidTo = () => {
        if (!newPaidTo.trim() || visiblePaidToAccounts.includes(newPaidTo.trim())) return;
        const updated = {
            ...settings,
            paidToAccounts: [...visiblePaidToAccounts, newPaidTo.trim()]
        };
        onUpdateSettings(updated);
        setNewPaidTo('');
    };

    const handleRemovePaidTo = (accName) => {
        const updated = {
            ...settings,
            paidToAccounts: visiblePaidToAccounts.filter(a => a !== accName)
        };
        onUpdateSettings(updated);
    };

    const handleAddWallet = () => {
        if (!newWalletName.trim()) return;
        const exists = visiblePrepaidWallets.some(w => w.name.toLowerCase() === newWalletName.trim().toLowerCase());
        if (exists) return;
        const newWallet = {
            name: newWalletName.trim(),
            openingBalance: Number(newWalletOpening) || 0.0,
            currency: 'INR',
            notes: `${newWalletName.trim()} Prepaid Wallet`
        };
        const updated = {
            ...settings,
            prepaidWallets: [...visiblePrepaidWallets, newWallet]
        };
        onUpdateSettings(updated);
        setNewWalletName('');
        setNewWalletOpening('');
    };

    const handleRemoveWallet = (walletName) => {
        const updated = {
            ...settings,
            prepaidWallets: visiblePrepaidWallets.filter(w => w.name !== walletName)
        };
        onUpdateSettings(updated);
    };

    const handleAddPostpaid = () => {
        if (!newPostpaidName.trim()) return;
        const exists = visiblePostpaidProviders.some(p => p.name.toLowerCase() === newPostpaidName.trim().toLowerCase());
        if (exists) return;
        const newProvider = {
            name: newPostpaidName.trim(),
            deposit: Number(newPostpaidDeposit) || 0.0,
            paymentTerms: '30 Days',
            accountNo: ''
        };
        const updated = {
            ...settings,
            postpaidProviders: [...visiblePostpaidProviders, newProvider]
        };
        onUpdateSettings(updated);
        setNewPostpaidName('');
        setNewPostpaidDeposit('');
    };

    const handleRemovePostpaid = (providerName) => {
        const updated = {
            ...settings,
            postpaidProviders: visiblePostpaidProviders.filter(p => p.name !== providerName)
        };
        onUpdateSettings(updated);
    };

    return (
        <div>
            <div className="page-header" style={{ marginBottom: '18px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>⚙️ Global System Configuration</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Configure business centers, couriers, staff collectors, payment channels, prepaid wallets, and postpaid accounts with zero code changes.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '16px', marginBottom: '22px' }}>
                {/* 1. Couriers */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>📦 Configurable Couriers</h4>
                    <div className="settings-chips-scroll">
                        {visibleCouriers.map(c => (
                            <span key={c} className="status-pill in-transit" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={c} height={14} />
                                <span>{c}</span>
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input type="text" className="filter-input" placeholder="Add custom courier..." value={newCourier} onChange={e => setNewCourier(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddCourier}>Add</button>
                        </div>
                    )}
                </div>

                {/* 2. Centers */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏢 Business Hubs & Centers</h4>
                    <div className="settings-chips-scroll">
                        {visibleCenters.map(c => (
                            <span key={c} className="status-pill delivered" style={{ fontSize: '12px', padding: '5px 10px' }}>{c}</span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input type="text" className="filter-input" placeholder="Add business center..." value={newCenter} onChange={e => setNewCenter(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddCenter}>Add</button>
                        </div>
                    )}
                </div>

                {/* 3. Staff Collectors & Cash Receivers */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>👤 Cash Collectors & Staff Members</h4>
                    <div className="settings-chips-scroll">
                        {visibleEmployees.map(emp => (
                            <span key={emp} className="status-pill delivered" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{emp}</span>
                                {canManageSettings && visibleEmployees.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveEmployee(emp)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
                                        title={`Remove ${emp}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input type="text" className="filter-input" placeholder="Add staff member / collector..." value={newEmployee} onChange={e => setNewEmployee(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddEmployee}>Add</button>
                        </div>
                    )}
                </div>

                {/* 4. Payment Accounts (paid_to) */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏦 Payment Accounts & Channels (paid_to)</h4>
                    <div className="settings-chips-scroll">
                        {visiblePaidToAccounts.map(acc => (
                            <span key={acc} className="status-pill in-transit" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{acc}</span>
                                {canManageSettings && visiblePaidToAccounts.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemovePaidTo(acc)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
                                        title={`Remove ${acc}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input type="text" className="filter-input" placeholder="Add account (e.g. Office QR, HDFC)..." value={newPaidTo} onChange={e => setNewPaidTo(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddPaidTo}>Add</button>
                        </div>
                    )}
                </div>

                {/* 5. Prepaid Wallets */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>💳 Prepaid Partner Wallets</h4>
                    <div className="settings-chips-scroll">
                        {visiblePrepaidWallets.map(w => (
                            <span key={w.name} className="status-pill delivered" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={w.name} height={14} />
                                <span>{w.name} (Opening: ₹{w.openingBalance?.toLocaleString('en-IN')})</span>
                                {canManageSettings && visiblePrepaidWallets.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveWallet(w.name)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
                                        title={`Remove ${w.name} Wallet`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                style={{ flex: '1 1 140px', minWidth: '120px' }} 
                                placeholder="Wallet Name (e.g. ICL, DTDC)..." 
                                value={newWalletName} 
                                onChange={e => setNewWalletName(e.target.value)} 
                            />
                            <input 
                                type="number" 
                                className="filter-input" 
                                style={{ width: '100px' }} 
                                placeholder="Opening ₹" 
                                value={newWalletOpening} 
                                onChange={e => setNewWalletOpening(e.target.value)} 
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddWallet}>Add Wallet</button>
                        </div>
                    )}
                </div>

                {/* 6. Postpaid Accounts */}
                <div className="dash-box">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>📋 Postpaid Courier Accounts</h4>
                    <div className="settings-chips-scroll">
                        {visiblePostpaidProviders.map(p => (
                            <span key={p.name} className="status-pill picked-up" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={p.name} height={14} />
                                <span>{p.name} (Deposit: ₹{p.deposit?.toLocaleString('en-IN')})</span>
                                {canManageSettings && visiblePostpaidProviders.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemovePostpaid(p.name)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
                                        title={`Remove ${p.name} Postpaid Account`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                style={{ flex: '1 1 140px', minWidth: '120px' }} 
                                placeholder="Provider (e.g. DTDC, Ecom)..." 
                                value={newPostpaidName} 
                                onChange={e => setNewPostpaidName(e.target.value)} 
                            />
                            <input 
                                type="number" 
                                className="filter-input" 
                                style={{ width: '100px' }} 
                                placeholder="Deposit ₹" 
                                value={newPostpaidDeposit} 
                                onChange={e => setNewPostpaidDeposit(e.target.value)} 
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddPostpaid}>Add Account</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Financial Audit Trail */}
            {hasPermission('viewFinancials') && (
                <div className="table-card" style={{ marginTop: '10px' }}>
                    <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0 }}>Financial Modifications Audit Log</h3>
                            <span className="pill-stat">Total: <strong>{auditLogs.length}</strong></span>
                        </div>
                    </div>
                    <div className="table-wrap reports-table-scroll" tabIndex={0} role="region" aria-label="Financial Modifications Audit Log" style={{ maxHeight: 'clamp(240px, 38vh, 420px)' }}>
                        <table className="data-table" style={{ minWidth: '650px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '22%' }}>Timestamp</th>
                                    <th style={{ width: '20%' }}>Staff User</th>
                                    <th style={{ width: '18%' }}>Entity</th>
                                    <th style={{ width: '20%' }}>Action</th>
                                    <th style={{ width: '20%' }}>Entity ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No audit events logged.</td></tr>
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
