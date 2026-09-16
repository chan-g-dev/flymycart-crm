import { paymentOptions, supportedPaymentMethods } from '../utils/businessOptions';
import React, { useEffect, useState } from 'react';
const defaults = { companyName: 'Fly My Cart Logistics', centerAddress: '', gstin: '', companyPhone: '', companyEmail: '', invoicePrefix: 'FMC-', defaultGstRate: 18, gstRates: [0, 5, 12, 14, 18], serviceTypes: ['International Priority', 'Express', 'Economy', 'Cargo'], defaultB2BCreditLimit: 100000, defaultB2BCreditDays: 30 };
export default function BusinessDefaults({ settings, onSave, canManage }) {
    const makeForm = () => ({...defaults, ...settings, paymentMethods: paymentOptions(settings), gstRates: (settings?.gstRates || defaults.gstRates).join(', '), serviceTypes: (settings?.serviceTypes || defaults.serviceTypes).join(', ')});
    const [form, setForm] = useState(makeForm);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => { setForm(makeForm()); }, [settings]);
    const fields = [
        ['companyName', 'Invoice business name', 'text'], ['centerAddress', 'Invoice business address', 'text'],
        ['gstin', 'GSTIN', 'text'], ['companyPhone', 'Business phone', 'text'], ['companyEmail', 'Business email', 'email'],
        ['invoicePrefix', 'New invoice number prefix', 'text'], ['defaultGstRate', 'Default GST rate (%)', 'number'],
        ['gstRates', 'GST choices (comma separated)', 'text'], ['serviceTypes', 'Services (comma separated)', 'text'],
        ['defaultB2BCreditLimit', 'Default B2B credit limit', 'number'], ['defaultB2BCreditDays', 'Default B2B credit period (days)', 'number'],
    ];
    const save = async event => {
        event.preventDefault(); setSaving(true); setMessage('');
        try {
            const values = Object.fromEntries(fields.map(([key]) => [key, form[key]]));
            values.paymentMethods = form.paymentMethods;
            values.gstRates = form.gstRates.split(',').map(value => Number(value.trim()));
            values.serviceTypes = form.serviceTypes.split(',').map(value => value.trim()).filter(Boolean);
            for (const key of ['defaultGstRate', 'defaultB2BCreditLimit', 'defaultB2BCreditDays']) values[key] = Number(values[key]);
            await onSave({...settings, ...values}); setMessage('Business defaults saved. New bookings and clients will use these values.');
        } catch (error) { const detail = error.response?.data?.detail; setMessage(typeof detail === 'string' ? detail : 'Unable to save. Check the entered values and try again.'); }
        finally { setSaving(false); }
    };
    return <form className="dash-box" onSubmit={save} style={{marginBottom: 20}}>
        <h3>Business, Billing & Credit Defaults</h3>
        <p>Set defaults for new transactions. Existing invoice amounts, invoice numbers and client credit terms are preserved. Invoice previews use the current business contact details.</p>
        <fieldset disabled={!canManage || saving} style={{border: 0, padding: 0}}>
            <div className="form-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))'}}>
                {fields.map(([key, label, type]) => <label key={key} className="form-group">{label}<input type={type} value={form[key] ?? ''} required={!['gstin','centerAddress','companyPhone','companyEmail'].includes(key)} min={key === 'defaultB2BCreditDays' ? 1 : 0} max={key === 'defaultB2BCreditDays' ? 365 : key === 'defaultGstRate' ? 100 : undefined} step={key === 'defaultB2BCreditDays' ? 1 : 'any'} onChange={event => setForm({...form, [key]: event.target.value})} /></label>)}
            </div>
            <fieldset style={{marginBottom: 12}}><legend>Enabled Payment Methods</legend>
                {supportedPaymentMethods.map(method => <label key={method} style={{display: 'inline-flex', gap: 6, margin: 8}}><input type="checkbox" checked={form.paymentMethods.includes(method)} onChange={e => setForm({...form, paymentMethods: e.target.checked ? [...form.paymentMethods, method] : form.paymentMethods.filter(value => value !== method)})} />{method}</label>)}
            </fieldset>
            {canManage && <button className="btn btn-primary-blue" type="submit">{saving ? 'Saving...' : 'Save Business Defaults'}</button>}
        </fieldset>
        {message && <p role="status">{message}</p>}
    </form>;
}
