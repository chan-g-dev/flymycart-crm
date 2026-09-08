import React, { useState } from 'react';
import { X, Check, RotateCcw, MessageSquare, Send, Save, CreditCard, Building, Truck, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';

export const WalletRechargeModal = ({ isOpen, onClose, walletName, onRecharged, settings }) => {
    const [amount, setAmount] = useState('');
    const [paidFrom, setPaidFrom] = useState('Current Account (HDFC)');
    const [reference, setReference] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const todayStr = new Date().toISOString().slice(0, 10);

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
                reference: reference || 'Bank Transfer'
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

    const paidFromAccounts = settings?.paidToAccounts?.filter(a => a.toLowerCase().includes('account') || a.toLowerCase().includes('bank')) || [
        'Current Account (HDFC)',
        'Savings Account (ICICI)'
    ];

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
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Transfer Amount (₹) <span className="required">*</span></label>
                            <input type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 25000" />
                        </div>
                        <div className="form-group">
                            <label>Paid From Bank Account</label>
                            <select value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
                                {paidFromAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Reference / Bank UTR Number</label>
                            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. RTGS/HDFC982103..." />
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
        refund_method: 'UPI: 9820011223@paytm'
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
                        ℹ️ <strong>Accounting Rule 9:</strong> Approved refunds automatically deduct from business Net Profit in EOD and Monthly P&L statements.
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

export const CommunicationModal = ({ isOpen, onClose, customerName, onCreated, settings }) => {
    const [channel, setChannel] = useState('WhatsApp');
    const [message, setMessage] = useState('');
    const [staff, setStaff] = useState('Nawaz');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            await apiClient.logCommunication({
                customer: customerName,
                channel,
                staff,
                date: new Date().toISOString().slice(0, 10),
                message: message.trim()
            });
            alert('Communication interaction logged to Customer 360° dossier!');
            onCreated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error logging message');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const employeesList = (settings?.employees || [{ name: 'Nawaz' }, { name: 'Lata' }, { name: 'Umesh' }, { name: 'Uma' }]).map(e => e.name);

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '520px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageSquare size={18} color="var(--primary-blue)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Log Contact with {customerName}</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Records interaction to Customer 360° timeline</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Communication Channel</label>
                            <select value={channel} onChange={e => setChannel(e.target.value)}>
                                <option value="WhatsApp">WhatsApp Message</option>
                                <option value="Call">Phone Call Log</option>
                                <option value="Email">Email</option>
                                <option value="SMS">SMS Notification</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Staff Member</label>
                            <select value={staff} onChange={e => setStaff(e.target.value)}>
                                {employeesList.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Conversation Notes / Message <span className="required">*</span></label>
                            <textarea rows="3" required value={message} onChange={e => setMessage(e.target.value)} placeholder="Summary of discussion or message sent to client..." />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="spin" />
                                    <span>Logging...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={14} />
                                    <span>Log Communication</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
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

export const B2BCompanyModal = ({ isOpen, onClose, onCreated }) => {
    const [form, setForm] = useState(INITIAL_B2B_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setForm(INITIAL_B2B_FORM);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiClient.createB2BCompany({
                ...form,
                credit_limit: parseFloat(form.credit_limit) || 100000,
                credit_period_days: parseInt(form.credit_period_days) || 30
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
                            <select value={form.credit_period_days} onChange={e => setForm({ ...form, credit_period_days: e.target.value, payment_terms: `Net ${e.target.value} Days` })}>
                                <option value="30">30 Days</option>
                                <option value="40">40 Days</option>
                                <option value="50">50 Days</option>
                                <option value="60">60 Days</option>
                                <option value="90">90 Days</option>
                            </select>
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
