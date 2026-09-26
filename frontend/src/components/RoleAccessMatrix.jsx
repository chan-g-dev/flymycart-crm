import { LoadingSpinner } from './LoadingSpinner';
import RolePermissionEditor from './RolePermissionEditor';
import { useAuth } from '../context/authSession';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ChevronDown, CheckCircle2, Shield, Edit3 } from 'lucide-react';
import { apiClient } from '../api/client';
import './UserAccessEditor.css';

const roleNames = ['SUPER_ADMIN', 'Manager', 'Supervisor', 'Account Executive', 'Operation Executive'];

const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const sectionOrder = [
    'Dashboard', 
    'Customers', 
    'Shipments', 
    'Invoices', 
    'Accounts', 
    'Value & Financials', 
    'Attendance & Timings', 
    'B2B & Credit', 
    'Refunds', 
    'Follow-ups & Communications', 
    'Reports & Analytics', 
    'Users & Access', 
    'Settings', 
    'Global Search'
];

const moduleDisplayNames = { 
    dashboards: 'Dashboard',
    customers: 'Customers',
    shipments: 'Shipments',
    invoices: 'Invoices',
    reconciliation: 'Accounts',
    b2b: 'B2B & Credit',
    attendance: 'Attendance & Timings',
    costs: 'Value & Financials',
    followups: 'Follow-ups & Communications',
    reports: 'Reports & Analytics',
    users: 'Users & Access',
    settings: 'Settings',
    search: 'Global Search'
};

const permissionLabels = {
    'dashboards.view': 'KPI Cards',
    'dashboards.booking_trends': 'Booking Trends',
    'dashboards.recent_bookings': 'Recent Bookings',
    'dashboards.fleet_volume': 'Courier Volume',
    'dashboards.accounts_snapshot': 'Accounts Snapshot',
    'dashboards.financial_analytics': 'Financial Charts',
    'dashboards.followups': 'Follow-ups',
    'dashboards.quick_actions': 'Quick Actions',
    'attendance.view': 'View Attendance',
    'attendance.manage': 'Manage Attendance',
    'attendance.punch': 'Record Punches',
    'attendance.leave': 'Mark Staff Leave',
    'costs.customer_price': 'Customer Sale Price',
    'costs.carrier_cost': 'Courier / Carrier Value',
    'costs.net_value': 'Profit',
    'costs.margins': 'Margins',
    'costs.view': 'Courier / Carrier Value',
    'reports.view_financial': 'Financial P&L',
    'reports.view': 'Reports Overview',
    'reports.eod': 'EOD Report',
    'reports.weekly': 'Weekly Trends',
    'reports.custom_range': 'Custom Date Range',
    'reports.monthly_pnl': 'Monthly P&L',
    'reports.print': 'Print Reports',
    'reports.export': 'Export Reports',
    'customers.statement': 'Customer Account Statement',
    'invoices.print': 'Print & View Invoices',
    'b2b.export': 'Export B2B Accounts',
    'search.global': 'Use Global Search',
    'settings.view': 'View Settings',
    'settings.manage': 'Manage Settings',
    'users.view': 'View Users',
    'users.invite': 'Invite Users',
    'users.edit': 'Edit Users',
    'users.suspend': 'Suspend Users',
    'users.manage_permissions': 'Manage Permissions',
    'customers.delete': 'Delete Customers',
    'shipments.delete': 'Delete Shipments'
};

const formatLabel = permission => permissionLabels[permission.code] || title(permission.code.split('.')[1] || permission.action || permission.code);
const scopeName = value => ({ all: 'All centers', center: 'Assigned centers', own: 'Own center' }[value] || value || 'Assigned centers');

