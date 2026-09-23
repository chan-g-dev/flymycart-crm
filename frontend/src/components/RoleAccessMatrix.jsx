import { LoadingSpinner } from './LoadingSpinner';
import RolePermissionEditor from './RolePermissionEditor';
import { useAuth } from '../context/authSession';
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ChevronDown } from 'lucide-react';
import { apiClient } from '../api/client';
import './UserAccessEditor.css';
const roleNames = ['SUPER_ADMIN', 'Manager', 'Team Leader', 'Counter Staff', 'Operations Executive'];
const readable = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const moduleName = value => ({ attendance: 'Attendance & Timings', b2b: 'B2B & Credit', costs: 'Courier Costs', dashboards: 'Dashboard', followups: 'Follow-ups', users: 'Users & Access' }[value] || readable(value));
const scopeName = value => ({ all: 'All centers', center: 'Assigned centers', own: 'Own center' }[value] || value);
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
        apiClient.getRoles().then(data => { if (active) setRoles(data.filter(role => roleNames.includes(role.name)).sort((a, b) => roleNames.indexOf(a.name) - roleNames.indexOf(b.name))); })
            .catch(() => { if (active) setError('Unable to load role defaults.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [revision]);
    if (editing) return <RolePermissionEditor role={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(n => n + 1); setMessage('Role permissions saved. Individual overrides are unchanged.'); }} />;
    return <section className="role-overview"><header><h3>Company role defaults</h3><p>Explore what each role can access. Personal overrides are managed in Individual Permissions.</p></header>
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}{loading && <LoadingSpinner text="Loading roles..." />}
        <div className="role-overview-list">{roles.map(role => {
            const groups = {};
            for (const permission of role.permissions) {
                const module = permission.code.split('.')[0];
                (groups[module] ||= []).push(permission);
            }
            return <details key={role.id} className="role-overview-card">
                <summary><span className="role-overview-icon"><ShieldCheck size={21} /></span><span className="role-overview-name"><strong>{role.name === 'SUPER_ADMIN' ? 'Super Admin' : role.name}</strong><small>{role.name === 'SUPER_ADMIN' ? 'Full application access' : 'Default permissions for this role'}</small></span><span className="role-count">{role.permissions.length} permissions</span><ChevronDown className="role-chevron" size={18} /></summary>
                {isSuperAdmin && role.name !== 'SUPER_ADMIN' && <div style={{ padding: '0 16px 16px' }}><button type="button" className="btn btn-primary-blue" onClick={() => setEditing(role)}>Edit role permissions</button></div>}
                <div className="role-module-grid">{Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([module, permissions]) => <section className="role-module" key={module}><h4>{moduleName(module)}</h4><ul>{permissions.sort((a, b) => a.code.localeCompare(b.code)).map(permission => <li key={permission.code}><span>{readable(permission.code.split('.')[1])}</span><small>{scopeName(permission.scope)}</small></li>)}</ul></section>)}</div>
            </details>;
        })}</div>
    </section>;
}

