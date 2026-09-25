import { ButtonSpinner, LoadingSpinner } from './LoadingSpinner';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
const title = text => text.replaceAll(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

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
    'costs.customer_price': 'Customer Price',
    'costs.carrier_cost': 'Carrier Value',
    'costs.net_value': 'Profit',
    'costs.margins': 'Margins',
    'costs.view': 'Carrier Value',
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
    'search.global': 'Global Search',
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

export default function RolePermissionEditor({ role, onClose, onSaved }) {
    const [catalog, setCatalog] = useState([]);
    const [selected, setSelected] = useState(Object.fromEntries(role.permissions.map(p => [p.code, p.scope])));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiClient.getPermissions().then(data => {
            if (active) {
                // Keep distinct permissions; avoid duplicate legacy entries if enhanced ones exist
                const filtered = data.filter(p => p.code !== 'costs.view');
                setCatalog(filtered);
            }
        }).catch(() => {
            if (active) setError('Unable to load permissions.');
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, []);

    const toggle = (code, checked) => setSelected(previous => {
        const next = { ...previous };
        if (checked) {
            next[code] = 'center';
            if (code === 'costs.carrier_cost') next['costs.view'] = 'center';
            if (code === 'costs.net_value') next['reports.view_financial'] = 'center';
        } else {
            delete next[code];
            if (code === 'costs.carrier_cost') delete next['costs.view'];
            if (code === 'costs.net_value') delete next['reports.view_financial'];
        }
        return next;
    });

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const rawCatalog = await apiClient.getPermissions();
            const payload = rawCatalog
                .filter(p => selected[p.code])
                .map(p => ({ permission_id: p.id, scope: selected[p.code] }));
            await apiClient.updateRolePermissions(role.id, payload);
            onSaved();
        } catch (e) {
            setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'Unable to save role permissions.');
        } finally {
            setSaving(false);
        }
    };

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

    const groups = {};
    for (const permission of catalog) {
        const mod = permission.resource || permission.code.split('.')[0];
        const groupName = moduleDisplayNames[mod] || title(mod);
        (groups[groupName] ||= []).push(permission);
    }

    const sortedGroupEntries = Object.entries(groups).sort(([a], [b]) => {
        const idxA = sectionOrder.indexOf(a) !== -1 ? sectionOrder.indexOf(a) : 99;
        const idxB = sectionOrder.indexOf(b) !== -1 ? sectionOrder.indexOf(b) : 99;
        return idxA - idxB;
    });

    return (
        <section className="role-overview">
            <header style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)' }}>
                    Edit {role.name} Default Permissions
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                    Changes apply to all staff members assigned the {role.name} role who do not have personal overrides. Saving takes effect on their next action.
                </p>
            </header>
            {error && <p role="alert" style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--rose, #ef4444)', borderRadius: '8px', fontSize: '13px' }}>{error}</p>}
            {loading ? <LoadingSpinner text="Loading permissions..." /> : (
                <div className="access-groups" style={{ display: 'grid', gap: '12px', margin: '16px 0' }}>
                    {sortedGroupEntries.map(([groupName, permissions]) => (
                        <section className="access-group access-section-row" key={groupName} style={{ margin: 0, border: '1px solid var(--card-border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--card-bg)' }}>
                            <div className="access-section-heading" style={{ padding: '16px', background: 'var(--bg-app)', borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{groupName}</h4>
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {permissions.filter(p => !!selected[p.code]).length} of {permissions.length} allowed
                                </span>
                            </div>
                            <div className="access-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', padding: '12px', gap: '10px', background: 'var(--card-bg)' }}>
                                {permissions.map(p => {
                                    const isChecked = !!selected[p.code];
                                    return (
                                        <div 
                                            className="access-option" 
                                            key={p.code} 
                                            style={{ 
                                                border: '1px solid var(--card-border)', 
                                                borderRadius: '8px', 
                                                padding: '10px 12px', 
                                                background: isChecked ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-app)',
                                                borderColor: isChecked ? 'rgba(59, 130, 246, 0.3)' : 'var(--card-border)'
                                            }}
                                        >
                                            <label style={{ display: 'flex', gap: '10px', cursor: 'pointer', alignItems: 'flex-start' }}>
                                                <input
                                                    type="checkbox"
                                                    disabled={saving}
                                                    checked={isChecked}
                                                    onChange={e => toggle(p.code, e.target.checked)}
                                                    style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: 'var(--primary-blue, #2563eb)' }}
                                                />
                                                <div>
                                                    <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block' }}>
                                                        {permissionLabels[p.code] || title(p.action)}
                                                    </strong>
                                                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px', lineHeight: 1.3 }}>
                                                        {p.description !== p.code ? p.description : title(p.code)}
                                                    </small>
                                                    <div style={{ marginTop: '6px' }}>
                                                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: isChecked ? 'var(--primary-blue, #2563eb)' : 'var(--text-muted)' }}>
                                                            {isChecked ? 'Allowed (Assigned centers)' : 'Blocked'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--card-border)' }}>
                <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-primary-blue" disabled={saving || loading || !catalog.length} onClick={save}>
                    {saving ? <ButtonSpinner text="Saving..." /> : 'Save role permissions'}
                </button>
            </div>
        </section>
    );
}
