import '../components/SettingsWorkspace.css';
import WeightSettings from '../components/WeightSettings';
import BusinessDefaults from '../components/BusinessDefaults';
import PaymentAccounts from '../components/PaymentAccounts';
import { formatRecordTime } from '../utils/businessDates';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';
import { CourierLogo, PRESET_CARRIER_LOGOS } from '../components/CourierLogos';
import { Plus, Upload, Image as ImageIcon, Check, X, Sparkles } from 'lucide-react';

export const Settings = ({ settings, onUpdateSettings }) => {
    const { hasPermission, currentUser } = useAuth();
    const canManageSettings = Boolean(currentUser?.isSuperAdmin || currentUser?.roleId === 'super_admin');
    
    const visibleCouriers = settings?.couriers?.length
        ? settings.couriers
        : ['FedEx', 'Aramex', 'DHL', 'Blue Dart', 'Delhivery', 'UPS', 'Sree Maruthi'];
    
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
        : [
            { name: 'ICL', openingBalance: 0.0, currency: 'INR' },
            { name: 'BRV', openingBalance: 0.0, currency: 'INR' }
        ];
        
    const visiblePostpaidProviders = settings?.postpaidProviders?.length
        ? settings.postpaidProviders
        : [
            { name: 'Aramex', deposit: 0.0, paymentTerms: '30 Days' },
            { name: 'Blue Dart', deposit: 0.0, paymentTerms: '30 Days' },
            { name: 'FedEx', deposit: 0.0, paymentTerms: '30 Days' },
            { name: 'DHL Express', deposit: 0.0, paymentTerms: '30 Days' }
        ];

    const [settingsView, setSettingsView] = useState('business');
    const [newCourier, setNewCourier] = useState('');
    const [newCourierLogo, setNewCourierLogo] = useState('');
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [newCenter, setNewCenter] = useState('');
    const [newEmployee, setNewEmployee] = useState('');
    const [newPaidTo, setNewPaidTo] = useState('');
    const [newWalletName, setNewWalletName] = useState('');
    const [newWalletOpening, setNewWalletOpening] = useState('');
    const [newPostpaidName, setNewPostpaidName] = useState('');
    const [newPostpaidDeposit, setNewPostpaidDeposit] = useState('');
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

        const updated = {
            ...settings,
            couriers: updatedCouriers,
            courierLogos: updatedLogos
        };

        if (typeof window !== 'undefined') {
            window.__FMC_SETTINGS__ = updated;
            try {
                localStorage.setItem('fmc_courier_logos', JSON.stringify(updatedLogos));
            } catch {}
        }

        onUpdateSettings(updated);
        setNewCourier('');
        setNewCourierLogo('');
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

        const updatedCouriers = visibleCouriers.filter(c => c !== courierName);
        const updatedLogos = { ...(settings?.courierLogos || {}) };
        delete updatedLogos[courierName];

        const updated = {
            ...settings,
            couriers: updatedCouriers,
            courierLogos: updatedLogos
        };

        if (typeof window !== 'undefined') {
            window.__FMC_SETTINGS__ = updated;
            try {
                localStorage.setItem('fmc_courier_logos', JSON.stringify(updatedLogos));
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
        const exists = visiblePrepaidWallets.some(w => w.name.toLowerCase() === newWalletName.trim().toLowerCase());
        if (exists) return;
        const newWallet = {
            name: newWalletName.trim(),
            openingBalance: Number(newWalletOpening) || 0.0,
            currency: 'INR',
            notes: `${newWalletName.trim()} Prepaid Wallet`
        };
        const updated = {
            ...settings,
            prepaidWallets: [...visiblePrepaidWallets, newWallet]
        };
        onUpdateSettings(updated);
        setNewWalletName('');
        setNewWalletOpening('');
    };

    const handleRemoveWallet = (walletName) => {
        const updated = {
            ...settings,
            prepaidWallets: visiblePrepaidWallets.filter(w => w.name !== walletName)
        };
        onUpdateSettings(updated);
    };

    const handleAddPostpaid = () => {
        if (!newPostpaidName.trim()) return;
        const exists = visiblePostpaidProviders.some(p => p.name.toLowerCase() === newPostpaidName.trim().toLowerCase());
        if (exists) return;
        const newProvider = {
            name: newPostpaidName.trim(),
            deposit: Number(newPostpaidDeposit) || 0.0,
            paymentTerms: '30 Days',
            accountNo: ''
        };
        const updated = {
            ...settings,
            postpaidProviders: [...visiblePostpaidProviders, newProvider]
        };
        onUpdateSettings(updated);
        setNewPostpaidName('');
        setNewPostpaidDeposit('');
    };

    const handleRemovePostpaid = (providerName) => {
        const updated = {
            ...settings,
            postpaidProviders: visiblePostpaidProviders.filter(p => p.name !== providerName)
        };
        onUpdateSettings(updated);
    };

    return (
        <div className="settings-workspace">
            <div className="page-header settings-header" style={{ marginBottom: '18px' }}>
                <div>
                    <h2 className="page-title">Business Settings</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Your business, configured your way. Manage the details your team uses every day.
                    </p>
                </div>
            </div>

            <nav className="settings-nav" aria-label="Settings sections">
                {[['business', 'Business & Billing', 'Company details, GST and defaults'], ['weights', 'Shipment Weights', 'Divisors, billing and courier rules'], ['operations', 'Team & Services', 'Couriers, centers and collectors'], ['payments', 'Payments & Carriers', 'Saved accounts, wallets and deposits'], ['audit', 'Activity', 'Review configuration changes']].filter(([key]) => key !== 'audit' || hasPermission('viewFinancials')).map(([key, title, subtitle]) => (
                    <button key={key} type="button" aria-pressed={settingsView === key} onClick={() => setSettingsView(key)}><strong>{title}</strong><span>{subtitle}</span></button>
                ))}
            </nav>
            <div hidden={settingsView !== 'business'}><BusinessDefaults settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} /></div>
            <div hidden={settingsView !== 'weights'}><WeightSettings settings={settings} onSave={onUpdateSettings} canManage={canManageSettings} /></div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '16px', marginBottom: '22px' }}>
                
                {/* 1. Couriers */}
                <div className="dash-box settings-card" hidden={settingsView !== 'operations'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>📦 Configurable Couriers</h4>
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
                    
                    <div className="settings-chips-scroll" style={{ minHeight: '80px' }}>
                        {visibleCouriers.map(c => (
                            <span 
                                key={c} 
                                className="status-pill in-transit" 
                                style={{ 
                                    fontSize: '12px', 
                                    padding: '5px 10px', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '7px',
                                    border: '1px solid rgba(255,255,255,0.06)'
                                }}
                            >
                                <CourierLogo courier={c} height={14} customLogos={settings?.courierLogos} />
                                <span>{c}</span>
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
                        ))}
                    </div>

                    {/* Quick inline add or modal */}
                    {canManageSettings && !showCourierModal && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                placeholder="Quick courier name..." 
                                value={newCourier} 
                                onChange={e => setNewCourier(e.target.value)} 
                                onKeyDown={e => { if (e.key === 'Enter') handleAddCourier(); }}
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddCourier}>Add</button>
                        </div>
                    )}

                    {/* Add Custom Courier with Logo Form */}
                    {canManageSettings && showCourierModal && (
                        <div style={{ 
                            marginTop: '12px', 
                            padding: '12px', 
                            background: 'var(--card-bg, #0f172a)', 
                            border: '1px solid var(--primary-blue)', 
                            borderRadius: '8px' 
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <strong style={{ fontSize: '12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Sparkles size={13} style={{ color: '#38bdf8' }} /> Add Custom Courier & Logo
                                </strong>
                                <button 
                                    type="button" 
                                    onClick={() => setShowCourierModal(false)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                    <X size={15} />
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

                            {/* Logo Choice: Upload file, URL, or Pick Standard */}
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    Carrier Logo (Upload Image or Pick Preset)
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

                            {/* Live Badge Preview */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                padding: '8px 10px', 
                                background: 'rgba(0,0,0,0.25)', 
                                borderRadius: '6px', 
                                marginBottom: '10px' 
                            }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Badge Preview:</span>
                                <span className="status-pill in-transit" style={{ fontSize: '12px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <CourierLogo courier={newCourier || 'New Courier'} height={14} logoUrl={newCourierLogo} />
                                    <span>{newCourier || 'Courier Name'}</span>
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
                                    <Check size={13} /> Save Carrier
                                </button>
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

                <div className="settings-payment-wrapper" hidden={settingsView !== 'payments'}><PaymentAccounts settings={settings} onUpdateSettings={onUpdateSettings} canManage={canManageSettings} /></div>
                
                {/* 4. Payment Accounts (paid_to) */}
                <div className="dash-box settings-card" hidden={settingsView !== 'payments'}>
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
                <div className="dash-box settings-card" hidden={settingsView !== 'payments'}>
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
                <div className="dash-box settings-card" hidden={settingsView !== 'payments'}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏢 Postpaid Providers & Deposits</h4>
                    <div className="settings-chips-scroll">
                        {visiblePostpaidProviders.map(p => (
                            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--card-bg, #0f172a)', border: '1px solid var(--card-border, #1e293b)', borderRadius: '6px', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CourierLogo courier={p.name} height={14} customLogos={settings?.courierLogos} />
                                    <div>
                                        <strong style={{ fontSize: '12px' }}>{p.name}</strong>
                                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>{p.paymentTerms || '30 Days'}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--emerald)' }}>Deposit: ₹{Number(p.deposit || 0).toLocaleString('en-IN')}</span>
                                    {canManageSettings && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemovePostpaid(p.name)} 
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                cursor: 'pointer', 
                                                color: 'var(--rose)', 
                                                fontSize: '13px', 
                                                fontWeight: 800 
                                            }}
                                            title={`Remove ${p.name}`}
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
                            <input type="text" className="filter-input" style={{ flex: 1, minWidth: '110px' }} placeholder="Provider name" value={newPostpaidName} onChange={e => setNewPostpaidName(e.target.value)} />
                            <input type="number" className="filter-input" style={{ width: '90px' }} placeholder="Deposit ₹" value={newPostpaidDeposit} onChange={e => setNewPostpaidDeposit(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddPostpaid}>Add</button>
                        </div>
                    )}
                </div>

            </div>

            {/* Audit Logs Section */}
            {canViewFinancials && (
                <div className="dash-box settings-card" hidden={settingsView !== 'audit'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>📋 Configuration Activity & Audit Log</h4>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Security trace of system settings changes, carrier modifications, and reconciliation activities.</p>
                        </div>
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>{auditLogs.length} Records</span>
                    </div>

                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                        <table className="data-table" style={{ width: '100%', fontSize: '11.5px' }}>
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
                                {auditLogs.slice(0, 50).map((log, idx) => (
                                    <tr key={log.id || idx}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{formatRecordTime(log.timestamp)}</td>
                                        <td><strong>{log.user_name || 'System'}</strong></td>
                                        <td><span className="status-pill in-transit" style={{ fontSize: '10px' }}>{log.entity_type}</span></td>
                                        <td><strong>{log.action}</strong></td>
                                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {typeof log.after_value === 'object' ? JSON.stringify(log.after_value) : (log.after_value || log.reason || '-')}
                                        </td>
                                    </tr>
                                ))}
                                {!auditLogs.length && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                            No configuration audit events logged yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
