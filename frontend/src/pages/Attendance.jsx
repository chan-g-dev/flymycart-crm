import { ButtonSpinner, LoadingSpinner } from '../components/LoadingSpinner';
import React, { useState, useEffect, useCallback } from 'react';
import { 
    Clock, 
    Calendar, 
    User, 
    Search, 
    Filter, 
    CheckCircle2, 
    AlertCircle, 
    Clock3, 
    Zap, 
    Camera, 
    X, 
    RefreshCw, 
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    Users,
    LogIn,
    LogOut,
    Utensils,
    Coffee,
    PauseCircle,
    PlayCircle,
    Save
} from 'lucide-react';
import { apiClient } from '../api/client';
import { businessDate } from '../utils/businessDates';
import { useAuth } from '../context/authSession';

export function Attendance({ settings }) {
    const todayStr = businessDate();
    const { currentUser, hasPermission } = useAuth();
    const isSuperAdmin = Boolean(currentUser?.isSuperAdmin || currentUser?.is_superuser);
    const canManageAttendance = Boolean(isSuperAdmin || hasPermission('attendance.manage'));
    const userName = currentUser?.name || currentUser?.display_name || 'Staff';
    
    // Filters & Config State
    const [datePreset, setDatePreset] = useState('Today'); // 'Today', 'This Week', 'This Month', 'Custom'
    const [dateFrom, setDateFrom] = useState(todayStr);
    const [dateTo, setDateTo] = useState(todayStr);
    const [selectedStaff, setSelectedStaff] = useState(canManageAttendance ? 'All Staff' : userName);
    const [expectedLogin, setExpectedLogin] = useState(settings?.attendanceSettings?.expectedLogin || '09:00 AM');
    const [expectedLogout, setExpectedLogout] = useState(settings?.attendanceSettings?.expectedLogout || '06:00 PM');
    const [expectedWorkHours, setExpectedWorkHours] = useState(
        settings?.attendanceSettings?.expectedWorkHours ?? 
        (settings?.attendanceSettings?.expectedWorkMin ? settings.attendanceSettings.expectedWorkMin / 60 : 8)
    );
    const [gracePeriodMin, setGracePeriodMin] = useState(settings?.attendanceSettings?.gracePeriodMin ?? 15);
    const [savingDefaults, setSavingDefaults] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState('');

    useEffect(() => {
        if (settings?.attendanceSettings) {
            if (settings.attendanceSettings.expectedLogin) setExpectedLogin(settings.attendanceSettings.expectedLogin);
            if (settings.attendanceSettings.expectedLogout) setExpectedLogout(settings.attendanceSettings.expectedLogout);
            if (settings.attendanceSettings.expectedWorkHours !== undefined) {
                setExpectedWorkHours(settings.attendanceSettings.expectedWorkHours);
            } else if (settings.attendanceSettings.expectedWorkMin !== undefined) {
                setExpectedWorkHours(settings.attendanceSettings.expectedWorkMin / 60);
            }
            if (settings.attendanceSettings.gracePeriodMin !== undefined) setGracePeriodMin(settings.attendanceSettings.gracePeriodMin);
        }
    }, [settings]);

    const handleSaveDefaultTimings = async () => {
        setSavingDefaults(true);
        try {
            const workHoursNum = parseFloat(expectedWorkHours) || 8;
            const workMin = Math.round(workHoursNum * 60);
            const graceMin = parseInt(gracePeriodMin) ?? 15;
            const currentConfig = settings || {};
            const updatedConfig = {
                ...currentConfig,
                attendanceSettings: {
                    expectedLogin,
                    expectedLogout,
                    expectedWorkHours: workHoursNum,
                    expectedWorkMin: workMin,
                    gracePeriodMin: graceMin
                }
            };
            await apiClient.saveSettings(updatedConfig);
            setSaveFeedback('✓ Saved default timings!');
            setTimeout(() => setSaveFeedback(''), 4000);
            await fetchData();
        } catch (err) {
            alert(err.message || 'Failed to save default shift timings');
        } finally {
            setSavingDefaults(false);
        }
    };
    
    // Active Tab
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'events', 'analysis'
    
    // Data States
    const [loading, setLoading] = useState(true);
    const [staffList, setStaffList] = useState(canManageAttendance ? [] : [userName]);
    const [summaryData, setSummaryData] = useState(null);
    const [eventsData, setEventsData] = useState([]);
    const [breakdownData, setBreakdownData] = useState([]);
    const [eventsCount, setEventsCount] = useState(0);
    const [eventsSearch, setEventsSearch] = useState('');
    const [breakdownSearch, setBreakdownSearch] = useState('');
    
    // Modals
    const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
    const [punchStaff, setPunchStaff] = useState(userName);
    const [punchEvent, setPunchEvent] = useState('LOGIN');
    const [punchNotes, setPunchNotes] = useState('');
    const [punchLoading, setPunchLoading] = useState(false);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    // Handle Preset Changes
    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        const now = new Date();
        if (preset === 'Today') {
            const t = businessDate();
            setDateFrom(t);
            setDateTo(t);
        } else if (preset === 'This Week') {
            const curr = new Date();
            const dayOfWeek = curr.getDay(); // 0 is Sunday
            const distanceToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
            const monday = new Date(curr);
            monday.setDate(curr.getDate() + distanceToMonday);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            setDateFrom(monday.toISOString().split('T')[0]);
            setDateTo(sunday.toISOString().split('T')[0]);
        } else if (preset === 'This Month') {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const lastDayNum = new Date(year, now.getMonth() + 1, 0).getDate();
            setDateFrom(`${year}-${month}-01`);
            setDateTo(`${year}-${month}-${String(lastDayNum).padStart(2, '0')}`);
        }
    };

    // Load Staff List
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const res = await apiClient.getAttendanceStaffList();
                if (res && res.staff && res.staff.length > 0) {
                    setStaffList(res.staff);
                    setPunchStaff(prev => prev || res.staff[0]);
                }
            } catch (err) {
                console.error("Failed to load staff list", err);
            }
        };
        fetchStaff();
    }, []);

    // Fetch Summary & Data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const workHoursNum = parseFloat(expectedWorkHours) || 8;
            const params = {
                date_from: dateFrom,
                date_to: dateTo,
                staff_name: selectedStaff,
                expected_work_min: Math.round(workHoursNum * 60),
                grace_period_min: parseInt(gracePeriodMin) || 15,
                expected_login: expectedLogin,
                expected_logout: expectedLogout
            };

            // Summary
            const summaryRes = await apiClient.getAttendanceSummary(params);
            setSummaryData(summaryRes);

            // Events Log
            const eventsRes = await apiClient.getAttendanceEvents({ ...params, search: eventsSearch });
            if (eventsRes) {
                setEventsData(eventsRes.events || []);
                setEventsCount(eventsRes.total_count || 0);
            }

            // Daily Breakdown
            const breakdownRes = await apiClient.getAttendanceDailyBreakdown({ ...params, search: breakdownSearch });
            if (breakdownRes) {
                setBreakdownData(breakdownRes.entries || []);
            }
        } catch (err) {
            console.error("Error fetching attendance data:", err);
        } finally {
            setLoading(false);
        }
    }, [dateFrom, dateTo, selectedStaff, expectedWorkHours, gracePeriodMin, expectedLogin, expectedLogout, eventsSearch, breakdownSearch]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle Quick Punch
    const handleRecordPunch = async (e) => {
        e.preventDefault();
        if (!punchStaff) return;
        setPunchLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            await apiClient.recordAttendancePunch({
                staff_name: punchStaff,
                event: punchEvent,
                time: timeStr,
                notes: punchNotes,
                photo_url: '/api/placeholder/120/120'
            });
            setIsPunchModalOpen(false);
            setPunchNotes('');
            await fetchData();
        } catch (err) {
            alert(err.message || "Failed to record punch");
        } finally {
            setPunchLoading(false);
        }
    };

    const getEventBadge = (event) => {
        switch (event) {
            case 'LOGIN':
                return <span className="att-badge att-badge-login"><LogIn size={13} /> LOGIN</span>;
            case 'LOGOUT':
                return <span className="att-badge att-badge-logout"><LogOut size={13} /> LOGOUT</span>;
            case 'LUNCH START':
                return <span className="att-badge att-badge-lunch"><Utensils size={13} /> LUNCH START</span>;
            case 'LUNCH END':
                return <span className="att-badge att-badge-lunch-end"><Coffee size={13} /> LUNCH END</span>;
            case 'BREAK START':
                return <span className="att-badge att-badge-break"><PauseCircle size={13} /> BREAK START</span>;
            case 'BREAK END':
                return <span className="att-badge att-badge-break-end"><PlayCircle size={13} /> BREAK END</span>;
            default:
                return <span className="att-badge att-badge-neutral">{event}</span>;
        }
    };

    const getStatusPill = (status) => {
        switch (status) {
            case 'On Time':
                return <span className="att-status-pill on-time">On Time</span>;
            case 'Late':
                return <span className="att-status-pill late">Late</span>;
            case 'Half Day':
                return <span className="att-status-pill half-day">Half Day</span>;
            case 'No Logout':
            default:
                return <span className="att-status-pill no-logout">No Logout</span>;
        }
    };

    // Clock & Live Shift State
    const [currentTime, setCurrentTime] = useState(new Date());
    const [actionMsg, setActionMsg] = useState('');

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Direct 1-Click Punch for logged in staff
    const handleDirectPunch = async (eventType) => {
        setPunchLoading(true);
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            await apiClient.recordAttendancePunch({
                staff_name: userName,
                event: eventType,
                time: timeStr,
                notes: `1-Click Quick Punch from Portal`,
                photo_url: '/api/placeholder/120/120'
            });
            setActionMsg(`✓ ${eventType} recorded successfully at ${timeStr}`);
            setTimeout(() => setActionMsg(''), 4500);
            await fetchData();
        } catch (err) {
            alert(err.message || `Failed to record ${eventType}`);
        } finally {
            setPunchLoading(false);
        }
    };

    // Calculate today's latest shift status for this staff member
    const myTodayEvents = eventsData.filter(e => e.date === todayStr && (e.staff_name === userName || !canManageAttendance));
    const latestTodayEvent = myTodayEvents[0]?.event;

    const getShiftStatusMeta = () => {
        switch (latestTodayEvent) {
            case 'LOGIN':
            case 'LUNCH END':
            case 'BREAK END':
                return { label: 'Active on Shift', class: 'active', sub: `Last recorded: ${latestTodayEvent} at ${myTodayEvents[0]?.time}` };
            case 'LUNCH START':
                return { label: 'On Lunch Break', class: 'lunch', sub: `Started at ${myTodayEvents[0]?.time}` };
            case 'BREAK START':
                return { label: 'On Break', class: 'break', sub: `Started at ${myTodayEvents[0]?.time}` };
            case 'LOGOUT':
                return { label: 'Shift Completed / Logged Out', class: 'logged-out', sub: `Logged out at ${myTodayEvents[0]?.time}` };
            default:
                return { label: 'Not Checked In Yet Today', class: 'none', sub: 'Ready to start your shift' };
        }
    };

    const shiftStatus = getShiftStatusMeta();

    return (
        <div className="attendance-page-container">
            {loading && <LoadingSpinner inline text="Loading attendance..." />}
            {/* Header */}
            <div className="attendance-header">
                <div className="attendance-title-area">
                    <div className="attendance-icon-badge">
                        <Clock size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="attendance-title">
                            {canManageAttendance ? 'Staff Attendance & Timings' : 'My Attendance & Timings'}
                        </h1>
                        <p className="attendance-subtitle">
                            {canManageAttendance 
                                ? 'Track company-wide staff attendance, shift timings & performance' 
                                : `Welcome, ${userName}! Mark your daily shift, breaks & view your time summary.`}
                        </p>
                    </div>
                </div>

                <div className="attendance-header-actions">
                    <button 
                        type="button" 
                        className="btn-quick-punch"
                        onClick={() => setIsPunchModalOpen(true)}
                    >
                        <Zap size={16} /> Detailed Punch
                    </button>
                    <button 
                        type="button" 
                        className="btn-refresh-icon"
                        onClick={fetchData}
                        title="Refresh data"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Shift Hero Station for Individual Staff (Super Admin does not need attendance punch card) */}
            {!isSuperAdmin && (
                <div className="att-staff-hero-card">
                    <div className="att-hero-clock-box">
                        <div className="att-live-date">
                            📅 {currentTime.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="att-live-clock">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </div>
                        <div className={`att-current-status-pill ${shiftStatus.class}`}>
                            <span>● {shiftStatus.label}</span>
                        </div>
                        <small style={{ color: '#94a3b8', marginTop: '2px' }}>{shiftStatus.sub}</small>
                        {actionMsg && <div style={{ color: '#4ade80', fontSize: '12.5px', fontWeight: 600, marginTop: '4px' }}>{actionMsg}</div>}
                    </div>

                    <div className="att-hero-actions-panel">
                        <div className="att-hero-actions-title">
                            ⚡ Quick 1-Click Punch ({userName})
                        </div>
                        <div className="att-direct-punch-grid">
                            <button
                                type="button"
                                className="att-direct-btn btn-login"
                                onClick={() => handleDirectPunch('LOGIN')}
                                disabled={punchLoading}
                            >
                                <LogIn size={15} /> Login
                            </button>
                            <button
                                type="button"
                                className="att-direct-btn btn-lunch"
                                onClick={() => handleDirectPunch('LUNCH START')}
                                disabled={punchLoading}
                            >
                                <Utensils size={15} /> Lunch Start
                            </button>
                            <button
                                type="button"
                                className="att-direct-btn btn-lunch"
                                onClick={() => handleDirectPunch('LUNCH END')}
                                disabled={punchLoading}
                            >
                                <Coffee size={15} /> Lunch End
                            </button>
                            <button
                                type="button"
                                className="att-direct-btn btn-break"
                                onClick={() => handleDirectPunch('BREAK START')}
                                disabled={punchLoading}
                            >
                                <PauseCircle size={15} /> Break Start
                            </button>
                            <button
                                type="button"
                                className="att-direct-btn btn-break"
                                onClick={() => handleDirectPunch('BREAK END')}
                                disabled={punchLoading}
                            >
                                <PlayCircle size={15} /> Break End
                            </button>
                            <button
                                type="button"
                                className="att-direct-btn btn-logout"
                                onClick={() => handleDirectPunch('LOGOUT')}
                                disabled={punchLoading}
                            >
                                <LogOut size={15} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter & Config Toolbar */}
            <div className="attendance-config-card">
                <div className="attendance-filter-row">
                    {/* Presets */}
                    <div className="att-preset-group">
                        {['Today', 'This Week', 'This Month', 'Custom'].map(preset => (
                            <button
                                key={preset}
                                type="button"
                                className={`att-preset-btn ${datePreset === preset ? 'active' : ''}`}
                                onClick={() => handlePresetChange(preset)}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>

                    {/* Date Pickers */}
                    <div className="att-date-pickers">
                        <div className="att-input-group">
                            <label>From</label>
                            <input 
                                type="date" 
                                value={dateFrom} 
                                onChange={(e) => {
                                    setDatePreset('Custom');
                                    setDateFrom(e.target.value);
                                }} 
                            />
                        </div>
                        <div className="att-input-group">
                            <label>To</label>
                            <input 
                                type="date" 
                                value={dateTo} 
                                onChange={(e) => {
                                    setDatePreset('Custom');
                                    setDateTo(e.target.value);
                                }} 
                            />
                        </div>
                    </div>

                    {/* Staff Select - Only for Super Admin / Managers */}
                    {canManageAttendance && (
                        <div className="att-staff-select-wrapper">
                            <User size={15} className="att-select-icon" />
                            <select 
                                value={selectedStaff} 
                                onChange={(e) => setSelectedStaff(e.target.value)}
                                className="att-staff-select"
                            >
                                <option value="All Staff">All Staff ({staffList.length})</option>
                                {staffList.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Date Span Label */}
                    <div className="att-date-range-badge">
                        📅 {dateFrom} – {dateTo} ({summaryData?.days_count || 1} day)
                    </div>
                </div>

                {/* Secondary Config Line - Only for Super Admin / Managers */}
                {canManageAttendance && (
                    <div className="attendance-config-secondary">
                        <div className="att-config-item">
                            <label>Expected Login</label>
                            <input 
                                type="text" 
                                value={expectedLogin} 
                                onChange={(e) => setExpectedLogin(e.target.value)}
                                placeholder="09:00 AM" 
                            />
                        </div>
                        <div className="att-config-item">
                            <label>Expected Logout</label>
                            <input 
                                type="text" 
                                value={expectedLogout} 
                                onChange={(e) => setExpectedLogout(e.target.value)}
                                placeholder="06:00 PM" 
                            />
                        </div>
                        <div className="att-config-item">
                            <label>How many hours to work in a day</label>
                            <input 
                                type="number" 
                                step="0.5"
                                min="1"
                                max="24"
                                value={expectedWorkHours} 
                                onChange={(e) => setExpectedWorkHours(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)} 
                                placeholder="8"
                            />
                        </div>
                        <div className="att-config-item">
                            <label>Grace Period (min)</label>
                            <input 
                                type="number" 
                                min="0"
                                max="120"
                                value={gracePeriodMin} 
                                onChange={(e) => setGracePeriodMin(parseInt(e.target.value) || 0)} 
                                placeholder="15"
                            />
                        </div>
                        <div className="att-config-save-action">
                            <button
                                type="button"
                                className="btn-save-defaults"
                                onClick={handleSaveDefaultTimings}
                                disabled={savingDefaults}
                                title="Save current shift timings as company defaults"
                            >
                                <Save size={13} /> {savingDefaults ? <ButtonSpinner text="Saving..." /> : 'Save as Default'}
                            </button>
                            {saveFeedback && <span className="save-feedback-text">{saveFeedback}</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="attendance-tabs-nav">
                <button 
                    type="button" 
                    className={`att-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    {canManageAttendance ? 'Overview' : 'My Overview'}
                </button>
                <button 
                    type="button" 
                    className={`att-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
                    onClick={() => setActiveTab('events')}
                >
                    {canManageAttendance ? `Attendance Log (${eventsCount})` : `My Punches (${eventsCount})`}
                </button>
                <button 
                    type="button" 
                    className={`att-tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analysis')}
                >
                    {canManageAttendance ? `Time Analysis (${breakdownData.length})` : `My Time Analysis (${breakdownData.length})`}
                </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="att-tab-content">
                    {/* 4 Main KPI Cards */}
                    <div className="att-kpi-grid">
                        <div className="att-kpi-card card-present">
                            <div className="kpi-label">{canManageAttendance ? 'PRESENT DAYS' : 'MY PRESENT DAYS'}</div>
                            <div className="kpi-number">{summaryData?.present_days ?? 0}</div>
                            <div className="kpi-subtext">
                                {canManageAttendance 
                                    ? `out of ${summaryData?.total_staff_days ?? (staffList.length || 12)} total staff days`
                                    : `out of ${summaryData?.days_count || 1} day(s) in selected range`}
                            </div>
                        </div>

                        <div className="att-kpi-card card-absent">
                            <div className="kpi-label">{canManageAttendance ? 'ABSENT DAYS' : 'MY ABSENT DAYS'}</div>
                            <div className="kpi-number">{summaryData?.absent_days ?? 0}</div>
                            <div className="kpi-subtext">absent or not logged in</div>
                        </div>

                        <div className="att-kpi-card card-late">
                            <div className="kpi-label">{canManageAttendance ? 'LATE DAYS' : 'MY LATE DAYS'}</div>
                            <div className="kpi-number">{summaryData?.late_days ?? 0}</div>
                            <div className="kpi-subtext">logged in after grace time</div>
                        </div>

                        <div className="att-kpi-card card-ontime">
                            <div className="kpi-label">{canManageAttendance ? 'ON TIME DAYS' : 'MY ON TIME DAYS'}</div>
                            <div className="kpi-number">{summaryData?.on_time_days ?? 0}</div>
                            <div className="kpi-subtext">punctual arrivals</div>
                        </div>
                    </div>

                    {/* 3 Secondary Metric Chips */}
                    <div className="att-secondary-stats">
                        <div className="att-stat-chip">
                            <span className="stat-label">Avg Work Time</span>
                            <span className="stat-val">{summaryData?.avg_work_time_str || '0h 0m'}</span>
                        </div>
                        <div className="att-stat-chip">
                            <span className="stat-label">Expected</span>
                            <span className="stat-val">{summaryData?.expected_work_str || '8h 0m'}</span>
                        </div>
                        <div className="att-stat-chip">
                            <span className="stat-label">No Logout</span>
                            <span className="stat-val">{summaryData?.no_logout_count ?? 0}</span>
                        </div>
                    </div>

                    {/* Staff Summary Grid */}
                    <div className="att-staff-summary-section">
                        <h3 className="att-section-title">
                            {canManageAttendance ? <Users size={18} /> : <User size={18} />} {canManageAttendance ? 'Staff Summary' : 'My Attendance Status'}
                        </h3>
                        <div className="att-staff-cards-grid">
                            {summaryData?.staff_summaries && summaryData.staff_summaries.length > 0 ? (
                                summaryData.staff_summaries.map((s, idx) => (
                                    <div key={idx} className="att-staff-card">
                                        <div className="staff-card-header">
                                            <div className="staff-avatar">
                                                {s.staff_name.charAt(0)}
                                            </div>
                                            <div className="staff-info">
                                                <div className="staff-name">{s.staff_name}</div>
                                                <span className={`staff-status-badge ${s.status === 'Absent' ? 'text-gray-400' : s.status.includes('Late') ? 'text-amber-500' : 'text-emerald'}`}>
                                                    {s.status === 'Absent' ? '— Absent' : s.status.includes('Late') ? `⚠️ ${s.status}` : '✓ All good'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="staff-metrics-row">
                                            <div className="m-item">
                                                <span className="m-label">Present</span>
                                                <span className="m-val text-emerald">{s.present_days}</span>
                                            </div>
                                            <div className="m-item">
                                                <span className="m-label">Absent</span>
                                                <span className="m-val text-rose">{s.absent_days}</span>
                                            </div>
                                            <div className="m-item">
                                                <span className="m-label">Avg/Day</span>
                                                <span className="m-val text-indigo">{s.avg_work_str}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : !canManageAttendance ? (
                                <div className="att-staff-card">
                                    <div className="staff-card-header">
                                        <div className="staff-avatar">
                                            {userName.charAt(0)}
                                        </div>
                                        <div className="staff-info">
                                            <div className="staff-name">{userName}</div>
                                            <span className={`staff-status-badge ${shiftStatus.class === 'none' ? 'text-gray-400' : 'text-emerald'}`}>
                                                {shiftStatus.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="staff-metrics-row">
                                        <div className="m-item">
                                            <span className="m-label">Present</span>
                                            <span className="m-val text-emerald">{summaryData?.present_days ?? 0}</span>
                                        </div>
                                        <div className="m-item">
                                            <span className="m-label">Absent</span>
                                            <span className="m-val text-rose">{summaryData?.absent_days ?? 0}</span>
                                        </div>
                                        <div className="m-item">
                                            <span className="m-label">Avg/Day</span>
                                            <span className="m-val text-indigo">{summaryData?.avg_work_time_str || '0h'}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ATTENDANCE LOG */}
            {activeTab === 'events' && (
                <div className="att-tab-content">
                    <div className="att-table-container">
                        <div className="att-table-header-bar">
                            <h3 className="table-title">All Events ({eventsCount})</h3>
                            <div className="att-search-box">
                                <Search size={15} />
                                <input 
                                    type="text" 
                                    placeholder="Search staff, event, time..." 
                                    value={eventsSearch}
                                    onChange={(e) => setEventsSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="att-table-responsive">
                            <table className="att-data-table">
                                <thead>
                                    <tr>
                                        <th>STAFF</th>
                                        <th>DATE</th>
                                        <th>EVENT</th>
                                        <th>TIME</th>
                                        <th>PHOTO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eventsData.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-gray-400">
                                                No attendance events recorded for this selection.
                                            </td>
                                        </tr>
                                    ) : (
                                        eventsData.map((ev) => (
                                            <tr key={ev.id}>
                                                <td className="font-semibold text-slate-800 dark:text-slate-100">{ev.staff_name}</td>
                                                <td>{ev.date}</td>
                                                <td>{getEventBadge(ev.event)}</td>
                                                <td className="font-mono text-sm">{ev.time}</td>
                                                <td>
                                                    <button 
                                                        type="button" 
                                                        className="att-photo-btn"
                                                        onClick={() => setPreviewPhoto(ev.photo_url || '/api/placeholder/300/300')}
                                                        title="View capture photo"
                                                    >
                                                        <Camera size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: TIME ANALYSIS */}
            {activeTab === 'analysis' && (
                <div className="att-tab-content">
                    <div className="att-table-container">
                        <div className="att-table-header-bar">
                            <h3 className="table-title">📊 Daily Time Breakdown ({breakdownData.length} entries)</h3>
                            <div className="att-search-box">
                                <Search size={15} />
                                <input 
                                    type="text" 
                                    placeholder="Search staff, date..." 
                                    value={breakdownSearch}
                                    onChange={(e) => setBreakdownSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="att-table-responsive">
                            <table className="att-data-table">
                                <thead>
                                    <tr>
                                        <th>STAFF</th>
                                        <th>DATE</th>
                                        <th>LOGIN</th>
                                        <th>LOGOUT</th>
                                        <th>WORK TIME</th>
                                        <th>EXPECTED</th>
                                        <th>LOGIN DIFF</th>
                                        <th>LOGOUT DIFF</th>
                                        <th>WORK DIFF</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdownData.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="text-center py-8 text-gray-400">
                                                No daily breakdown entries available.
                                            </td>
                                        </tr>
                                    ) : (
                                        breakdownData.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="font-semibold text-slate-800 dark:text-slate-100">{row.staff_name}</td>
                                                <td>{row.date}</td>
                                                <td className="font-mono text-sm">{row.login_time}</td>
                                                <td className="font-mono text-sm">{row.logout_time}</td>
                                                <td className="font-semibold">{row.work_time_str}</td>
                                                <td className="text-gray-500">{row.expected_str}</td>
                                                <td>
                                                    <span className={`diff-pill ${row.login_status === 'on_time' ? 'diff-good' : 'diff-warn'}`}>
                                                        {row.login_diff}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`diff-pill ${row.logout_status === 'on_time' ? 'diff-good' : row.logout_status === 'none' ? 'diff-neutral' : 'diff-warn'}`}>
                                                        {row.logout_diff}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`diff-pill ${row.work_diff.startsWith('+') ? 'diff-good' : row.work_diff.startsWith('-') ? 'diff-bad' : 'diff-neutral'}`}>
                                                        {row.work_diff}
                                                    </span>
                                                </td>
                                                <td>
                                                    {getStatusPill(row.status)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Punch Modal */}
            {isPunchModalOpen && (
                <div className="att-modal-overlay" onClick={() => setIsPunchModalOpen(false)}>
                    <div className="att-punch-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="att-modal-header">
                            <div className="att-modal-title-wrap">
                                <Zap size={18} className="text-amber-500" />
                                <h3>Quick Attendance Punch</h3>
                            </div>
                            <button type="button" className="att-modal-close-btn" onClick={() => setIsPunchModalOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleRecordPunch} className="att-modal-form">
                            <div className="att-form-group">
                                <label className="att-form-label">Staff Member</label>
                                <select 
                                    value={punchStaff} 
                                    onChange={(e) => setPunchStaff(e.target.value)}
                                    required
                                    className="att-form-select"
                                    disabled={!canManageAttendance}
                                >
                                    {staffList.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="att-form-group">
                                <label className="att-form-label">Event Type</label>
                                <div className="att-punch-grid">
                                    {[
                                        { id: 'LOGIN', label: 'Login', icon: LogIn, color: 'emerald' },
                                        { id: 'LUNCH START', label: 'Lunch Start', icon: Utensils, color: 'amber' },
                                        { id: 'LUNCH END', label: 'Lunch End', icon: Coffee, color: 'amber' },
                                        { id: 'BREAK START', label: 'Break Start', icon: PauseCircle, color: 'indigo' },
                                        { id: 'BREAK END', label: 'Break End', icon: PlayCircle, color: 'indigo' },
                                        { id: 'LOGOUT', label: 'Logout', icon: LogOut, color: 'rose' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`att-punch-btn ${punchEvent === opt.id ? `selected selected-${opt.color}` : ''}`}
                                            onClick={() => setPunchEvent(opt.id)}
                                        >
                                            <opt.icon size={16} />
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="att-form-group">
                                <label className="att-form-label">Notes (Optional)</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Field visit, Client meeting" 
                                    value={punchNotes}
                                    onChange={(e) => setPunchNotes(e.target.value)}
                                    className="att-form-input"
                                />
                            </div>

                            <div className="att-modal-actions">
                                <button 
                                    type="button" 
                                    className="att-btn-cancel" 
                                    onClick={() => setIsPunchModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="att-btn-submit"
                                    disabled={punchLoading}
                                >
                                    {punchLoading ? <ButtonSpinner text="Recording..." /> : `Record ${punchEvent}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Photo Preview Modal */}
            {previewPhoto && (
                <div className="att-modal-overlay" onClick={() => setPreviewPhoto(null)}>
                    <div className="att-photo-preview-card" onClick={(e) => e.stopPropagation()}>
                        <div className="att-modal-header">
                            <h4>Punch Photo Capture</h4>
                            <button type="button" className="att-modal-close-btn" onClick={() => setPreviewPhoto(null)}><X size={18} /></button>
                        </div>
                        <div className="photo-preview-body">
                            <div className="photo-placeholder-box">
                                <Camera size={44} className="text-gray-400 mb-2" />
                                <p className="text-xs text-gray-500">Selfie verification captured during punch check-in</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Attendance;
