import { ButtonSpinner } from './LoadingSpinner';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
const title = text => text.replaceAll(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const permissionLabels = {
    'attendance.view': 'View Attendance Summary & Logs',
    'attendance.manage': 'Manage All Staff Attendance',
    'attendance.punch': 'Record Attendance Punches',
    'costs.customer_price': 'Customer Price',
    'costs.carrier_cost': 'Carrier Cost',
    'costs.net_value': 'Net Value',
    'costs.margins': 'Profit Margins',
    'costs.view': 'Carrier Cost',
    'reports.view_financial': 'Financial P&L',
    'reports.view': 'View Reports Overview',
    'reports.eod': 'EOD Operations Audit',
    'reports.weekly': 'Weekly Trends Report',
    'reports.custom_range': 'Custom Date Range Report',
    'reports.monthly_pnl': 'Monthly Business P&L',
    'reports.print': 'Print Reports & Audit Sheets',
    'reports.export': 'Export Analytical Reports',
    'customers.statement': 'Customer Account Statement',
    'invoices.print': 'Print & View Invoices',
    'b2b.export': 'Export B2B Accounts',
    'search.global': 'Global Search',
    'settings.view': 'View Settings',
    'settings.manage': 'Manage Settings',
    'dashboards.view': 'View Dashboard',
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

    const groups = {};
    for (const permission of catalog) {
        const res = permission.resource === 'costs' ? 'costs' : permission.resource;
        (groups[res] ||= []).push(permission);
    }

    return (
        <section className="role-overview">
            <header>
                <h3>Edit {role.name} permissions</h3>
                <p>Changes apply to everyone with this role. Customize exact operational, user management, and financial access. Saving signs affected employees out.</p>
            </header>
            {error && <p role="alert">{error}</p>}
            {loading ? <p>Loading permissions...</p> : (
                <div className="role-module-grid">
                    {Object.entries(groups).map(([module, permissions]) => (
                        <section className="role-module" key={module}>
                            <h4>{module === 'costs' ? 'Costs & Financials' : title(module)}</h4>
                            {permissions.map(p => (
                                <label key={p.code} style={{ display: 'flex', gap: 10, padding: '9px 0', fontSize: 13, alignItems: 'flex-start', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        disabled={saving}
                                        checked={!!selected[p.code]}
                                        onChange={e => toggle(p.code, e.target.checked)}
                                    />
                                    <span>
                                        <strong>{permissionLabels[p.code] || title(p.action)}</strong>
                                        <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: 4 }}>
                                            {p.description !== p.code ? p.description : title(p.code)}
                                        </small>
                                        {selected[p.code] && (
                                            <small style={{ display: 'block', color: 'var(--primary-color, #2563eb)' }}>
                                                {selected[p.code] === 'all' ? 'All centers' : selected[p.code] === 'own' ? 'Own center' : 'Assigned centers'}
                                            </small>
                                        )}
                                    </span>
                                </label>
                            ))}
                        </section>
                    ))}
                </div>
            )}
            <div className="form-actions">
                <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-primary-blue" disabled={saving || loading || !catalog.length} onClick={save}>
                    {saving ? <ButtonSpinner text="Saving..." /> : 'Save role permissions'}
                </button>
            </div>
        </section>
    );
}
