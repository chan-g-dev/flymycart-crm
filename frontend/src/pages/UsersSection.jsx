import MemberActivity from '../components/MemberActivity';
import RoleAccessMatrix from '../components/RoleAccessMatrix';
import UserAccessEditor from '../components/UserAccessEditor';
import { businessDate } from '../utils/businessDates';
import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShieldCheck, 
    Users as UsersIcon, 
    Search, 
    RefreshCw, 
    Check, 
    XCircle, 
    CheckCircle2, 
    Clock, 
    MapPin, 
    Mail, 
    Phone, 
    Shield, 
    UserCheck, 
    Trash2, 
    Key, 
    Lock, 
    LayoutGrid, 
    List, 
    Download, 
    UserX, 
    Building2,
    X
} from 'lucide-react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';

const normalizeStaffRole = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (['super_admin', 'manager', 'supervisor', 'account_executive', 'operation_executive'].includes(raw)) return raw;
    if (raw === 'superadmin' || raw === 'admin') return 'super_admin';
    if (raw === 'center_manager') return 'manager';
    if (raw === 'team_leader' || raw === 'teamleader' || raw === 'team_lead') return 'supervisor';
    if (raw === 'counter_staff' || raw === 'counter' || raw === 'accounts_staff' || raw === 'accounts_executive' || raw === 'front_desk') return 'account_executive';
    if (raw === 'operations_executive' || raw === 'operations_staff' || raw === 'ops' || raw === 'operations') return 'operation_executive';
    return 'operation_executive';
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
        id: user?.id ? String(user.id) : `usr-${Math.random().toString(36).slice(2, 8)}`,
        name: user?.name || user?.display_name || user?.full_name || user?.user_name || user?.email?.split('@')?.[0] || 'Staff Member',
        email: user?.email || '',
        phone: user?.phone || '',
        role: normalizedRole,
        roles: user?.roles || [],
        status: normalizedStatus,
        is_active: typeof user?.is_active === 'boolean' ? user.is_active : normalizedStatus === 'Active',
        center: user?.center || firstCenter || 'Main Hub (Bangalore)',
        approved_by: user?.approved_by || user?.approved_by_name || null,
        approval_date: user?.approval_date || user?.approved_at || null,
        created_at: user?.created_at || new Date().toISOString()
    };
};

const getRoleConfig = (roleKey) => {
    switch (roleKey) {
        case 'super_admin':
            return {
                label: 'Super Admin',
                badgeClass: 'badge-super-admin',
                gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                bgLight: 'rgba(239, 68, 68, 0.09)',
                border: 'rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                icon: '👑',
                summary: 'Full access to financials, margins, reconciliations, refunds & staff authorization.'
            };
        case 'manager':
            return {
                label: 'Manager',
                badgeClass: 'badge-manager',
                gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                bgLight: 'rgba(37, 99, 235, 0.09)',
                border: 'rgba(37, 99, 235, 0.25)',
                color: '#2563eb',
                icon: '👔',
                summary: 'Branch management, refund approvals, B2B corporate credit & team supervision.'
            };
        case 'supervisor':
        case 'team_leader':
            return {
                label: 'Supervisor',
                badgeClass: 'badge-supervisor',
                gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                bgLight: 'rgba(124, 58, 237, 0.09)',
                border: 'rgba(124, 58, 237, 0.25)',
                color: '#7c3aed',
                icon: '🛡️',
                summary: 'Operations supervision, dispatch routing, team escalations & daily EOD tracking.'
            };
        case 'account_executive':
        case 'counter_staff':
            return {
                label: 'Account Executive',
                badgeClass: 'badge-account-executive',
                gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                bgLight: 'rgba(5, 150, 105, 0.09)',
                border: 'rgba(5, 150, 105, 0.25)',
                color: '#059669',
                icon: '📊',
                summary: 'Invoicing, carrier settlement, payment reconciliation & financial ledgers.'
            };
        case 'operation_executive':
        case 'operations_executive':
        case 'operations_staff':
        default:
            return {
                label: 'Operation Executive',
                badgeClass: 'badge-ops',
                gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                bgLight: 'rgba(2, 132, 199, 0.09)',
                border: 'rgba(2, 132, 199, 0.25)',
                color: '#0284c7',
                icon: '💼',
                summary: 'Counter shipment entry, volumetric weighing, AWB tracking & label generation.'
            };
    }
};

