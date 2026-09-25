import React, { useState } from 'react';
import { Save, RotateCcw, Info, HelpCircle } from 'lucide-react';
import { apiClient } from '../api/client';

const DEFAULT_CREDIT_ALERT_CONFIG = {
    autoReminder: true,
    duePeriod: '30 Days',
    schedule: [
        { id: 'rem_1', label: '1st Reminder', sub: 'Before Due Date', days: 5, timing: 'Days Before Due Date', enabled: true },
        { id: 'rem_2', label: '2nd Reminder', sub: 'On Due Date', days: 0, timing: 'Days (On Due Date)', enabled: true },
        { id: 'rem_3', label: '3rd Reminder', sub: 'After Due Date', days: 2, timing: 'Days After Due Date', enabled: true },
        { id: 'rem_4', label: '4th Reminder', sub: 'Final Reminder', days: 7, timing: 'Days After Due Date', enabled: true },
    ],
    fromEmail: 'accounts@flymycart.com',
    ccEmail: 'owner@flymycart.com',
    subject: 'Payment Reminder - Outstanding Amount ₹{outstanding_amount}',
    body: `Dear {customer_name},

This is a friendly reminder regarding the outstanding payment of ₹{outstanding_amount} for the invoice(s) listed below.

Invoice No: {invoice_numbers}
Billing Period: {billing_period}
Due Date: {due_date}

Kindly arrange the payment at your earliest convenience.
If the payment has already been made, please share the details with us.

Regards,
Accounts Team
{company_name}
Phone: {office_phone}
Email: {office_email}`
};

const AVAILABLE_VARIABLES = [
    '{customer_name}',
    '{invoice_numbers}',
    '{invoice_date}',
    '{billing_period}',
    '{due_date}',
    '{outstanding_amount}',
    '{payment_link}',
    '{office_phone}',
    '{office_email}',
    '{company_name}',
];

