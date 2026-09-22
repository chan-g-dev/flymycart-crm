import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import './UserAccessEditor.css';

const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const sectionOrder = ['Dashboard', 'Customers', 'Shipments', 'Invoices', 'Accounts', 'B2B & Credit', 'Refunds', 'Follow-ups & Communications', 'Reports & Financial Values', 'Users & Access', 'Settings', 'Global Search'];
const names = { search: 'Global Search', reconciliation: 'Accounts', b2b: 'B2B & Credit', costs: 'Accounts', reports: 'Reports & Financial Values', users: 'Users & Access', dashboards: 'Dashboard', followups: 'Follow-ups & Communications' };
const label = permission => ({ 'costs.view': 'View courier purchase costs', 'reports.view_financial': 'View Net Value, margins & financial reports', 'search.global': 'Use global search' }[permission.code] || title(permission.code.split('.')[1]));

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
        if (code === 'reports.view_financial' && overrides['costs.view'] === 'deny') return false;
        if (code === 'costs.view' && overrides[code] !== 'deny' && (overrides['reports.view_financial'] === 'allow' || (!overrides['reports.view_financial'] && access.role_defaults['reports.view_financial']))) return true;
        return overrides[code] ? overrides[code] === 'allow' : Boolean(access.role_defaults[code]);
    };
    const toggle = (code, checked) => setOverrides(previous => {
        const next = { ...previous, [code]: checked ? 'allow' : 'deny' };
        // Keep the checkboxes consistent with server-side financial dependencies.
        if (code === 'costs.view' && !checked) next['reports.view_financial'] = 'deny';
        if (code === 'reports.view_financial' && checked) next['costs.view'] = 'allow';
        return next;
    });
    const reset = code => setOverrides(previous => { const next = { ...previous }; delete next[code]; return next; });
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
        const module = permission.code.split('.')[0];
        const groupName = names[module] || title(module);
        if (permission.code === 'users.invite') continue;
        if (`${groupName} ${permission.code} ${permission.description}`.toLowerCase().includes(query.toLowerCase())) {
            (groups[groupName] ||= []).push(permission);
        }
    }
    return <div className={embedded ? "access-page" : "modal-overlay"}><section className={embedded ? "employee-access access-page-panel" : "modal modal-lg employee-access"} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-labelledby="individual-access-title">
        <header className="modal-header"><div><h3 id="individual-access-title">Individual access: {user.name}</h3><p>Choose what this employee can view and do.</p></div><button type="button" className="btn btn-outline" disabled={saving || dirty} onClick={onClose}>{embedded ? 'Clear selection' : 'Close'}</button></header>
        <div className="access-intro">Tick to allow access. Untick to block access. Then click Save changes. This affects only the selected employee.</div>
        {error && <p role="alert">{typeof error === 'string' ? error : 'Invalid access settings.'}</p>}
        {!access ? <p>Loading access...</p> : <>
            <div className="access-toolbar"><input type="search" aria-label="Search permissions" placeholder="Search modules or permissions..." value={query} onChange={event => setQuery(event.target.value)} /></div>
            <p className="access-centers"><strong>Assigned centers:</strong> {access.centers.join(', ') || 'None'} · Center assignments are managed separately.</p>
            {!access.centers.length && <p className="access-intro">No centers assigned. Allowing permissions does not give this employee access to center records until a center is assigned.</p>}
            <div className="access-groups">
                {Object.entries(groups).sort(([a], [b]) => (sectionOrder.indexOf(a) === -1 ? 99 : sectionOrder.indexOf(a)) - (sectionOrder.indexOf(b) === -1 ? 99 : sectionOrder.indexOf(b))).map(([name, permissions]) => <section className="access-group access-section-row" key={name}>
                    <div className="access-section-heading"><h4>{name}</h4><span>{permissions.filter(p => !p.protected && allowed(p.code)).length} of {permissions.length} allowed</span></div>
                    <div className="access-options">{permissions.map(permission => <div className={`access-option ${permission.protected ? 'access-protected' : ''}`} key={permission.code}>
                        <label><input type="checkbox" checked={!permission.protected && allowed(permission.code)} disabled={saving || access.protected || permission.protected} onChange={event => toggle(permission.code, event.target.checked)} /><span><strong>{label(permission)}</strong><small>{permission.description !== permission.code ? permission.description : `${label(permission)} ${name.toLowerCase()}`}</small><small>{permission.protected ? 'Super Admin only' : allowed(permission.code) ? 'Allowed' : 'Blocked'}</small></span></label>
                        {!permission.protected && overrides[permission.code] && <button type="button" className="access-reset" disabled={saving} onClick={() => reset(permission.code)} title="Restore this permission to its role default">Customized · Reset</button>}
                    </div>)}</div>
                </section>)}
                {!Object.keys(groups).length && <p>No permissions match your search.</p>}
            </div>
            <p className="access-note">Financial reports require courier cost access. These two settings update together. Saving signs this employee out so their new access takes effect at the next login.</p>
            <footer className="form-actions"><span className="access-save-status" role="status">{dirty ? `${changed.length} unsaved changes` : 'Changes saved'}</span>{dirty && <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setOverrides({ ...access.overrides })}>Discard changes</button>}<button type="button" className="btn btn-outline" disabled={saving || access.protected} onClick={() => setOverrides({})}>Restore role defaults</button><button type="button" className="btn btn-primary-blue" disabled={saving || access.protected || !dirty} onClick={save}>{saving ? 'Saving...' : 'Save changes'}</button></footer>
        </>}
    </section></div>;
}
