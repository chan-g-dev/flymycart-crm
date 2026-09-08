import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Package, 
    Save,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { CourierLogo } from './CourierLogos';

const getInitialShipmentForm = (todayStr) => ({
    awb: '',
    date: todayStr,
    pickup_date: todayStr,
    delivery_date: '',
    center: 'Main Hub (Bangalore)',
    employee: 'Nawaz',
    customer_id: '',
    customer_name: '',
    customer_type: 'C2C',
    sender_phone: '',
    sender_address: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_city: '',
    receiver_country: 'USA',
    receiver_zip: '',
    receiver_address: '',
    description: '',
    packages_count: 1,
    actual_weight: '',
    length: '',
    width: '',
    height: '',
    volumetric_weight: 0,
    chargeable_weight: 0,
    courier: 'FedEx',
    domestic_international: 'International',
    service_type: 'International Priority',
    provider_type: '',
    provider_name: '',
    price: '',
    provider_cost: '',
    payment_status: 'Paid',
    amount_received: '',
    payment_method: 'PhonePe',
    paid_to: 'Office QR',
    collected_by: 'Nawaz',
    status: 'Booked',
    delay_reason: ''
});

const ShipmentModal = ({ isOpen, onClose, onCreated, settings }) => {
    const { currentUser } = useAuth();
    const canEnterShipmentCosts = currentUser?.isSuperAdmin
        || currentUser?.roleId === 'super_admin'
        || currentUser?.roleId === 'operations_staff';
    const todayStr = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState(getInitialShipmentForm(todayStr));
    const lookupSequence = useRef(0);
    const [customerFound, setCustomerFound] = useState(null);
    const [, setIsSearchingCustomer] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Clean reset whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setForm(getInitialShipmentForm(todayStr));
            setCustomerFound(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    // Auto-calculate Volumetric & Chargeable weight in real-time
    useEffect(() => {
        const l = parseFloat(form.length) || 0;
        const w = parseFloat(form.width) || 0;
        const h = parseFloat(form.height) || 0;
        const actual = parseFloat(form.actual_weight) || 0;

        const divisor = /cargo|ltl/i.test(`${form.service_type} ${form.courier}`) ? 4000 : 5000;
        const vol = (l * w * h) / divisor;
        const chg = Math.max(actual, vol);

        setForm(prev => ({
            ...prev,
            volumetric_weight: parseFloat(vol.toFixed(2)),
            chargeable_weight: parseFloat(chg.toFixed(2))
        }));
    }, [form.length, form.width, form.height, form.actual_weight, form.service_type, form.courier]);

    // Courier and accounting provider are selected independently. A courier can
    // be billed through different contracted providers, so do not assume one.
    const handleCourierChange = (courierName) => {
        setForm(prev => ({ ...prev, courier: courierName }));
    };

    const handleProviderChange = (value) => {
        const [providerType = '', providerName = ''] = value.split('|');
        setForm(prev => ({ ...prev, provider_type: providerType, provider_name: providerName }));
    };

    // Live mobile lookup & auto-fill customer profile
    const handleMobileLookup = async (mobileVal) => {
        const sequence = ++lookupSequence.current;
        setForm(prev => ({ ...prev, sender_phone: mobileVal, customer_id: '' }));
        if (mobileVal.trim().length >= 4) {
            setIsSearchingCustomer(true);
            try {
                const res = await apiClient.lookupCustomerByMobile(mobileVal.trim());
                if (sequence !== lookupSequence.current) return;
                if (res.found && res.customer) {
                    const c = res.customer;
                    setCustomerFound(c.name);
                    setForm(prev => ({
                        ...prev,
                        customer_id: c.id,
                        customer_name: c.name,
                        customer_type: c.customer_type,
                        sender_address: c.address || prev.sender_address
                    }));
                } else {
                    setCustomerFound(null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (sequence === lookupSequence.current) setIsSearchingCustomer(false);
            }
        } else {
            setCustomerFound(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.awb.trim()) {
            alert('Please enter an AWB tracking number');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                awb: form.awb.trim().toUpperCase(),
                date: form.date,
                pickup_date: form.pickup_date || form.date,
                delivery_date: form.delivery_date || null,
                customer_id: form.customer_id || null,
                customer_name: form.customer_name.trim(),
                customer_type: form.customer_type,
                center: form.center,
                employee: form.employee,
                sender: {
                    name: form.customer_name.trim(),
                    phone: form.sender_phone.trim(),
                    address: form.sender_address.trim()
                },
                receiver: {
                    name: form.receiver_name.trim(),
                    phone: form.receiver_phone.trim(),
                    city: form.receiver_city.trim(),
                    country: form.receiver_country.trim(),
                    zip: form.receiver_zip.trim(),
                    address: form.receiver_address.trim()
                },
                parcel: {
                    description: form.description,
                    packages_count: parseInt(form.packages_count) || 1,
                    actual_weight: parseFloat(form.actual_weight) || 0,
                    length: parseFloat(form.length) || 0,
                    width: parseFloat(form.width) || 0,
                    height: parseFloat(form.height) || 0,
                    volumetric_weight: form.volumetric_weight,
                    chargeable_weight: form.chargeable_weight
                },
                courier: form.courier,
                domestic_international: form.domestic_international,
                service_type: form.service_type,
                provider_type: form.provider_type || 'postpaid',
                provider_name: form.provider_name || 'Aramex',
                price: parseFloat(form.price) || 0,
                provider_cost: parseFloat(form.provider_cost) || 0,
                payment_status: form.payment_status,
                amount_received: form.payment_status === 'Partial' ? Number(form.amount_received) : null,
                payment_method: form.payment_method,
                paid_to: form.paid_to,
                collected_by: form.collected_by,
                status: form.status,
                delay_reason: form.delay_reason
            };

            await apiClient.createShipment(payload);
            alert(`Shipment ${payload.awb} booked successfully! Invoice generated.`);
            onCreated();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error booking shipment');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const estimatedMargin = (parseFloat(form.price) || 0) - (parseFloat(form.provider_cost) || 0);
    const marginPct = form.price > 0 ? ((estimatedMargin / form.price) * 100).toFixed(1) : 0;

    const couriersList = settings?.couriers || ['FedEx', 'Aramex', 'Delhivery', 'Blue Dart', 'DHL', 'LTL', 'UPS', 'Sree Maruthi'];
    const centersList = settings?.centers || ['Main Hub (Bangalore)', 'Delhi Regional Hub', 'Mumbai Branch', 'Hyderabad Hub', 'Kolkata Center'];
    const employeesList = (settings?.employees || [{ name: 'Nawaz' }, { name: 'Lata' }, { name: 'Umesh' }, { name: 'Uma' }]).map(e => e.name);
    const paidToAccounts = settings?.paidToAccounts || ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];
    const paymentMethods = settings?.paymentMethods || ['PhonePe', 'Google Pay', 'Office QR', 'Cash', 'Bank Transfer', 'B2B Credit'];

    return (
        <div className="modal-overlay">
            <div className="modal modal-lg shipment-booking-modal" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={19} color="var(--primary-blue)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>New Shipment Booking (Single-Entry Master)</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Instant data propagation &rarr; Customer, Invoice, Provider Wallet/Ledger & Real-time Profit
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Form Body */}
                <form className="shipment-booking-form" onSubmit={handleSubmit}>
                    {/* Section 1: Center, Staff & Dates */}
                    <div className="form-section-title">
                        <span>1. Center, Staff & Booking Info</span>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Business Center <span className="required">*</span></label>
                            <select value={form.center} onChange={e => setForm({ ...form, center: e.target.value })}>
                                {centersList.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Staff Handled <span className="required">*</span></label>
                            <select value={form.employee} onChange={e => setForm({ ...form, employee: e.target.value })}>
                                {employeesList.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Booking Date <span className="required">*</span></label>
                            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value, pickup_date: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label>AWB Tracking Number <span className="required">*</span></label>
                            <input 
                                type="text" 
                                value={form.awb} 
                                onChange={e => setForm({ ...form, awb: e.target.value })} 
                                placeholder="e.g. FX260831099" 
                                required 
                                style={{ fontWeight: 800, color: 'var(--primary-blue)', fontFamily: 'monospace' }} 
                            />
                        </div>
                    </div>

                    {/* Section 2: Sender & Customer Profile with Auto-Fill */}
                    <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>2. Sender & Customer Details (Auto-Fill on Mobile)</span>
                        {customerFound && (
                            <span style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} /> Profile Linked: {customerFound}
                            </span>
                        )}
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Mobile Number <span className="required">*</span></label>
                            <input 
                                type="text" 
                                value={form.sender_phone} 
                                onChange={e => handleMobileLookup(e.target.value)} 
                                placeholder="10-digit mobile number" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Customer / Company Name <span className="required">*</span></label>
                            <input 
                                type="text" 
                                value={form.customer_name} 
                                onChange={e => setForm({ ...form, customer_name: e.target.value })} 
                                placeholder="Full Name or Company Name" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Customer Category</label>
                            <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })}>
                                <option value="C2C">C2C (Retail Walk-in)</option>
                                <option value="B2C">B2C (Commercial Business)</option>
                                <option value="B2B">B2B (Corporate Monthly Credit)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Pickup / Sender Address</label>
                            <input 
                                type="text" 
                                value={form.sender_address} 
                                onChange={e => setForm({ ...form, sender_address: e.target.value })} 
                                placeholder="Full street address / Area" 
                            />
                        </div>
                    </div>

                    {/* Section 3: Receiver & Destination */}
                    <div className="form-section-title">
                        <span>3. Receiver & Destination Details</span>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Receiver Name <span className="required">*</span></label>
                            <input 
                                type="text" 
                                value={form.receiver_name} 
                                onChange={e => setForm({ ...form, receiver_name: e.target.value })} 
                                placeholder="Receiver person / company name" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Receiver Phone Number</label>
                            <input 
                                type="text" 
                                value={form.receiver_phone} 
                                onChange={e => setForm({ ...form, receiver_phone: e.target.value })} 
                                placeholder="+1 / +971 / +91 number" 
                            />
                        </div>
                        <div className="form-group">
                            <label>Destination City <span className="required">*</span></label>
                            <input 
                                type="text" 
                                value={form.receiver_city} 
                                onChange={e => setForm({ ...form, receiver_city: e.target.value })} 
                                placeholder="e.g. Dubai, New York, London, Delhi" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Destination Country <span className="required">*</span></label>
                            <input 
                                type="text" 
                                value={form.receiver_country} 
                                onChange={e => {
                                    const c = e.target.value;
                                    setForm({ 
                                        ...form, 
                                        receiver_country: c,
                                        domestic_international: (c.toLowerCase() === 'india') ? 'Domestic' : 'International'
                                    });
                                }} 
                                placeholder="USA / UAE / UK / India" 
                                required 
                            />
                        </div>
                    </div>

                    {/* Section 4: Parcel Dimensions & Volumetric Engine */}
                    <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>4. Parcel & Weight Calculator (L &times; W &times; H / 5000)</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 800, background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>
                            Chargeable: {form.chargeable_weight} kg ({parseFloat(form.actual_weight) >= parseFloat(form.volumetric_weight) ? 'Actual Applied' : 'Volumetric Applied'})
                        </span>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Contents Description</label>
                            <input 
                                type="text" 
                                value={form.description} 
                                onChange={e => setForm({ ...form, description: e.target.value })} 
                                placeholder="e.g. Documents, Samples, Garments" 
                            />
                        </div>
                        <div className="form-group">
                            <label>Actual Weight (KG) <span className="required">*</span></label>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0.01" 
                                value={form.actual_weight} 
                                onChange={e => setForm({ ...form, actual_weight: e.target.value })} 
                                placeholder="e.g. 2.50"
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Dimensions (L &times; W &times; H cm)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                                <input type="number" placeholder="L (cm)" min="0" value={form.length} onChange={e => setForm({ ...form, length: e.target.value })} />
                                <input type="number" placeholder="W (cm)" min="0" value={form.width} onChange={e => setForm({ ...form, width: e.target.value })} />
                                <input type="number" placeholder="H (cm)" min="0" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Volumetric Weight</label>
                            <input 
                                type="text" 
                                readOnly 
                                value={`${form.volumetric_weight} kg`} 
                                style={{ background: '#f8fafc', fontWeight: 700, color: '#64748b' }} 
                            />
                        </div>
                    </div>

                    {/* Operations Staff and Super Admin enter the complete shipment costing record. */}
                    {canEnterShipmentCosts ? (
                        <>
                            <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>5. Courier Partner, Cost Accounting & Gross Profit</span>
                                <span style={{ fontSize: '11px', color: estimatedMargin >= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 800, background: estimatedMargin >= 0 ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                                    Gross Margin: ₹{estimatedMargin.toLocaleString('en-IN')} ({marginPct}%)
                                </span>
                            </div>
                            <div className="form-grid shipment-pricing-grid">
                                <div className="form-group">
                                    <div className="shipment-pricing-label">
                                        <label style={{ margin: 0 }}>Courier Provider <span className="required">*</span></label>
                                        <CourierLogo courier={form.courier} height={18} />
                                    </div>
                                    <select value={form.courier} onChange={e => handleCourierChange(e.target.value)}>
                                        {couriersList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Accounting Provider <span className="required">*</span></label>
                                    <select required value={form.provider_type && form.provider_name ? `${form.provider_type}|${form.provider_name}` : ''} onChange={e => handleProviderChange(e.target.value)}>
                                        <option value="" disabled>Select provider & billing</option>
                                        <option value="postpaid|Aramex">Aramex (Postpaid)</option>
                                        <option value="postpaid|Blue Dart">Blue Dart (Postpaid)</option>
                                        <option value="prepaid|ICL">ICL (Prepaid)</option>
                                        <option value="prepaid|BRV Logistics">BRV Logistics (Prepaid)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Customer Price / Sale (₹) <span className="required">*</span></label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={form.price} 
                                        onChange={e => setForm({ ...form, price: e.target.value })} 
                                        placeholder="e.g. 3500" 
                                        required 
                                        style={{ fontWeight: 800, color: 'var(--text-main)' }} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Predicted Provider Cost (₹) <span className="required">*</span></label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={form.provider_cost} 
                                        onChange={e => setForm({ ...form, provider_cost: e.target.value })} 
                                        placeholder="e.g. 2200" 
                                        required 
                                        style={{ fontWeight: 700, color: '#dc2626' }} 
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-section-title">
                                <span>5. Courier Partner & Customer Price</span>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label style={{ margin: 0 }}>Courier Provider <span className="required">*</span></label>
                                        <CourierLogo courier={form.courier} height={18} />
                                    </div>
                                    <select value={form.courier} onChange={e => handleCourierChange(e.target.value)}>
                                        {couriersList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Customer Selling Price (₹) <span className="required">*</span></label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        value={form.price} 
                                        onChange={e => setForm({ ...form, price: e.target.value })} 
                                        placeholder="e.g. 3500" 
                                        required 
                                        style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '15px' }} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Shipment Type</label>
                                    <select value={form.domestic_international} onChange={e => setForm({ ...form, domestic_international: e.target.value })}>
                                        <option value="Domestic">Domestic</option>
                                        <option value="International">International</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Courier Service</label>
                                    <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}>
                                        <option value="International Priority">International Priority</option>
                                        <option value="International Economy">International Economy</option>
                                        <option value="Domestic Express">Domestic Express</option>
                                        <option value="Surface">Surface</option>
                                        <option value="Cargo">Cargo / LTL</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Section 6: Payment Settlement & Two-Party Audit */}
                    <div className="form-section-title">
                        <span>6. Payment Settlement & Two-Party Employee Audit</span>
                    </div>
                    <div className="form-grid" style={{ marginBottom: '8px' }}>
                        <div className="form-group">
                            <label>Payment Status <span className="required">*</span></label>
                            <select value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                                <option value="Paid">Paid (Cash / UPI / QR / Bank)</option>
                                <option value="B2B Credit">B2B Corporate Credit (Receivable)</option>
                                <option value="Partial">Partial Payment</option>
                                <option value="Unpaid">Unpaid / Due</option>
                            </select>
                            {form.payment_status === 'Partial' && <input type="number" min="0.01" max={form.price} step="0.01" required aria-label="Amount received" placeholder="Amount received" value={form.amount_received} onChange={e => setForm({ ...form, amount_received: e.target.value })} />}
                        </div>
                        <div className="form-group">
                            <label>Payment Mode</label>
                            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                                {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Paid To (Account / QR) <span className="required">*</span></label>
                            <select value={form.paid_to} onChange={e => setForm({ ...form, paid_to: e.target.value })}>
                                {paidToAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Collected By Staff <span className="required">*</span></label>
                            <select value={form.collected_by} onChange={e => setForm({ ...form, collected_by: e.target.value })}>
                                {employeesList.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Modal Footer Actions */}
                    <div className="form-actions" style={{ position: 'sticky', bottom: 0, background: 'var(--bg-card)', paddingTop: '10px', borderTop: '1px solid var(--card-border)' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary-blue" disabled={isSubmitting} style={{ padding: '8px 20px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer' }}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={14} className="spin" />
                                    <span>Booking Shipment...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    <span>Confirm & Book Master Shipment</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShipmentModal;
