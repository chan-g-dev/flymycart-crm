import { ButtonSpinner } from './LoadingSpinner';
import React, { useEffect, useRef, useState } from 'react';
import { Palette, Check, X } from 'lucide-react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';
import './InvoiceLogo.css';

const designs = [
    ['original', 'Default logo', 'Original Fly My Cart logo'],
    ['express-wing', 'Express Wing', 'Blue flight mark'],
    ['global-orbit', 'Global Orbit', 'Teal globe and gold orbit'],
    ['parcel-flight', 'Parcel Flight', 'Orange parcel and flight arrow'],
    ['swift-arrow', 'Swift Arrow', 'Purple express symbol'],
    ['fmc-monogram', 'FMC Signature', 'Navy and gold shield'],
];
const source = id => /^data:image\/(png|jpeg|webp);base64,/.test(id) ? id : designs.some(([key]) => key === id && key !== 'original') ? `/invoice-logos/${id}.svg` : '/logo_transparent.png';
export default function InvoiceLogo({ settingsMode = false }) {
    const { currentUser } = useAuth();
    const canEdit = currentUser?.isSuperAdmin === true || currentUser?.roleId === 'super_admin';
    const [saved, setSaved] = useState('original');
    const [draft, setDraft] = useState('original');
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reading, setReading] = useState(false);
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
    useEffect(() => {
        const refresh = () => setRevision(value => value + 1);
        window.addEventListener('fmc-invoice-branding', refresh);
        return () => window.removeEventListener('fmc-invoice-branding', refresh);
    }, []);
    const upload = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setMessage('');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 512 * 1024) {
            setMessage('Choose a PNG, JPG or WebP image up to 512 KB.');
            return;
        }
        setReading(true);
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const image = new Image();
            image.src = data;
            await image.decode();
            if (mounted.current) setDraft(data);
        } catch {
            if (mounted.current) setMessage('This image could not be opened. Please choose another file.');
        } finally { if (mounted.current) setReading(false); }
    };
    const close = () => { setOpen(false); setDraft(saved); setMessage(''); trigger.current?.focus(); };
    const save = async () => {
        if (saving || reading || !loaded) return;
        setSaving(true); setMessage('');
        try {
            const result = await apiClient.updateInvoiceBranding(draft);
            if (!mounted.current) return;
            setSaved(result.logo); setDraft(result.logo); setOpen(false);
            setMessage('Invoice logo saved.'); trigger.current?.focus();
            window.dispatchEvent(new Event('fmc-invoice-branding'));
        } catch (error) {
            if (mounted.current) setMessage(typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Could not save the logo. Please try again.');
        } finally { if (mounted.current) setSaving(false); }
    };
    const pickerVisible = settingsMode || open;
    return <div className={`invoice-logo-customizer${settingsMode ? ' invoice-logo-settings dash-box' : ''}`}>
        {settingsMode && <div><h3>Default invoice logo</h3><p>Choose a design or upload your business logo. Your saved choice appears on all invoice previews and printed PDFs.</p></div>}
        <img className="invoice-selected-logo" src={source(saved)} alt="Fly My Cart invoice logo" />
        {loadError && <div className="invoice-logo-controls" role="alert">{loadError}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
        {canEdit && !settingsMode && <button ref={trigger} type="button" className="invoice-logo-change invoice-logo-controls" disabled={!loaded || saving || reading} aria-expanded={open} aria-controls="invoice-logo-picker" onClick={() => { setDraft(saved); setMessage(''); setOpen(value => !value); }}><Palette size={12} /> Change invoice logo</button>}
        {canEdit && pickerVisible && <section id={settingsMode ? 'settings-invoice-logo-picker' : 'invoice-logo-picker'} className="invoice-logo-picker invoice-logo-controls" aria-label="Choose invoice logo" onKeyDown={event => { if (event.key === 'Escape' && !saving && !reading && !settingsMode) { event.stopPropagation(); close(); } }}>
            <header><div><h4>Choose invoice logo</h4><p>Select the default logo, another design, or your own image.</p></div>{!settingsMode && <button type="button" aria-label="Close logo picker" onClick={close} disabled={saving || reading}><X size={17} /></button>}</header>
            <div className="invoice-logo-options" role="group" aria-label="Invoice logo designs">
                {designs.map(([id, name, description], index) => <button ref={index === 0 ? firstChoice : undefined} key={id} type="button" aria-pressed={draft === id} className={draft === id ? 'selected' : ''} disabled={!loaded || saving || reading} onClick={() => setDraft(id)}>
                    <img src={source(id)} alt={`${name} logo`} /><span>{name}{draft === id && <Check size={13} />}</span><small>{description}</small>
                </button>)}
            </div>
            <div className="invoice-logo-upload">
                <label>Upload custom logo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!loaded || saving || reading} onChange={upload} /></label>
                <small>PNG, JPG or WebP, up to 512 KB. A transparent background works best.</small>
                {reading && <p role="status">Reading image...</p>}
                {draft.startsWith('data:') && <div><img className="invoice-logo-custom-preview" src={source(draft)} alt="Custom invoice logo preview" /><small>Custom image selected</small></div>}
            </div>
            <div className="invoice-logo-picker-footer"><button type="button" disabled={!loaded || saving || reading} onClick={() => setDraft('original')} aria-pressed={draft === 'original'}>Restore default</button><div><button type="button" disabled={saving || reading} onClick={close}>{settingsMode ? 'Discard changes' : 'Cancel'}</button><button type="button" className="invoice-logo-save" disabled={!loaded || saving || reading || draft === saved} onClick={save}>{saving ? <ButtonSpinner text="Saving..." /> : 'Save default logo'}</button></div></div>
            {draft === 'original' && <img className="invoice-logo-original-preview" src={source('original')} alt="Original Fly My Cart logo selected" />}
            {message && <p role="status">{message}</p>}
        </section>}
        {!pickerVisible && message && <small className="invoice-logo-controls" role="status">{message}</small>}
    </div>;
}
