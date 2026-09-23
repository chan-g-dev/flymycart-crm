import React, { useState } from 'react';
import { customerTypeOptions } from '../utils/customerTypes';
import { ButtonSpinner } from './LoadingSpinner';

export default function CustomerTypesSettings({ settings, onSave, canManage }) {
    const types = customerTypeOptions(settings);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const add = async event => {
        event.preventDefault();
        if (saving || !canManage || !settings) return;
        const value = name.trim();
        setError(''); setMessage('');
        if (!value || value.length > 50) { setError('Enter a customer type with 1–50 characters.'); return; }
        if (types.some(type => type.toLowerCase() === value.toLowerCase())) { setError('This customer type already exists.'); return; }
        setSaving(true);
        try {
            await onSave({ ...settings, customerTypes: [...types, value] });
            setName(''); setMessage(`${value} is now available for customers and shipments.`);
        } catch (failure) {
            setError(typeof failure.response?.data?.detail === 'string' ? failure.response.data.detail : 'Unable to save customer type. Please try again.');
        } finally { setSaving(false); }
    };
    return <section className="dash-box settings-card" style={{ marginBottom: 20 }}>
        <h3>Customer Types</h3>
        <p>Add categories for your business. Saved types appear in customer registration, shipment bookings and customer filters. B2B retains its corporate credit features.</p>
        <ul aria-label="Available customer types" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0 }}>
            {types.map(type => <li className="pill-stat" key={type}>{type}</li>)}
        </ul>
        {canManage && <form onSubmit={add}>
            <fieldset disabled={saving || !settings || types.length >= 100} style={{ border: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
                <label className="form-group" style={{ flex: '1 1 220px', minWidth: 0 }}>New customer type
                    <input value={name} onChange={event => setName(event.target.value)} required maxLength={50} placeholder="e.g. Distributor or Marketplace" />
                </label>
                <button className="btn btn-primary-blue" type="submit">{saving ? <ButtonSpinner text="Saving customer type..." /> : 'Add Customer Type'}</button>
            </fieldset>
            {types.length >= 100 && <p>Up to 100 customer types are supported.</p>}
        </form>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
    </section>;
}
