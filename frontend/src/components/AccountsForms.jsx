import { entryKindForCategory } from '../utils/accountEntry';
import { paymentOptions } from '../utils/businessOptions';
import PaymentDetails from './PaymentDetails';
import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Package } from 'lucide-react';
import { apiClient } from '../api/client';
import { businessDate } from '../utils/businessDates';
import { categories, colors } from './accountsHelpers';
import ExpenseCategories from './ExpenseCategories';

export function ExpenseEntry({ settings, accounts, providers = [], profiles = [], center, onSaved, onClose, linkedShipment, onClearShipment }) {
    const [entryKind, setEntryKind] = useState('expense');
    const [provider, setProvider] = useState('');
    const [categoryChoices, setCategoryChoices] = useState(categories);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => {
        let active = true;
        apiClient.getExpenseCategories().then(result => {
            if (active) { setCategoryChoices(result.categories); setCategoriesLoaded(true); }
        }).catch(() => { if (active) setMessage('Unable to load saved categories. Reopen Expense Entry to retry.'); });
        return () => { active = false; };
    }, []);
    const [entry, setEntry] = useState({ date: businessDate(), category: '', vendor: '', amount: '', account: '', payment_mode: '', reference: '', payment_details: {} });
    const [file, setFile] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const [saving, setSaving] = useState(false);
    const fileInput = useRef(null);
    const change = (key, value) => {
        setEntry(old => ({ ...old, [key]: value }));
        if (key === 'category') {
            const nextKind = entryKindForCategory(value);
            setEntryKind(nextKind);
            if (nextKind !== 'provider_payment') { setMessage(''); return; }
            setFile(null);
            if (fileInput.current) fileInput.current.value = '';
            setMessage('Select the courier below. This payment will update their balance.');
        }
    };
    const save = async event => {
        event.preventDefault();
        if (saving) return;
        if (file && file.size > 5 * 1024 * 1024) { setMessage('Bill must be 5 MB or smaller.'); return; }
        setSaving(true); setMessage('');
        let id = savedId;
        try {
            if (!id) {
                const result = await apiClient.recordAccountingEntry({ ...entry, kind: entryKind, provider: entryKind === 'provider_payment' ? provider : null, shipment_id: entryKind === 'expense' ? linkedShipment?.id || null : null, center: center || null, category: entryKind === 'expense' ? entry.category.trim() : null, vendor: entry.vendor.trim(), account: entry.account.trim(), reference: entry.reference.trim(), amount: Number(entry.amount) });
                id = result.id; setSavedId(id);
            }
            if (file) await apiClient.uploadExpenseBill(id, file);
            setEntry(old => ({ ...old, amount: '', reference: '', vendor: '' }));
            setSavedId(null); setFile(null);
            if (fileInput.current) fileInput.current.value = '';
            setMessage(entryKind === 'provider_payment' ? 'Courier payment saved. Courier balances updated.' : 'Expense saved successfully.'); onClearShipment?.(); onSaved();
        } catch (error) {
            const detail = typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Please retry.';
            setMessage(id ? `Expense saved; bill upload failed. ${detail} Retry attaches the bill without recording the expense again.` : `Unable to save expense. ${detail}`);
            if (id) onSaved();
        } finally { setSaving(false); }
    };
    return <aside className="ao-panel ao-entry">
        <header><h3>{entryKind === 'provider_payment' ? 'Courier Payment' : 'Expense Entry'}</h3><span className="ao-quick">Quick Add</span><button aria-label="Close expense entry" disabled={saving} onClick={onClose}><X size={14} /></button></header>
        <form onSubmit={save}>
            <fieldset disabled={saving || !!savedId}>
                <label>Entry Type<select value={entryKind} onChange={e => { setEntryKind(e.target.value); setFile(null); if (fileInput.current) fileInput.current.value = ''; }}><option value="expense">Operating Expense</option><option value="provider_payment">Courier Payment</option></select></label>
                {entryKind === 'provider_payment' && <><p className="ao-note">Reduces the selected courier balance. This is not an operating expense.</p><label>Courier<select required value={provider} onChange={e => setProvider(e.target.value)}><option value="">Select courier</option>{providers.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label></>}
                {linkedShipment && <div className="ao-linked-expense"><span>Shipment: {linkedShipment.awb}</span><button type="button" aria-label="Unlink shipment expense" onClick={onClearShipment}><X size={12} /></button></div>}
                <label>Date<input required type="date" value={entry.date} onChange={e => change('date', e.target.value)} /></label>
                {entryKind === 'expense' && <>
                <label>Expense Category<input id="ao-category" required maxLength={100} list="ao-categories" placeholder="Select Category" value={entry.category} onChange={e => change('category', e.target.value)} /></label>
                <datalist id="ao-categories">{categoryChoices.map(name => <option key={name} value={name} />)}</datalist>
                <label>Vendor / Person<input required maxLength={150} placeholder="Enter name" value={entry.vendor} onChange={e => change('vendor', e.target.value)} /></label>
                </>}
                <label>Amount (₹)<input required type="number" min="0.01" step="0.01" placeholder="0.00" value={entry.amount} onChange={e => change('amount', e.target.value)} /></label>
                <label>Paid From<input required maxLength={100} list="ao-payment-accounts" placeholder="Select Account" value={entry.account} onChange={e => change('account', e.target.value)} /></label>
                <datalist id="ao-payment-accounts">{[...new Set([...accounts, ...profiles.map(profile => profile.name)])].map(name => <option key={name} value={name} />)}</datalist>
                <label>Payment Mode<select aria-label="Payment Mode" required value={entry.payment_mode} onChange={e => change('payment_mode', e.target.value)}><option value="">Select Mode</option>{paymentOptions(settings).map(mode => <option key={mode}>{mode}</option>)}</select></label>
                <PaymentDetails referenceOnly onAccountChange={value => change("account", value)} profiles={profiles} method={entry.payment_mode} value={entry.payment_details} onChange={value => change("payment_details", value)} reference={entry.reference} onReferenceChange={value => change("reference", value)} />
            </fieldset>
            {entryKind === 'expense' && <label>Upload Bill (Optional)<input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} /><small>PDF, PNG or JPEG · Up to 5 MB</small></label>}
            <label>Remarks<textarea disabled={saving || !!savedId} maxLength={150} rows={3} placeholder="Add remarks or bill reference…" value={entry.payment_details.remarks || ''} onChange={e => change('payment_details', { ...entry.payment_details, remarks: e.target.value })} /></label>
            <button className="ao-button primary" disabled={saving}>{saving ? 'Saving…' : savedId ? 'Retry Bill Upload' : entryKind === 'provider_payment' ? 'Save Courier Payment' : 'Save Expense'}</button>
            {message && <p className="ao-form-message" role="status">{message}</p>}
        </form>
        <h3>Expense Categories</h3>
        <ExpenseCategories categories={categoryChoices} disabled={!categoriesLoaded || saving || !!savedId} onSaved={names => { setCategoryChoices(names); setMessage('Expense categories saved.'); onSaved(); }} />
        <div className="ao-categories">{categoryChoices.map((name, index) => <button key={name} disabled={!!savedId || saving} onClick={() => { change('category', name); document.getElementById('ao-category')?.focus(); }}>
            <span style={{ background: colors[index % colors.length] }}><Package size={10} /></span>{name}
        </button>)}</div>
    </aside>;
}
export function TransactionDialog({ settings, accounts, providers, profiles = [], center, onSaved }) {
    const ref = useRef(null);
    const [entry, setEntry] = useState({ kind: 'transfer', date: businessDate(), account: '', transfer_to: '', provider: '', amount: '', payment_mode: paymentOptions(settings)[0], reference: '', payment_details: {} });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const change = (key, value) => setEntry(old => ({ ...old, [key]: value }));
    const submit = async event => {
        event.preventDefault(); if (saving) return;
        setSaving(true); setError('');
        try {
            await apiClient.recordAccountingEntry({ ...entry, amount: Number(entry.amount), center: center || null });
            setEntry(old => ({ ...old, amount: '', reference: '' })); ref.current.close(); onSaved();
        } catch (err) { setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Unable to record transaction. Please retry.'); }
        finally { setSaving(false); }
    };
    return <><button className="ao-button primary" onClick={() => ref.current.showModal()}><Plus size={15} /> Add Transaction</button>
        <dialog className="ao-dialog" ref={ref} aria-labelledby="ao-transaction-title" onCancel={e => { if (saving) e.preventDefault(); }}><header><h3 id="ao-transaction-title">Add Transaction</h3><button aria-label="Close transaction" disabled={saving} onClick={() => ref.current.close()}><X size={18} /></button></header>
            <form onSubmit={submit}>
                <label>Transaction Type<select aria-label="Transaction Type" value={entry.kind} onChange={e => change('kind', e.target.value)}><option value="transfer">Account Transfer</option><option value="provider_payment">Courier Payment</option><option value="provider_deposit">Courier Deposit</option></select></label>
                <label>Date<input required type="date" value={entry.date} onChange={e => change('date', e.target.value)} /></label>
                <label>From Account<select aria-label="From Account" required value={entry.account} onChange={e => change('account', e.target.value)}><option value="">Select account</option>{accounts.map(name => <option key={name}>{name}</option>)}</select></label>
                {entry.kind === 'transfer' ? <label>To Account<select aria-label="To Account" required value={entry.transfer_to} onChange={e => change('transfer_to', e.target.value)}><option value="">Select account</option>{accounts.filter(name => name !== entry.account).map(name => <option key={name}>{name}</option>)}</select></label> : <label>Courier<select aria-label="Courier" required value={entry.provider} onChange={e => change('provider', e.target.value)}><option value="">Select courier</option>{providers.map(p => <option key={p.name}>{p.name}</option>)}</select></label>}
                <label>Amount (₹)<input required type="number" min="0.01" step="0.01" value={entry.amount} onChange={e => change('amount', e.target.value)} /></label>
                <label>Payment Mode<select aria-label="Payment Mode" value={entry.payment_mode} onChange={e => change('payment_mode', e.target.value)}>{paymentOptions(settings).map(mode => <option key={mode}>{mode}</option>)}</select></label>
                <PaymentDetails onAccountChange={value => change("account", value)} profiles={profiles} method={entry.payment_mode} value={entry.payment_details} onChange={value => change("payment_details", value)} reference={entry.reference} onReferenceChange={value => change("reference", value)} />
                {entry.kind === 'transfer' && <p className="ao-muted">This records an internal transfer. It does not initiate a bank payment.</p>}
                {error && <p role="alert">{error}</p>}<button className="ao-button primary" disabled={saving}>{saving ? 'Saving…' : 'Record Transaction'}</button>
            </form>
        </dialog>
    </>;
}
