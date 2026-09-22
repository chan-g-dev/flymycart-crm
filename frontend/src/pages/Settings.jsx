import '../components/SettingsWorkspace.css';
import WeightSettings from '../components/WeightSettings';
import BusinessDefaults from '../components/BusinessDefaults';
import PaymentAccounts from '../components/PaymentAccounts';
import { formatRecordTime } from '../utils/businessDates';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';
import { CourierLogo } from '../components/CourierLogos';

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
    const [newCenter, setNewCenter] = useState('');
    const [newEmployee, setNewEmployee] = useState('');
    const [newPaidTo, setNewPaidTo] = useState('');
    const [newWalletName, setNewWalletName] = useState('');
    const [newWalletOpening, setNewWalletOpening] = useState('');
    const [newPostpaidName, setNewPostpaidName] = useState('');
    const [newPostpaidDeposit, setNewPostpaidDeposit] = useState('');
    const [auditLogs, setAuditLogs] = useState([]);

    const canViewFinancials = hasPermission('viewFinancials');
    useEffect(() => {
        if (canViewFinancials) {
            apiClient.getAuditLogs().then(setAuditLogs).catch(() => {});
        }
    }, [canViewFinancials]);

    const handleAddCourier = () => {
        if (!newCourier.trim()) return;
        const updated = {
            ...settings,
            couriers: [...visibleCouriers, newCourier.trim()]
        };
        onUpdateSettings(updated);
        setNewCourier('');
    };

    const handleAddCenter = () => {
        if (!newCenter.trim()) return;
        const updated = {
            ...settings,
            centers: [...visibleCenters, newCenter.trim()]
        };
        onUpdateSettings(updated);
        setNewCenter('');
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
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>📦 Configurable Couriers</h4>
                    <div className="settings-chips-scroll">
                        {visibleCouriers.map(c => (
                            <span key={c} className="status-pill in-transit" style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={c} height={14} />
                                <span>{c}</span>
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input type="text" className="filter-input" placeholder="Add custom courier..." value={newCourier} onChange={e => setNewCourier(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddCourier}>Add</button>
                        </div>
                    )}
                </div>

                {/* 2. Centers */}
                <div className="dash-box settings-card" hidden={settingsView !== 'operations'}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>🏢 Business Hubs & Centers</h4>
                    <div className="settings-chips-scroll">
                        {visibleCenters.map(c => (
                            <span key={c} className="status-pill delivered" style={{ fontSize: '12px', padding: '5px 10px' }}>{c}</span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                            <input type="text" className="filter-input" placeholder="Add business center..." value={newCenter} onChange={e => setNewCenter(e.target.value)} />
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
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
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
                            <input type="text" className="filter-input" placeholder="Add staff member / collector..." value={newEmployee} onChange={e => setNewEmployee(e.target.value)} />
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
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
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
                            <input type="text" className="filter-input" placeholder="Add account (e.g. Office QR, HDFC)..." value={newPaidTo} onChange={e => setNewPaidTo(e.target.value)} />
                            <button className="btn btn-primary-blue" onClick={handleAddPaidTo}>Add</button>
                        </div>
                    )}
                </div>

                {/* 5. Prepaid Wallets */}
                <div className="dash-box settings-card" hidden={settingsView !== 'payments'}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>💳 Prepaid Partner Wallets</h4>
                    <div className="settings-chips-scroll">
                        {visiblePrepaidWallets.map(w => (
                            <span key={w.name} className="status-pill delivered" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={w.name} height={14} />
                                <span>{w.name} (Opening: ₹{w.openingBalance?.toLocaleString('en-IN')})</span>
                                {canManageSettings && visiblePrepaidWallets.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveWallet(w.name)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
                                        title={`Remove ${w.name} Wallet`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                style={{ flex: '1 1 140px', minWidth: '120px' }} 
                                placeholder="Wallet Name (e.g. ICL, DTDC)..." 
                                value={newWalletName} 
                                onChange={e => setNewWalletName(e.target.value)} 
                            />
                            <input 
                                type="number" 
                                className="filter-input" 
                                style={{ width: '100px' }} 
                                placeholder="Opening ₹" 
                                value={newWalletOpening} 
                                onChange={e => setNewWalletOpening(e.target.value)} 
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddWallet}>Add Wallet</button>
                        </div>
                    )}
                </div>

                {/* 6. Postpaid Accounts */}
                <div className="dash-box settings-card" hidden={settingsView !== 'payments'}>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '10px', color: 'var(--text-main)' }}>📋 Postpaid Courier Accounts</h4>
                    <div className="settings-chips-scroll">
                        {visiblePostpaidProviders.map(p => (
                            <span key={p.name} className="status-pill picked-up" style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <CourierLogo courier={p.name} height={14} />
                                <span>{p.name} (Deposit: ₹{p.deposit?.toLocaleString('en-IN')})</span>
                                {canManageSettings && visiblePostpaidProviders.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemovePostpaid(p.name)} 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', padding: '0 2px', fontSize: '12px', fontWeight: 800 }}
                                        title={`Remove ${p.name} Postpaid Account`}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>
                    {canManageSettings && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            <input 
                                type="text" 
                                className="filter-input" 
                                style={{ flex: '1 1 140px', minWidth: '120px' }} 
                                placeholder="Provider (e.g. DTDC, Ecom)..." 
                                value={newPostpaidName} 
                                onChange={e => setNewPostpaidName(e.target.value)} 
                            />
                            <input 
                                type="number" 
                                className="filter-input" 
                                style={{ width: '100px' }} 
                                placeholder="Deposit ₹" 
                                value={newPostpaidDeposit} 
                                onChange={e => setNewPostpaidDeposit(e.target.value)} 
                            />
                            <button className="btn btn-primary-blue" onClick={handleAddPostpaid}>Add Account</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Financial Audit Trail */}
            {hasPermission('viewFinancials') && (
                <div hidden={settingsView !== 'audit'} className="table-card" style={{ marginTop: '10px' }}>
                    <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0 }}>Financial Modifications Audit Log</h3>
                            <span className="pill-stat">Total: <strong>{auditLogs.length}</strong></span>
                        </div>
                    </div>
                    <div className="table-wrap reports-table-scroll" tabIndex={0} role="region" aria-label="Financial Modifications Audit Log" style={{ maxHeight: 'clamp(240px, 38vh, 420px)' }}>
                        <table className="data-table" style={{ minWidth: '650px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '22%' }}>Timestamp</th>
                                    <th style={{ width: '20%' }}>Staff User</th>
                                    <th style={{ width: '18%' }}>Entity</th>
                                    <th style={{ width: '20%' }}>Action</th>
                                    <th style={{ width: '20%' }}>Entity ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No audit events logged.</td></tr>
                                ) : (
                                    auditLogs.map(l => (
                                        <tr key={l.id}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatRecordTime(l.timestamp)}</td>
                                            <td><strong>{l.user_name}</strong></td>
                                            <td><span className="status-pill in-transit">{l.entity_type}</span></td>
                                            <td><strong>{l.action}</strong></td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{l.entity_id}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
};
