import React, { useState } from 'react';
import { X, UserPlus, Save, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';

const INITIAL_FORM = {
    name: '',
    company: '',
    mobile: '',
    whatsapp: '',
    email: '',
    address: '',
    id_proof: '',
    customer_type: 'C2C',
    credit_limit: '',
    credit_period_days: '',
    source: 'Walk-in'
};

const CustomerModal = ({ isOpen, onClose, onCreated }) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Clean reset whenever modal opens or closes
    React.useEffect(() => {
        if (isOpen) {
            setForm(INITIAL_FORM);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await apiClient.createCustomer({
                ...form,
                credit_limit: parseFloat(form.credit_limit) || 0,
                credit_period_days: parseInt(form.credit_period_days) || 30
            });
            onCreated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error creating customer');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '640px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserPlus size={18} color="var(--primary-blue)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Register Permanent Customer</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-attaches future shipments, invoices and payments to this 360° profile</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Customer Full Name <span className="required">*</span></label>
                            <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Sharma" />
                        </div>
                        <div className="form-group">
                            <label>Company / Trade Name</label>
                            <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. TechNovus Solutions" />
                        </div>
                        <div className="form-group">
                            <label>Primary Mobile Number <span className="required">*</span></label>
                            <input type="text" required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="10-digit number" />
                        </div>
                        <div className="form-group">
                            <label>WhatsApp Number</label>
                            <input type="text" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="For invoice sharing" />
                        </div>
                        <div className="form-group">
                            <label>Email Address</label>
                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
                        </div>
                        <div className="form-group">
                            <label>Customer Type <span className="required">*</span></label>
                            <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })}>
                                <option value="C2C">C2C (Individual Walk-in)</option>
                                <option value="B2C">B2C (Commercial Business)</option>
                                <option value="B2B">B2B (Corporate Monthly Credit)</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Full Address / Location</label>
                            <textarea rows="2" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Office / residence address..." />
                        </div>

                        {form.customer_type === 'B2B' && (
                            <>
                                <div className="form-group">
                                    <label>Credit Limit (₹)</label>
                                    <input type="number" min="0" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} placeholder="e.g. 100000" />
                                </div>
                                <div className="form-group">
                                    <label>Credit Period (Days)</label>
                                    <input type="number" min="0" value={form.credit_period_days} onChange={e => setForm({ ...form, credit_period_days: e.target.value })} placeholder="e.g. 30" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={13} className="spin" />
                                    <span>Saving Profile...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    <span>Save Customer Profile</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomerModal;
