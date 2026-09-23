import { ButtonSpinner } from './LoadingSpinner';
import { paymentOptions } from '../utils/businessOptions';
import React, { useState } from 'react';
import PaymentDetails from './PaymentDetails';
import { apiClient } from '../api/client';

export default function RefundPayoutModal({ settings, id, onClose, onSaved }) {
    const [method, setMethod] = useState(paymentOptions(settings)[0]);
    const [account, setAccount] = useState('');
    const [reference, setReference] = useState('');
    const [details, setDetails] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const save = async event => {
        event.preventDefault(); if (saving) return;
        setSaving(true); setError('');
        try {
            await apiClient.updateRefundStatus(id, 'Refunded', { refund_method: method, account, reference, payment_details: details });
            onSaved(); onClose();
        } catch (err) { setError(err.response?.data?.detail || 'Unable to record refund payout'); }
        finally { setSaving(false); }
    };
    return <div className="modal-overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="Record refund payout">
        <h3>Record completed refund payout</h3><p>Enter the recipient’s details and the reference from the completed payment.</p>
        <form onSubmit={save}><fieldset disabled={saving} style={{ border: 0, padding: 0 }}>
            <label className="form-group">Recipient account / cash recipient *<input required maxLength={100} value={account} onChange={e => setAccount(e.target.value)} /></label>
            <label className="form-group">Payout mode<select value={method} onChange={e => { setMethod(e.target.value); setDetails({}); setReference(''); }}>{paymentOptions(settings).map(m => <option key={m}>{m}</option>)}</select></label>
            <PaymentDetails method={method} value={details} onChange={setDetails} reference={reference} onReferenceChange={setReference} />
            {error && <p role="alert">{typeof error === 'string' ? error : 'Invalid payout details'}</p>}
            <div className="form-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary-blue" type="submit">{saving ? <ButtonSpinner text="Saving…" /> : 'Record payout'}</button></div>
        </fieldset></form>
    </section></div>;
}
