import { LoadingSpinner } from './LoadingSpinner';
import { ButtonSpinner } from './LoadingSpinner';
import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import './UserAccessEditor.css';

const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const sectionOrder = ['Dashboard', 'Customers', 'Shipments', 'Invoices', 'Accounts', 'Costs & Financials', 'Attendance & Timings', 'B2B & Credit', 'Refunds', 'Follow-ups & Communications', 'Reports & Analytics', 'Users & Access', 'Settings', 'Global Search'];
const names = { attendance: 'Attendance & Timings', search: 'Global Search', reconciliation: 'Accounts', b2b: 'B2B & Credit', costs: 'Costs & Financials', reports: 'Reports & Analytics', users: 'Users & Access', dashboards: 'Dashboard', followups: 'Follow-ups & Communications' };
const label = permission => ({
    'attendance.view': 'View Attendance Summary & Logs',
    'attendance.manage': 'Manage All Staff Attendance',
    'attendance.punch': 'Record Attendance Punches',
    'costs.customer_price': 'View Customer Sale Price',
    'costs.carrier_cost': 'View Courier / Carrier Cost',
    'costs.net_value': 'View Net Value',
    'costs.margins': 'View Profit Margins',
    'costs.view': 'View Courier / Carrier Cost',
    'reports.view_financial': 'View Financial P&L',
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
    'search.global': 'Use Global Search'
}[permission.code] || title(permission.code.split('.')[1]));