export default function RoleAccessMatrix() {
    const { currentUser } = useAuth();
    const isSuperAdmin = currentUser?.isSuperAdmin;
    const [editing, setEditing] = useState(null);
    const [revision, setRevision] = useState(0);
    const [message, setMessage] = useState('');
    const [roles, setRoles] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiClient.getRoles().then(data => { 
            if (active) {
                // Strictly filter to the 5 official company roles
                const filtered = data
                    .filter(role => roleNames.includes(role.name))
                    .sort((a, b) => roleNames.indexOf(a.name) - roleNames.indexOf(b.name));
                setRoles(filtered); 
            }
        })
        .catch(() => { if (active) setError('Unable to load role defaults.'); })
        .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [revision]);

    if (editing) {
        return (
            <RolePermissionEditor 
                role={editing} 
                onClose={() => setEditing(null)} 
                onSaved={() => { 
                    setEditing(null); 
                    setRevision(n => n + 1); 
                    setMessage('Role permissions saved. Individual overrides are unchanged.'); 
                }} 
            />
        );
    }

    return (
        <section className="role-overview">
            <header style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)' }}>Company Role Defaults</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                    Review default operational & financial access for each of the 5 standard company roles. Personal exceptions can be managed under Individual Permissions.
                </p>
            </header>

            {message && <p role="status" style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald, #10b981)', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>{message}</p>}
            {error && <p role="alert" style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--rose, #ef4444)', borderRadius: '8px', fontSize: '13px' }}>{error}</p>}
            {loading && <LoadingSpinner text="Loading roles..." />}

            <div className="role-overview-list" style={{ display: 'grid', gap: '14px' }}>
                {roles.map((role, idx) => {
                    const isRoleSuperAdmin = role.name === 'SUPER_ADMIN';
                    const roleDisplayName = isRoleSuperAdmin ? 'Super Admin' : role.name;

                    // Group permissions by module
                    const groups = {};
                    for (const permission of role.permissions || []) {
                        if (permission.code === 'costs.view') continue;
                        const module = permission.code.split('.')[0];
                        const groupName = moduleDisplayNames[module] || title(module);
                        (groups[groupName] ||= []).push(permission);
                    }

                    // Sort groups according to sectionOrder (Dashboard first)
                    const sortedGroupEntries = Object.entries(groups).sort(([a], [b]) => {
                        const idxA = sectionOrder.indexOf(a) !== -1 ? sectionOrder.indexOf(a) : 99;
                        const idxB = sectionOrder.indexOf(b) !== -1 ? sectionOrder.indexOf(b) : 99;
                        return idxA - idxB;
                    });

                    return (
                        <details key={role.id} className="role-overview-card" defaultOpen={idx === 0}>
                            <summary style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', background: 'var(--card-bg)' }}>
                                <span className="role-overview-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', background: isRoleSuperAdmin ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: isRoleSuperAdmin ? '#ef4444' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isRoleSuperAdmin ? <Shield size={20} color="#ef4444" /> : <ShieldCheck size={20} />}
                                </span>
                                <span className="role-overview-name" style={{ flex: 1 }}>
                                    <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>{roleDisplayName}</strong>
                                    <small style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                                        {isRoleSuperAdmin ? 'Full application access across all centers & financials' : `Standard default permissions for ${roleDisplayName}`}
                                    </small>
                                </span>
                                <span className="role-count" style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-blue, #2563eb)' }}>
                                    {role.permissions?.length || 0} permissions
                                </span>
                                <ChevronDown className="role-chevron" size={18} style={{ color: 'var(--text-muted)' }} />
                            </summary>

                            <div style={{ padding: '16px', background: 'var(--bg-app)', borderTop: '1px solid var(--card-border)' }}>
                                {isSuperAdmin && !isRoleSuperAdmin && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '10px' }}>
                                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                                            Customize default module permissions and center scopes for all <strong>{roleDisplayName}</strong> staff members.
                                        </div>
                                        <button 
                                            type="button" 
                                            className="btn btn-primary-blue" 
                                            style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            onClick={() => setEditing(role)}
                                        >
                                            <Edit3 size={13} /> Edit Role Permissions
                                        </button>
                                    </div>
                                )}

                                <div className="access-groups" style={{ display: 'grid', gap: '10px' }}>
                                    {sortedGroupEntries.map(([groupName, permissions]) => (
                                        <section className="access-group access-section-row" key={groupName} style={{ margin: 0, border: '1px solid var(--card-border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--card-bg)' }}>
                                            <div className="access-section-heading" style={{ padding: '14px 16px', background: 'var(--bg-app)', borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>{groupName}</h4>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    {permissions.length} allowed
                                                </span>
                                            </div>
                                            <div className="access-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', padding: '10px 12px', gap: '10px', background: 'var(--card-bg)' }}>
                                                {permissions.map(permission => (
                                                    <div 
                                                        className="access-option" 
                                                        key={permission.code} 
                                                        style={{ 
                                                            border: '1px solid var(--card-border)', 
                                                            borderRadius: '8px', 
                                                            padding: '10px 12px', 
                                                            display: 'flex', 
                                                            flexDirection: 'column', 
                                                            justifyContent: 'space-between', 
                                                            gap: '6px',
                                                            background: 'var(--bg-app)'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                            <CheckCircle2 size={16} color="var(--primary-blue, #2563eb)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                            <div>
                                                                <strong style={{ fontSize: '12.5px', color: 'var(--text-main)', display: 'block' }}>
                                                                    {formatLabel(permission)}
                                                                </strong>
                                                                <small style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                                                                    {permission.description !== permission.code ? permission.description : `${formatLabel(permission)} ${groupName.toLowerCase()}`}
                                                                </small>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '4px' }}>
                                                            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-blue, #2563eb)' }}>
                                                                {scopeName(permission.scope)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </div>
                        </details>
                    );
                })}
            </div>
        </section>
    );
}


