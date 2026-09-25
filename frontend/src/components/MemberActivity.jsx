import { useRemoteData } from '../utils/useRemoteData';
import { LoadingSpinner } from './LoadingSpinner';
import React, { useCallback, useState } from 'react';
import { apiClient } from '../api/client';
import './UserAccessEditor.css';
const readable = value => (value || 'Activity').replaceAll(/[._]/g, ' ');
const dateLabel = value => value ? new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z').toLocaleString('en-IN') : 'Unknown time';
export default function MemberActivity({ user, onClose }) {
    const [page, setPage] = useState(0);
    const loadLogs = useCallback(() => apiClient.getAuditLogs({ actor_id: user.id, offset: page * 20, limit: 21 }), [user.id, page]);
    const { data, loading, error: requestError, reload } = useRemoteData(loadLogs);
    const logs = data || [];
    const error = requestError ? 'Unable to load activity. Please try Refresh.' : '';
    return <div className="modal-overlay"><section className="modal modal-lg employee-access" role="dialog" aria-modal="true" aria-labelledby="member-activity-title">
        <header className="modal-header"><div><h3 id="member-activity-title">Activity: {user.name}</h3><p>{user.email} · Recorded actions by this member</p></div><button type="button" className="btn btn-outline" onClick={onClose}>Close</button></header>
        <p className="access-note">Shows available audit records. Actions that were not logged cannot be reconstructed.</p>
        <div className="access-groups" aria-live="polite">{loading ? <LoadingSpinner text="Loading activity..." /> : error ? <p role="alert">{error}</p> : !logs.length ? <p>No recorded activity for this member.</p> : logs.slice(0, 20).map(log => <article className="member-log" key={log.id}>
            <div className="member-log-heading"><strong>{readable(log.action)}</strong><time>{dateLabel(log.timestamp)}</time></div>
            <p>{readable(log.resource_type)}{log.resource_id ? ` · ${log.resource_id}` : ''} · {log.result || 'Recorded'}</p>
            <small>{readable(log.event_type)}</small>
            {(log.before_data || log.after_data) && <details><summary>View changes</summary><div className="member-log-values"><div><h4>Before</h4><pre>{JSON.stringify(log.before_data ?? 'Not recorded', null, 2)}</pre></div><div><h4>After</h4><pre>{JSON.stringify(log.after_data ?? 'Not recorded', null, 2)}</pre></div></div></details>}
        </article>)}</div>
        <footer className="form-actions"><button type="button" className="btn btn-outline" disabled={loading} onClick={reload}>Refresh</button><button type="button" className="btn btn-outline" disabled={loading || page === 0} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page + 1}</span><button type="button" className="btn btn-outline" disabled={loading || !!error || logs.length <= 20} onClick={() => setPage(n => n + 1)}>Next</button></footer>
    </section></div>;
}
