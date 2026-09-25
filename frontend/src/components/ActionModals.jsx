import { openWhatsApp, openEmail, openCall, CommTemplates, getDefaultMessageTemplates, formatTemplate } from '../utils/communication';
import { Phone, Mail, PhoneCall } from 'lucide-react';
import PaymentDetails from './PaymentDetails';
import { businessDate } from '../utils/businessDates';
import React, { useState } from 'react';
import { X, Check, RotateCcw, MessageSquare, Save, CreditCard, Building, Truck, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';

export const WalletRechargeModal = ({ isOpen, onClose, walletName, onRecharged, settings }) => {
    const [amount, setAmount] = useState('');
    const [paidFrom, setPaidFrom] = useState('Current Account (HDFC)');
    const [reference, setReference] = useState('');
    const [paymentDetails, setPaymentDetails] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const todayStr = businessDate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
            alert('Please enter a valid transfer amount');
            return;
        }

        setIsSubmitting(true);
        try {
            await apiClient.rechargeWallet({
                wallet: walletName || 'ICL',
                date: todayStr,
                amount: amt,
                paid_from: paidFrom,
                reference, payment_method: 'Bank Transfer', payment_details: paymentDetails
            });
            alert(`₹${amt.toLocaleString('en-IN')} transferred to ${walletName} wallet successfully!`);
            onRecharged();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error recording wallet transfer');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const paidFromAccounts = [...new Set([
        ...(settings?.paidToAccounts || []),
        ...(settings?.paymentAccounts || []).filter(p => p.method === 'Bank Transfer').map(p => p.name),
    ])];

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '520px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={18} color="var(--primary-blue)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Top-up {walletName} Provider Wallet</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Transfer funds from FMC Bank Account to Courier Wallet</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <PaymentDetails onAccountChange={setPaidFrom} method="Bank Transfer" value={paymentDetails} onChange={setPaymentDetails} profiles={settings?.paymentAccounts || []} />
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Transfer Amount (₹) <span className="required">*</span></label>
                            <input type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 25000" />
                        </div>
                        <div className="form-group">
                            <label>Paid From Bank Account</label>
                            <select required value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
                                <option value="">Select bank account</option>{paidFromAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Reference / Bank UTR Number</label>
                            <input required minLength={4} maxLength={100} type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. RTGS/HDFC982103..." />
                        </div>
                    </div>

                    <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: '14px', fontSize: '11.5px', color: '#0369a1' }}>
                        ℹ️ <strong>Accounting Rule 1:</strong> Wallet recharge is a balance transfer (Bank &rarr; Wallet Asset), NOT a business expense. Logistics cost occurs only when the wallet is debited on a shipment.
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="spin" />
                                    <span>Recording Transfer...</span>
                                </>
                            ) : (
                                <>
                                    <Check size={14} />
                                    <span>Record Transfer</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const RefundModal = ({ isOpen, onClose, onCreated }) => {
    const [form, setForm] = useState({
        customer: '',
        awb: '',
        invoice_no: '',
        amount: '',
        reason: '',
        refund_method: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(form.amount);
        if (!amt || amt <= 0) {
            alert('Please enter a valid refund amount');
            return;
        }

        setIsSubmitting(true);
        try {
            await apiClient.createRefund({
                ...form,
                amount: amt
            });
            alert('Refund request logged. Submitted to Super Admin for approval.');
            onCreated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error creating refund request');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '560px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <RotateCcw size={18} color="var(--rose)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Request Customer Refund</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lifecycle: Requested &rarr; Approved &rarr; Refunded / Rejected</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Customer Name <span className="required">*</span></label>
                            <input type="text" required value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="e.g. Dr. Ananya Roy" />
                        </div>
                        <div className="form-group">
                            <label>AWB Number <span className="required">*</span></label>
                            <input type="text" required value={form.awb} onChange={e => setForm({ ...form, awb: e.target.value })} placeholder="e.g. FX260831001" />
                        </div>
                        <div className="form-group">
                            <label>Invoice Number</label>
                            <input type="text" value={form.invoice_no} onChange={e => setForm({ ...form, invoice_no: e.target.value })} placeholder="e.g. FMC-202608-001" />
                        </div>
                        <div className="form-group">
                            <label>Refund Amount (₹) <span className="required">*</span></label>
                            <input type="number" min="1" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 500" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Reason for Refund <span className="required">*</span></label>
                            <input type="text" required value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Flight delay concession, weight recalculation refund" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Refund Payout Method / UPI ID</label>
                            <input type="text" value={form.refund_method} onChange={e => setForm({ ...form, refund_method: e.target.value })} placeholder="e.g. 9820011223@upi / Bank Account" />
                        </div>
                    </div>

                    <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: '14px', fontSize: '11.5px', color: '#be123c' }}>
                        ℹ️ <strong>Accounting Rule 9:</strong> Approved refunds automatically deduct from business Profit in EOD and Monthly P&L statements.
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="spin" />
                                    <span>Submitting Request...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    <span>Submit Refund Request</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CommunicationForm = ({ isOpen, onClose, customerName, data, onCreated, settings, customers = [], invoices = [], shipments = [] }) => {
    const rawTargetName = typeof customerName === 'object' ? (customerName?.name || customerName?.customer || '') : (customerName || data?.name || data?.customer || '');
    const companyName = settings?.companyName || 'Fly My Cart Logistics';

    const templates = (settings?.messageTemplates && settings.messageTemplates.length > 0)
        ? settings.messageTemplates
        : getDefaultMessageTemplates(companyName);

    const [parsedName, setParsedName] = useState(rawTargetName || 'Customer');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [dueAmount, setDueAmount] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [paidAmount, setPaidAmount] = useState(0);
    const [invoiceNo, setInvoiceNo] = useState('');
    const [awb, setAwb] = useState('');
    const [courier, setCourier] = useState('');
    const [destination, setDestination] = useState('');
    const [channel, setChannel] = useState('WhatsApp');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [message, setMessage] = useState('');
    const [staff, setStaff] = useState('Nawaz');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [initializedTarget, setInitializedTarget] = useState(null);
    if (isOpen && (!initializedTarget || initializedTarget.customerName !== customerName || initializedTarget.data !== data)) {
        setInitializedTarget({ customerName, data });

        const target = typeof customerName === 'object' ? customerName : { name: customerName || data?.name || '' };
        const nameStr = target?.name || target?.customer || data?.name || data?.customer || '';
        const normName = nameStr.trim().toLowerCase();

        // 1. Find matching customer from customer directory
        const matchedCust = (customers || []).find(c => 
            (target?.customer_id && c.id === target.customer_id) ||
            (normName && c.name && c.name.trim().toLowerCase() === normName) ||
            (normName && c.company && c.company.trim().toLowerCase() === normName)
        );

        // 2. Find matching invoice
        const matchedInvoices = (invoices || []).filter(inv => 
            (matchedCust && inv.customer_id === matchedCust.id) ||
            (normName && inv.customer_name && inv.customer_name.trim().toLowerCase() === normName)
        );
        const latestUnpaidInv = matchedInvoices.find(inv => (inv.balance || (Number(inv.total) - Number(inv.paid || 0))) > 0) || matchedInvoices[0];

        // 3. Find matching shipment
        const matchedShipments = (shipments || []).filter(s => 
            (matchedCust && s.customer_id === matchedCust.id) ||
            (normName && s.sender_name && s.sender_name.trim().toLowerCase() === normName)
        );
        const latestShip = matchedShipments[0];

        const finalName = nameStr || matchedCust?.name || matchedCust?.company || 'Customer';
        const finalPhone = target?.mobile || target?.phone || data?.mobile || matchedCust?.mobile || matchedCust?.whatsapp || '';
        const finalEmail = target?.email || data?.email || matchedCust?.email || '';
        
        const finalDue = target?.due ?? target?.outstanding ?? target?.balance ?? matchedCust?.outstanding_balance ?? latestUnpaidInv?.balance ?? 0;
        const finalTotal = target?.total ?? target?.total_amount ?? latestUnpaidInv?.total ?? 0;
        const finalPaid = target?.paid ?? target?.paid_amount ?? latestUnpaidInv?.paid ?? 0;
        const finalInvoiceNo = target?.invoice_no || latestUnpaidInv?.invoice_no || '';
        const finalAwb = target?.awb || latestShip?.awb || latestUnpaidInv?.awb || '';
        const finalCourier = target?.courier || latestShip?.courier || 'Express Courier';
        const finalDestination = target?.destination || latestShip?.destination || matchedCust?.city || '';

        setParsedName(finalName);
        setPhone(finalPhone);
        setEmail(finalEmail);
        setDueAmount(finalDue);
        setTotalAmount(finalTotal);
        setPaidAmount(finalPaid);
        setInvoiceNo(finalInvoiceNo);
        setAwb(finalAwb);
        setCourier(finalCourier);
        setDestination(finalDestination);

        const ctx = {
            customerName: finalName,
            companyName,
            dueAmount: finalDue,
            balance: finalDue,
            invoiceNo: finalInvoiceNo,
            awb: finalAwb,
            courier: finalCourier,
            destination: finalDestination,
            totalAmount: finalTotal,
            paidAmount: finalPaid,
            docTitle: 'Commercial Invoice / Bill of Supply'
        };

        // Smart template auto-selection based on intent and real data
        let chosenTpl = null;
        if (target?.category === 'Invoice Due' || target?.category === 'B2B Payment' || Number(finalDue) > 0) {
            chosenTpl = templates.find(t => t.category === 'payment_reminder' || t.id === 'payment_reminder');
        } else if (finalAwb) {
            chosenTpl = templates.find(t => t.category === 'dispatch' || t.id === 'shipment_dispatch');
        } else if (Number(finalTotal) > 0) {
            chosenTpl = templates.find(t => t.category === 'invoice' || t.id === 'invoice_share');
        } else {
            chosenTpl = templates.find(t => t.category === 'greeting' || t.id === 'general_greeting') || templates[0];
        }

        if (chosenTpl) {
            setSelectedTemplateId(chosenTpl.id);
            setMessage(formatTemplate(chosenTpl.body, ctx));
            if (chosenTpl.channel && chosenTpl.channel !== 'All') {
                setChannel(chosenTpl.channel);
            }
        } else {
            setSelectedTemplateId('custom');
            setMessage(CommTemplates.generalGreeting(ctx));
        }
    }

    const getContextData = () => ({
        customerName: parsedName,
        companyName,
        dueAmount,
        balance: dueAmount,
        invoiceNo,
        awb,
        courier,
        destination,
        totalAmount,
        paidAmount,
        docTitle: 'Commercial Invoice / Bill of Supply'
    });

    const applyTemplate = (tpl) => {
        setSelectedTemplateId(tpl.id);
        const ctx = getContextData();
        setMessage(formatTemplate(tpl.body, ctx));
        if (tpl.channel && tpl.channel !== 'All') {
            setChannel(tpl.channel);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!phone.trim()) {
            alert('Please enter a valid mobile number for WhatsApp.');
            return;
        }
        openWhatsApp({ phone, message });
        try {
            await apiClient.logCommunication({
                customer: parsedName,
                channel: 'WhatsApp',
                staff,
                date: businessDate(),
                message: `[WhatsApp Sent to ${phone}]: ${message.trim()}`
            });
            onCreated?.();
        } catch (e) {
            console.warn('Auto log error:', e);
        }
    };

    const handleSendEmail = async () => {
        if (!email.trim()) {
            alert('Please enter a valid email address.');
            return;
        }
        openEmail({ email, subject: `${companyName} - Update regarding your shipment / account`, body: message });
        try {
            await apiClient.logCommunication({
                customer: parsedName,
                channel: 'Email',
                staff,
                date: businessDate(),
                message: `[Email Sent to ${email}]: ${message.trim()}`
            });
            onCreated?.();
        } catch (e) {
            console.warn('Auto log error:', e);
        }
    };

    const handleCall = () => {
        if (!phone.trim()) {
            alert('Please enter a phone number to dial.');
            return;
        }
        openCall({ phone });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            await apiClient.logCommunication({
                customer: parsedName,
                channel,
                staff,
                date: businessDate(),
                message: message.trim()
            });
            alert('Communication interaction logged to Customer 360° dossier!');
            onCreated?.();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error logging message');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const employeesList = (settings?.employees || [{ name: 'Nawaz' }, { name: 'Lata' }, { name: 'Umesh' }, { name: 'Uma' }]).map(e => (typeof e === 'string' ? e : e.name));

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200, padding: '16px' }}>
            <div className="modal" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header" style={{ background: '#0f172a', color: '#ffffff', padding: '14px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #1e64f0, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                            <MessageSquare size={19} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>Customer Communication Hub</h3>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>Direct WhatsApp, Email, Calling & CRM timeline logging</p>
                        </div>
                    </div>
                    <button className="modal-close" style={{ color: '#cbd5e1' }} onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>

                {/* Scrollable Body */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1 }}>
                    {/* Customer Context Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ fontSize: '14px', color: '#0f172a' }}>{parsedName}</strong>
                                {dueAmount > 0 && (
                                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px' }}>
                                        Due: ₹{Number(dueAmount).toLocaleString('en-IN')}
                                    </span>
                                )}
                            </div>
                            {awb && <span style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#1e64f0', fontWeight: 700 }}>AWB: {awb}</span>}
                            {invoiceNo && <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Inv: #{invoiceNo}</span>}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Phone size={13} color="#10b981" />
                                <input 
                                    type="text" 
                                    placeholder="Enter mobile number" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value)} 
                                    style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={13} color="#3b82f6" />
                                <input 
                                    type="email" 
                                    placeholder="Enter email address" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick Smart Templates */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', margin: 0 }}>
                                Configured Message Templates ({templates.length})
                            </label>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Customizable in Settings &gt; Message Templates</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                            {templates.map(tpl => {
                                const isSelected = selectedTemplateId === tpl.id;
                                return (
                                    <button 
                                        key={tpl.id}
                                        type="button" 
                                        className={`btn btn-sm ${isSelected ? 'btn-primary-blue' : 'btn-outline'}`}
                                        onClick={() => applyTemplate(tpl)}
                                        style={{ fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        <span>{tpl.title}</span>
                                        {tpl.channel && tpl.channel !== 'All' && (
                                            <span style={{ fontSize: '9.5px', opacity: 0.8, background: 'rgba(0,0,0,0.1)', padding: '1px 4px', borderRadius: '4px' }}>
                                                {tpl.channel}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message Editor */}
                    <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700 }}>
                                Message Body <span className="required">*</span>
                            </label>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {message.length} characters
                            </span>
                        </div>
                        <textarea 
                            rows={6} 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            placeholder="Type customized message or select a template..."
                            style={{ width: '100%', fontSize: '12.5px', fontFamily: 'inherit', lineHeight: '1.45', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>

                    {/* 1-Click Action Buttons */}
                    <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '12px', color: '#334155' }}>🚀 1-Click Direct Launch:</strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Opens WhatsApp / Mail app with filled text</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '8px' }}>
                            <button 
                                type="button" 
                                className="btn"
                                onClick={handleSendWhatsApp}
                                style={{ background: '#25D366', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '12px', padding: '8px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(37,211,102,0.3)', cursor: 'pointer' }}
                                title="Open WhatsApp with pre-filled message"
                            >
                                <MessageSquare size={15} />
                                <span>WhatsApp</span>
                            </button>
                            <button 
                                type="button" 
                                className="btn"
                                onClick={handleSendEmail}
                                style={{ background: '#3b82f6', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '12px', padding: '8px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(59,130,246,0.3)', cursor: 'pointer' }}
                                title="Open Email client with pre-filled message"
                            >
                                <Mail size={15} />
                                <span>Email</span>
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-outline"
                                onClick={handleCall}
                                style={{ fontWeight: 700, fontSize: '12px', padding: '8px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                                title="Call customer phone"
                            >
                                <PhoneCall size={14} color="#10b981" />
                                <span>Call</span>
                            </button>
                        </div>
                    </div>

                    {/* Timeline Interaction Log Section */}
                    <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '3px' }}>Channel</label>
                                <select 
                                    value={channel} 
                                    onChange={e => setChannel(e.target.value)}
                                    style={{ width: '100%', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                >
                                    {['WhatsApp', 'Email', 'Phone Call', 'SMS', 'In-Person', 'Other'].map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '3px' }}>Staff Representative</label>
                                <select 
                                    value={staff} 
                                    onChange={e => setStaff(e.target.value)}
                                    style={{ width: '100%', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                >
                                    {employeesList.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Close</button>
                            <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                                {isSubmitting ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                                <span>Log Interaction to CRM Timeline</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const INITIAL_B2B_FORM = {
    company_name: '',
    contact_person: '',
    mobile: '',
    email: '',
    gst_number: '',
    billing_address: '',
    credit_limit: '',
    credit_period_days: 30,
    payment_terms: 'Net 30 Days'
};

const B2BCompanyForm = ({ isOpen, onClose, onCreated, settings }) => {
    const [form, setForm] = useState(() => ({...INITIAL_B2B_FORM, credit_limit: settings?.defaultB2BCreditLimit ?? 100000, credit_period_days: settings?.defaultB2BCreditDays ?? 30, payment_terms: `Net ${settings?.defaultB2BCreditDays ?? 30} Days`}));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiClient.createB2BCompany({
                ...form,
                credit_limit: Number(form.credit_limit),
                credit_period_days: Number(form.credit_period_days)
            });
            alert(`B2B Company ${form.company_name} registered successfully!`);
            onCreated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error registering B2B company');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '580px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building size={18} color="#7e22ce" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Register Corporate B2B Client</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configure corporate credit limits and billing terms</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Company Legal Name <span className="required">*</span></label>
                            <input type="text" required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Apex Global Logistics" />
                        </div>
                        <div className="form-group">
                            <label>Contact Person <span className="required">*</span></label>
                            <input type="text" required value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="e.g. Rajesh Khurana" />
                        </div>
                        <div className="form-group">
                            <label>Mobile Number <span className="required">*</span></label>
                            <input type="text" required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit number" />
                        </div>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="accounts@company.com" />
                        </div>
                        <div className="form-group">
                            <label>GST Number</label>
                            <input type="text" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} placeholder="e.g. 27AAACT0982F1Z1" />
                        </div>
                        <div className="form-group">
                            <label>Credit Limit (₹) <span className="required">*</span></label>
                            <input type="number" min="0" required value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} placeholder="e.g. 150000" />
                        </div>
                        <div className="form-group">
                            <label>Credit Period (Days)</label>
                            <input required type="number" min="1" max="365" step="1" value={form.credit_period_days} onChange={e => setForm({...form, credit_period_days: e.target.value, payment_terms: `Net ${e.target.value} Days`})} />
                        </div>
                        <div className="form-group">
                            <label>Payment Terms</label>
                            <input type="text" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Corporate Billing Address</label>
                            <textarea rows="2" value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })} placeholder="Registered GST office address..." />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="spin" />
                                    <span>Saving Profile...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    <span>Save B2B Profile</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const ShipmentStatusModal = ({ isOpen, onClose, shipment, onUpdated }) => {
    const [status, setStatus] = useState(shipment?.status || 'In Transit');
    const [delayReason, setDelayReason] = useState(shipment?.delay_reason || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !shipment) return null;

    const handleUpdate = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiClient.updateShipmentStatus(shipment.id, {
                status,
                delay_reason: status === 'Delayed' ? delayReason : null
            });
            alert(`Shipment ${shipment.awb} status updated to ${status}!`);
            onUpdated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error updating status');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '460px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={18} color="var(--primary-blue)" />
                        <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Update Status: {shipment.awb}</h3>
                    </div>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>
                <form onSubmit={handleUpdate}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label>Consignment Tracking Status <span className="required">*</span></label>
                        <select value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="Booked">Booked (At Origin Hub)</option>
                            <option value="Picked Up">Picked Up (Handed over to carrier)</option>
                            <option value="In Transit">In Transit (Air / Surface linehaul)</option>
                            <option value="Delivered">Delivered (Completed)</option>
                            <option value="Delayed">Delayed (Exception)</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    {status === 'Delayed' && (
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                            <label>Reason for Delay <span className="required">*</span></label>
                            <input 
                                type="text" 
                                required 
                                value={delayReason} 
                                onChange={e => setDelayReason(e.target.value)} 
                                placeholder="e.g. Flight technical delay, Customs clearance hold" 
                            />
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="spin" />
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <Check size={14} />
                                    <span>Update Status</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const B2BCompanyModal = props => props.isOpen ? <B2BCompanyForm {...props} /> : null;

export const CommunicationModal = props => props.isOpen ? <CommunicationForm {...props} /> : null;
