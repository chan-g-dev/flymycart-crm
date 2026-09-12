import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    CheckCircle2, 
    Loader2, 
    Search, 
    Building2, 
    User, 
    MapPin, 
    Package, 
    Truck, 
    Receipt, 
    Plus, 
    Trash2,
    Calculator,
    Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

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
    is_gst_applicable: true,
    gst_rate: '18',
    custom_gst_rate: '',
    sender_phone: '',
    same_sender: true,
    alternate_sender_name: '',
    alternate_sender_phone: '',
    sender_city: '',
    sender_zip: '',
    sender_country: 'India',
    sender_address: '',
    sender_email: '',
    sender_id_proof: '',
    receiver_email: '',
    receiver_state: '',
    boxes: [],
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
    payment_status: 'Unpaid',
    payment_reference: '',
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
    const localToday = new Date();
    const todayStr = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
    const [form, setForm] = useState(getInitialShipmentForm(todayStr));
    const lookupSequence = useRef(0);
    const workspaceRef = useRef(null);
    const [customerFound, setCustomerFound] = useState(null);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Clean reset whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setForm(getInitialShipmentForm(todayStr));
            setCustomerFound(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement;
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        workspaceRef.current?.querySelector('button')?.focus();
        const keyboard = event => {
            if (event.key === 'Escape' && !isSubmitting) onClose();
            if (event.key !== 'Tab') return;
            const nodes = [...(workspaceRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || [])].filter(node => node.getClientRects().length);
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', keyboard);
        return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keyboard); previouslyFocused?.focus(); };
    }, [isOpen, isSubmitting, onClose]);

    // Auto-calculate Volumetric & Chargeable weight in real-time
    useEffect(() => {
        const l = parseFloat(form.length) || 0;
        const w = parseFloat(form.width) || 0;
        const h = parseFloat(form.height) || 0;
        const actual = form.boxes.length ? form.boxes.reduce((sum, box) => sum + (Number(box.actual_weight) || 0), 0) : parseFloat(form.actual_weight) || 0;

        const divisor = /cargo/i.test(`${form.service_type} ${form.courier}`) ? 4000 : 5000;
        const vol = form.boxes.length ? form.boxes.reduce((sum, box) => sum + Number(box.length) * Number(box.width) * Number(box.height) / divisor, 0) : (l * w * h) / divisor;
        const chg = Math.max(actual, vol);

        setForm(prev => ({
            ...prev,
            ...(form.boxes.length ? { actual_weight: actual, packages_count: form.boxes.length } : {}),
            volumetric_weight: parseFloat(vol.toFixed(2)),
            chargeable_weight: parseFloat(chg.toFixed(2))
        }));
    }, [form.length, form.width, form.height, form.actual_weight, form.service_type, form.courier, form.boxes]);

    const courierKey = (name) => {
        const key = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return ({ dhlexpress: 'dhl' })[key] || key;
    };
    const defaultPostpaid = [
        { name: 'Aramex' },
        { name: 'Blue Dart' },
        { name: 'FedEx' },
        { name: 'DHL Express' },
        { name: 'DHL' },
        { name: 'Delhivery' },
        { name: 'UPS' },
        { name: 'Sree Maruthi' },
        { name: 'Trackon' },
        { name: 'DTDC' },
        { name: 'Speed Post' }
    ];
    const defaultPrepaid = [{ name: 'ICL' }, { name: 'BRV' }];
    const postpaidProviders = (settings?.postpaidProviders && settings.postpaidProviders.length > 0) ? settings.postpaidProviders : defaultPostpaid;
    const prepaidWallets = (settings?.prepaidWallets && settings.prepaidWallets.length > 0) ? settings.prepaidWallets : defaultPrepaid;

    useEffect(() => {
        if (!isOpen) return;
        setForm(prev => {
            if (prev.provider_type === 'prepaid' && prepaidWallets.some(p => p.name === prev.provider_name)) return prev;
            const account = postpaidProviders.find(p => courierKey(p.name) === courierKey(prev.courier)) || postpaidProviders[0];
            return { ...prev, provider_type: 'postpaid', provider_name: account?.name || prev.courier || postpaidProviders[0]?.name || 'FedEx' };
        });
    }, [isOpen, settings]);

    const handleCourierChange = (courierName) => {
        const account = postpaidProviders.find(p => courierKey(p.name) === courierKey(courierName));
        setForm(prev => ({
            ...prev,
            courier: courierName,
            ...(prev.provider_type === 'prepaid' ? {} : {
                provider_type: 'postpaid',
                provider_name: account?.name || courierName
            })
        }));
    };

    const handleProviderChange = (value) => {
        const [providerType = '', providerName = ''] = value.split('|');
        const matchedCourier = providerType === 'postpaid' 
            ? (postpaidProviders.find(p => courierKey(p.name) === courierKey(providerName))?.name || providerName)
            : form.courier;

        setForm(prev => ({ 
            ...prev, 
            provider_type: providerType || 'postpaid', 
            provider_name: providerName || prev.courier,
            ...(providerType === 'postpaid' ? { courier: matchedCourier } : {})
        }));
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
                        sender_email: c.email || '',
                        sender_id_proof: c.id_proof || '',
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

    const effectiveGstRate = form.is_gst_applicable 
        ? (form.gst_rate === 'custom' ? (Number(form.custom_gst_rate) || 0) : (Number(form.gst_rate) || 0))
        : 0;
    const estimatedMargin = (parseFloat(form.price) || 0) - (parseFloat(form.provider_cost) || 0);

    const couriersList = React.useMemo(() => {
        const base = settings?.couriers || ['FedEx', 'Aramex', 'Delhivery', 'Blue Dart', 'DHL', 'UPS', 'Sree Maruthi', 'Trackon', 'DTDC', 'Speed Post', 'ICL', 'BRV'];
        const fromWallets = (settings?.prepaidWallets || []).map(w => typeof w === 'string' ? w : w?.name);
        const fromPostpaid = (settings?.providerAccounts || []).map(p => typeof p === 'string' ? p : p?.name);
        return Array.from(new Set([...base, ...fromWallets, ...fromPostpaid])).filter(Boolean);
    }, [settings]);
    const centersList = settings?.centers || ['Main Hub (Bangalore)', 'Delhi Regional Hub', 'Mumbai Branch', 'Hyderabad Hub', 'Kolkata Center'];
    const employeesList = (settings?.employees || [{ name: 'Nawaz' }, { name: 'Lata' }, { name: 'Umesh' }, { name: 'Uma' }]).map(e => e.name);
    const paidToAccounts = settings?.paidToAccounts || ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];
    const paymentMethods = settings?.paymentMethods || ['PhonePe', 'Google Pay', 'Office QR', 'Cash', 'Bank Transfer', 'B2B Credit'];

    const money = value => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
    const gst = Math.round((Number(form.price) || 0) * effectiveGstRate) / 100;
    const invoiceTotal = Math.round(((Number(form.price) || 0) + gst) * 100) / 100;
    const payingNow = ['Paid', 'Partial'].includes(form.payment_status);
    const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.awb.trim()) {
            alert('Please enter an AWB tracking number');
            return;
        }

        if (!form.provider_type || !form.provider_name) {
            alert('Select a billing account for this courier');
            return;
        }
        if (isSubmitting) return;
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
                customer_mobile: form.sender_phone.trim(),
                is_gst_applicable: !!form.is_gst_applicable,
                gst_rate: effectiveGstRate,
                center: form.center,
                employee: form.employee,
                sender: {
                    email: form.sender_email,
                    id_proof: form.sender_id_proof,
                    name: (form.same_sender ? form.customer_name : form.alternate_sender_name).trim(),
                    phone: (form.same_sender ? form.sender_phone : form.alternate_sender_phone).trim(),
                    address: [form.sender_address.trim(), form.sender_city, form.sender_zip, form.sender_country].filter(Boolean).join(', ')
                },
                receiver: {
                    email: form.receiver_email,
                    state: form.receiver_state,
                    name: form.receiver_name.trim(),
                    phone: form.receiver_phone.trim(),
                    city: form.receiver_city.trim(),
                    country: form.receiver_country.trim(),
                    zip: form.receiver_zip.trim(),
                    address: form.receiver_address.trim()
                },
                parcel: {
                    boxes: form.boxes.map(box => Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Number(value) || 0]))),
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
                provider_type: form.provider_type,
                provider_name: form.provider_name,
                price: parseFloat(form.price) || 0,
                provider_cost: parseFloat(form.provider_cost) || 0,
                payment_status: ['Paid', 'Partial'].includes(form.payment_status) ? (Number(form.amount_received) >= invoiceTotal ? 'Paid' : 'Partial') : form.payment_status,
                amount_received: ['Paid', 'Partial'].includes(form.payment_status) ? Number(form.amount_received) : null,
                payment_reference: form.payment_reference,
                payment_method: form.payment_method,
                paid_to: form.paid_to,
                collected_by: form.collected_by,
                status: form.status,
                delay_reason: form.delay_reason
            };

            await apiClient.createShipment(payload);
            try {
                if (typeof onCreated === 'function') {
                    await onCreated(false);
                }
            } catch (refreshErr) {
                console.warn('Post-creation refresh error:', refreshErr);
            }
            alert(`Shipment ${payload.awb} booked successfully! Invoice generated.`);
            onClose();
        } catch (err) {
            let errorMsg = 'Error booking shipment';
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                errorMsg = 'Server request timed out. If the backend is waking up, please retry in a few moments.';
            } else if (err.code === 'ERR_NETWORK' || !err.response) {
                errorMsg = 'Cannot reach backend server. Please check your internet connection or verify the backend service status.';
            } else {
                const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
                if (typeof detail === 'string') {
                    errorMsg = detail;
                } else if (Array.isArray(detail)) {
                    errorMsg = detail.map(d => (d.loc ? `${d.loc.slice(-1)[0]}: ` : '') + (d.msg || JSON.stringify(d))).join('\n');
                } else if (detail && typeof detail === 'object') {
                    errorMsg = detail.message || detail.msg || JSON.stringify(detail);
                }
            }
            alert(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const field = (key, label, options = {}) => (
        <div className={`booking-field ${options.wide ? 'booking-wide' : ''}`} key={key}>
            <label className="booking-field-label">
                {label}{options.required && <span className="required-star">*</span>}
            </label>
            {options.items ? (
                <div className="booking-input-wrap">
                    <select 
                        value={form[key]} 
                        onChange={e => options.onChange ? options.onChange(e.target.value) : update(key, e.target.value)} 
                        required={options.required}
                        className="booking-select"
                    >
                        <option value="" disabled>Select...</option>
                        {options.items.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                </div>
            ) : options.multiline ? (
                <textarea 
                    rows={2} 
                    value={form[key]} 
                    onChange={e => update(key, e.target.value)} 
                    required={options.required}
                    placeholder={options.placeholder}
                    className="booking-textarea"
                />
            ) : (
                <div className="booking-input-wrap">
                    <input 
                        type={options.type || 'text'} 
                        value={form[key]} 
                        onChange={e => options.onChange ? options.onChange(e.target.value) : update(key, e.target.value)}
                        required={options.required} 
                        placeholder={options.placeholder} 
                        min={options.min} 
                        max={options.max} 
                        step={options.type === 'number' ? '0.01' : undefined} 
                        readOnly={options.readOnly}
                        className="booking-input"
                    />
                </div>
            )}
            {options.hint && <span className="booking-field-hint">{options.hint}</span>}
        </div>
    );

    const checks = [
        ['Customer identified', !!(form.customer_name && form.sender_phone)],
        ['Receiver name and address', !!(form.receiver_name && form.receiver_address && form.receiver_city)],
        ['Parcel measured', Number(form.actual_weight) > 0],
        ['Price and provider account', !!(Number(form.price) > 0 && form.provider_name && (!canEnterShipmentCosts || form.provider_cost !== ''))],
    ];

    return (
        <div ref={workspaceRef} className="booking-workspace" role="dialog" aria-modal="true" aria-labelledby="booking-title">
            <div className="booking-container">
                {/* Header */}
                <header className="booking-header">
                    <div className="booking-header-left">
                        <div className="booking-header-icon">
                            <Truck size={22} />
                        </div>
                        <div>
                            <h2 id="booking-title">New Shipment Booking</h2>
                            <p>Book consignment once. Invoice generation, carrier routing, and accounting sync automatically.</p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        className="booking-close-btn" 
                        aria-label="Close booking" 
                        disabled={isSubmitting} 
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </header>

                <div className="booking-layout">
                    {/* Main Form Column */}
                    <form className="booking-main" onSubmit={handleSubmit}>
                        
                        {/* 1. Handling & Hub */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <Building2 size={16} />
                                    <span>1. Booking Hub & Staff</span>
                                </div>
                                <span className="booking-card-subtitle">Select processing center and handler</span>
                            </div>
                            <div className="booking-fields">
                                {field('center', 'Business Center', { items: centersList, required: true })}
                                {field('employee', 'Handled By', { items: employeesList, required: true })}
                            </div>
                        </div>

                        {/* 2. Customer Profile */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <User size={16} />
                                    <span>2. Customer Information</span>
                                </div>
                                <span className="booking-card-subtitle">Search existing profile or enter details</span>
                            </div>
                            
                            <div className="booking-lookup-row">
                                <div className="booking-field booking-lookup-field">
                                    <label className="booking-field-label">Customer Mobile <span className="required-star">*</span></label>
                                    <div className="booking-search-input-group">
                                        <input 
                                            type="tel" 
                                            value={form.sender_phone} 
                                            onChange={e => handleMobileLookup(e.target.value)}
                                            placeholder="Enter 10-digit mobile number"
                                            required
                                            className="booking-input"
                                        />
                                        <button 
                                            className="btn btn-primary-blue booking-search-btn" 
                                            type="button" 
                                            onClick={() => handleMobileLookup(form.sender_phone)} 
                                            disabled={isSearchingCustomer}
                                        >
                                            {isSearchingCustomer ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
                                            <span>{isSearchingCustomer ? 'Searching...' : 'Lookup'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {customerFound && (
                                <div className="booking-linked-banner">
                                    <CheckCircle2 size={16} />
                                    <span>Profile Found & Linked: <strong>{customerFound}</strong></span>
                                </div>
                            )}

                            <div className="booking-fields" style={{ marginTop: '14px' }}>
                                {field('customer_name', 'Customer / Company Name', { required: true, placeholder: 'Full Name / Company' })}
                                {field('customer_type', 'Customer Category', { items: ['C2C', 'B2C', 'B2B'] })}
                            </div>
                        </div>

                        {/* 3. Sender Details */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <MapPin size={16} />
                                    <span>3. Sender Details</span>
                                </div>
                                <label className="booking-compact-toggle">
                                    <input 
                                        type="checkbox" 
                                        checked={form.same_sender} 
                                        onChange={e => update('same_sender', e.target.checked)} 
                                    />
                                    <span className="booking-switch-sm" />
                                    <span>Same as Customer</span>
                                </label>
                            </div>

                            <div className="booking-fields">
                                {field(form.same_sender ? 'customer_name' : 'alternate_sender_name', 'Sender Name', { required: true })}
                                {field(form.same_sender ? 'sender_phone' : 'alternate_sender_phone', 'Sender Mobile', { required: true, ...(form.same_sender ? { onChange: handleMobileLookup } : {}) })}
                                {field('sender_email', 'Sender Email', { type: 'email', placeholder: 'sender@example.com' })}
                                {field('sender_id_proof', 'ID Proof (Aadhaar/Passport)', { placeholder: 'ID proof reference' })}
                                {field('sender_address', 'Pickup / Origin Address', { required: true, multiline: true, wide: true, placeholder: 'Street address, building, locality...' })}
                                {field('sender_city', 'City', { placeholder: 'City' })}
                                {field('sender_zip', 'ZIP / Pincode', { placeholder: 'Pincode' })}
                                {field('sender_country', 'Country', { placeholder: 'Country' })}
                            </div>
                        </div>

                        {/* 4. Receiver Details */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <MapPin size={16} />
                                    <span>4. Destination & Consignee</span>
                                </div>
                                <span className="booking-card-subtitle">Receiver contact & destination address</span>
                            </div>
                            <div className="booking-fields">
                                {field('receiver_name', 'Receiver Full Name', { required: true, placeholder: 'Consignee Name' })}
                                {field('receiver_phone', 'Receiver Phone / Mobile', { placeholder: 'Contact Number' })}
                                {field('receiver_email', 'Receiver Email', { type: 'email', placeholder: 'receiver@example.com' })}
                                {field('receiver_country', 'Destination Country', { required: true, onChange: value => setForm(prev => ({ ...prev, receiver_country: value, domestic_international: value.toLowerCase() === 'india' ? 'Domestic' : 'International' })) })}
                                {field('receiver_address', 'Delivery Address', { required: true, multiline: true, wide: true, placeholder: 'Full delivery street address...' })}
                                {field('receiver_city', 'City', { required: true, placeholder: 'Destination City' })}
                                {field('receiver_zip', 'ZIP / Postal Code', { placeholder: 'Postal code' })}
                                {field('receiver_state', 'State / Province', { placeholder: 'State or Province' })}
                            </div>
                        </div>

                        {/* 5. Parcel Details */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <Package size={16} />
                                    <span>5. Package & Dimensions</span>
                                </div>
                                <span className="booking-card-subtitle">Weight (kg) and dimensions (cm)</span>
                            </div>
                            <div className="booking-fields">
                                {field('description', 'Package Contents / Items', { wide: true, placeholder: 'e.g. Documents, garments, dry snacks, electronics...' })}
                                {field('packages_count', 'No. of Packages', { type: 'number', min: 1, readOnly: form.boxes.length > 0 })}
                                {field('actual_weight', 'Total Actual Weight (kg)', { type: 'number', min: 0.01, required: true, readOnly: form.boxes.length > 0 })}
                                {!form.boxes.length && (
                                    <>
                                        {field('length', 'Length (cm)', { type: 'number', min: 0 })}
                                        {field('width', 'Width (cm)', { type: 'number', min: 0 })}
                                        {field('height', 'Height (cm)', { type: 'number', min: 0 })}
                                    </>
                                )}
                            </div>

                            {form.boxes.map((box, index) => (
                                <div className="booking-multi-box" key={index}>
                                    <div className="booking-multi-box-header">
                                        <strong>Package #{index + 1}</strong>
                                        <button 
                                            type="button" 
                                            className="btn btn-sm btn-outline text-rose"
                                            onClick={() => setForm(prev => ({ ...prev, boxes: prev.boxes.filter((_, i) => i !== index) }))}
                                        >
                                            <Trash2 size={13} /> Remove Box
                                        </button>
                                    </div>
                                    <div className="booking-fields">
                                        {['length', 'width', 'height', 'actual_weight'].map(key => (
                                            <div className="booking-field" key={key}>
                                                <label className="booking-field-label">
                                                    {key === 'actual_weight' ? 'Weight (kg)' : `${key.toUpperCase()} (cm)`}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    min="0.01" 
                                                    step="0.01" 
                                                    required 
                                                    value={box[key]} 
                                                    onChange={e => setForm(prev => ({
                                                        ...prev, 
                                                        boxes: prev.boxes.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item)
                                                    }))}
                                                    className="booking-input"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <button 
                                type="button" 
                                className="btn btn-outline booking-add-box-btn" 
                                onClick={() => setForm(prev => ({ ...prev, boxes: [...prev.boxes, { length: '', width: '', height: '', actual_weight: '' }] }))}
                            >
                                <Plus size={14} /> Add Individual Box Details
                            </button>
                        </div>

                        {/* 6. Courier & Service */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <Truck size={16} />
                                    <span>6. Courier Routing & AWB</span>
                                </div>
                                <span className="booking-card-subtitle">Tracking number & carrier routing</span>
                            </div>
                            <div className="booking-fields">
                                {field('courier', 'Courier Carrier', { items: couriersList, required: true, onChange: handleCourierChange })}
                                {field('domestic_international', 'Service Scope', { items: ['Domestic', 'International'], required: true })}
                                {field('service_type', 'Service Type', { required: true, placeholder: 'e.g. Express, Priority, Economy' })}
                                {field('awb', 'Courier AWB Number', { required: true, placeholder: 'Enter tracking AWB' })}
                                {field('date', 'Booking Date', { type: 'date', required: true, onChange: value => setForm(prev => ({ ...prev, date: value, pickup_date: value })) })}
                            </div>
                        </div>

                        {/* 7. Pricing, GST & Payment */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <Receipt size={16} />
                                    <span>7. Pricing, GST & Billing Settlement</span>
                                </div>
                                <span className="booking-card-subtitle">Customer rate, provider cost, and tax terms</span>
                            </div>

                            <div className="booking-fields">
                                {field('price', 'Customer Base Price (₹)', { type: 'number', min: 0, required: true, hint: form.is_gst_applicable ? `${effectiveGstRate}% GST will be computed` : 'Bill of supply / Non-GST rate' })}
                                <div className="booking-field">
                                    <label className="booking-field-label">Provider Billing Account <span className="required-star">*</span></label>
                                    <div className="booking-input-wrap">
                                        <select 
                                            required 
                                            value={`${form.provider_type}|${form.provider_name}`} 
                                            onChange={e => handleProviderChange(e.target.value)}
                                            className="booking-select"
                                        >
                                            <option value="|">Select Account...</option>
                                            <optgroup label="Prepaid Wallets">
                                                {prepaidWallets.map(a => <option key={a.name} value={`prepaid|${a.name}`}>{a.name}</option>)}
                                            </optgroup>
                                            <optgroup label="Postpaid Accounts">
                                                {postpaidProviders.map(a => <option key={a.name} value={`postpaid|${a.name}`}>{a.name}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <span className="booking-field-hint">Prepaid wallets are debited immediately upon booking.</span>
                                </div>
                                {canEnterShipmentCosts && field('provider_cost', 'Provider Cost (₹)', { type: 'number', min: 0, required: true, hint: 'Cost paid to courier' })}
                            </div>

                            {/* GST Customization Card */}
                            <div className="booking-gst-config-box">
                                <div className="booking-gst-header-row">
                                    <label className="booking-compact-toggle">
                                        <input 
                                            type="checkbox" 
                                            checked={form.is_gst_applicable} 
                                            onChange={e => update('is_gst_applicable', e.target.checked)} 
                                        />
                                        <span className="booking-switch-sm" />
                                        <strong>Apply GST (Official Tax Invoice)</strong>
                                    </label>

                                    {form.is_gst_applicable && (
                                        <div className="booking-gst-rate-selector">
                                            <span className="booking-gst-label">GST Rate:</span>
                                            <select 
                                                value={form.gst_rate} 
                                                onChange={e => update('gst_rate', e.target.value)}
                                                className="booking-select booking-gst-select"
                                            >
                                                <option value="18">18% (Standard Rate)</option>
                                                <option value="14">14% (Special Rate)</option>
                                                <option value="12">12% (Forwarding Rate)</option>
                                                <option value="5">5% (Concessional)</option>
                                                <option value="0">0% (Nil / Exempt)</option>
                                                <option value="custom">Custom Rate...</option>
                                            </select>
                                            {form.gst_rate === 'custom' && (
                                                <div className="booking-custom-gst-wrap">
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        max="100" 
                                                        step="0.1" 
                                                        placeholder="%" 
                                                        value={form.custom_gst_rate} 
                                                        onChange={e => update('custom_gst_rate', e.target.value)}
                                                        className="booking-input booking-custom-gst-input"
                                                    />
                                                    <span>%</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="booking-gst-status-note">
                                    {form.is_gst_applicable ? (
                                        <span>✓ <strong>Tax Invoice enabled:</strong> {effectiveGstRate}% GST ({money(gst)}) added. Total invoice: <strong>{money(invoiceTotal)}</strong></span>
                                    ) : (
                                        <span>✓ <strong>Bill of Supply:</strong> Non-GST client with ₹0.00 tax. Total invoice: <strong>{money(invoiceTotal)}</strong></span>
                                    )}
                                </div>
                            </div>

                            {/* Payment Settlement */}
                            <div className="booking-payment-toggle-wrap">
                                <label className="booking-compact-toggle">
                                    <input 
                                        type="checkbox" 
                                        checked={payingNow} 
                                        onChange={e => setForm(prev => ({ ...prev, payment_status: e.target.checked ? 'Partial' : 'Unpaid', amount_received: '' }))} 
                                    />
                                    <span className="booking-switch-sm" />
                                    <strong>Customer is paying now</strong>
                                </label>
                            </div>

                            {payingNow && (
                                <div className="booking-fields" style={{ marginTop: '12px' }}>
                                    {field('amount_received', 'Amount Received (₹)', { type: 'number', min: 0.01, max: invoiceTotal, required: true, onChange: value => setForm(prev => ({ ...prev, amount_received: value, payment_status: Number(value) >= invoiceTotal ? 'Paid' : 'Partial' })) })}
                                    {field('payment_method', 'Payment Method', { items: paymentMethods, required: true })}
                                    {field('paid_to', 'Paid To Account', { items: paidToAccounts, required: true, hint: 'Bank, UPI, or cash box' })}
                                    {field('collected_by', 'Collected By', { items: employeesList, required: true })}
                                    {field('payment_reference', 'Payment Reference / Note', { wide: true, placeholder: 'UPI transaction ID, Cheque number, or note' })}
                                </div>
                            )}

                            {!payingNow && form.customer_type === 'B2B' && field('payment_status', 'Payment Terms', { items: ['Unpaid', 'B2B Credit'] })}
                        </div>

                        {/* Action Buttons */}
                        <div className="booking-actions-card">
                            <button 
                                type="button" 
                                className="btn btn-outline booking-cancel-btn" 
                                disabled={isSubmitting} 
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary-blue booking-submit-btn" 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                                <span>{isSubmitting ? 'Booking Consignment...' : 'Confirm & Book Shipment'}</span>
                            </button>
                        </div>
                    </form>

                    {/* Right Sticky Sidebar */}
                    <aside className="booking-sidebar">
                        {/* Live Calculation */}
                        <div className="booking-sidebar-card">
                            <div className="booking-sidebar-header">
                                <Calculator size={16} />
                                <h3>Live Calculation</h3>
                            </div>
                            <div className="booking-calc-list">
                                <div className="booking-calc-row">
                                    <span>Volumetric Weight</span>
                                    <strong>{Number(form.volumetric_weight).toFixed(3)} kg</strong>
                                </div>
                                <div className="booking-calc-row booking-calc-highlight">
                                    <span>Chargeable Weight</span>
                                    <strong className="text-primary-blue">{Number(form.chargeable_weight).toFixed(3)} kg</strong>
                                </div>
                                <div className="booking-calc-row">
                                    <span>Customer Base Rate</span>
                                    <span>{money(form.price)}</span>
                                </div>
                                <div className="booking-calc-row">
                                    <span>GST ({form.is_gst_applicable ? `${effectiveGstRate}%` : 'Non-GST'})</span>
                                    <span>{money(gst)}</span>
                                </div>
                                <div className="booking-calc-row booking-calc-total">
                                    <span>Total Billed Amount</span>
                                    <strong className="text-emerald">{money(invoiceTotal)}</strong>
                                </div>

                                {canEnterShipmentCosts && (
                                    <>
                                        <div className="booking-calc-row" style={{ borderTop: '1px dashed var(--card-border)', paddingTop: '10px' }}>
                                            <span>Provider Cost</span>
                                            <span>{money(form.provider_cost)}</span>
                                        </div>
                                        <div className="booking-calc-row booking-calc-profit">
                                            <span>Estimated Margin</span>
                                            <span className={estimatedMargin < 0 ? 'margin-loss' : 'margin-profit'}>
                                                {money(estimatedMargin)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="booking-sidebar-note">
                                {form.provider_name ? (
                                    form.provider_type === 'prepaid' ? (
                                        <span>💰 <strong>{form.provider_name}</strong> wallet will be debited on booking.</span>
                                    ) : (
                                        <span>📋 <strong>{form.provider_name}</strong> cost recorded in provider payable ledger.</span>
                                    )
                                ) : (
                                    <span>Select provider account to view cost settlement terms.</span>
                                )}
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="booking-sidebar-card">
                            <div className="booking-sidebar-header">
                                <CheckCircle2 size={16} />
                                <h3>Booking Checklist</h3>
                            </div>
                            <ul className="booking-checklist">
                                {checks.map(([label, done]) => (
                                    <li key={label} className={done ? 'is-complete' : 'is-pending'}>
                                        <CheckCircle2 size={16} className="check-icon" />
                                        <span>{label}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default ShipmentModal;
