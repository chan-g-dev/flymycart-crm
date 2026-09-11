import React, { useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { dateAfter } from '../utils/followupDates';

export default function ScheduleFollowup({ customers, onSaved, onClose }) {
    const [form, setForm] = useState({ customer_id: '', due_date: dateAfter(5), category: 'Customer Retention', priority: 'Medium', channel_action: 'Call', notes: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const submitting = useRef(false);
    const [error, setError] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [choices, setChoices] = useState(customers);
    const [searching, setSearching] = useState(false);
    async function searchCustomers() {
        setSearching(true); setError('');
        try {
            const found = await apiClient.getCustomers({ search: customerSearch.trim(), limit: 100 });
            setChoices(found);
            setForm(previous => ({ ...previous, customer_id: '' }));
        } catch { setError('Unable to search customers. Try again or select from the current list.'); }
        finally { setSearching(false); }
    }
    async function submit(event) {
        event.preventDefault();
        if (submitting.current || saved || searching) return;
        const customer = choices.find(item => item.id === form.customer_id);
        if (!customer) { setError('Select a customer.'); return; }
        submitting.current = true;
        setSaving(true); setError('');
        try {
            await apiClient.createFollowup({ ...form, customer: customer.name });
            setSaved(true);
            try { await onSaved(); onClose(); }
            catch { setError('Follow-up saved, but the list could not refresh. Close this form and refresh the page to see it.'); }
        } catch (err) { setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Unable to schedule follow-up.'); }
        finally { submitting.current = false; setSaving(false); }
    }
    return <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
        <div className="modal-header"><h3 id="schedule-title">Schedule a follow-up</h3><button className="modal-close" disabled={saving} onClick={onClose} aria-label="Close follow-up form">×</button></div>
        {saved && <p role="status">Follow-up saved.</p>}
        <form onSubmit={submit}><fieldset className="account-check-fieldset" disabled={saving || saved || searching}><div className="form-grid">
            <div className="form-group"><label htmlFor="followup-search">Find customer by name or mobile</label><input id="followup-search" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} /><button type="button" className="btn btn-sm btn-outline" disabled={searching} onClick={searchCustomers}>{searching ? 'Searching…' : 'Search customers'}</button></div>
            <div className="form-group"><label htmlFor="followup-customer">Customer</label><select id="followup-customer" disabled={searching} required value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}><option value="">Select customer</option>{choices.map(c => <option key={c.id} value={c.id}>{c.name} — {c.mobile}</option>)}</select><small>Showing up to 100 matches. Refine the search if needed.</small></div>
            <div className="form-group"><label htmlFor="followup-category">Category</label><select id="followup-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Customer Retention', 'Invoice Due', 'B2B Payment'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label htmlFor="followup-date">Due date</label><input id="followup-date" required type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="followup-priority">Priority</label><select id="followup-priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{['Low', 'Medium', 'High'].map(p => <option key={p}>{p}</option>)}</select></div>
            <div className="form-group"><label htmlFor="followup-channel">Contact method</label><select id="followup-channel" value={form.channel_action} onChange={e => setForm({ ...form, channel_action: e.target.value })}>{['Call', 'WhatsApp', 'Email', 'SMS'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label htmlFor="followup-notes">Task / notes</label><textarea id="followup-notes" required maxLength="2000" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div><div className="account-check-pagination">{[5, 10, 15, 30].map(days => <button type="button" key={days} className="btn btn-sm btn-outline" onClick={() => setForm({ ...form, due_date: dateAfter(days) })}>In {days} days</button>)}</div><div className="form-actions"><button className="btn btn-primary-blue" type="submit">{saving ? 'Scheduling…' : 'Schedule follow-up'}</button></div></fieldset>{error && <p role="alert">{error}</p>}</form>
    </div></div>;
}
