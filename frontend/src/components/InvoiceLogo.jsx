import { ButtonSpinner } from './LoadingSpinner';
import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check, X } from 'lucide-react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';
import './InvoiceLogo.css';

const designs = [
    ['express-wing', 'Express Wing', 'Blue flight mark'],
    ['global-orbit', 'Global Orbit', 'Teal globe and gold orbit'],
    ['parcel-flight', 'Parcel Flight', 'Orange parcel and flight arrow'],
    ['swift-arrow', 'Swift Arrow', 'Purple express symbol'],
    ['fmc-monogram', 'FMC Signature', 'Navy and gold shield'],
];
const source = id => designs.some(([key]) => key === id) ? `/invoice-logos/${id}.svg` : '/logo_transparent.png';
export default function InvoiceLogo() {
    const { currentUser } = useAuth();
    const canEdit = currentUser?.isSuperAdmin === true || currentUser?.roleId === 'super_admin';
    const [saved, setSaved] = useState('original');
    const [draft, setDraft] = useState('original');
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [loadError, setLoadError] = useState('');
    const [revision, setRevision] = useState(0);
    const trigger = useRef(null);
    const firstChoice = useRef(null);
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        let active = true;
        apiClient.getInvoiceBranding().then(result => {
            if (active) { setSaved(result.logo); setDraft(result.logo); setLoaded(true); setLoadError(''); }
        }).catch(() => { if (active) setLoadError('Could not load the invoice logo. Please retry.'); });
        return () => { active = false; mounted.current = false; };
    }, [revision]);
    useEffect(() => { if (open) firstChoice.current?.focus(); }, [open]);
    const close = () => { setOpen(false); setDraft(saved); setMessage(''); trigger.current?.focus(); };
    const save = async () => {
        if (saving || !loaded) return;
        setSaving(true); setMessage('');
        try {
            const result = await apiClient.updateInvoiceBranding(draft);
            if (!mounted.current) return;
            setSaved(result.logo); setDraft(result.logo); setOpen(false);
            setMessage('Invoice logo saved.'); trigger.current?.focus();
        } catch (error) {
            if (mounted.current) setMessage(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Could not save the logo. Please try again.');
        } finally { if (mounted.current) setSaving(false); }
    };
    return <div className="invoice-logo-customizer">
        <img className="invoice-selected-logo" src={source(saved)} alt="Fly My Cart invoice logo" />
        {loadError && <div className="invoice-logo-controls" role="alert">{loadError}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
        {canEdit && <button ref={trigger} type="button" className="invoice-logo-change invoice-logo-controls" disabled={!loaded || saving} aria-expanded={open} aria-controls="invoice-logo-picker" onClick={() => { setDraft(saved); setMessage(''); setOpen(value => !value); }}><Palette size={12} /> Change invoice logo</button>}
        {canEdit && open && <section id="invoice-logo-picker" className="invoice-logo-picker invoice-logo-controls" aria-label="Choose invoice logo" onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.stopPropagation(); close(); } }}>
            <header><div><h4>Choose invoice logo</h4><p>Applies to all invoice previews and printed PDFs.</p></div><button type="button" aria-label="Close logo picker" onClick={close} disabled={saving}><X size={17} /></button></header>
            <div className="invoice-logo-options" role="group" aria-label="Five logo designs">
                {designs.map(([id, name, description], index) => <button ref={index === 0 ? firstChoice : undefined} key={id} type="button" aria-pressed={draft === id} className={draft === id ? 'selected' : ''} disabled={saving} onClick={() => setDraft(id)}>
                    <img src={source(id)} alt={`${name} logo`} /><span>{name}{draft === id && <Check size={13} />}</span><small>{description}</small>
                </button>)}
            </div>
            <div className="invoice-logo-picker-footer"><button type="button" disabled={saving} onClick={() => setDraft('original')} aria-pressed={draft === 'original'}>Restore original{draft === 'original' ? ' ✓' : ''}</button><div><button type="button" disabled={saving} onClick={close}>Cancel</button><button type="button" className="invoice-logo-save" disabled={saving || draft === saved} onClick={save}>{saving ? <ButtonSpinner text="Saving…" /> : 'Save logo'}</button></div></div>
            {draft === 'original' && <img className="invoice-logo-original-preview" src={source('original')} alt="Original Fly My Cart logo selected" />}
            {message && <p role="status">{message}</p>}
        </section>}
        {!open && message && <small className="invoice-logo-controls" role="status">{message}</small>}
    </div>;
}
