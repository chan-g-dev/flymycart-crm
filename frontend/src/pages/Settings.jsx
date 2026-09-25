import CustomerTypesSettings from '../components/CustomerTypesSettings';
import '../components/SettingsWorkspace.css';
import WeightSettings from '../components/WeightSettings';
import BusinessDefaults from '../components/BusinessDefaults';
import PaymentAccounts from '../components/PaymentAccounts';
import KycStorageSettings from '../components/KycStorageSettings';
import MessageTemplatesSettings from '../components/MessageTemplatesSettings';
import CreditPaymentAlertsSettings from '../components/CreditPaymentAlertsSettings';
import { formatRecordTime } from '../utils/businessDates';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';
import { CourierLogo } from '../components/CourierLogos';
import { Plus, Upload, Check, X, Sparkles, Building2 } from 'lucide-react';
import { getEntityOptions } from '../utils/entityConstants';

export const Settings = ({ settings, onUpdateSettings, activeSubPage }) => {
    const { hasPermission, currentUser } = useAuth();
    const canManageSettings = Boolean(currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin');
    
    const DEFAULT_COURIERS = ['FedEx', 'Aramex', 'DHL', 'Blue Dart', 'Delhivery', 'UPS', 'Sree Maruthi', 'ICL', 'BRV'];
    
    const visibleCouriers = settings?.couriers?.length
        ? settings.couriers
        : DEFAULT_COURIERS;
    
    const visibleCenters = settings?.centers?.length
        ? settings.centers
        : [
            settings?.centerName || 'Main Hub (Bangalore)',
            'Delhi Regional Hub',
            'Mumbai Branch',
            'Hyderabad Hub',
            'Kolkata Center',
        ];
        
    const visibleEmployees = (settings?.employees?.length
        ? settings.employees
        : ['Nawaz', 'Lata', 'Umesh', 'Uma']).map(e => (typeof e === 'string' ? e : e.name));
        
    const visiblePaidToAccounts = settings?.paidToAccounts?.length
        ? settings.paidToAccounts
        : ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];
        
    const visiblePrepaidWallets = settings?.prepaidWallets?.length
        ? settings.prepaidWallets
        : visibleCouriers.map(c => ({ name: c, openingBalance: 0.0, currency: 'INR' }));
        
    const visiblePostpaidProviders = settings?.postpaidProviders?.length
        ? settings.postpaidProviders
        : visibleCouriers.map(c => ({ name: c, deposit: 0.0, paymentTerms: '30 Days' }));

    const PAYMENT_TERMS_OPTIONS = ['7 Days', '15 Days', '30 Days', '45 Days', '60 Days', 'Weekly', 'Bi-Weekly', 'Monthly'];

    const VALID_SETTINGS_VIEWS = ['business', 'credit_alerts', 'messages', 'weights', 'operations', 'payments', 'kyc', 'audit'];
    const resolveSettingsView = (sub) => (sub && VALID_SETTINGS_VIEWS.includes(sub)) ? sub : 'business';

    const settingsView = resolveSettingsView(activeSubPage);
    const [newCourier, setNewCourier] = useState('');
    const [newCourierLogo, setNewCourierLogo] = useState('');
    const [newCourierTrackingUrl, setNewCourierTrackingUrl] = useState('');
    const [newCourierTerms, setNewCourierTerms] = useState('30 Days');
    const [newCourierDeposit, setNewCourierDeposit] = useState('');
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [newCenter, setNewCenter] = useState('');
    const [newEmployee, setNewEmployee] = useState('');
    const [newPaidTo, setNewPaidTo] = useState('');
    const [newWalletName, setNewWalletName] = useState('');
    const [newWalletOpening, setNewWalletOpening] = useState('');
    const [newPostpaidName, setNewPostpaidName] = useState('');
    const [newPostpaidDeposit, setNewPostpaidDeposit] = useState('');
    const [newPostpaidTerms, setNewPostpaidTerms] = useState('30 Days');
    const visibleEntities = getEntityOptions(settings);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityShortName, setNewEntityShortName] = useState('');
    const [newEntityCode, setNewEntityCode] = useState('');
    const [newEntityTagline, setNewEntityTagline] = useState('');
    const [newEntityColor, setNewEntityColor] = useState('#2563eb');
    const [showEntityModal, setShowEntityModal] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [logoUploadError, setLogoUploadError] = useState('');
    
    const fileInputRef = useRef(null);

    const canViewFinancials = hasPermission('viewFinancials');
    useEffect(() => {
        if (canViewFinancials) {
            apiClient.getAuditLogs().then(setAuditLogs).catch(() => {});
        }
    }, [canViewFinancials]);

    const handleLogoFileUpload = (e) => {
        setLogoUploadError('');
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setLogoUploadError('Please select a valid image file (PNG, JPG, SVG, WebP)');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setLogoUploadError('Logo image size should be less than 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            setNewCourierLogo(dataUrl);
        };
        reader.onerror = () => {
            setLogoUploadError('Failed to read image file');
        };
        reader.readAsDataURL(file);
    };

    const handleAddCourier = () => {
        const name = newCourier.trim();
        if (!name) return;
        if (visibleCouriers.some(c => c.toLowerCase() === name.toLowerCase())) {
            alert(`Courier "${name}" already exists.`);
            return;
        }

        const updatedCouriers = [...visibleCouriers, name];
        const updatedLogos = { ...(settings?.courierLogos || {}) };
        if (newCourierLogo) {
            updatedLogos[name] = newCourierLogo;
        }
        const updatedTrackingUrls = { ...(settings?.courierTrackingUrls || {}) };
        if (newCourierTrackingUrl.trim()) {
            updatedTrackingUrls[name] = newCourierTrackingUrl.trim();
        }

        // Automatically create or update postpaid provider entry with default terms & deposit
        const terms = newCourierTerms?.trim() || '30 Days';
        const deposit = Number(newCourierDeposit) || 0.0;
        const existingPostpaid = visiblePostpaidProviders.filter(p => p.name.toLowerCase() !== name.toLowerCase());
        const updatedPostpaid = [...existingPostpaid, { name, deposit, paymentTerms: terms, accountNo: '' }];

        // Automatically ensure prepaid wallet is available
        const existingWallets = visiblePrepaidWallets.filter(w => w.name.toLowerCase() !== name.toLowerCase());
        const updatedWallets = [...existingWallets, { name, openingBalance: 0.0, currency: 'INR' }];

        const updated = {
            ...settings,
            couriers: updatedCouriers,
            courierLogos: updatedLogos,
            courierTrackingUrls: updatedTrackingUrls,
            postpaidProviders: updatedPostpaid,
            prepaidWallets: updatedWallets
        };

        if (typeof window !== 'undefined') {
            window.__FMC_SETTINGS__ = updated;
            try {
                localStorage.setItem('fmc_courier_logos', JSON.stringify(updatedLogos));
                localStorage.setItem('fmc_courier_tracking_urls', JSON.stringify(updatedTrackingUrls));
            } catch {}
        }

        onUpdateSettings(updated);
        setNewCourier('');
        setNewCourierLogo('');
        setNewCourierTrackingUrl('');
        setNewCourierTerms('30 Days');
        setNewCourierDeposit('');
        setShowCourierModal(false);
    };

    const handleRemoveCourier = (courierName) => {
        if (visibleCouriers.length <= 1) {
            alert('At least one courier partner must remain configured.');
            return;
        }
        if (!window.confirm(`Are you sure you want to remove courier partner "${courierName}"?`)) {
            return;
        }

        const updatedCouriers = visibleCouriers.filter(c => c.toLowerCase() !== courierName.toLowerCase());
        const updatedLogos = { ...(settings?.courierLogos || {}) };
        delete updatedLogos[courierName];
        const updatedTrackingUrls = { ...(settings?.courierTrackingUrls || {}) };
        delete updatedTrackingUrls[courierName];

        const updatedPostpaid = (settings?.postpaidProviders || visiblePostpaidProviders).filter(p => p.name.toLowerCase() !== courierName.toLowerCase());
        const updatedWallets = (settings?.prepaidWallets || visiblePrepaidWallets).filter(w => w.name.toLowerCase() !== courierName.toLowerCase());

        const updated = {
            ...settings,
            couriers: updatedCouriers,
            courierLogos: updatedLogos,
            courierTrackingUrls: updatedTrackingUrls,
            postpaidProviders: updatedPostpaid,
            prepaidWallets: updatedWallets
        };

        if (typeof window !== 'undefined') {
            window.__FMC_SETTINGS__ = updated;
            try {
                localStorage.setItem('fmc_courier_logos', JSON.stringify(updatedLogos));
                localStorage.setItem('fmc_courier_tracking_urls', JSON.stringify(updatedTrackingUrls));
            } catch {}
        }

        onUpdateSettings(updated);
    };

    const handleAddCenter = () => {
        const name = newCenter.trim();
        if (!name) return;
        if (visibleCenters.some(c => c.toLowerCase() === name.toLowerCase())) {
            alert(`Center "${name}" already exists.`);
            return;
        }

        const updated = {
            ...settings,
            centers: [...visibleCenters, name]
        };
        onUpdateSettings(updated);
        setNewCenter('');
    };

    const handleRemoveCenter = (centerName) => {
        if (visibleCenters.length <= 1) {
            alert('At least one business hub / center must remain configured.');
            return;
        }
        if (!window.confirm(`Are you sure you want to remove business center "${centerName}"?`)) {
            return;
        }

        const updated = {
            ...settings,
            centers: visibleCenters.filter(c => c !== centerName)
        };
        onUpdateSettings(updated);
    };

    const handleAddEmployee = () => {
        if (!newEmployee.trim() || visibleEmployees.includes(newEmployee.trim())) return;
        const updated = {
            ...settings,
            employees: [...visibleEmployees, newEmployee.trim()]
        };
        onUpdateSettings(updated);
        setNewEmployee('');
    };

    const handleRemoveEmployee = (empName) => {
        if (visibleEmployees.length <= 1) {
            alert('At least one collector / staff member must remain configured.');
            return;
        }
        const updated = {
            ...settings,
            employees: visibleEmployees.filter(e => e !== empName)
        };
        onUpdateSettings(updated);
    };

    const handleAddEntity = () => {
        const name = newEntityName.trim();
        if (!name) return;
        if (visibleEntities.some(e => e.name.toLowerCase() === name.toLowerCase())) {
            alert(`Operating entity "${name}" already exists.`);
            return;
        }
        const shortName = newEntityShortName.trim() || name.split(' ')[0];
        const code = (newEntityCode.trim() || shortName).slice(0, 4).toUpperCase();
        const tagline = newEntityTagline.trim() || `${name} Operations`;
        const color = newEntityColor || '#2563eb';

        const newEntity = {
            id: name,
            name,
            shortName,
            code,
            tagline,
            color,
            accentColor: color,
            bg: '#f8fafc',
            border: '#cbd5e1'
        };

        const currentList = Array.isArray(settings?.operatingEntities) && settings.operatingEntities.length > 0
            ? settings.operatingEntities
            : visibleEntities;

        const updated = {
            ...settings,
            operatingEntities: [...currentList, newEntity]
        };

        onUpdateSettings(updated);
        setNewEntityName('');
        setNewEntityShortName('');
        setNewEntityCode('');
        setNewEntityTagline('');
        setShowEntityModal(false);
    };

    const handleRemoveEntity = (entityId) => {
        if (visibleEntities.length <= 1) {
            alert('At least one operating entity must remain configured.');
            return;
        }
        if (!window.confirm(`Are you sure you want to remove operating entity "${entityId}"?`)) {
            return;
        }

        const currentList = Array.isArray(settings?.operatingEntities) && settings.operatingEntities.length > 0
            ? settings.operatingEntities
            : visibleEntities;

        const updated = {
            ...settings,
            operatingEntities: currentList.filter(e => (e.id || e.name || e) !== entityId)
        };
        onUpdateSettings(updated);
    };

    const handleAddPaidTo = () => {
        if (!newPaidTo.trim() || visiblePaidToAccounts.includes(newPaidTo.trim())) return;
        const updated = {
            ...settings,
            paidToAccounts: [...visiblePaidToAccounts, newPaidTo.trim()]
        };
        onUpdateSettings(updated);
        setNewPaidTo('');
    };

    const handleRemovePaidTo = (accName) => {
        const updated = {
            ...settings,
            paidToAccounts: visiblePaidToAccounts.filter(a => a !== accName)
        };
        onUpdateSettings(updated);
    };

    const handleAddWallet = () => {
        if (!newWalletName.trim()) return;
        const name = newWalletName.trim();
        const exists = visiblePrepaidWallets.some(w => w.name.toLowerCase() === name.toLowerCase());
        if (exists) return;
        const newWallet = {
            name: name,
            openingBalance: Number(newWalletOpening) || 0.0,
            currency: 'INR',
            notes: `${name} Prepaid Wallet`
        };
        const updatedWallets = [...visiblePrepaidWallets, newWallet];
        const updatedCouriers = visibleCouriers.some(c => c.toLowerCase() === name.toLowerCase())
            ? visibleCouriers
            : [...visibleCouriers, name];
        const updatedPostpaid = visiblePostpaidProviders.some(p => p.name.toLowerCase() === name.toLowerCase())
            ? visiblePostpaidProviders
            : [...visiblePostpaidProviders, { name, deposit: 0.0, paymentTerms: '30 Days', accountNo: '' }];

        const updated = {
            ...settings,
            couriers: updatedCouriers,
            prepaidWallets: updatedWallets,
            postpaidProviders: updatedPostpaid
        };
        onUpdateSettings(updated);
        setNewWalletName('');
        setNewWalletOpening('');
    };

    const handleRemoveWallet = (walletName) => {
        const updated = {
            ...settings,
            prepaidWallets: visiblePrepaidWallets.filter(w => w.name.toLowerCase() !== walletName.toLowerCase())
        };
        onUpdateSettings(updated);
    };

    const handleAddPostpaid = () => {
        if (!newPostpaidName.trim()) return;
        const name = newPostpaidName.trim();
        const exists = visiblePostpaidProviders.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) return;
        const newProvider = {
            name: name,
            deposit: Number(newPostpaidDeposit) || 0.0,
            paymentTerms: newPostpaidTerms.trim() || '30 Days',
            accountNo: ''
        };
        const updatedPostpaid = [...visiblePostpaidProviders, newProvider];
        const updatedCouriers = visibleCouriers.some(c => c.toLowerCase() === name.toLowerCase())
            ? visibleCouriers
            : [...visibleCouriers, name];
        const updatedWallets = visiblePrepaidWallets.some(w => w.name.toLowerCase() === name.toLowerCase())
            ? visiblePrepaidWallets
            : [...visiblePrepaidWallets, { name, openingBalance: 0.0, currency: 'INR' }];

        const updated = {
            ...settings,
            couriers: updatedCouriers,
            postpaidProviders: updatedPostpaid,
            prepaidWallets: updatedWallets
        };
        onUpdateSettings(updated);
        setNewPostpaidName('');
        setNewPostpaidDeposit('');
        setNewPostpaidTerms('30 Days');
    };

    const handleUpdatePostpaid = (providerName, updates) => {
        const updated = {
            ...settings,
            postpaidProviders: visiblePostpaidProviders.map(p => 
                p.name === providerName ? { ...p, ...updates } : p
            )
        };
        onUpdateSettings(updated);
    };

    const handleRemovePostpaid = (providerName) => {
        const updated = {
            ...settings,
            postpaidProviders: visiblePostpaidProviders.filter(p => p.name.toLowerCase() !== providerName.toLowerCase())
        };
        onUpdateSettings(updated);
    };

    return (
        <div className="settings-workspace" style={{ paddingTop: '4px' }}>
            <div hidden={settingsView !== 'business'}>
                <BusinessDefaults settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} />
                <CustomerTypesSettings settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} />
            </div>
            <div hidden={settingsView !== 'credit_alerts'}><CreditPaymentAlertsSettings settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} /></div>
            <div hidden={settingsView !== 'messages'}><MessageTemplatesSettings settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} /></div>
            <div hidden={settingsView !== 'weights'}><WeightSettings settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} /></div>
            {canManageSettings && <div hidden={settingsView !== 'kyc'}><KycStorageSettings canManage={canManageSettings} /></div>}

            <div hidden={settingsView !== 'operations'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '16px', marginBottom: '22px' }}>
                
                {/* 1. Couriers */}
                <div className="dash-box settings-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                            <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>📦 Configurable Couriers</h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Couriers & default billing terms</span>
                        </div>
                        {canManageSettings && (
                            <button 
                                type="button" 
                                className="btn btn-primary-blue" 
                                style={{ fontSize: '11px', padding: '4px 10px', height: '28px', gap: '4px' }}
                                onClick={() => setShowCourierModal(true)}
                            >
                                <Plus size={13} /> Add Courier
                            </button>
                        )}
                    </div>
                    
                    <div className="settings-chips-scroll" style={{ minHeight: '100px' }}>
                        {visibleCouriers.map(c => {
                            const carrierPostpaid = visiblePostpaidProviders.find(p => p.name.toLowerCase() === c.toLowerCase());
                            const terms = (carrierPostpaid?.paymentTerms && carrierPostpaid.paymentTerms !== 'Not set') ? carrierPostpaid.paymentTerms : '30 Days';
                            return (
                                <span 
                                    key={c} 
                                    className="status-pill in-transit" 
                                    style={{ 
                                        fontSize: '12px', 
                                        padding: '5px 10px', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '7px',
                                        background: 'var(--card-bg, #0f172a)',
                                        border: '1px solid var(--card-border, #1e293b)'
                                    }}
                                >
                                    <CourierLogo courier={c} height={14} customLogos={settings?.courierLogos} />
                                    <span>{c}</span>
                                    <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-blue)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                        ⏱️ {terms}
                                    </span>
                                    {canManageSettings && visibleCouriers.length > 1 && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveCourier(c)} 
                                            style={{ 
                                                background: 'rgba(239, 68, 68, 0.12)', 
                                                border: 'none', 
                                                borderRadius: '50%',
                                                cursor: 'pointer', 
                                                color: '#ef4444', 
                                                width: '18px',
                                                height: '18px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '13px', 
                                                fontWeight: 800,
                                                marginLeft: '2px',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title={`Remove ${c}`}
                                        >
                                            ×
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </div>

                    {/* Add Custom Courier with Logo & Terms Form */}
                    {canManageSettings && showCourierModal && (
                        <div style={{ 
                            marginTop: '12px', 
                            padding: '14px', 
                            background: 'var(--card-bg, #0f172a)', 
                            border: '1px solid var(--primary-blue)', 
                            borderRadius: '10px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={14} style={{ color: '#38bdf8' }} /> Configure New Courier & Payment Terms
                                </strong>
                                <button 
                                    type="button" 
                                    onClick={() => setShowCourierModal(false)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Carrier / Courier Name *
                                </label>
                                <input 
                                    type="text" 
                                    className="filter-input" 
                                    style={{ width: '100%' }}
                                    placeholder="e.g. DTDC, Trackon, Professional Couriers..." 
                                    value={newCourier} 
                                    onChange={e => setNewCourier(e.target.value)} 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                        Default Payment Terms / Days *
                                    </label>
                                    <select 
                                        className="filter-input" 
                                        style={{ width: '100%', fontSize: '12px' }}
                                        value={newCourierTerms} 
                                        onChange={e => setNewCourierTerms(e.target.value)}
                                    >
                                        {PAYMENT_TERMS_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                        Initial Security Deposit (₹)
                                    </label>
                                    <input 
                                        type="number" 
                                        className="filter-input" 
                                        style={{ width: '100%', fontSize: '12px' }}
                                        placeholder="0" 
                                        value={newCourierDeposit} 
                                        onChange={e => setNewCourierDeposit(e.target.value)} 
                                    />
                                </div>
                            </div>

                            {/* Logo Choice: Upload file, URL, or Pick Standard */}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Carrier Logo (Upload Image or Paste URL)
                                </label>
                                
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleLogoFileUpload}
                                    />
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary"
                                        style={{ fontSize: '11px', padding: '5px 9px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload size={12} /> Upload Logo File
                                    </button>
                                    
                                    <input 
                                        type="text" 
                                        className="filter-input" 
                                        style={{ flex: 1, fontSize: '11px' }}
                                        placeholder="Or paste Logo Image URL (https://...)" 
                                        value={newCourierLogo.startsWith('data:') ? 'Custom Image Uploaded ✓' : newCourierLogo} 
                                        onChange={e => {
                                            if (!e.target.value.startsWith('Custom Image')) {
                                                setNewCourierLogo(e.target.value);
                                            }
                                        }} 
                                    />

                                    {newCourierLogo && (
                                        <button 
                                            type="button"
                                            className="btn btn-outline"
                                            style={{ fontSize: '11px', padding: '4px 6px', color: 'var(--rose)' }}
                                            onClick={() => setNewCourierLogo('')}
                                            title="Clear logo"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {logoUploadError && <div style={{ fontSize: '10.5px', color: 'var(--rose)', marginBottom: '6px' }}>{logoUploadError}</div>}
                            </div>

                            {/* Tracking Link / Portal URL */}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Live Tracking URL / Portal Link (Optional)
                                </label>
                                <input 
                                    type="text" 
                                    className="filter-input" 
                                    style={{ width: '100%', fontSize: '11.5px' }}
                                    placeholder="e.g. https://www.dtdc.in/tracking/{awb} or portal link" 
                                    value={newCourierTrackingUrl} 
                                    onChange={e => setNewCourierTrackingUrl(e.target.value)} 
                                />
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'block', lineHeight: 1.3 }}>
                                    💡 <em>Tip: Include <code>{'{awb}'}</code> in the link to automatically open direct tracking for each shipment.</em>
                                </span>
                            </div>

                            {/* Live Badge Preview */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '8px 12px', 
                                background: 'rgba(0,0,0,0.25)', 
                                borderRadius: '6px', 
                                marginBottom: '12px' 
                            }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Live Badge Preview:</span>
                                <span className="status-pill in-transit" style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <CourierLogo courier={newCourier || 'New Courier'} height={14} logoUrl={newCourierLogo} />
                                    <span style={{ fontWeight: 600 }}>{newCourier || 'Courier Name'}</span>
                                    <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-blue)', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                        ⏱️ {newCourierTerms}
                                    </span>
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    style={{ fontSize: '11px' }}
                                    onClick={() => setShowCourierModal(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-primary-blue" 
                                    style={{ fontSize: '11px' }}
                                    onClick={handleAddCourier}
                                    disabled={!newCourier.trim()}
                                >
                                    <Check size={13} /> Save Carrier & Terms
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 1b. Operating Entities & Divisions (Customizable) */}
                <div className="dash-box settings-card" hidden={settingsView !== 'operations'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={16} color="var(--primary-blue)" /> Operating Entities & Divisions ({visibleEntities.length})
                        </h4>
                        {canManageSettings && !showEntityModal && (
                            <button 
                                type="button" 
                                className="btn btn-outline" 
                                style={{ fontSize: '11px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => setShowEntityModal(true)}
                            >
                                <Plus size={12} /> Add Entity
                            </button>
                        )}
                    </div>
                    
                    <div className="settings-chips-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {visibleEntities.map(ent => (
                            <span 
                                key={ent.id} 
                                style={{ 
                                    fontSize: '12px', 
                                    padding: '6px 12px', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    borderRadius: '6px',
                                    border: `1px solid ${ent.color}`,
                                    background: ent.bg,
                                    color: ent.accentColor,
                                    fontWeight: 600
                                }}
                            >
                                <span>{ent.name}</span>
                                <span style={{ fontSize: '10px', background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                                    {ent.code}
                                </span>
                                {canManageSettings && visibleEntities.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveEntity(ent.id)} 
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.12)', 
                                            border: 'none', 
                                            borderRadius: '50%',
                                            cursor: 'pointer', 
                                            color: '#ef4444', 
                                            width: '18px',
                                            height: '18px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '13px', 
                                            fontWeight: 800,
                                            marginLeft: '2px',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title={`Remove ${ent.name}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>

                    {canManageSettings && showEntityModal && (
                        <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>Register New Operating Entity</strong>
                                <button type="button" onClick={() => setShowEntityModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={14} /></button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.8fr', gap: '8px', marginBottom: '8px' }}>
                                <input 
                                    type="text" 
                                    className="filter-input" 
                                    placeholder="Legal Entity Name (e.g. Apex Express)" 
                                    value={newEntityName} 
                                    onChange={e => setNewEntityName(e.target.value)} 
                                />
                                <input 
                                    type="text" 
                                    className="filter-input" 
                                    placeholder="Short Name (e.g. Apex)" 
                                    value={newEntityShortName} 
                                    onChange={e => setNewEntityShortName(e.target.value)} 
                                />
                                <input 
                                    type="text" 
                                    className="filter-input" 
                                    placeholder="Code (APX)" 
                                    value={newEntityCode} 
                                    onChange={e => setNewEntityCode(e.target.value)} 
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                <input 
                                    type="text" 
                                    className="filter-input" 
                                    placeholder="Tagline / Description (e.g. Air Freight & Domestic)" 
                                    value={newEntityTagline} 
                                    onChange={e => setNewEntityTagline(e.target.value)} 
                                />
                                <select 
                                    className="filter-input" 
                                    value={newEntityColor} 
                                    onChange={e => setNewEntityColor(e.target.value)}
                                >
                                    <option value="#2563eb">🔵 Blue</option>
                                    <option value="#059669">🟢 Emerald</option>
                                    <option value="#7c3aed">🟣 Purple</option>
                                    <option value="#d97706">🟠 Amber</option>
                                    <option value="#e11d48">🔴 Rose</option>
                                    <option value="#0891b2">🔷 Cyan</option>
                                    <option value="#4f46e5">🟪 Indigo</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={() => setShowEntityModal(false)}>Cancel</button>
                                <button type="button" className="btn btn-primary-blue" style={{ fontSize: '11px' }} onClick={handleAddEntity} disabled={!newEntityName.trim()}><Check size={13} /> Save Entity</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Centers */}
                <div className="dash-box settings-card" hidden={settingsView !== 'operations'}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏢 Business Hubs & Centers</h4>
                    <div className="settings-chips-scroll">
                        {visibleCenters.map(c => (
                            <span 
                                key={c} 
                                className="status-pill delivered" 
                                style={{ 
                                    fontSize: '12px', 
                                    padding: '5px 10px', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '6px' 
                                }}
                            >
                                <span>{c}</span>
                                {canManageSettings && visibleCenters.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveCenter(c)} 
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.12)', 
                                            border: 'none', 
                                            borderRadius: '50%',
                                            cursor: 'pointer', 
                                            color: '#ef4444', 
                                            width: '18px',
                                            height: '18px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '13px', 
                                            fontWeight: 800,
                                            marginLeft: '2px',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title={`Remove ${c}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                placeholder="Add business center..." 
                                value={newCenter} 
                                onChange={e => setNewCenter(e.target.value)} 
                                onKeyDown={e => { if (e.key === 'Enter') handleAddCenter(); }}
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddCenter}>Add</button>
                        </div>
                    )}
                </div>

                {/* 3. Staff Collectors & Cash Receivers */}
                <div className="dash-box settings-card" hidden={settingsView !== 'operations'}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>👤 Cash Collectors & Staff Members</h4>
                    <div className="settings-chips-scroll">
                        {visibleEmployees.map(emp => (
                            <span key={emp} className="status-pill delivered" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{emp}</span>
                                {canManageSettings && visibleEmployees.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveEmployee(emp)} 
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.12)', 
                                            border: 'none', 
                                            borderRadius: '50%',
                                            cursor: 'pointer', 
                                            color: '#ef4444', 
                                            width: '18px',
                                            height: '18px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '13px', 
                                            fontWeight: 800,
                                            marginLeft: '2px',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title={`Remove ${emp}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                placeholder="Add staff member / collector..." 
                                value={newEmployee} 
                                onChange={e => setNewEmployee(e.target.value)} 
                                onKeyDown={e => { if (e.key === 'Enter') handleAddEmployee(); }}
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddEmployee}>Add</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Payments & Carriers Section */}
            <div hidden={settingsView !== 'payments'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '16px', marginBottom: '22px' }}>
                <div className="settings-payment-wrapper" style={{ gridColumn: '1 / -1' }}>
                    <PaymentAccounts settings={settings} onUpdateSettings={onUpdateSettings} canManage={canManageSettings} />
                </div>
                
                {/* 4. Payment Accounts (paid_to) */}
                <div className="dash-box settings-card">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏦 Payment Accounts & Channels (paid_to)</h4>
                    <div className="settings-chips-scroll">
                        {visiblePaidToAccounts.map(acc => (
                            <span key={acc} className="status-pill in-transit" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>{acc}</span>
                                {canManageSettings && visiblePaidToAccounts.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemovePaidTo(acc)} 
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.12)', 
                                            border: 'none', 
                                            borderRadius: '50%',
                                            cursor: 'pointer', 
                                            color: '#ef4444', 
                                            width: '18px',
                                            height: '18px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '13px', 
                                            fontWeight: 800,
                                            marginLeft: '2px',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title={`Remove ${acc}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                placeholder="Add payment account / UPI..." 
                                value={newPaidTo} 
                                onChange={e => setNewPaidTo(e.target.value)} 
                                onKeyDown={e => { if (e.key === 'Enter') handleAddPaidTo(); }}
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddPaidTo}>Add</button>
                        </div>
                    )}
                </div>

                {/* 5. Prepaid Wallets */}
                <div className="dash-box settings-card">
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>💳 Prepaid Partner Wallets</h4>
                    <div className="settings-chips-scroll">
                        {visiblePrepaidWallets.map(w => (
                            <div key={w.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--card-bg, #0f172a)', border: '1px solid var(--card-border, #1e293b)', borderRadius: '6px', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CourierLogo courier={w.name} height={14} customLogos={settings?.courierLogos} />
                                    <strong style={{ fontSize: '12px' }}>{w.name}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--primary-blue)' }}>₹{Number(w.openingBalance || 0).toLocaleString('en-IN')}</span>
                                    {canManageSettings && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveWallet(w.name)} 
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                cursor: 'pointer', 
                                                color: 'var(--rose)', 
                                                fontSize: '13px', 
                                                fontWeight: 800 
                                            }}
                                            title={`Remove ${w.name}`}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', flexWrap: 'wrap' }}>
                            <input type="text" className="filter-input" style={{ flex: 1, minWidth: '110px' }} placeholder="Wallet name (e.g. DTDC)" value={newWalletName} onChange={e => setNewWalletName(e.target.value)} />
                            <input type="number" className="filter-input" style={{ width: '90px' }} placeholder="Opening ₹" value={newWalletOpening} onChange={e => setNewWalletOpening(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddWallet}>Add</button>
                        </div>
                    )}
                </div>

                {/* 6. Postpaid Providers */}
                <div className="dash-box settings-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>🏢 Postpaid Providers & Terms</h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customize billing & payment cycles</span>
                    </div>
                    <div className="settings-chips-scroll">
                        {visiblePostpaidProviders.map(p => {
                            const currentTerms = (p.paymentTerms && p.paymentTerms !== 'Not set') ? p.paymentTerms : '30 Days';
                            return (
                                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--card-bg, #0f172a)', border: '1px solid var(--card-border, #1e293b)', borderRadius: '6px', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
                                        <CourierLogo courier={p.name} height={14} customLogos={settings?.courierLogos} />
                                        <strong style={{ fontSize: '12px' }}>{p.name}</strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                        {canManageSettings ? (
                                            <select 
                                                className="filter-input" 
                                                style={{ padding: '3px 6px', fontSize: '11px', height: '26px', background: 'var(--bg-app)', border: '1px solid var(--card-border)', borderRadius: '4px', color: 'var(--text-main)' }}
                                                value={currentTerms} 
                                                onChange={e => handleUpdatePostpaid(p.name, { paymentTerms: e.target.value })}
                                                title={`Change payment terms for ${p.name}`}
                                            >
                                                {PAYMENT_TERMS_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="status-pill in-transit" style={{ fontSize: '10.5px' }}>{currentTerms}</span>
                                        )}
                                        <span style={{ fontSize: '11px', color: 'var(--emerald)', whiteSpace: 'nowrap' }}>
                                            Deposit: ₹{Number(p.deposit || 0).toLocaleString('en-IN')}
                                        </span>
                                        {canManageSettings && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemovePostpaid(p.name)} 
                                                style={{ 
                                                    background: 'none', 
                                                    border: 'none', 
                                                    cursor: 'pointer', 
                                                    color: 'var(--rose)', 
                                                    fontSize: '14px', 
                                                    fontWeight: 800,
                                                    padding: '0 4px'
                                                }}
                                                title={`Remove ${p.name}`}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', flexWrap: 'wrap', paddingTop: '8px' }}>
                            <input type="text" className="filter-input" style={{ flex: 1, minWidth: '100px' }} placeholder="Provider name" value={newPostpaidName} onChange={e => setNewPostpaidName(e.target.value)} />
                            <input type="number" className="filter-input" style={{ width: '85px' }} placeholder="Deposit ₹" value={newPostpaidDeposit} onChange={e => setNewPostpaidDeposit(e.target.value)} />
                            <select 
                                className="filter-input" 
                                style={{ width: '95px', fontSize: '11.5px' }} 
                                value={newPostpaidTerms} 
                                onChange={e => setNewPostpaidTerms(e.target.value)}
                                title="Default payment terms"
                            >
                                {PAYMENT_TERMS_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <button className="btn btn-primary-blue" style={{ whiteSpace: 'nowrap' }} onClick={handleAddPostpaid}>+ Add</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Logs Section */}
            {canViewFinancials && (
                <div hidden={settingsView !== 'audit'} style={{ width: '100%', marginBottom: '22px' }}>
                    <div className="dash-box settings-card" style={{ width: '100%', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div>
                                <h4 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>📋 Configuration Activity & Audit Log</h4>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Security trace of system settings changes, carrier modifications, and reconciliation activities.</p>
                            </div>
                            <span className="badge badge-info" style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px' }}>{auditLogs.length} Records</span>
                        </div>

                        <div style={{ overflowX: 'auto', maxHeight: '550px', overflowY: 'auto' }}>
                            <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>User</th>
                                        <th>Entity</th>
                                        <th>Action</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.slice(0, 100).map((log, idx) => (
                                        <tr key={log.id || idx}>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{formatRecordTime(log.timestamp)}</td>
                                            <td><strong>{log.user_name || 'System'}</strong></td>
                                            <td><span className="status-pill in-transit" style={{ fontSize: '11px' }}>{log.entity_type}</span></td>
                                            <td><strong>{log.action}</strong></td>
                                            <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {typeof log.after_value === 'object' ? JSON.stringify(log.after_value) : (log.after_value || log.reason || '-')}
                                            </td>
                                        </tr>
                                    ))}
                                    {!auditLogs.length && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                                No configuration audit events logged yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
