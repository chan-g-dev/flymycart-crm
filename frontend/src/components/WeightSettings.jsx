import { ButtonSpinner } from './LoadingSpinner';
import React, { useState } from 'react';
import { defaultWeightRule, weightSettings } from '../utils/weightRules';

export default function WeightSettings({ settings, onSave, canManage }) {
    const [draft, setDraft] = useState(null);
    const form = draft?.settings === settings ? draft.form : weightSettings(settings);
    const setForm = form => setDraft({ settings, form });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const editRule = (key, index, name, value) => setForm(key === 'overrides'
        ? { ...form, overrides: form.overrides.map((rule, i) => i === index ? { ...rule, [name]: value } : rule) }
        : { ...form, [key]: { ...form[key], [name]: value } });
    const renderRule = (rule, key, index = 0) => {
        const set = (name, value) => editRule(key, index, name, value);
        const number = (name, label, min, max) => <label>{label}<input className="filter-input" type="number" required min={min} max={max} step="0.01" value={rule[name]} onChange={e => set(name, e.target.value === '' ? '' : Number(e.target.value))} /></label>;
        const select = (name, label, options) => <label>{label}<select className="filter-input" value={rule[name]} onChange={e => set(name, e.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
        return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {key === 'overrides' && <>
                <label>Courier (blank = any)<input className="filter-input" list="weight-couriers" maxLength={100} value={rule.courier} onChange={e => set('courier', e.target.value)} /></label>
                <label>Service (blank = any)<input className="filter-input" list="weight-services" maxLength={100} value={rule.service} onChange={e => set('service', e.target.value)} /></label>
                {select('destination', 'Shipment type', [['Any', 'Any'], ['Domestic', 'Domestic'], ['International', 'International']])}
            </>}
            {number('divisor', 'Volumetric divisor (cm³/kg)', 0.01, 1000000)}
            {select('basis', 'Chargeable weight', [['higher', 'Higher of actual / volumetric'], ['actual', 'Actual weight only'], ['volumetric', 'Volumetric weight only']])}
            {select('aggregation', 'Multiple boxes', [['shipment', 'Compare shipment totals'], ['box', 'Calculate each box, then sum']])}
            {number('rounding', 'Round up to (kg; 0 = no step)', 0, 1000)}
            {number('minimum', 'Minimum billable weight (kg)', 0, 100000)}
        </div>;
    };
    return <form className="dash-box settings-card" onSubmit={async e => {
        e.preventDefault(); setSaving(true); setMessage('');
        try { await onSave({ ...settings, weightRules: form }); setDraft(null); setMessage('Shipment weight rules saved.'); }
        catch (error) { setMessage(error.message || 'Could not save weight rules.'); }
        finally { setSaving(false); }
    }}>
        <h3>Shipment Weight Rules</h3>
        <p>Volumetric kg = length × width × height in centimetres ÷ divisor. Weights are entered in kg; inches are converted to cm.</p>
        <p>Minimum weight is applied before rounding up. With “each box”, both apply to each box. Final totals use 2 decimal places. Existing shipments keep their recorded weights.</p>
        <fieldset disabled={!canManage || saving} style={{ border: 0, padding: 0, minWidth: 0 }}>
            <h4>Default services</h4>{renderRule(form.express, 'express')}
            <h4>Cargo default (courier or service contains “cargo”)</h4>{renderRule(form.cargo, 'cargo')}
            <h4>Courier and service overrides</h4>
            <p>Names match exactly, ignoring case. The rule with the most matching criteria wins; ties use the first rule below. Leave a name blank to match any.</p>
            <datalist id="weight-couriers">{(settings?.couriers || []).map(name => <option key={name} value={name} />)}</datalist>
            <datalist id="weight-services">{(settings?.serviceTypes || []).map(name => <option key={name} value={name} />)}</datalist>
            {form.overrides.map((rule, i) => <fieldset key={i} style={{ marginBottom: 16, padding: 12 }}>
                <legend>Override {i + 1}</legend>{renderRule(rule, 'overrides', i)}
                <button type="button" className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setForm({ ...form, overrides: form.overrides.filter((_, n) => n !== i) })}>Remove override</button>
            </fieldset>)}
            {canManage && <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn btn-outline" disabled={form.overrides.length >= 100} onClick={() => setForm({ ...form, overrides: [...form.overrides, { ...defaultWeightRule, courier: '', service: '', destination: 'Any' }] })}>Add override</button>
                <button type="submit" className="btn btn-primary-blue">{saving ? <ButtonSpinner text="Saving..." /> : 'Save Weight Rules'}</button>
            </div>}
        </fieldset>
        {message && <p role="status">{message}</p>}
    </form>;
}
