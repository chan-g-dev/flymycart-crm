import { exportToExcel } from '../utils/excelExport';
import { businessDate, formatBusinessDate } from '../utils/businessDates';
import ScheduleFollowup from '../components/ScheduleFollowup';
import { dateAfter, followupBuckets } from '../utils/followupDates';
import { useState } from 'react';
import { Plus, Check, MessageSquare, Search, Download } from 'lucide-react';
import { useAuth } from '../context/authSession';
import { WhatsAppIcon } from '../components/CourierLogos';

export const Followups = ({ followups = [], customers = [], onRefresh, onCompleteFollowup, onOpenCommModal }) => {
    const { hasPermission } = useAuth();
    const [scheduling, setScheduling] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const [filterVal, setFilterVal] = useState('');
    const todayStr = dateAfter();
    const formatDate = formatBusinessDate;

    const { dueToday, overdue, upcoming } = followupBuckets(followups, todayStr);

    const findCustomerObj = (name) => {
        if (!name) return null;
        const norm = name.trim().toLowerCase();
        return (customers || []).find(c => 
            (c.name && c.name.trim().toLowerCase() === norm) || 
            (c.company && c.company.trim().toLowerCase() === norm)
        );
    };

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
            f.customer || '',
            f.category || '',
            f.due_date || '',
            f.priority || '',
            f.notes || '',
            f.status || ''
        ]);

        exportToExcel(headers, rows, `FMC_Followups_${businessDate()}.xlsx`, 'Followups');
    };

    const handleWhatsAppFollowup = (followupItem) => {
        const cust = findCustomerObj(followupItem.customer);
        const targetData = {
            name: followupItem.customer,
            customer_id: followupItem.customer_id || cust?.id,
            mobile: cust?.mobile || cust?.whatsapp || '',
            email: cust?.email || '',
            due: cust?.outstanding_balance || 0,
            category: followupItem.category,
            notes: followupItem.notes,
            priority: followupItem.priority
        };
        onOpenCommModal(targetData);
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
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Follow-ups to Excel">
                        <Download size={14} /> Export Excel
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
                                                <button className="btn btn-sm btn-outline" onClick={() => handleWhatsAppFollowup(f)} title="Send WhatsApp">
                                                    <WhatsAppIcon size={14} color="#25D366" />
                                                </button>
                                                <button className="btn btn-sm btn-outline" onClick={() => handleWhatsAppFollowup(f)} title="Log Phone Call / Meeting">
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