export default function UserAccessEditor({ user, onClose, onSaved, embedded = false, onEditingChange }) {
    const [access, setAccess] = useState(null);
    const [overrides, setOverrides] = useState({});
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const changed = access ? [...new Set([...Object.keys(overrides), ...Object.keys(access.overrides)])].filter(code => overrides[code] !== access.overrides[code]) : [];
    const dirty = changed.length > 0;
    useEffect(() => {
        onEditingChange?.(dirty || saving);
        return () => onEditingChange?.(false);
    }, [dirty, saving, onEditingChange]);
    useEffect(() => {
        if (!dirty) return;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    useEffect(() => {
        let active = true;
        apiClient.getUserAccess(user.id).then(data => {
            if (active) { setAccess(data); setOverrides(data.overrides); }
        }).catch(() => { if (active) setError('Unable to load access. Close and try again.'); });
        return () => { active = false; };
    }, [user.id]);
    const allowed = code => {
        if (['costs.net_value', 'reports.view_financial'].includes(code) &&
            (overrides['costs.view'] === 'deny' || overrides['costs.carrier_cost'] === 'deny')) return false;
        if (overrides[code]) return overrides[code] === 'allow';
        if (code === 'costs.carrier_cost' && overrides['costs.view']) return overrides['costs.view'] === 'allow';
        return Boolean(access.role_defaults[code]);
    };
    const toggle = (code, checked) => setOverrides(previous => {
        const next = { ...previous, [code]: checked ? 'allow' : 'deny' };
        if (code === 'costs.carrier_cost') next['costs.view'] = checked ? 'allow' : 'deny';
        if (code === 'costs.net_value') next['reports.view_financial'] = checked ? 'allow' : 'deny';
        if (code === 'reports.view_financial') next['costs.net_value'] = checked ? 'allow' : 'deny';
        return next;
    });
    const reset = code => setOverrides(previous => {
        const next = { ...previous };
        delete next[code];
        if (code === 'costs.carrier_cost') delete next['costs.view'];
        if (code === 'costs.net_value') delete next['reports.view_financial'];
        if (code === 'reports.view_financial') delete next['costs.net_value'];
        return next;
    });
    const save = async () => {
        setSaving(true); setError('');
        try {
            await apiClient.updateUserAccess(user.id, { version: access.version, overrides });
            onSaved(); onClose();
        } catch (err) { setError(err.response?.data?.detail || 'Could not save access. Try again.'); }
        finally { setSaving(false); }
    };
    const groups = {};
    for (const permission of access?.permissions || []) {
        if (permission.code === 'costs.view') continue;
        const module = permission.code.split('.')[0];
        const groupName = names[module] || title(module);
        if (`${groupName} ${permission.code} ${permission.description}`.toLowerCase().includes(query.toLowerCase())) {
            (groups[groupName] ||= []).push(permission);
        }
    }
    return <div className={embedded ? "access-page" : "modal-overlay"}><section className={embedded ? "employee-access access-page-panel" : "modal modal-lg employee-access"} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="individual-access-title">
        <header className="modal-header"><div><h3 id="individual-access-title">Individual access: {user.name}</h3><p>Choose what this employee can view and do.</p></div><button type="button" className="btn btn-outline" disabled={saving || dirty} onClick={onClose}>{embedded ? 'Clear selection' : 'Close'}</button></header>
        <div className="access-intro">Tick to allow access. Untick to block access. Then click Save changes. This affects only the selected employee.</div>
        {error && <p role="alert">{typeof error === 'string' ? error : 'Invalid access settings.'}</p>}
        {!access ? <LoadingSpinner text="Loading access..." /> : <>
            <div className="access-toolbar"><input type="search" aria-label="Search permissions" placeholder="Search modules or permissions..." value={query} onChange={event => setQuery(event.target.value)} /></div>
            <p className="access-centers"><strong>Assigned centers:</strong> {access.centers.join(', ') || 'None'} · Center assignments are managed separately.</p>
            {!access.centers.length && <p className="access-intro">No centers assigned. Allowing permissions does not give this employee access to center records until a center is assigned.</p>}
            <p className="access-note">Select the relevant module's View permission as well as its actions. Collections need Customer Sale Price access. Reconciliation needs Carrier Cost access. Net Value needs Customer Sale Price and Carrier Cost access. Monthly P&amp;L also needs Monthly Business P&amp;L access. Permission selection does not change an employee's assigned centers.</p>
            <div className="access-groups">
                {Object.entries(groups).sort(([a], [b]) => (sectionOrder.indexOf(a) === -1 ? 99 : sectionOrder.indexOf(a)) - (sectionOrder.indexOf(b) === -1 ? 99 : sectionOrder.indexOf(b))).map(([name, permissions]) => <section className="access-group access-section-row" key={name}>
                    <div className="access-section-heading"><h4>{name}</h4><span>{permissions.filter(p => allowed(p.code)).length} of {permissions.length} allowed</span></div>
                    <div className="access-options">{permissions.map(permission => <div className="access-option" key={permission.code}>
                        <label><input type="checkbox" checked={allowed(permission.code)} disabled={saving || access.protected} onChange={event => toggle(permission.code, event.target.checked)} /><span><strong>{label(permission)}</strong><small>{permission.description !== permission.code ? permission.description : `${label(permission)} ${name.toLowerCase()}`}</small><small>{allowed(permission.code) ? 'Allowed' : 'Blocked'}</small></span></label>
                        {overrides[permission.code] && <button type="button" className="access-reset" disabled={saving} onClick={() => reset(permission.code)} title="Restore this permission to its role default">Customized · Reset</button>}
                    </div>)}</div>
                </section>)}
                {!Object.keys(groups).length && <p>No permissions match your search.</p>}
            </div>
            <p className="access-note">Super Admin can customize exact operational, user management, and financial access (Customer Price, Carrier Cost, Net Value) for each employee. Saving signs this employee out so their new access takes effect immediately at their next request/login.</p>
            <footer className="form-actions"><span className="access-save-status" role="status">{dirty ? `${changed.length} unsaved changes` : 'Changes saved'}</span>{dirty && <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setOverrides({ ...access.overrides })}>Discard changes</button>}<button type="button" className="btn btn-outline" disabled={saving || access.protected} onClick={() => setOverrides({})}>Restore role defaults</button><button type="button" className="btn btn-primary-blue" disabled={saving || access.protected || !dirty} onClick={save}>{saving ? <ButtonSpinner text="Saving..." /> : 'Save changes'}</button></footer>
        </>}
    </section></div>;
}
