import { ButtonSpinner } from './LoadingSpinner';
import React, { useState } from 'react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';

export default function ExpenseCategories({ categories, onSaved, disabled }) {
    const { currentUser } = useAuth();
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    if (!currentUser?.isSuperAdmin && currentUser?.roleId !== 'super_admin') return null;
    const save = async () => {
        const names = draft.map(name => name.trim());
        if (names.some(name => !name)) { setError('Enter a name for every category or remove the empty row.'); return; }
        if (new Set(names.map(name => name.toLowerCase())).size !== names.length) { setError('Category names must be unique.'); return; }
        setSaving(true); setError('');
        try {
            const result = await apiClient.updateExpenseCategories(names);
            onSaved(result.categories); setDraft(null);
        } catch (err) { setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Unable to save categories. Please retry.'); }
        finally { setSaving(false); }
    };
    return <div className="ao-category-editor">
        {draft === null ? <button type="button" className="ao-button" disabled={disabled} onClick={() => { setDraft([...categories]); setError(''); }}>Customize categories</button> : <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={saving || disabled}>
            <p>Add, rename or remove choices. Existing expenses keep their recorded category.</p>
            {draft.map((name, index) => <div key={index} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input aria-label={`Category ${index + 1}`} maxLength={100} value={name} onChange={e => setDraft(old => old.map((value, i) => i === index ? e.target.value : value))} />
                <button type="button" aria-label={`Remove category ${index + 1}`} onClick={() => setDraft(old => old.filter((_, i) => i !== index))}>Remove</button>
            </div>)}
            <button type="button" className="ao-button" disabled={draft.length >= 100} onClick={() => setDraft(old => [...old, ''])}>+ Add category</button>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="button" className="ao-button primary" onClick={save}>{saving ? <ButtonSpinner text="Saving..." /> : 'Save categories'}</button>
                <button type="button" className="ao-button" onClick={() => { setDraft(null); setError(''); }}>Cancel</button>
            </div>
        </fieldset>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