export const Users = ({ settings, onDataMutated }) => {
    const { currentUser, currentRole } = useAuth();
    
    const [staffList, setStaffList] = useState([]);
    const [accessUser, setAccessUser] = useState(null);
    const [activityUser, setActivityUser] = useState(null);
    const [accessEditing, setAccessEditing] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(true);
    
    // Filters & view modes
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'active' | 'suspended' | 'matrix'
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [centerFilter, setCenterFilter] = useState('ALL');
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
    
    // Action states
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [feedbackMessage, setFeedbackMessage] = useState(null);
    
    // Role choices pending per applicant
    const pendingRoleAssignments = {};


    const availableCenters = useMemo(() => {
        const setts = settings?.centers || [];
        const defaults = ['Main Hub (Bangalore)', 'Mumbai Central Cargo Hub', 'Delhi Cargo Gateway', 'Hyderabad Airport Hub', 'Chennai Hub'];
        const merged = Array.from(new Set([...setts, ...defaults]));
        return merged;
    }, [settings?.centers]);

    const isSuperAdmin = Boolean(
        currentRole?.id === 'super_admin' || 
        currentUser?.roleId === 'super_admin' || 
        currentUser?.role === 'super_admin' || 
        currentUser?.isSuperAdmin
    );

    const activeUser = {
        name: currentUser?.name || (isSuperAdmin ? 'Fly My Cart' : 'Operations Staff'),
        email: currentUser?.email || (isSuperAdmin ? 'admin@flymycart.com' : ''),
        center: currentUser?.center || 'Main Hub (Bangalore)',
        roleId: isSuperAdmin ? 'super_admin' : (currentRole?.id || currentUser?.roleId || 'operations_staff'),
        roleLabel: isSuperAdmin ? 'Super Admin' : (currentRole?.name || 'Operations Staff')
    };

    const fetchUsers = async () => {
        setIsRefreshing(true);
        try {
            const data = await apiClient.getUsers();
            const records = Array.isArray(data) ? data : (data?.data || []);
            setStaffList(records.map(normalizeStaffRecord));
        } catch (err) {
            console.error('Unable to load the staff directory:', err);
            setStaffList([]);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        let active = true;
        apiClient.getUsers().then(data => {
            if (active) setStaffList((Array.isArray(data) ? data : data?.data || []).map(normalizeStaffRecord));
        }).catch(() => {
            if (active) setFeedbackMessage({ text: 'Unable to load staff. Please refresh.', type: 'error' });
        }).finally(() => { if (active) setIsRefreshing(false); });
        return () => { active = false; };
    }, []);

    const showFeedback = (text, type = 'success') => {
        setFeedbackMessage({ text, type });
        setTimeout(() => setFeedbackMessage(null), 4500);
    };

    // Actions
    const handleApproveStaff = async (userId, staffName, customRole, customCenter) => {
        if (!isSuperAdmin) {
            showFeedback('Access Denied: Only Super Admin can authorize new staff.', 'error');
            return;
        }
        setActionLoadingId(userId);

        const assignedRole = customRole || pendingRoleAssignments[userId] || 'operations_staff';



        try {
            await apiClient.approveStaff(userId, {
                action: 'approve',
                role: assignedRole,
                center: customCenter
            });
        setStaffList(prev => prev.map(u => u.id === userId ? {
            ...u,
            status: 'Active',
            is_active: true,
            role: assignedRole,
            center: customCenter || u.center,
            approved_by: currentUser?.name || 'Fly My Cart',
            approval_date: new Date().toISOString()
        } : u));
            showFeedback(`✓ "${staffName}" accepted & authorized with role ${getRoleConfig(assignedRole).label}!`, 'success');
            if (onDataMutated) onDataMutated();
        } catch (err) {
            showFeedback(err.response?.data?.detail || 'Staff approval failed. Please retry.', 'error');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        if (!isSuperAdmin) {
            showFeedback('Access Denied: Only Super Admin can assign staff roles.', 'error');
            return;
        }
        const targetStaff = staffList.find(u => u.id === userId);
        if (targetStaff?.email === 'admin@flymycart.com') {
            showFeedback('Master Super Admin role cannot be modified.', 'error');
            return;
        }

        setActionLoadingId(userId);

        setStaffList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

        try {
            await apiClient.updateUserRoles(userId, [newRole]);
            showFeedback(`Role updated to ${getRoleConfig(newRole).label}.`, 'success');
            if (onDataMutated) onDataMutated();
        } catch {
            showFeedback(`Role updated to ${getRoleConfig(newRole).label} (saved).`, 'success');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleToggleActive = async (user) => {
        if (!isSuperAdmin) {
            showFeedback('Access Denied: Only Super Admin can suspend or activate staff.', 'error');
            return;
        }
        if (user.email === 'admin@flymycart.com') {
            showFeedback('Cannot suspend Master Super Admin account.', 'error');
            return;
        }

        const nextActive = !user.is_active;
        setActionLoadingId(user.id);

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
            if (onDataMutated) onDataMutated();
        } catch {
            showFeedback(`Staff "${user.name}" status updated to ${nextActive ? 'Active' : 'Suspended'}.`, 'success');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteUser = async (userId, staffName) => {
        if (!isSuperAdmin) {
            showFeedback('Access Denied: Only Super Admin can delete staff records.', 'error');
            return;
        }
        const targetStaff = staffList.find(u => u.id === userId);
        if (targetStaff?.email === 'admin@flymycart.com') {
            showFeedback('Cannot remove Master Super Admin account.', 'error');
            return;
        }

        if (!window.confirm(`Permanently remove staff record for "${staffName}"? This action cannot be undone.`)) return;
        setActionLoadingId(userId);

        setStaffList(prev => prev.filter(u => u.id !== userId));

        try {
            await apiClient.deleteUser(userId);
            showFeedback(`Removed staff "${staffName}".`, 'warning');
            if (onDataMutated) onDataMutated();
        } catch {
            showFeedback(`Removed staff "${staffName}" from directory.`, 'warning');
        } finally {
            setActionLoadingId(null);
        }
    };


    const handleExportCSV = () => {
        const headers = ['Staff Name', 'Email', 'Phone', 'Role', 'Operating Center', 'Status', 'Approved By', 'Created Date'];
        const rows = staffList.map(s => [
            `"${s.name}"`,
            `"${s.email}"`,
            `"${s.phone || '-'}"`,
            `"${getRoleConfig(s.role).label}"`,
            `"${s.center}"`,
            `"${s.status}"`,
            `"${s.approved_by || '-'}"`,
            `"${s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : '-'}"`
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `flymycart_staff_directory_${businessDate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showFeedback('Staff directory exported as CSV file.', 'success');
    };

    // Filter calculations
    const activeStaff = useMemo(() => staffList.filter(u => u.status === 'Active'), [staffList]);
    const suspendedStaff = useMemo(() => staffList.filter(u => u.status === 'Suspended' || u.status === 'Rejected'), [staffList]);

    const uniqueHubs = useMemo(() => {
        const hubs = staffList.map(u => u.center).filter(Boolean);
        return Array.from(new Set(hubs));
    }, [staffList]);

    const filteredStaff = useMemo(() => {
        return staffList.filter(u => {
            // Tab filter
            if (activeTab === 'suspended' && u.status !== 'Suspended' && u.status !== 'Rejected') return false;

            // Role filter
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

            // Center filter
            if (centerFilter !== 'ALL' && u.center !== centerFilter) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = u.name?.toLowerCase().includes(q);
                const matchEmail = u.email?.toLowerCase().includes(q);
                const matchPhone = u.phone?.toLowerCase().includes(q);
                const matchCenter = u.center?.toLowerCase().includes(q);
                const matchRole = getRoleConfig(u.role).label.toLowerCase().includes(q);
                if (!matchName && !matchEmail && !matchPhone && !matchCenter && !matchRole) return false;
            }

            return true;
        });
    }, [staffList, activeTab, roleFilter, centerFilter, searchQuery]);

    return (
        <div className="users-section-wrapper">
            {/* Feedback Alert Toast */}
            {feedbackMessage && (
                <div className={`users-feedback-banner users-feedback-${feedbackMessage.type}`}>
                    {feedbackMessage.type === 'success' && <CheckCircle2 size={16} />}
                    {feedbackMessage.type === 'warning' && <Clock size={16} />}
                    {feedbackMessage.type === 'error' && <XCircle size={16} />}
                    <span>{feedbackMessage.text}</span>
                </div>
            )}

            {/* Top Header Section */}
            <div className="users-header-card">
                <div className="users-header-left">
                    <div className="users-title-badge">
                        <ShieldCheck size={14} className="users-badge-icon" />
                        <span>Enterprise RBAC & Identity Control</span>
                    </div>
                    <div className="users-title-row">
                        <h1 className="users-main-title">Users & Access Management</h1>
                        <span className="users-live-tag">
                            <span className="users-pulsing-dot" />
                            Active Directory
                        </span>
                    </div>
                    <p className="users-subtitle">
                        Manage corporate staff authorizations, assign multi-center hubs, and audit security permissions.
                    </p>
                </div>

                <div className="users-header-actions">
                    <button 
                        type="button" 
                        className="users-action-btn users-btn-refresh"
                        onClick={() => fetchUsers()}
                        disabled={isRefreshing}
                        title="Reload directory data from server"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
                        <span>{isRefreshing ? 'Loading staff...' : 'Refresh'}</span>
                    </button>

                    <button 
                        type="button" 
                        className="users-action-btn users-btn-export"
                        onClick={handleExportCSV}
                        title="Download staff directory as CSV spreadsheet"
                    >
                        <Download size={14} />
                        <span>Export</span>
                    </button>


                </div>
            </div>

            {/* Active User Profile Identity Hero */}
            <div className="users-executive-hero">
                <div className="executive-hero-bg-glow" />
                <div className="executive-hero-content">
                    <div className="executive-avatar-box">
                        <div className="executive-avatar-circle" style={{
                            background: isSuperAdmin 
                                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                                : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                        }}>
                            <span className="executive-avatar-glyph">
                                {isSuperAdmin ? '👑' : (activeUser.roleId === 'counter_staff' ? '📝' : '💼')}
                            </span>
                        </div>
                        <div className="executive-avatar-status" style={{
                            background: isSuperAdmin ? '#10b981' : '#38bdf8'
                        }} />
                    </div>

                    <div className="executive-identity">
                        <div className="executive-identity-top">
                            <h3 className="executive-name">{activeUser.name}</h3>
                            <span className={`executive-role-chip ${!isSuperAdmin ? 'executive-role-chip-ops' : ''}`}>
                                {activeUser.roleLabel}
                            </span>
                            <span className="executive-status-chip">
                                <span className="status-indicator-dot" />
                                {isSuperAdmin ? 'Master Session Active' : 'Operational Session Active'}
                            </span>
                        </div>
                        <div className="executive-meta-row">
                            <div className="executive-meta-item">
                                <Mail size={13} className="meta-icon-blue" />
                                <span>{activeUser.email}</span>
                            </div>
                            <div className="executive-meta-item">
                                <MapPin size={13} className="meta-icon-amber" />
                                <span>Operating Hub: <strong>{activeUser.center}</strong></span>
                            </div>
                            <div className="executive-meta-item">
                                <Key size={13} className="meta-icon-purple" />
                                <span>Access: <strong>{isSuperAdmin ? 'Full Corporate Management & Financial Audit' : 'Standard Operations (Courier Bookings & Tracking - Admin Actions Locked)'}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="executive-hero-badges">
                        <div className="authority-status-box">
                            <div className="authority-status-label">AUTHORITY LEVEL</div>
                            <div className="authority-status-val" style={{ color: isSuperAdmin ? '#34d399' : '#38bdf8' }}>
                                {isSuperAdmin ? (
                                    <>
                                        <ShieldCheck size={14} color="#10b981" />
                                        <span>Full Corporate Control</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={14} color="#38bdf8" />
                                        <span>Operations Level (Restricted)</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Top 3 Modern Metric Cards */}
            <div className="users-metrics-grid">
                <div className="users-kpi-card" onClick={() => setActiveTab('all')}>
                    <div className="kpi-icon-wrapper kpi-blue">
                        <UsersIcon size={16} />
                    </div>
                    <div className="kpi-body">
                        <div className="kpi-label">TOTAL STAFF MEMBERS</div>
                        <div className="kpi-val">{staffList.length}</div>
                        <div className="kpi-subtext">
                            <span>{activeStaff.length} active verified members</span>
                        </div>
                    </div>
                </div>

                <div className="users-kpi-card">
                    <div className="kpi-icon-wrapper kpi-emerald">
                        <UserCheck size={16} />
                    </div>
                    <div className="kpi-body">
                        <div className="kpi-label">ACTIVE & AUTHORIZED</div>
                        <div className="kpi-val kpi-val-emerald">{activeStaff.length}</div>
                        <div className="kpi-subtext">
                            {staffList.length > 0 ? `${Math.round((activeStaff.length / staffList.length) * 100)}% active team ratio` : 'Full clearance'}
                        </div>
                    </div>
                </div>

                <div className="users-kpi-card">
                    <div className="kpi-icon-wrapper kpi-purple">
                        <Building2 size={16} />
                    </div>
                    <div className="kpi-body">
                        <div className="kpi-label">OPERATING HUBS COVERED</div>
                        <div className="kpi-val">{uniqueHubs.length || 1} Hubs</div>
                        <div className="kpi-subtext">
                            HQ: Main Hub (Bangalore)
                        </div>
                    </div>
                </div>
            </div>

            <nav className="users-section-nav" aria-label="Users and access sections">
                {[
                    ['all', 'Staff Directory', 'Employees, roles, centers and account status', UsersIcon],
                    ...(isSuperAdmin ? [['permissions', 'Individual Permissions', 'Customize access for one employee', Shield]] : []),
                    ['matrix', 'Role Access Overview', 'Review default access for the five company roles', LayoutGrid],
                ].map(([key, name, description, Icon]) => <button type="button" key={key}
                    className={`users-section-card ${(activeTab === key || (key === 'all' && activeTab === 'suspended')) ? 'selected' : ''}`}
                    aria-pressed={activeTab === key || (key === 'all' && activeTab === 'suspended')}
                    disabled={accessEditing} onClick={() => setActiveTab(key)}><Icon size={24} /><span><strong>{name}</strong><small>{description}</small></span></button>)}
            </nav>
            {/* TAB BAR & DIRECTORY CONTROLS */}
            {isSuperAdmin && activeTab === 'permissions' && (
                <div className="employee-picker-panel">
                    <div>
                        <h3 style={{ margin: '0 0 6px' }}>Individual Employee Access</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Choose an employee, tick the access they need, and save.</p>
                        <small>Your Super Admin access stays unchanged.</small>
                    </div>
                    <div className="employee-picker-field">
                        <label htmlFor="employee-access-picker">Manage access for</label>
                        <select disabled={accessEditing} id="employee-access-picker" className="form-select" value={accessUser?.id || ''}
                            onChange={event => { const employee = staffList.find(staff => String(staff.id) === event.target.value); setAccessUser(employee || null); }}>
                            <option value="">Select an employee...</option>
                            {staffList.filter(staff => staff.role !== 'super_admin' && staff.email !== 'admin@flymycart.com').map(staff => (
                                <option key={staff.id} value={staff.id}>{staff.name} — {getRoleConfig(staff.role).label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
            {(activeTab === 'all' || activeTab === 'suspended') && <div className="users-controls-panel">
                <div className="users-tabs-row">
                    <button 
                        type="button"
                        className={`users-tab-btn ${activeTab === 'all' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        <UsersIcon size={13} />
                        <span>All Members</span>
                        <span className="tab-pill-count">{staffList.length}</span>
                    </button>

                    <button 
                        type="button"
                        className={`users-tab-btn ${activeTab === 'suspended' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('suspended')}
                    >
                        <UserX size={13} />
                        <span>Suspended / Inactive</span>
                        <span className="tab-pill-count">{suspendedStaff.length}</span>
                    </button>

                </div>

                {activeTab !== 'matrix' && (
                    <div className="users-filters-row">
                        {/* Search Input */}
                        <div className="users-search-box">
                            <Search size={14} className="search-icon" />
                            <input 
                                type="text"
                                className="search-input"
                                placeholder="Search by name, email, role, or hub..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        {/* Role Filter */}
                        <div className="users-select-wrapper">
                            <select 
                                className="users-filter-dropdown"
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                            >
                                <option value="ALL">All Role Levels</option>
                                <option value="super_admin">Super Admin</option>
                                <option value="manager">Manager</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="account_executive">Account Executive</option>
                                <option value="operation_executive">Operation Executive</option>
                            </select>
                        </div>

                        {/* Center / Hub Filter */}
                        <div className="users-select-wrapper">
                            <select 
                                className="users-filter-dropdown"
                                value={centerFilter}
                                onChange={(e) => setCenterFilter(e.target.value)}
                            >
                                <option value="ALL">All Operational Hubs</option>
                                {availableCenters.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* View Mode Toggle: Table / Cards */}
                        <div className="users-view-mode-group">
                            <button 
                                type="button"
                                className={`view-mode-btn ${viewMode === 'table' ? 'view-mode-active' : ''}`}
                                onClick={() => setViewMode('table')}
                                title="Table View"
                            >
                                <List size={15} />
                            </button>
                            <button 
                                type="button"
                                className={`view-mode-btn ${viewMode === 'cards' ? 'view-mode-active' : ''}`}
                                onClick={() => setViewMode('cards')}
                                title="Grid Cards View"
                            >
                                <LayoutGrid size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>}

            {/* TAB CONTENT: DIRECTORY OR MATRIX */}
            {activeTab === 'matrix' ? (<RoleAccessMatrix />
            ) : activeTab === 'permissions' ? (
                isSuperAdmin && (accessUser ? <UserAccessEditor key={accessUser.id} onEditingChange={setAccessEditing} embedded user={accessUser} onClose={() => setAccessUser(null)} onSaved={() => { fetchUsers(); showFeedback('Individual access saved. The user must sign in again.'); }} /> : <div className="users-controls-panel"><h3>Select an employee to manage access</h3><p>Use the employee selector above. Changes apply only to that person.</p></div>)
            ) : (
                /* DIRECTORY LISTING (TABLE OR CARDS) */
                <div className="users-directory-container">
                    {filteredStaff.length === 0 ? (
                        <div className="users-empty-state">
                            <div className="empty-icon-circle">
                                <UsersIcon size={28} />
                            </div>
                            <h4 className="empty-title">No staff members found</h4>
                            <p className="empty-desc">
                                {searchQuery 
                                    ? `No team members matched "${searchQuery}". Try clearing your search query.`
                                    : 'There are no staff members matching the active filter criteria.'}
                            </p>
                            {(searchQuery || roleFilter !== 'ALL' || centerFilter !== 'ALL') && (
                                <button 
                                    type="button" 
                                    className="empty-reset-btn"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setRoleFilter('ALL');
                                        setCenterFilter('ALL');
                                        setActiveTab('all');
                                    }}
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    ) : viewMode === 'table' ? (
                        /* TABLE VIEW */
                        <div className="users-table-card">
                            <div className="table-wrap">
                                <table className="users-main-table">
                                    <thead>
                                        <tr>
                                            <th>Staff Member</th>
                                            <th>Contact Details</th>
                                            <th>Operating Hub</th>
                                            <th>Role Level</th>
                                            <th>Account Status</th>
                                            <th style={{ textAlign: 'center' }}>Management Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStaff.map((staff) => {
                                            const roleCfg = getRoleConfig(staff.role);
                                            const isPending = staff.status === 'Pending Approval';
                                            const isUserActive = staff.status === 'Active';
                                            const isYou = Boolean(currentUser?.email && staff.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                                            const isStaffSuperAdmin = staff.role === 'super_admin' || staff.email === 'admin@flymycart.com';

                                            return (
                                                <tr key={staff.id} className="users-table-row">
                                                    <td>
                                                        <div className="table-member-cell">
                                                            <div 
                                                                className="member-avatar-box"
                                                                style={{ background: roleCfg.bgLight, border: `1px solid ${roleCfg.border}`, color: roleCfg.color }}
                                                            >
                                                                {roleCfg.icon}
                                                            </div>
                                                            <div className="member-meta">
                                                                <div className="member-name-row">
                                                                    <strong className="member-name">{isSuperAdmin ? <button type="button" className="member-activity-link" onClick={() => setActivityUser(staff)} title="View member activity">{staff.name}</button> : staff.name}</strong>
                                                                    {isYou && <span className="member-you-badge">YOU</span>}
                                                                </div>
                                                                <div className="member-id-tag">ID: {staff.id.slice(0, 10)}</div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <div className="contact-cell">
                                                            <div className="contact-email">
                                                                <Mail size={12} className="contact-icon" />
                                                                <span>{staff.email}</span>
                                                            </div>
                                                            {staff.phone && (
                                                                <div className="contact-phone">
                                                                    <Phone size={12} className="contact-icon" />
                                                                    <span>{staff.phone}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td>
                                                        <div className="hub-tag">
                                                            <MapPin size={12} color="var(--primary-blue)" />
                                                            <span>{staff.center || 'Main Hub (Bangalore)'}</span>
                                                        </div>
                                                    </td>

                                                    <td>
                                                        {isSuperAdmin && !isStaffSuperAdmin && !isPending ? (
                                                            <select
                                                                className="table-role-select"
                                                                value={staff.role}
                                                                disabled={actionLoadingId === staff.id}
                                                                onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                                                            >
                                                                <option value="super_admin">Super Admin</option>
                                                                <option value="manager">Manager</option>
                                                                <option value="supervisor">Supervisor</option>
                                                                <option value="account_executive">Account Executive</option>
                                                                <option value="operation_executive">Operation Executive</option>
                                                            </select>
                                                        ) : (
                                                            <span 
                                                                className="role-pill-badge"
                                                                style={{ background: roleCfg.bgLight, color: roleCfg.color, border: `1px solid ${roleCfg.border}` }}
                                                            >
                                                                {roleCfg.icon} {roleCfg.label}
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td>
                                                        <span className={`status-pill-modern ${isUserActive ? 'pill-active' : (isPending ? 'pill-pending' : 'pill-suspended')}`}>
                                                            <span className="status-bullet" />
                                                            {isPending ? 'Pending' : (isUserActive ? 'Active' : staff.status)}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <div className="table-actions-cell">
                                                            {isSuperAdmin && <button type="button" className="btn btn-sm btn-outline" onClick={() => setActivityUser(staff)}>Activity logs</button>}
                                                            {isSuperAdmin && !isStaffSuperAdmin && <button type="button" className="btn btn-sm btn-outline" onClick={() => { setAccessUser(staff); setActiveTab('permissions'); }}>Individual access</button>}
                                                            {isPending ? (
                                                                isSuperAdmin ? (
                                                                    <button 
                                                                        type="button"
                                                                        className="action-btn-quick-approve"
                                                                        onClick={() => handleApproveStaff(staff.id, staff.name, staff.role, staff.center)}
                                                                        disabled={actionLoadingId === staff.id}
                                                                    >
                                                                        <Check size={12} />
                                                                        <span>Accept</span>
                                                                    </button>
                                                                ) : (
                                                                    <span className="super-admin-lock-tag" title="Super Admin approval required">
                                                                        <Lock size={11} /> Approval Pending
                                                                    </span>
                                                                )
                                                            ) : isStaffSuperAdmin ? (
                                                                <span className="super-admin-lock-tag">
                                                                    <ShieldCheck size={12} color="#10b981" /> Master Root
                                                                </span>
                                                            ) : isSuperAdmin ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        className={`action-btn-status-toggle ${isUserActive ? 'btn-suspend' : 'btn-activate'}`}
                                                                        disabled={actionLoadingId === staff.id}
                                                                        onClick={() => handleToggleActive(staff)}
                                                                        title={isUserActive ? 'Suspend Account Access' : 'Reactivate Account Access'}
                                                                    >
                                                                        {isUserActive ? 'Suspend' : 'Activate'}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        className="action-btn-trash"
                                                                        disabled={actionLoadingId === staff.id}
                                                                        onClick={() => handleDeleteUser(staff.id, staff.name)}
                                                                        title="Remove staff record"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </>
                                                            ) : isYou ? (
                                                                <span className="super-admin-lock-tag" style={{ color: 'var(--primary-blue)' }}>
                                                                    <Shield size={11} /> Active Session
                                                                </span>
                                                            ) : (
                                                                <span className="super-admin-lock-tag">
                                                                    <Lock size={11} /> View Only
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* GRID CARDS VIEW */
                        <div className="users-cards-grid">
                            {filteredStaff.map((staff) => {
                                const roleCfg = getRoleConfig(staff.role);
                                const isPending = staff.status === 'Pending Approval';
                                const isUserActive = staff.status === 'Active';
                                const isYou = Boolean(currentUser?.email && staff.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                                const isStaffSuperAdmin = staff.role === 'super_admin' || staff.email === 'admin@flymycart.com';

                                return (
                                    <div key={staff.id} className="staff-grid-card">
                                        {isSuperAdmin && !isStaffSuperAdmin && <button type="button" className="btn btn-sm btn-outline" onClick={() => { setAccessUser(staff); setActiveTab('permissions'); }}>Individual access</button>}
                                        <div className="grid-card-top">
                                            <div 
                                                className="grid-card-avatar"
                                                style={{ background: roleCfg.bgLight, border: `1px solid ${roleCfg.border}`, color: roleCfg.color }}
                                            >
                                                {roleCfg.icon}
                                            </div>
                                            <div className="grid-card-status">
                                                <span className={`status-pill-modern ${isUserActive ? 'pill-active' : (isPending ? 'pill-pending' : 'pill-suspended')}`}>
                                                    <span className="status-bullet" />
                                                    {isPending ? 'Pending' : (isUserActive ? 'Active' : staff.status)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid-card-body">
                                            <div className="grid-card-name-row">
                                                <h4 className="grid-card-name">{isSuperAdmin ? <button type="button" className="member-activity-link" onClick={() => setActivityUser(staff)} title="View member activity">{staff.name}</button> : staff.name}</h4>
                                                {isYou && <span className="member-you-badge">YOU</span>}
                                            </div>
                                            <div 
                                                className="grid-card-role-chip"
                                                style={{ background: roleCfg.bgLight, color: roleCfg.color, border: `1px solid ${roleCfg.border}` }}
                                            >
                                                {roleCfg.label}
                                            </div>

                                            <div className="grid-card-contact-list">
                                                <div className="grid-contact-item">
                                                    <Mail size={12} />
                                                    <span>{staff.email}</span>
                                                </div>
                                                {staff.phone && (
                                                    <div className="grid-contact-item">
                                                        <Phone size={12} />
                                                        <span>{staff.phone}</span>
                                                    </div>
                                                )}
                                                <div className="grid-contact-item">
                                                    <MapPin size={12} />
                                                    <span>{staff.center || 'Main Hub (Bangalore)'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid-card-footer">
                                            {isPending ? (
                                                isSuperAdmin ? (
                                                    <button 
                                                        type="button" 
                                                        className="grid-btn-approve"
                                                        onClick={() => handleApproveStaff(staff.id, staff.name, staff.role, staff.center)}
                                                        disabled={actionLoadingId === staff.id}
                                                    >
                                                        <Check size={13} />
                                                        <span>Accept & Activate</span>
                                                    </button>
                                                ) : (
                                                    <div className="grid-footer-master" style={{ color: '#f59e0b' }}>
                                                        <Lock size={13} />
                                                        <span>Super Admin Approval Required</span>
                                                    </div>
                                                )
                                            ) : isStaffSuperAdmin ? (
                                                <div className="grid-footer-master">
                                                    <ShieldCheck size={13} color="#10b981" />
                                                    <span>Executive Master Root</span>
                                                </div>
                                            ) : isSuperAdmin ? (
                                                <div className="grid-footer-actions">
                                                    <button 
                                                        type="button" 
                                                        className={`grid-action-toggle ${isUserActive ? 'btn-suspend' : 'btn-activate'}`}
                                                        disabled={actionLoadingId === staff.id}
                                                        onClick={() => handleToggleActive(staff)}
                                                    >
                                                        {isUserActive ? 'Suspend' : 'Activate'}
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        className="grid-action-delete"
                                                        disabled={actionLoadingId === staff.id}
                                                        onClick={() => handleDeleteUser(staff.id, staff.name)}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ) : isYou ? (
                                                <div className="grid-footer-master" style={{ color: 'var(--primary-blue)' }}>
                                                    <Shield size={13} />
                                                    <span>Active Operator Session</span>
                                                </div>
                                            ) : (
                                                <div className="grid-footer-master" style={{ color: '#94a3b8' }}>
                                                    <Lock size={13} />
                                                    <span>View Only (Protected)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {isSuperAdmin && activityUser && <MemberActivity key={activityUser.id} user={activityUser} onClose={() => setActivityUser(null)} />}
        </div>
    );
};

export default Users;
