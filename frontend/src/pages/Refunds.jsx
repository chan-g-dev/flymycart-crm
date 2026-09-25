import { exportToExcel } from '../utils/excelExport';
import PaymentDetailsSummary from '../components/PaymentDetailsSummary';
import { businessDate, formatBusinessDate } from '../utils/businessDates';
import { useState } from 'react';
import { Plus, Check, Search, Download } from 'lucide-react';
import { useAuth } from '../context/authSession';

export const Refunds = ({ refunds = [], onOpenRefundModal, onApproveRefund, onProcessRefund, onRejectRefund }) => {
    const { hasPermission } = useAuth();
    const [searchVal, setSearchVal] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = formatBusinessDate;

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
            r.customer || '',
            r.awb || '',
            Number(r.amount || 0),
            r.reason || '',
            r.status || '',
            r.request_date || '',
            r.approved_by || ''
        ]);

        exportToExcel(headers, rows, `FMC_Refunds_${businessDate()}.xlsx`, 'Refunds');
    };

    return (
        <div className="refund-directory-page">
            {/* Header with KPI chips */}
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>🔄 Customer Refunds & Adjustments</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        5-state permission-gated lifecycle (Requested &rarr; Approved &rarr; Refunded / Rejected). Deducts automatically from Profit.
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
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Refunds to Excel">
                        <Download size={14} /> Export Excel
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
                                            <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{r.customer}</strong><PaymentDetailsSummary details={r.payment_details} />
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
