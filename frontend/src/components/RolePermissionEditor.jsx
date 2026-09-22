import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
const protectedCodes = new Set(['users.invite', 'users.edit', 'users.suspend', 'users.manage_permissions', 'settings.manage']);
const title = text => text.replaceAll(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export default function RolePermissionEditor({ role, onClose, onSaved }) {
    const [catalog, setCatalog] = useState([]);
    const [selected, setSelected] = useState(Object.fromEntries(role.permissions.map(p => [p.code, p.scope])));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    useEffect(() => { let active = true; apiClient.getPermissions().then(data => { if (active) setCatalog(data.filter(p => !protectedCodes.has(p.code))); }).catch(() => { if (active) setError('Unable to load permissions.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
    const toggle = (code, checked) => setSelected(previous => {
        const next = { ...previous };
        if (checked) next[code] = 'center'; else delete next[code];
        if (code === 'reports.view_financial' && checked) next['costs.view'] = 'center';
        if (code === 'costs.view' && !checked) delete next['reports.view_financial'];
        return next;
    });
    const save = async () => {
        setSaving(true); setError('');
        try {
            await apiClient.updateRolePermissions(role.id, catalog.filter(p => selected[p.code]).map(p => ({ permission_id: p.id, scope: selected[p.code] })));
            onSaved();
        } catch (e) { setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'Unable to save role permissions.'); }
        finally { setSaving(false); }
    };
    const groups = {};
    for (const permission of catalog) (groups[permission.resource] ||= []).push(permission);
    return <section className="role-overview"><header><h3>Edit {role.name} permissions</h3><p>Changes apply to everyone with this role. Individual Allow/Deny overrides still take priority. Saving signs affected employees out.</p></header>
        {error && <p role="alert">{error}</p>}{loading ? <p>Loading permissions...</p> : <div className="role-module-grid">{Object.entries(groups).map(([module, permissions]) => <section className="role-module" key={module}><h4>{title(module)}</h4>{permissions.map(p => <label key={p.code} style={{ display: 'flex', gap: 10, padding: '9px 0', fontSize: 13 }}><input type="checkbox" disabled={saving} checked={!!selected[p.code]} onChange={e => toggle(p.code, e.target.checked)} /><span>{title(p.action)}{selected[p.code] && <small style={{ display: 'block' }}>{selected[p.code] === 'all' ? 'All centers' : selected[p.code] === 'own' ? 'Own center' : 'Assigned centers'}</small>}</span></label>)}</section>)}</div>}
        <div className="form-actions"><button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary-blue" disabled={saving || loading || !catalog.length} onClick={save}>{saving ? 'Saving...' : 'Save role permissions'}</button></div>
    </section>;
}
