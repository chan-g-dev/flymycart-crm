import React from 'react';

function paymentKind(method = '') {
    const value = method.toLowerCase().trim();
    if (['upi', 'phonepe', 'google pay', 'gpay', 'paytm', 'office qr', 'qr'].includes(value)) return 'UPI';
    if (['bank', 'bank transfer', 'neft', 'rtgs', 'imps'].includes(value)) return 'Bank Transfer';
    return method;
}

export default function PaymentDetails({ method, value = {}, onChange, reference, onReferenceChange, profiles = [], profile = false, onAccountChange }) {
    const kind = paymentKind(method);
    const change = (key, text) => onChange({ ...value, [key]: text });
    const field = (key, label, pattern, placeholder) => <label className="form-group" key={key}>{label} *
        <input required maxLength={150} value={value[key] || ''} pattern={pattern} placeholder={placeholder} onChange={e => change(key, e.target.value)} />
    </label>;
    return <div className="payment-details" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10, padding: 12, border: '1px solid var(--border-color, #dbe2ea)', borderRadius: 8 }}>
        {!profile && profiles.length > 0 && <label className="form-group">Use saved account details
            <select key={kind} defaultValue="" onChange={e => { const p = profiles.find(p => p.name === e.target.value); if (p) { onChange({ ...p.details }); onAccountChange?.(p.name); } }}>
                <option value="">Enter details manually</option>
                {profiles.filter(p => paymentKind(p.method) === kind).map(p => <option key={p.name} value={p.name}>{p.name} — {p.details.account_holder}</option>)}
            </select>
        </label>}
        <label className="form-group">Account ownership *<select aria-label="Account ownership *" required value={value.owner_type || ''} onChange={e => change('owner_type', e.target.value)}>
            <option value="">Select ownership</option>{['Business', 'Proprietor', 'Individual'].map(type => <option key={type}>{type}</option>)}
        </select></label>
        {field('account_holder', kind === 'Cash' ? 'Cash custodian / recipient name' : 'Account holder / owner name', '.*\\S.*')}
        {kind === 'UPI' && field('upi_id', 'UPI ID', '[A-Za-z0-9._\\-]{2,256}@[A-Za-z][A-Za-z0-9.\\-]{1,63}', 'name@bank')}
        {['Bank Transfer', 'Cheque'].includes(kind) && <>
            {field('bank_name', 'Bank name', '.*\\S.*')}
            {field('account_number', 'Bank account number', '[0-9]{6,34}')}
            {field('ifsc', 'IFSC', '[A-Za-z]{4}0[A-Za-z0-9]{6}', 'HDFC0001234')}
        </>}
        {kind === 'Card' && field('card_last4', 'Card last four digits', '[0-9]{4}')}
        {kind === 'Other' && field('other_details', 'Payment method and destination', '.*\\S.*')}
        {!profile && onReferenceChange && <label className="form-group">{kind === 'Cash' ? 'Receipt reference (optional)' : kind === 'Cheque' ? 'Cheque number *' : 'Transaction ID / UTR / reference *'}
            <input required={kind !== 'Cash'} minLength={kind === 'Cash' ? undefined : 4} maxLength={100} pattern={kind === 'Cheque' ? '[0-9]{6}' : undefined} value={reference || ''} onChange={e => onReferenceChange(e.target.value)} />
        </label>}
    </div>;
}
