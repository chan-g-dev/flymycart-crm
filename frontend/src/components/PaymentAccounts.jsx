import { ButtonSpinner } from './LoadingSpinner';
import React, { useState } from 'react';
import PaymentDetails from './PaymentDetails';

export default function PaymentAccounts({ settings, onUpdateSettings, canManage }) {
    const [name, setName] = useState('');
    const [method, setMethod] = useState('UPI');
    const [details, setDetails] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const profiles = settings?.paymentAccounts || [];
    const [notice, setNotice] = useState('');
    const remove = async profile => {
        if (!canManage || saving) return;
        if (!window.confirm(`Delete saved account "${profile.name}"? It will be removed from future selections. Past payment records will remain unchanged.`)) return;
        setSaving(true); setError(''); setNotice('');
        try {
            const key = profile.name.trim().toLowerCase();
            await onUpdateSettings({
                ...settings,
                paymentAccounts: profiles.filter(item => item.name.trim().toLowerCase() !== key),
                paidToAccounts: (settings?.paidToAccounts || []).filter(item => item.trim().toLowerCase() !== key),
            });
            if (name.trim().toLowerCase() === key) { setName(''); setDetails({}); setMethod('UPI'); }
            setNotice(`Saved account "${profile.name}" deleted. Past payments were preserved.`);
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Unable to delete the account. Refresh Settings and try again.');
        } finally { setSaving(false); }
    };
    const save = async event => {
        event.preventDefault();
        if (saving) return;
        setSaving(true); setError(''); setNotice('');
        try {
            const cleanName = name.trim();
            if (!cleanName) throw new Error('Account name is required');
            const next = profiles.filter(p => p.name.toLowerCase() !== cleanName.toLowerCase());
            next.push({ name: cleanName, method, details });
            await onUpdateSettings({ ...settings, paymentAccounts: next, paidToAccounts: [...new Set([...(settings?.paidToAccounts || []), cleanName])] });
            setName(''); setDetails({});
        } catch (err) { setError(err.response?.data?.detail || err.message || 'Unable to save account'); }
        finally { setSaving(false); }
    };
    return <section className="dash-box settings-payment-accounts" style={{ gridColumn: '1 / -1' }}>
        <h4>Payment account owners and details</h4>
        <p>Save business, proprietor or individual accounts. Select an existing name to update its details. Each payment keeps its own copy.</p>
        <div className="settings-saved-accounts">{profiles.map(p => <div key={p.name} style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap'}}>
            <button type="button" className="btn btn-outline" style={{flex: '1 1 220px', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere'}} disabled={!canManage || saving} onClick={() => { setName(p.name); setMethod(p.method); setDetails(p.details || {}); setNotice(''); }}>
                {p.name} ? {p.details?.owner_type} ? {p.details?.account_holder}
            </button>
            {canManage && <button type="button" className="btn btn-outline" style={{color: 'var(--rose)'}} disabled={saving} aria-label={`Delete saved account ${p.name}`} onClick={() => remove(p)}>Delete</button>}
        </div>)}</div>
        {!profiles.length && <p>No saved payment accounts.</p>}
        {notice && <p role="status">{notice}</p>}
        {canManage && <form onSubmit={save}><fieldset disabled={saving} style={{ border: 0, padding: 0 }}>
            <label className="form-group">Account display name *<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Proprietor Ravi UPI" /></label>
            <label className="form-group">Payment mode<select value={method} onChange={e => { setMethod(e.target.value); setDetails({}); }}>{['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other'].map(m => <option key={m}>{m}</option>)}</select></label>
            <PaymentDetails method={method} value={details} onChange={setDetails} profile />
            <button className="btn btn-primary-blue" type="submit">{saving ? <ButtonSpinner text="Saving…" /> : 'Save account details'}</button>
            {error && <p role="alert">{typeof error === 'string' ? error : 'Unable to save account details'}</p>}
        </fieldset></form>}
    </section>;
}
