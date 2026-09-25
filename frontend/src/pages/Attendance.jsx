import { useRemoteData } from '../utils/useRemoteData';
import { LoadingSpinner } from '../components/LoadingSpinner';
import React, { useState, useCallback, useMemo } from 'react';
import { Users, CheckCircle2, XCircle, Clock, Calendar, LogIn, LogOut, Coffee, Play, Search, Eye, Plus, X, TrendingUp } from 'lucide-react';
import { apiClient } from '../api/client';
import { businessDate, formatBusinessDate } from '../utils/businessDates';
import { useAuth } from '../context/authSession';

const STAFF_DEPARTMENTS = {
    'Umesh': 'Operations',
    'Asma': 'Accounts',
    'Ravi': 'Sales',
    'Suresh': 'Operations',
    'Praveen': 'Customer Support',
    'Naseer': 'Logistics',
    'Karthik': 'Admin',
    'Nawaz': 'Management',
    'Lata': 'Finance',
    'Uma': 'Operations',
    'Akash': 'Logistics'
};

const AVATAR_COLORS = [
    { bg: '#3b82f6', text: '#ffffff' }, // Blue
    { bg: '#10b981', text: '#ffffff' }, // Green
    { bg: '#8b5cf6', text: '#ffffff' }, // Purple
    { bg: '#f43f5e', text: '#ffffff' }, // Rose
    { bg: '#0ea5e9', text: '#ffffff' }, // Sky
    { bg: '#f97316', text: '#ffffff' }, // Orange
    { bg: '#6366f1', text: '#ffffff' }, // Indigo
];