export default function CreditPaymentAlertsSettings({ settings, onSave, canManage }) {
    const savedConfig = settings?.creditPaymentAlerts || {};
    const [config, setConfig] = useState({
        ...DEFAULT_CREDIT_ALERT_CONFIG,
        ...savedConfig,
        schedule: savedConfig.schedule?.length ? savedConfig.schedule : DEFAULT_CREDIT_ALERT_CONFIG.schedule
    });
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState('');

    const handleToggleSchedule = (id) => {
        if (!canManage) return;
        setConfig(prev => ({
            ...prev,
            schedule: prev.schedule.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item)
        }));
    };

    const handleDaysChange = (id, val) => {
        if (!canManage) return;
        const num = parseInt(val) || 0;
        setConfig(prev => ({
            ...prev,
            schedule: prev.schedule.map(item => item.id === id ? { ...item, days: num } : item)
        }));
    };

    const handleInsertVariable = (varName) => {
        if (!canManage) return;
        setConfig(prev => ({
            ...prev,
            body: prev.body + ' ' + varName
        }));
    };

    const handleReset = () => {
        if (!canManage) return;
        if (window.confirm('Reset email template to default values?')) {
            setConfig(prev => ({
                ...prev,
                subject: DEFAULT_CREDIT_ALERT_CONFIG.subject,
                body: DEFAULT_CREDIT_ALERT_CONFIG.body
            }));
        }
    };

    const handleSave = async () => {
        if (!canManage) return;
        setSaving(true);
        try {
            const updated = {
                ...(settings || {}),
                creditPaymentAlerts: config
            };
            await apiClient.saveSettings(updated);
            if (onSave) onSave(updated);
            setFeedback('✓ Settings saved successfully!');
            setTimeout(() => setFeedback(''), 4000);
        } catch (err) {
            alert(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '0 4px', maxWidth: '1440px', margin: '0 auto' }}>
            {/* Breadcrumb & Subtitle */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Settings</span>
                    <span style={{ color: 'var(--text-muted)' }}>›</span>
                    <span>Credit Payment Alerts</span>
                    <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', marginLeft: '6px' }}>
                        🚧 Currently in Development
                    </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Configure automatic payment reminder emails for all credit customers
                </p>
            </div>

            {/* In Development Notice Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.08)'
            }}>
                <div style={{
                    background: '#f59e0b',
                    color: '#ffffff',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '15px',
                    fontWeight: 800
                }}>
                    🛠️
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13.5px', color: '#92400e' }}>
                            Feature Currently in Development
                        </strong>
                        <span style={{ fontSize: '10.5px', background: '#f59e0b', color: '#ffffff', padding: '1px 7px', borderRadius: '10px', fontWeight: 700 }}>
                            Coming Soon
                        </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#b45309', lineHeight: '1.45' }}>
                        Automated background email sending is currently under development. You can preview and customize your schedule rules and email templates below. In the meantime, use <strong>1-Click WhatsApp & Email</strong> directly from the <em>Invoices</em> and <em>Follow-ups</em> dashboards.
                    </p>
                </div>
            </div>

            {/* Main 2-Column Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                gap: '24px',
                alignItems: 'start'
            }}>
                {/* LEFT COLUMN: Settings & Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* 1. Default Settings */}
                    <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--card-border, #e2e8f0)', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <span style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800
                            }}>1</span>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                Default Settings (Applied to all Credit Customers)
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Auto Reminder Toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Auto Payment Reminder</span>
                                        <span title="System will automatically send reminder emails for all credit customers" style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            <HelpCircle size={14} />
                                        </span>
                                    </div>
                                    <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                        System will automatically send reminder emails for all credit customers.
                                    </p>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: canManage ? 'pointer' : 'default' }}>
                                    <input
                                        type="checkbox"
                                        checked={config.autoReminder}
                                        disabled={!canManage}
                                        onChange={e => setConfig(prev => ({ ...prev, autoReminder: e.target.checked }))}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundColor: config.autoReminder ? '#10b981' : '#cbd5e1',
                                        borderRadius: '24px',
                                        transition: '0.2s',
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '""',
                                            height: '18px',
                                            width: '18px',
                                            left: config.autoReminder ? '22px' : '3px',
                                            bottom: '3px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            transition: '0.2s',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }} />
                                    </span>
                                </label>
                            </div>

                            {/* Payment Due Period */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--card-border, #f1f5f9)' }}>
                                <div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Default Payment Due Period</span>
                                    <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                        Consider invoice due after {config.duePeriod} from invoice date.
                                    </p>
                                </div>
                                <select
                                    value={config.duePeriod}
                                    disabled={!canManage}
                                    onChange={e => setConfig(prev => ({ ...prev, duePeriod: e.target.value }))}
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="7 Days">7 Days</option>
                                    <option value="15 Days">15 Days</option>
                                    <option value="30 Days">30 Days</option>
                                    <option value="45 Days">45 Days</option>
                                    <option value="60 Days">60 Days</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 2. Reminder Schedule */}
                    <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--card-border, #e2e8f0)', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <span style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800
                            }}>2</span>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                Reminder Schedule
                            </h3>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-app, #f8fafc)', borderBottom: '1px solid var(--card-border, #e2e8f0)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-muted)' }}>Reminder</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-muted)' }}>When to Send</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {config.schedule.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border, #f1f5f9)' }}>
                                            <td style={{ padding: '10px 10px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.sub}</div>
                                            </td>
                                            <td style={{ padding: '10px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="number"
                                                        value={item.days}
                                                        disabled={!canManage}
                                                        onChange={e => handleDaysChange(item.id, e.target.value)}
                                                        style={{
                                                            width: '50px',
                                                            padding: '5px 8px',
                                                            borderRadius: '6px',
                                                            border: '1px solid var(--card-border, #cbd5e1)',
                                                            background: 'var(--card-bg, #ffffff)',
                                                            color: 'var(--text-main)',
                                                            fontSize: '12.5px',
                                                            fontWeight: 700,
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                    <span style={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: 500 }}>
                                                        {item.timing}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                                                <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', cursor: canManage ? 'pointer' : 'default' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={item.enabled}
                                                        disabled={!canManage}
                                                        onChange={() => handleToggleSchedule(item.id)}
                                                        style={{ opacity: 0, width: 0, height: 0 }}
                                                    />
                                                    <span style={{
                                                        position: 'absolute',
                                                        top: 0, left: 0, right: 0, bottom: 0,
                                                        backgroundColor: item.enabled ? '#10b981' : '#cbd5e1',
                                                        borderRadius: '20px',
                                                        transition: '0.2s',
                                                    }}>
                                                        <span style={{
                                                            position: 'absolute',
                                                            content: '""',
                                                            height: '14px',
                                                            width: '14px',
                                                            left: item.enabled ? '20px' : '3px',
                                                            bottom: '3px',
                                                            backgroundColor: 'white',
                                                            borderRadius: '50%',
                                                            transition: '0.2s',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                        }} />
                                                    </span>
                                                </label>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Email Settings */}
                    <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--card-border, #e2e8f0)', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <span style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800
                            }}>3</span>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                Email Settings
                            </h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    From Email (Our Office) <Info size={13} />
                                </label>
                                <input
                                    type="email"
                                    value={config.fromEmail}
                                    disabled={!canManage}
                                    onChange={e => setConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        borderRadius: '7px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '12.5px'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    CC Email (Optional)
                                </label>
                                <input
                                    type="email"
                                    value={config.ccEmail}
                                    disabled={!canManage}
                                    onChange={e => setConfig(prev => ({ ...prev, ccEmail: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        borderRadius: '7px',
                                        border: '1px solid var(--card-border, #cbd5e1)',
                                        background: 'var(--card-bg, #ffffff)',
                                        color: 'var(--text-main)',
                                        fontSize: '12.5px'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. Email Template */}
                    <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--card-border, #e2e8f0)', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 800
                                }}>4</span>
                                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                    Email Template (Default for all Credit Customers)
                                </h3>
                            </div>
                            {canManage && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '4px 10px',
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        color: '#334155',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <RotateCcw size={12} /> Reset to Default
                                </button>
                            )}
                        </div>

                        {/* Email Subject */}
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Email Subject
                            </label>
                            <input
                                type="text"
                                value={config.subject}
                                disabled={!canManage}
                                onChange={e => setConfig(prev => ({ ...prev, subject: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    borderRadius: '7px',
                                    border: '1px solid var(--card-border, #cbd5e1)',
                                    background: 'var(--card-bg, #ffffff)',
                                    color: 'var(--text-main)',
                                    fontSize: '12.5px',
                                    fontWeight: 600
                                }}
                            />
                        </div>

                        {/* Email Body & Variables Tag Cloud */}
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                Email Body
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: '12px', alignItems: 'start' }}>
                                <div style={{ border: '1px solid var(--card-border, #cbd5e1)', borderRadius: '8px', overflow: 'hidden' }}>
                                    {/* Mini Toolbar */}
                                    <div style={{ display: 'flex', gap: '6px', padding: '6px 10px', background: 'var(--bg-app, #f8fafc)', borderBottom: '1px solid var(--card-border, #e2e8f0)', fontSize: '12px' }}>
                                        <span style={{ fontWeight: 800, cursor: 'pointer', padding: '0 4px' }}>B</span>
                                        <span style={{ fontStyle: 'italic', cursor: 'pointer', padding: '0 4px' }}>I</span>
                                        <span style={{ textDecoration: 'underline', cursor: 'pointer', padding: '0 4px' }}>U</span>
                                        <span style={{ color: 'var(--text-muted)' }}>|</span>
                                        <span style={{ cursor: 'pointer' }}>•—</span>
                                        <span style={{ cursor: 'pointer' }}>1.</span>
                                        <span style={{ cursor: 'pointer' }}>🔗</span>
                                    </div>
                                    <textarea
                                        rows={10}
                                        value={config.body}
                                        disabled={!canManage}
                                        onChange={e => setConfig(prev => ({ ...prev, body: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: 'none',
                                            outline: 'none',
                                            background: 'var(--card-bg, #ffffff)',
                                            color: 'var(--text-main)',
                                            fontSize: '12px',
                                            lineHeight: '1.5',
                                            resize: 'vertical',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>

                                {/* Available Variables Badge Cloud */}
                                <div style={{ background: 'var(--bg-app, #f8fafc)', padding: '10px', borderRadius: '8px', border: '1px solid var(--card-border, #e2e8f0)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Available Variables
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {AVAILABLE_VARIABLES.map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => handleInsertVariable(v)}
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '4px',
                                                    padding: '3px 6px',
                                                    fontSize: '11px',
                                                    color: '#2563eb',
                                                    textAlign: 'left',
                                                    cursor: canManage ? 'pointer' : 'default',
                                                    fontFamily: 'monospace',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title={`Click to insert ${v}`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        {canManage && (
                            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        padding: '8px 18px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
                                </button>
                                {feedback && (
                                    <span style={{ fontSize: '12.5px', color: '#16a34a', fontWeight: 600 }}>
                                        {feedback}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: How It Works & Sample Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* 5. How It Works */}
                    <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--card-border, #e2e8f0)', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <span style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800
                            }}>5</span>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                How It Works
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {[
                                { num: 1, title: 'Create invoice for a credit customer', desc: `System calculates due date automatically (e.g., ${config.duePeriod}).` },
                                { num: 2, title: 'System checks daily', desc: 'It finds invoices that are due or overdue.' },
                                { num: 3, title: 'Automatic emails are sent', desc: `As per the default schedule (${config.schedule.filter(s => s.enabled).map(s => s.days === 0 ? 'on due date' : `${s.days} days ${s.sub.toLowerCase()}`).join(', ')}).` },
                                { num: 4, title: 'Works for all credit customers', desc: 'No need to configure individually. Only change if custom settings are required for a specific customer.' }
                            ].map(step => (
                                <div key={step.num} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <span style={{
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        flexShrink: 0,
                                        marginTop: '1px'
                                    }}>{step.num}</span>
                                    <div>
                                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>{step.title}</div>
                                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>{step.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 6. Sample Email Preview */}
                    <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--card-border, #e2e8f0)', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <span style={{
                                background: '#ef4444',
                                color: '#ffffff',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 800
                            }}>6</span>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                Sample Email Preview
                            </h3>
                        </div>

                        {/* Email Header Metadata */}
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '60px 1fr', rowGap: '4px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--card-border, #f1f5f9)' }}>
                            <span style={{ fontWeight: 700 }}>From:</span>
                            <span style={{ color: 'var(--text-main)' }}>{config.fromEmail || 'accounts@flymycart.com'}</span>
                            <span style={{ fontWeight: 700 }}>To:</span>
                            <span style={{ color: 'var(--text-main)' }}>abc.traders@gmail.com</span>
                            <span style={{ fontWeight: 700 }}>CC:</span>
                            <span style={{ color: 'var(--text-main)' }}>{config.ccEmail || 'owner@flymycart.com'}</span>
                            <span style={{ fontWeight: 700 }}>Subject:</span>
                            <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                                {config.subject.replace('{outstanding_amount}', '25,500').replace('{customer_name}', 'ABC Traders')}
                            </span>
                        </div>

                        {/* Actual Branded Email Letter Card */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            fontSize: '12px',
                            color: '#1e293b',
                            lineHeight: '1.5'
                        }}>
                            {/* Brand Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '2px solid #2563eb', marginBottom: '12px' }}>
                                <div style={{ width: '24px', height: '24px', background: '#2563eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 800, fontSize: '12px' }}>
                                    📦
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>Fly My Cart</div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>Courier & Logistics</div>
                                </div>
                            </div>

                            <p style={{ margin: '0 0 10px', fontWeight: 600 }}>Dear ABC Traders,</p>
                            <p style={{ margin: '0 0 12px', color: '#475569' }}>
                                This is a friendly reminder regarding the outstanding payment of <strong style={{ color: '#0f172a' }}>₹25,500</strong> for the invoice(s) listed below.
                            </p>

                            {/* Invoices Mini Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '5px 8px' }}>Invoice No</th>
                                        <th style={{ padding: '5px 8px' }}>Invoice Date</th>
                                        <th style={{ padding: '5px 8px' }}>Due Date</th>
                                        <th style={{ padding: '5px 8px', textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '5px 8px', fontWeight: 600, color: '#2563eb' }}>FMC20250901</td>
                                        <td style={{ padding: '5px 8px' }}>01 Sep 2026</td>
                                        <td style={{ padding: '5px 8px' }}>30 Sep 2026</td>
                                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>₹12,000</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '5px 8px', fontWeight: 600, color: '#2563eb' }}>FMC20250905</td>
                                        <td style={{ padding: '5px 8px' }}>05 Sep 2026</td>
                                        <td style={{ padding: '5px 8px' }}>30 Sep 2026</td>
                                        <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>₹13,500</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style={{ fontSize: '11.5px', marginBottom: '12px', color: '#334155' }}>
                                <div><strong>Billing Period:</strong> September 2026</div>
                                <div><strong>Due Date:</strong> 30 Sep 2026</div>
                                <div><strong>Outstanding Amount:</strong> <span style={{ color: '#0f172a', fontWeight: 800 }}>₹25,500</span></div>
                            </div>

                            <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '11px' }}>
                                Kindly arrange the payment at your earliest convenience. If the payment has already been made, please share the details with us.
                            </p>

                            <div style={{ fontSize: '11px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                <div>Regards,</div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>Accounts Team</div>
                                <div>Fly My Cart</div>
                                <div>Phone: +91 9876543210</div>
                                <div>Email: accounts@flymycart.com</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
