import React, { useState } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, RotateCcw, Check, Sparkles, Copy, Tag, Eye, Code, FileText, Bell, Package, HelpCircle } from 'lucide-react';
import { getDefaultMessageTemplates, AVAILABLE_PLACEHOLDERS, formatTemplate } from '../utils/communication';

export default function MessageTemplatesSettings({ settings, onSave, canManage = true }) {
    const companyName = settings?.companyName || 'Fly My Cart Logistics';
    const templates = (settings?.messageTemplates && settings.messageTemplates.length > 0)
        ? settings.messageTemplates
        : getDefaultMessageTemplates(companyName);

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formTitle, setFormTitle] = useState('');
    const [formChannel, setFormChannel] = useState('WhatsApp');
    const [formCategory, setFormCategory] = useState('custom');
    const [formBody, setFormBody] = useState('');
    const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
    const [activeTab, setActiveTab] = useState('all');

    const sampleData = {
        customerName: 'Dr. Chanakya Sharma',
        companyName: companyName,
        invoiceNo: 'FMC-202609-001',
        awb: '60301243122',
        totalAmount: 2450,
        paidAmount: 1450,
        dueAmount: 1000,
        balance: 1000,
        courier: 'FedEx Express',
        destination: 'London, United Kingdom',
        docTitle: 'Commercial Invoice / Bill of Supply (Non-GST)',
        trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=60301243122'
    };

    const getTriggerInfo = (category, id) => {
        if (category === 'invoice' || id === 'invoice_share') {
            return {
                badge: '🎯 Used in: Invoice Share (WhatsApp & Email)',
                desc: 'Triggered automatically when clicking WhatsApp or Email inside Invoice Modal',
                color: '#2563eb',
                bg: '#eff6ff',
                icon: FileText
            };
        }
        if (category === 'payment_reminder' || id === 'payment_reminder') {
            return {
                badge: '🎯 Used in: Unpaid Balances & Follow-ups',
                desc: 'Triggered automatically in Invoices Ledger and Follow-ups for overdue accounts',
                color: '#d97706',
                bg: '#fffbeb',
                icon: Bell
            };
        }
        if (category === 'dispatch' || id === 'shipment_dispatch') {
            return {
                badge: '🎯 Used in: Shipments & AWB Tracking',
                desc: 'Triggered when sending live AWB tracking info from Shipments dashboard',
                color: '#16a34a',
                bg: '#f0fdf4',
                icon: Package
            };
        }
        return {
            badge: '🎯 Used in: Customer 360° Directory & Care',
            desc: 'General touchpoint & greeting message for customer relationship management',
            color: '#7c3aed',
            bg: '#f5f3ff',
            icon: MessageSquare
        };
    };

    const handleOpenNew = () => {
        setEditingId(null);
        setFormTitle('');
        setFormChannel('WhatsApp');
        setFormCategory('custom');
        setFormBody('Dear {customer_name},\n\nGreetings from {company_name}!\n\nYour message text here...\n\nThank you,\n{company_name}');
        setIsEditing(true);
    };

    const handleOpenEdit = (template) => {
        setEditingId(template.id);
        setFormTitle(template.title || '');
        setFormChannel(template.channel || 'All');
        setFormCategory(template.category || 'custom');
        setFormBody(template.body || '');
        setIsEditing(true);
    };

    const handleInsertTag = (tag) => {
        setFormBody(prev => prev + tag);
    };

    const handleSaveTemplate = (e) => {
        e.preventDefault();
        if (!formTitle.trim() || !formBody.trim()) {
            alert('Please provide a title and message body for the template.');
            return;
        }

        let updated;
        if (editingId) {
            updated = templates.map(t => (t.id === editingId ? {
                ...t,
                title: formTitle.trim(),
                channel: formChannel,
                category: formCategory,
                body: formBody.trim()
            } : t));
        } else {
            const newTpl = {
                id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                title: formTitle.trim(),
                channel: formChannel,
                category: formCategory,
                body: formBody.trim()
            };
            updated = [...templates, newTpl];
        }

        onSave({
            ...settings,
            messageTemplates: updated
        });
        setIsEditing(false);
    };

    const handleDeleteTemplate = (id, title) => {
        if (templates.length <= 1) {
            alert('You must retain at least one communication template.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete template "${title}"?`)) {
            return;
        }
        const updated = templates.filter(t => t.id !== id);
        onSave({
            ...settings,
            messageTemplates: updated
        });
        if (editingId === id) {
            setIsEditing(false);
        }
    };

    const handleResetDefaults = () => {
        if (!window.confirm('Reset all message templates to standard logistics system defaults? Custom templates will be overwritten.')) {
            return;
        }
        const defaults = getDefaultMessageTemplates(companyName);
        onSave({
            ...settings,
            messageTemplates: defaults
        });
        setIsEditing(false);
    };

    const filteredTemplates = templates.filter(t => {
        if (activeTab === 'all') return true;
        if (activeTab === 'whatsapp') return t.channel === 'WhatsApp' || t.channel === 'All';
        if (activeTab === 'email') return t.channel === 'Email' || t.channel === 'All';
        return true;
    });

    return (
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
            {/* Header */}
            <div className="dash-box" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--card-border, #e2e8f0)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--card-border, #f1f5f9)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 12px rgba(37,211,102,0.25)' }}>
                            <MessageSquare size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>WhatsApp & Email Message Templates</h3>
                                <span style={{ fontSize: '11px', background: 'rgba(37,211,102,0.12)', color: '#16a34a', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                    {templates.length} Templates Configured
                                </span>
                            </div>
                            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                                Easily manage how the CRM automatically formats customer messages for invoices, payment reminders, tracking, and greetings.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {canManage && (
                            <>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={handleResetDefaults}
                                    title="Reset all templates to standard defaults"
                                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <RotateCcw size={13} /> Reset Standard Presets
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary-blue"
                                    onClick={handleOpenNew}
                                    style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Plus size={14} /> Create New Template
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* HOW THE CRM AUTOMATICALLY USES THESE TEMPLATES */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <HelpCircle size={15} color="#2563eb" />
                        <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>How the CRM Automatically Chooses & Sends Each Template:</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', fontSize: '12px' }}>
                        <div style={{ background: '#ffffff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1d4ed8', fontWeight: 700, marginBottom: '3px' }}>
                                <FileText size={14} />
                                <span>1. Invoice Sharing (WhatsApp / Email)</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: '#475569' }}>
                                Used when clicking <strong>WhatsApp</strong> or <strong>Email Invoice</strong> inside any invoice popup. Sends invoice total, paid amount & balance.
                            </p>
                        </div>

                        <div style={{ background: '#ffffff', border: '1px solid #fef3c7', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: 700, marginBottom: '3px' }}>
                                <Bell size={14} />
                                <span>2. Payment Dues Reminder</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: '#475569' }}>
                                Used in <strong>Follow-ups</strong> and <strong>Invoices Ledger</strong> for customers with pending balances. Mentions due balance & AWB.
                            </p>
                        </div>

                        <div style={{ background: '#ffffff', border: '1px solid #dcfce7', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontWeight: 700, marginBottom: '3px' }}>
                                <Package size={14} />
                                <span>3. AWB Dispatch & Tracking</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: '#475569' }}>
                                Used when dispatching consignments in <strong>Shipments</strong>. Shares live AWB number, courier carrier & destination.
                            </p>
                        </div>

                        <div style={{ background: '#ffffff', border: '1px solid #ede9fe', borderRadius: '8px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6d28d9', fontWeight: 700, marginBottom: '3px' }}>
                                <MessageSquare size={14} />
                                <span>4. Customer Follow-up & Greeting</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: '#475569' }}>
                                Used in <strong>Customer 360° Drawer</strong> and general customer relations when no outstanding dues are pending.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Editor Modal / Card */}
            {isEditing && (
                <div style={{ background: 'var(--surface-bg, #f8fafc)', border: '2px solid #3b82f6', borderRadius: '12px', padding: '18px', marginBottom: '22px', boxShadow: '0 8px 24px rgba(59,130,246,0.12)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
                        <strong style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                            <Sparkles size={17} color="#2563eb" />
                            {editingId ? 'Edit Message Template' : 'Create New Message Template'}
                        </strong>
                        <button type="button" onClick={() => setIsEditing(false)} className="btn btn-sm btn-outline" style={{ fontSize: '12px', padding: '3px 10px' }}>Cancel</button>
                    </div>

                    <form onSubmit={handleSaveTemplate}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Template Title *</label>
                                <input
                                    type="text"
                                    required
                                    className="filter-input"
                                    style={{ width: '100%', fontSize: '12.5px' }}
                                    placeholder="e.g. Invoice Sharing / Bill Notice"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Channel Availability</label>
                                <select
                                    className="filter-input"
                                    style={{ width: '100%', fontSize: '12.5px' }}
                                    value={formChannel}
                                    onChange={e => setFormChannel(e.target.value)}
                                >
                                    <option value="WhatsApp">WhatsApp Only</option>
                                    <option value="Email">Email Only</option>
                                    <option value="All">All Channels (WhatsApp & Email)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>CRM Trigger Category</label>
                                <select
                                    className="filter-input"
                                    style={{ width: '100%', fontSize: '12.5px' }}
                                    value={formCategory}
                                    onChange={e => setFormCategory(e.target.value)}
                                >
                                    <option value="invoice">📄 Invoice Sharing & Billing</option>
                                    <option value="payment_reminder">🔔 Payment Dues Reminder</option>
                                    <option value="dispatch">📦 Shipment Tracking & Dispatch</option>
                                    <option value="greeting">👋 Customer Care & Greeting</option>
                                    <option value="custom">⚙️ General Custom</option>
                                </select>
                            </div>
                        </div>

                        {/* Interactive Placeholders helper */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <Tag size={13} color="#2563eb" />
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>Click to Insert Dynamic Placeholder Tags:</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {AVAILABLE_PLACEHOLDERS.map(p => (
                                    <button
                                        key={p.tag}
                                        type="button"
                                        onClick={() => handleInsertTag(p.tag)}
                                        title={p.desc}
                                        style={{
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            background: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            padding: '3px 8px',
                                            cursor: 'pointer',
                                            color: '#2563eb',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <span>+ {p.tag}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Body Textarea & Live Preview Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Template Body (With Placeholders) *</label>
                                <textarea
                                    required
                                    rows={8}
                                    className="filter-input"
                                    style={{ width: '100%', fontSize: '12.5px', fontFamily: 'inherit', lineHeight: '1.45', padding: '10px' }}
                                    placeholder="Enter template text with placeholders..."
                                    value={formBody}
                                    onChange={e => setFormBody(e.target.value)}
                                />
                            </div>

                            {/* Live Preview Box */}
                            <div>
                                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Live Customer Preview (Sample Data)</label>
                                <div style={{
                                    height: 'calc(100% - 22px)',
                                    minHeight: '160px',
                                    background: '#eef2f6',
                                    border: '1px dashed #94a3b8',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '12px',
                                    whiteSpace: 'pre-wrap',
                                    color: '#0f172a',
                                    overflowY: 'auto'
                                }}>
                                    {formatTemplate(formBody, sampleData) || '<Empty template text>'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Check size={14} /> Save Template
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Toolbar: Filters & View Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Channel Filter:</span>
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary-blue' : 'btn-outline'}`}
                        style={{ fontSize: '11.5px', padding: '3px 10px' }}
                    >
                        All ({templates.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('whatsapp')}
                        className={`btn btn-sm ${activeTab === 'whatsapp' ? 'btn-primary-blue' : 'btn-outline'}`}
                        style={{ fontSize: '11.5px', padding: '3px 10px' }}
                    >
                        WhatsApp Only ({templates.filter(t => t.channel === 'WhatsApp' || t.channel === 'All').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('email')}
                        className={`btn btn-sm ${activeTab === 'email' ? 'btn-primary-blue' : 'btn-outline'}`}
                        style={{ fontSize: '11.5px', padding: '3px 10px' }}
                    >
                        Email Only ({templates.filter(t => t.channel === 'Email' || t.channel === 'All').length})
                    </button>
                </div>

                {/* View Mode Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '3px', border: '1px solid #e2e8f0' }}>
                    <button
                        type="button"
                        onClick={() => setViewMode('preview')}
                        style={{
                            border: 'none',
                            background: viewMode === 'preview' ? '#ffffff' : 'transparent',
                            color: viewMode === 'preview' ? '#2563eb' : '#64748b',
                            fontWeight: viewMode === 'preview' ? 700 : 500,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: viewMode === 'preview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <Eye size={13} />
                        <span>Live Customer View</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('code')}
                        style={{
                            border: 'none',
                            background: viewMode === 'code' ? '#ffffff' : 'transparent',
                            color: viewMode === 'code' ? '#2563eb' : '#64748b',
                            fontWeight: viewMode === 'code' ? 700 : 500,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: viewMode === 'code' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <Code size={13} />
                        <span>Raw Tags View ({'{tag}'})</span>
                    </button>
                </div>
            </div>

            {/* Template Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '16px' }}>
                {filteredTemplates.map((tpl) => {
                    const isWhatsApp = tpl.channel === 'WhatsApp';
                    const isEmail = tpl.channel === 'Email';
                    const trigger = getTriggerInfo(tpl.category, tpl.id);
                    const TriggerIcon = trigger.icon;

                    return (
                        <div
                            key={tpl.id}
                            style={{
                                background: 'var(--card-bg, #ffffff)',
                                border: '1px solid var(--card-border, #e2e8f0)',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                            }}
                        >
                            <div>
                                {/* Header of Card */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                                    <div>
                                        <h4 style={{ fontSize: '14.5px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>
                                            {tpl.title}
                                        </h4>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '10.5px',
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                background: isWhatsApp ? '#dcfce7' : isEmail ? '#e0e7ff' : '#f1f5f9',
                                                color: isWhatsApp ? '#15803d' : isEmail ? '#4338ca' : '#475569'
                                            }}>
                                                Channel: {tpl.channel || 'All'}
                                            </span>
                                            <span style={{
                                                fontSize: '10.5px',
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                background: trigger.bg,
                                                color: trigger.color,
                                                border: `1px solid ${trigger.color}30`
                                            }}>
                                                {trigger.badge}
                                            </span>
                                        </div>
                                    </div>

                                    {canManage && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(tpl)}
                                                className="btn btn-sm btn-outline"
                                                style={{ padding: '4px 8px', height: '28px' }}
                                                title="Edit template content"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                                                className="btn btn-sm btn-outline"
                                                style={{ padding: '4px 8px', height: '28px', color: '#dc2626' }}
                                                title="Delete template"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Trigger Helper Note */}
                                <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <TriggerIcon size={12} color={trigger.color} />
                                    <span>{trigger.desc}</span>
                                </div>

                                {/* Message Content Box */}
                                <div style={{
                                    background: viewMode === 'preview' ? '#f8fafc' : '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '12px',
                                    color: '#1e293b',
                                    maxHeight: '170px',
                                    minHeight: '110px',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.45',
                                    fontFamily: viewMode === 'code' ? 'monospace' : 'inherit'
                                }}>
                                    {viewMode === 'preview'
                                        ? formatTemplate(tpl.body, sampleData)
                                        : tpl.body}
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#94a3b8' }}>
                                <span>{viewMode === 'preview' ? 'Sample Client Preview' : 'Raw Template Text'}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const textToCopy = viewMode === 'preview' ? formatTemplate(tpl.body, sampleData) : tpl.body;
                                        navigator.clipboard.writeText(textToCopy);
                                        alert('Message text copied to clipboard!');
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 600 }}
                                >
                                    <Copy size={12} /> Copy Text
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