export function Attendance() {
    const todayStr = businessDate();
    const { currentUser, hasPermission } = useAuth();
    const isSuperAdmin = Boolean(currentUser?.isSuperAdmin || currentUser?.is_superuser);
    const canManageAttendance = Boolean(isSuperAdmin || hasPermission('attendance.manage'));
    const userName = currentUser?.name || currentUser?.display_name || 'Staff';

    // Date & Filters State
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [summaryPeriod, setSummaryPeriod] = useState('today'); // 'today' or 'month'

    // Data States


    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [viewStaffData, setViewStaffData] = useState(null);
    const [punchStaff, setPunchStaff] = useState(userName);
    const [punchEvent, setPunchEvent] = useState('LOGIN');
    const [punchTime, setPunchTime] = useState('');
    const [punchNotes, setPunchNotes] = useState('');
    const [punchLoading, setPunchLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');

    const requestData = useCallback(async () => {
        const params = { date_from: selectedDate, date_to: selectedDate };
        const [staff, breakdown, events, summary] = await Promise.all([
            apiClient.getAttendanceStaffList(),
            apiClient.getAttendanceDailyBreakdown(params),
            apiClient.getAttendanceEvents(params),
            apiClient.getAttendanceSummary({ ...params, date_from: summaryPeriod === 'month' ? selectedDate.slice(0, 8) + '01' : selectedDate }),
        ]);
        return { staff: staff.staff || [], breakdown: breakdown.entries || [], events: events.events || [], summary };
    }, [selectedDate, summaryPeriod]);
    const { data, loading, error, reload: fetchData } = useRemoteData(requestData);
    const staffList = useMemo(() => data?.staff || [], [data]);
    const breakdownData = useMemo(() => data?.breakdown || [], [data]);
    const eventsData = data?.events || [];
    const summary = data?.summary;
    const periodKpis = {
        total: summary?.total_staff_days || 0,
        present: summary?.present_days || 0,
        absent: summary?.absent_days || 0,
        late: summary?.late_days || 0,
        onLeave: 0,
    };
    const canPunch = hasPermission('attendance.punch');

    // Handle Direct Punch (Punch In, Break, Resume, Punch Out)
    const handleDirectAction = async (eventType) => {
        setPunchLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
            await apiClient.recordAttendancePunch({
                staff_name: userName,
                event: eventType,
                time: timeStr,
                date: todayStr,
                notes: `Quick action: ${eventType}`
            });
            setActionMsg(`✓ ${eventType} recorded successfully at ${timeStr}`);
            setTimeout(() => setActionMsg(''), 4000);
            await fetchData();
        } catch (err) {
            alert(err.message || `Failed to record ${eventType}`);
        } finally {
            setPunchLoading(false);
        }
    };

    // Handle Add Attendance Modal Submission
    const handleAddAttendanceSubmit = async (e) => {
        e.preventDefault();
        if (!punchStaff) return;
        setPunchLoading(true);
        try {
            const timeToRecord = punchTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
            await apiClient.recordAttendancePunch({
                staff_name: punchStaff,
                event: punchEvent,
                time: timeToRecord,
                date: selectedDate,
                notes: punchNotes || 'Manual entry'
            });
            setIsAddModalOpen(false);
            setPunchNotes('');
            setPunchTime('');
            setActionMsg(`✓ Attendance logged for ${punchStaff}`);
            setTimeout(() => setActionMsg(''), 4000);
            await fetchData();
        } catch (err) {
            alert(err.message || "Failed to add attendance");
        } finally {
            setPunchLoading(false);
        }
    };

    // Build unified table rows combining all staff and breakdown data
    const allStaffMembers = useMemo(() => {
        const set = new Set(staffList);
        breakdownData.forEach(b => {
            if (b.staff_name) set.add(b.staff_name);
        });
        return Array.from(set);
    }, [staffList, breakdownData]);

    const tableRows = useMemo(() => {
        return allStaffMembers.map((name, idx) => {
            const entry = breakdownData.find(b => b.staff_name === name);
            const dept = STAFF_DEPARTMENTS[name] || 'Operations';
            const dateFmt = formatBusinessDate(selectedDate);

            // Determine status
            let status = 'Absent';
            let loginTime = '-';
            let logoutTime = '-';
            let workingHours = '-';

            if (entry && entry.login_time && entry.login_time !== '—' && entry.login_time !== '-') {
                loginTime = entry.login_time;
                logoutTime = entry.logout_time !== '—' ? entry.logout_time : '-';
                workingHours = entry.work_time_str !== '—' && entry.work_time_str !== '0h 0m' ? entry.work_time_str : (logoutTime !== '-' ? '0h 0m' : 'In Progress');
                status = entry.login_status === 'late' ? 'Late' : 'Present';
            }

            return {
                id: idx + 1,
                name,
                dept,
                date: dateFmt,
                rawDate: selectedDate,
                loginTime,
                logoutTime,
                workingHours,
                status,
                rawEntry: entry
            };
        });
    }, [allStaffMembers, breakdownData, selectedDate]);

    // Filter table rows by search and department
    const filteredRows = useMemo(() => {
        return tableRows.filter(row => {
            const matchesSearch = !searchTerm || 
                row.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                row.dept.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDept = selectedDept === 'All' || row.dept === selectedDept;
            return matchesSearch && matchesDept;
        });
    }, [tableRows, searchTerm, selectedDept]);

    // KPI Metrics calculation
    const kpis = useMemo(() => {
        const total = tableRows.length;
        const present = tableRows.filter(r => r.status === 'Present').length;
        const late = tableRows.filter(r => r.status === 'Late').length;
        const absent = tableRows.filter(r => r.status === 'Absent').length;
        const onLeave = tableRows.filter(r => r.status === 'On Leave').length;
        return { total, present, late, absent, onLeave };
    }, [tableRows]);

    // Late Coming Staff List
    const lateStaffList = useMemo(() => {
        return tableRows.filter(r => r.status === 'Late').map(r => {
            return {
                name: r.name,
                loginTime: r.loginTime,
                delay: r.rawEntry?.login_diff?.replace('+', '')?.replace(' late', '') || '-'
            };
        });
    }, [tableRows]);

    // Early Leaving Staff List
    const earlyLeavingList = useMemo(() => {
        return tableRows.filter(r => r.rawEntry?.logout_status === 'early').map(r => {
            return {
                name: r.name,
                logoutTime: r.logoutTime,
                leftEarly: r.rawEntry?.logout_diff?.replace('-', '') || '-'
            };
        });
    }, [tableRows]);

    // Available Departments for dropdown
    const availableDepts = useMemo(() => {
        const set = new Set(Object.values(STAFF_DEPARTMENTS));
        return ['All', ...Array.from(set)];
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
            
            {loading && <LoadingSpinner text="Loading attendance" />}
            {error && <p role="alert">Unable to load attendance. <button onClick={fetchData}>Retry</button></p>}
            {/* Header: Title, Date Picker, Add Attendance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '9px',
                        background: '#1d4ed8',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)'
                    }}>
                        <Users size={20} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                            Staff Attendance
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Date Selector */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--card-border, #e2e8f0)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}>
                        <Calendar size={15} color="#2563eb" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        />
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {selectedDate === todayStr ? '(Today)' : ''}
                        </span>
                    </div>

                    {/* + Add Attendance Button */}
                    <button
                        type="button"
                        disabled={!canManageAttendance || !canPunch}
                        onClick={() => { setPunchStaff(staffList[0] || userName); setIsAddModalOpen(true); }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '7px 16px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Plus size={16} /> Add Attendance
                    </button>
                </div>
            </div>

            {/* Action Feedback Banner */}
            {actionMsg && (
                <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600
                }}>
                    {actionMsg}
                </div>
            )}

            {/* 5 KPI Summary Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
            }}>
                {/* 1. Total Staff */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{kpis.total}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Total Staff</div>
                    </div>
                </div>

                {/* 2. Present */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#dcfce7',
                        color: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{kpis.present}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Present</div>
                    </div>
                </div>

                {/* 3. Absent */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <XCircle size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{kpis.absent}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Absent</div>
                    </div>
                </div>

                {/* 4. Late */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#fef3c7',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Clock size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{kpis.late}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Late</div>
                    </div>
                </div>

                {/* 5. On Leave */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Calendar size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>{kpis.onLeave}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>On Leave</div>
                    </div>
                </div>
            </div>

            {/* Action Bar: Quick Punch Buttons + Search & Department Filter */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--card-border, #e2e8f0)',
                borderRadius: '10px',
                padding: '10px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
                {/* 4 Quick Punch Action Buttons */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => handleDirectAction('LOGIN')}
                        disabled={punchLoading || !canPunch}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '7px',
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <LogIn size={15} /> Punch In
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDirectAction('BREAK START')}
                        disabled={punchLoading || !canPunch}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f97316',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '7px',
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Coffee size={15} /> Break
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDirectAction('BREAK END')}
                        disabled={punchLoading || !canPunch}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '7px',
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Play size={14} /> Resume
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDirectAction('LOGOUT')}
                        disabled={punchLoading || !canPunch}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '7px',
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <LogOut size={15} /> Punch Out
                    </button>
                </div>

                {/* Right: Search + Department Filter */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--bg-app, #f8fafc)',
                        border: '1px solid var(--card-border, #cbd5e1)',
                        borderRadius: '7px',
                        padding: '5px 10px',
                        minWidth: '220px',
                        flex: '1 1 200px',
                        maxWidth: '360px'
                    }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search staff by name or department..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '12px',
                                outline: 'none',
                                width: '100%'
                            }}
                        />
                    </div>

                    <select
                        value={selectedDept}
                        onChange={e => setSelectedDept(e.target.value)}
                        style={{
                            background: 'var(--card-bg, #ffffff)',
                            border: '1px solid var(--card-border, #cbd5e1)',
                            borderRadius: '7px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        <option value="All">All Departments</option>
                        {availableDepts.filter(d => d !== 'All').map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Attendance Main Table */}
            <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--card-border, #e2e8f0)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-app, #f8fafc)', borderBottom: '1px solid var(--card-border, #e2e8f0)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', width: '40px' }}>#</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Staff Name</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Department</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Date</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Login Time</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Logout Time</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Working Hours</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
                                <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No attendance records found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row, idx) => {
                                    const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                                    return (
                                        <tr key={row.name} style={{ borderBottom: '1px solid var(--card-border, #f1f5f9)' }}>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {row.id}
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                    <div style={{
                                                        width: '26px',
                                                        height: '26px',
                                                        borderRadius: '50%',
                                                        background: avatarColor.bg,
                                                        color: avatarColor.text,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '11px',
                                                        fontWeight: 800
                                                    }}>
                                                        {row.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                                        {row.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                                                {row.dept}
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                                {row.date}
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 600 }}>
                                                {row.loginTime}
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 600 }}>
                                                {row.logoutTime}
                                            </td>
                                            <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontWeight: 600 }}>
                                                {row.workingHours}
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                {row.status === 'Present' ? (
                                                    <span style={{
                                                        background: '#dcfce7',
                                                        color: '#15803d',
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: 700
                                                    }}>Present</span>
                                                ) : row.status === 'Late' ? (
                                                    <span style={{
                                                        background: '#fef3c7',
                                                        color: '#b45309',
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: 700
                                                    }}>Late</span>
                                                ) : (
                                                    <span style={{
                                                        background: '#fee2e2',
                                                        color: '#b91c1c',
                                                        padding: '3px 10px',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: 700
                                                    }}>Absent</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewStaffData(row)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        background: '#f1f5f9',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '6px',
                                                        padding: '3px 9px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        color: '#334155',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Eye size={13} /> View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom 3 Analytics Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)',
                gap: '16px',
                alignItems: 'stretch'
            }}>
                {/* 1. Attendance Summary Card */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                            <TrendingUp size={16} color="#2563eb" /> Attendance Summary
                        </div>
                        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
                            <button
                                type="button"
                                onClick={() => setSummaryPeriod('today')}
                                style={{
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: summaryPeriod === 'today' ? '#2563eb' : 'transparent',
                                    color: summaryPeriod === 'today' ? '#ffffff' : '#64748b'
                                }}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => setSummaryPeriod('month')}
                                style={{
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: summaryPeriod === 'month' ? '#2563eb' : 'transparent',
                                    color: summaryPeriod === 'month' ? '#ffffff' : '#64748b'
                                }}
                            >
                                This Month
                            </button>
                        </div>
                    </div>

                    {/* Progress Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Present */}
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 30px 1fr 35px', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Present
                            </span>
                            <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{periodKpis.present}</span>
                            <div style={{ background: '#f1f5f9', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                                <div style={{ background: '#10b981', height: '100%', width: `${periodKpis.total > 0 ? (periodKpis.present / periodKpis.total) * 100 : 0}%`, borderRadius: '10px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                {periodKpis.total > 0 ? Math.round((periodKpis.present / periodKpis.total) * 100) : 0}%
                            </span>
                        </div>

                        {/* Absent */}
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 30px 1fr 35px', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Absent
                            </span>
                            <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{periodKpis.absent}</span>
                            <div style={{ background: '#f1f5f9', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                                <div style={{ background: '#ef4444', height: '100%', width: `${periodKpis.total > 0 ? (periodKpis.absent / periodKpis.total) * 100 : 0}%`, borderRadius: '10px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                {periodKpis.total > 0 ? Math.round((periodKpis.absent / periodKpis.total) * 100) : 0}%
                            </span>
                        </div>

                        {/* Late */}
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 30px 1fr 35px', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Late
                            </span>
                            <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{periodKpis.late}</span>
                            <div style={{ background: '#f1f5f9', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                                <div style={{ background: '#f59e0b', height: '100%', width: `${periodKpis.total > 0 ? (periodKpis.late / periodKpis.total) * 100 : 0}%`, borderRadius: '10px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                {periodKpis.total > 0 ? Math.round((periodKpis.late / periodKpis.total) * 100) : 0}%
                            </span>
                        </div>

                        {/* On Leave */}
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 30px 1fr 35px', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} /> On Leave
                            </span>
                            <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{periodKpis.onLeave}</span>
                            <div style={{ background: '#f1f5f9', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                                <div style={{ background: '#3b82f6', height: '100%', width: `${periodKpis.total > 0 ? (periodKpis.onLeave / periodKpis.total) * 100 : 0}%`, borderRadius: '10px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>
                                {periodKpis.total > 0 ? Math.round((periodKpis.onLeave / periodKpis.total) * 100) : 0}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Late Coming Card */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '14px' }}>
                        <Clock size={16} color="#d97706" /> Late Coming
                    </div>

                    {lateStaffList.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            - No late arrivals today -
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--card-border, #f1f5f9)', textAlign: 'left' }}>
                                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Staff</th>
                                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Login Time</th>
                                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Delay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lateStaffList.map((st, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--card-border, #f8fafc)' }}>
                                        <td style={{ padding: '8px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                                        <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{st.loginTime}</td>
                                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                                            <span style={{
                                                background: '#fee2e2',
                                                color: '#b91c1c',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700
                                            }}>
                                                {st.delay}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 3. Early Leaving Card */}
                <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--card-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '14px' }}>
                        <Calendar size={16} color="#0284c7" /> Early Leaving
                    </div>

                    {earlyLeavingList.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            - No early leaving today -
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--card-border, #f1f5f9)', textAlign: 'left' }}>
                                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Staff</th>
                                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Logout Time</th>
                                    <th style={{ padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Left Early</th>
                                </tr>
                            </thead>
                            <tbody>
                                {earlyLeavingList.map((st, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--card-border, #f8fafc)' }}>
                                        <td style={{ padding: '8px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{st.name}</td>
                                        <td style={{ padding: '8px 8px', color: 'var(--text-muted)' }}>{st.logoutTime}</td>
                                        <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                                            <span style={{
                                                background: '#fef3c7',
                                                color: '#b45309',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 700
                                            }}>
                                                {st.leftEarly}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* MODAL 1: Add Attendance / Manual Punch */}
            {isAddModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }}>
                    <div style={{
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--card-border, #e2e8f0)',
                        borderRadius: '14px',
                        padding: '22px',
                        width: '100%',
                        maxWidth: '440px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                + Add Attendance Record
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddAttendanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    Staff Member *
                                </label>
                                <select
                                    value={punchStaff}
                                    onChange={e => setPunchStaff(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '13px',
                                        fontWeight: 600
                                    }}
                                >
                                    {allStaffMembers.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    Action / Event *
                                </label>
                                <select
                                    value={punchEvent}
                                    onChange={e => setPunchEvent(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '13px',
                                        fontWeight: 600
                                    }}
                                >
                                    <option value="LOGIN">Punch In (LOGIN)</option>
                                    <option value="BREAK START">Break Start</option>
                                    <option value="BREAK END">Resume (Break End)</option>
                                    <option value="LUNCH START">Lunch Start</option>
                                    <option value="LUNCH END">Lunch End</option>
                                    <option value="LOGOUT">Punch Out (LOGOUT)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    Time (Leave blank for current time)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 09:30 AM"
                                    value={punchTime}
                                    onChange={e => setPunchTime(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '13px'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Shift adjustment or reason"
                                    value={punchNotes}
                                    onChange={e => setPunchNotes(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '13px'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'transparent',
                                        color: 'var(--text-main)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={punchLoading || !canPunch}
                                    style={{
                                        padding: '8px 18px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#10b981',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {punchLoading ? 'Saving...' : 'Record Attendance'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: View Staff Attendance Details */}
            {viewStaffData && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }}>
                    <div style={{
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--card-border, #e2e8f0)',
                        borderRadius: '14px',
                        padding: '22px',
                        width: '100%',
                        maxWidth: '480px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '14px'
                                }}>
                                    {viewStaffData.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                        {viewStaffData.name} - Attendance Details
                                    </h3>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                        {viewStaffData.dept} • {viewStaffData.date}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewStaffData(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Summary Details Grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '10px',
                            background: 'var(--bg-app, #f8fafc)',
                            padding: '12px',
                            borderRadius: '10px',
                            marginBottom: '16px',
                            fontSize: '12.5px'
                        }}>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Login Time</div>
                                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{viewStaffData.loginTime}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Logout Time</div>
                                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{viewStaffData.logoutTime}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Total Working Hours</div>
                                <div style={{ fontWeight: 800, color: '#2563eb' }}>{viewStaffData.workingHours}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>Status</div>
                                <div>
                                    <span style={{
                                        background: viewStaffData.status === 'Present' ? '#dcfce7' : viewStaffData.status === 'Late' ? '#fef3c7' : '#fee2e2',
                                        color: viewStaffData.status === 'Present' ? '#15803d' : viewStaffData.status === 'Late' ? '#b45309' : '#b91c1c',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 700
                                    }}>
                                        {viewStaffData.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Events Log for this Staff */}
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                Day Event Timeline
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                {eventsData.filter(e => e.staff_name === viewStaffData.name).length === 0 ? (
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px 0' }}>
                                        No punch logs recorded for this date.
                                    </div>
                                ) : (
                                    eventsData.filter(e => e.staff_name === viewStaffData.name).map((ev, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--card-border, #e2e8f0)', padding: '6px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{ev.event}</span>
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{ev.time}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setViewStaffData(null)}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: '7px',
                                    border: '1px solid var(--card-border, #cbd5e1)',
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    fontSize: '12.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
