import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    CheckCircle2,
    Loader2
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
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return ({ dhlexpress: 'dhl' })[key] || key;
    };
    const postpaidProviders = settings?.postpaidProviders || [];
    const prepaidWallets = settings?.prepaidWallets || [];

    useEffect(() => {
        if (!isOpen) return;
        setForm(prev => {
            if (prev.provider_type === 'prepaid' && prepaidWallets.some(p => p.name === prev.provider_name)) return prev;
            const account = postpaidProviders.find(p => courierKey(p.name) === courierKey(prev.courier));
            return { ...prev, provider_type: account ? 'postpaid' : '', provider_name: account?.name || '' };
        });
    }, [isOpen, settings]);

    const handleCourierChange = (courierName) => {
        const account = postpaidProviders.find(p => courierKey(p.name) === courierKey(courierName));
        setForm(prev => ({ ...prev, courier: courierName,
            provider_type: account ? 'postpaid' : '', provider_name: account?.name || '' }));
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
                payment_status: ['Paid', 'Partial'].includes(form.payment_status) ? (Number(form.amount_received) === Math.round((Number(form.price) + Math.round(Number(form.price) * 18) / 100) * 100) / 100 ? 'Paid' : 'Partial') : form.payment_status,
                amount_received: ['Paid', 'Partial'].includes(form.payment_status) ? Number(form.amount_received) : null,
                payment_reference: form.payment_reference,
                payment_method: form.payment_method,
                paid_to: form.paid_to,
                collected_by: form.collected_by,
                status: form.status,
                delay_reason: form.delay_reason
            };

            await apiClient.createShipment(payload);
            // Wait for the parent refresh to finish before closing the modal. This
            // keeps the dashboard and shipment list in sync with the new booking.
            await onCreated(false);
            alert(`Shipment ${payload.awb} booked successfully! Invoice generated.`);
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error booking shipment');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const estimatedMargin = (parseFloat(form.price) || 0) - (parseFloat(form.provider_cost) || 0);

    const couriersList = settings?.couriers || ['FedEx', 'Aramex', 'Delhivery', 'Blue Dart', 'DHL', 'UPS', 'Sree Maruthi'];
    const centersList = settings?.centers || ['Main Hub (Bangalore)', 'Delhi Regional Hub', 'Mumbai Branch', 'Hyderabad Hub', 'Kolkata Center'];
    const employeesList = (settings?.employees || [{ name: 'Nawaz' }, { name: 'Lata' }, { name: 'Umesh' }, { name: 'Uma' }]).map(e => e.name);
    const paidToAccounts = settings?.paidToAccounts || ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];
    const paymentMethods = settings?.paymentMethods || ['PhonePe', 'Google Pay', 'Office QR', 'Cash', 'Bank Transfer', 'B2B Credit'];

    const money = value => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
    const gst = Math.round((Number(form.price) || 0) * 18) / 100;
    const invoiceTotal = Math.round(((Number(form.price) || 0) + gst) * 100) / 100;
    const payingNow = ['Paid', 'Partial'].includes(form.payment_status);
    const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const field = (key, label, options = {}) => <label className={`booking-field ${options.wide ? 'booking-wide' : ''}`} key={key}>
        <span>{label}{options.required && <b className="required"> *</b>}</span>
        {options.items ? <select value={form[key]} onChange={e => options.onChange ? options.onChange(e.target.value) : update(key, e.target.value)} required={options.required}>
            <option value="" disabled>Select...</option>{options.items.map(item => <option key={item} value={item}>{item}</option>)}
        </select> : options.multiline ? <textarea rows={3} value={form[key]} onChange={e => update(key, e.target.value)} required={options.required} /> :
        <input type={options.type || 'text'} value={form[key]} onChange={e => options.onChange ? options.onChange(e.target.value) : update(key, e.target.value)}
            required={options.required} placeholder={options.placeholder} min={options.min} max={options.max} step={options.type === 'number' ? '0.01' : undefined} readOnly={options.readOnly} />}
        {options.hint && <small>{options.hint}</small>}
    </label>;
    const checks = [
        ['Customer identified', form.customer_name && form.sender_phone],
        ['Receiver name and address', form.receiver_name && form.receiver_address && form.receiver_city],
        ['Parcel measured', Number(form.actual_weight) > 0],
        ['Price and provider account', Number(form.price) > 0 && form.provider_name && (!canEnterShipmentCosts || form.provider_cost !== '')],
    ];
    return <div ref={workspaceRef} className="booking-workspace" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <header className="booking-page-heading"><div><h2 id="booking-title">New shipment</h2><p>Book once. The invoice, provider cost, profit and follow-up all follow from here.</p></div>
            <button type="button" className="modal-close" aria-label="Close booking" disabled={isSubmitting} onClick={onClose}><X size={22} /></button></header>
        <div className="booking-layout">
            <form className="booking-main" onSubmit={handleSubmit}>
                <fieldset><legend>Where and who</legend><p>The center and the person handling this booking.</p><div className="booking-fields">
                    {field('center', 'Business center', { items: centersList, required: true })}
                    {field('employee', 'Handled by', { items: employeesList, required: true })}
                </div></fieldset>
                <fieldset><legend>Customer</legend><p>Search by mobile. An existing customer fills in automatically.</p>
                    <div className="booking-lookup">{field('sender_phone', 'Customer mobile', {required: true, placeholder: '10-digit mobile number', onChange: handleMobileLookup})}
                    <button className="btn btn-outline" type="button" onClick={() => handleMobileLookup(form.sender_phone)} disabled={isSearchingCustomer}>{isSearchingCustomer ? 'Finding...' : 'Find'}</button></div>
                    {customerFound && <div className="booking-linked"><CheckCircle2 size={16} /> Profile linked: {customerFound}</div>}
                    <div className="booking-fields">{field('customer_name', 'Customer / company name', {required: true})}
                    {field('customer_type', 'Customer category', {items: ['C2C', 'B2C', 'B2B']})}</div>
                </fieldset>
                <fieldset><legend>Sender</legend><p>Who is handing over the parcel.</p>
                    <label className="booking-toggle"><input type="checkbox" checked={form.same_sender} onChange={e => update('same_sender', e.target.checked)} /><span className="booking-switch" />Same as the customer</label><div className="booking-fields">
                    {field(form.same_sender ? 'customer_name' : 'alternate_sender_name', 'Full name', {required: true})}{field(form.same_sender ? 'sender_phone' : 'alternate_sender_phone', 'Mobile', {required: true, ...(form.same_sender ? {onChange: handleMobileLookup} : {})})}
                    {field('sender_email', 'Email', {type: 'email'})}{field('sender_id_proof', 'ID proof', {placeholder: 'Aadhaar / passport reference'})}
                    {field('sender_address', 'Address', {required: true, multiline: true, wide: true})}
                    {field('sender_city', 'City')}{field('sender_zip', 'ZIP / pincode')}{field('sender_country', 'Country')}
                </div></fieldset>
                <fieldset><legend>Receiver</legend><p>Who is receiving the parcel, and where it is going.</p><div className="booking-fields">
                    {field('receiver_name', 'Full name', {required: true})}{field('receiver_phone', 'Mobile')}
                    {field('receiver_email', 'Email', {type: 'email'})}{field('receiver_country', 'Country', {required: true, onChange: value => setForm(prev => ({...prev, receiver_country: value, domestic_international: value.toLowerCase() === 'india' ? 'Domestic' : 'International'}))})}
                    {field('receiver_address', 'Address', {required: true, multiline: true, wide: true})}
                    {field('receiver_city', 'City', {required: true})}{field('receiver_zip', 'ZIP / pincode')}{field('receiver_state', 'State')}
                </div></fieldset>
                <fieldset><legend>Parcel</legend><p>Measure in centimeters and weigh in kilograms.</p><div className="booking-fields">
                    {field('description', 'Contents', {wide: true, placeholder: 'Documents, garments, samples...'})}
                    {field('packages_count', 'Number of packages', {type: 'number', min: 1, readOnly: form.boxes.length > 0})}
                    {field('actual_weight', 'Actual weight (kg)', {type: 'number', min: 0.01, required: true, readOnly: form.boxes.length > 0})}
                    {!form.boxes.length && <>{field('length', 'Length (cm)', {type: 'number', min: 0})}{field('width', 'Width (cm)', {type: 'number', min: 0})}{field('height', 'Height (cm)', {type: 'number', min: 0})}</>}
                </div>
                {form.boxes.map((box, index) => <div className="booking-box" key={index}><strong>Package {index + 1}</strong><div className="booking-fields">
                    {['length', 'width', 'height', 'actual_weight'].map(key => <label className="booking-field" key={key}><span>{key === 'actual_weight' ? 'Weight (kg)' : `${key} (cm)`}</span><input type="number" min="0.01" step="0.01" required value={box[key]} onChange={e => setForm(prev => ({...prev, boxes: prev.boxes.map((item, i) => i === index ? {...item, [key]: e.target.value} : item)}))} /></label>)}
                </div><button type="button" className="btn btn-outline" onClick={() => setForm(prev => ({...prev, boxes: prev.boxes.filter((_, i) => i !== index)}))}>Remove package</button></div>)}
                <button type="button" className="btn btn-outline" onClick={() => setForm(prev => ({...prev, boxes: [...prev.boxes, {length: '', width: '', height: '', actual_weight: ''}]}))}>+ Add individual package</button>
                </fieldset>
                <fieldset><legend>Courier and service</legend><p>Choose the courier and enter the shipment tracking number.</p><div className="booking-fields">
                    {field('courier', 'Courier', {items: couriersList, required: true, onChange: handleCourierChange})}
                    {field('domestic_international', 'Scope', {items: ['Domestic', 'International'], required: true})}
                    {field('service_type', 'Service', {required: true, placeholder: 'Express, Economy, Priority'})}
                    {field('awb', 'AWB number', {required: true, placeholder: 'Courier AWB'})}
                    {field('date', 'Booking date', {type: 'date', required: true, onChange: value => setForm(prev => ({...prev, date: value, pickup_date: value}))})}
                </div></fieldset>
                <fieldset><legend>Money</legend><p>The customer price and the provider cost stay separate.</p><div className="booking-fields">
                    {field('price', 'Customer selling price (\u20b9)', {type: 'number', min: 0, required: true, hint: 'Excluding GST. 18% GST is added to the invoice.'})}
                    <label className="booking-field"><span>Provider account <b className="required">*</b></span><select required value={`${form.provider_type}|${form.provider_name}`} onChange={e => handleProviderChange(e.target.value)}>
                        <option value="|">Select...</option><optgroup label="Prepaid wallets">{prepaidWallets.map(a => <option key={a.name} value={`prepaid|${a.name}`}>{a.name}</option>)}</optgroup>
                        <optgroup label="Postpaid accounts">{postpaidProviders.filter(a => courierKey(a.name) === courierKey(form.courier)).map(a => <option key={a.name} value={`postpaid|${a.name}`}>{a.name}</option>)}</optgroup>
                    </select><small>Prepaid wallets deduct the provider cost on booking.</small></label>
                    {canEnterShipmentCosts && field('provider_cost', 'Provider cost (\u20b9)', {type: 'number', min: 0, required: true})}
                </div>
                <label className="booking-toggle"><input type="checkbox" checked={payingNow} onChange={e => setForm(prev => ({...prev, payment_status: e.target.checked ? 'Partial' : 'Unpaid', amount_received: ''}))} /><span className="booking-switch" />Customer is paying now</label>
                {payingNow && <div className="booking-fields">
                    {field('amount_received', 'Amount received (\u20b9)', {type: 'number', min: 0.01, max: invoiceTotal, required: true, onChange: value => setForm(prev => ({...prev, amount_received: value, payment_status: Number(value) === invoiceTotal ? 'Paid' : 'Partial'}))})}
                    {field('payment_method', 'Payment method', {items: paymentMethods, required: true})}
                    {field('paid_to', 'Paid to', {items: paidToAccounts, required: true, hint: 'Bank, UPI handle or cash box'})}
                    {field('collected_by', 'Collected by', {items: employeesList, required: true})}
                    {field('payment_reference', 'Reference', {wide: true, hint: 'UPI reference, cheque number or receipt note'})}
                </div>}
                {!payingNow && form.customer_type === 'B2B' && field('payment_status', 'Payment terms', {items: ['Unpaid', 'B2B Credit']})}
                </fieldset>
                <div className="booking-actions"><button type="button" className="btn btn-outline" disabled={isSubmitting} onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary-blue" disabled={isSubmitting}>{isSubmitting && <Loader2 size={16} className="spin" />}{isSubmitting ? 'Booking...' : 'Book shipment'}</button></div>
            </form>
            <aside className="booking-sidebar"><section className="booking-summary"><h3>Live calculation</h3><dl>
                <div><dt>Volumetric weight</dt><dd>{Number(form.volumetric_weight).toFixed(3)} kg</dd></div>
                <div className="booking-emphasis"><dt>Chargeable weight</dt><dd>{Number(form.chargeable_weight).toFixed(3)} kg</dd></div>
                <div><dt>Customer price</dt><dd>{money(form.price)}</dd></div><div><dt>GST (18%)</dt><dd>{money(gst)}</dd></div>
                <div className="booking-emphasis"><dt>Invoice total</dt><dd>{money(invoiceTotal)}</dd></div>
                {canEnterShipmentCosts && <><div><dt>Provider cost</dt><dd>{money(form.provider_cost)}</dd></div><div className="booking-emphasis"><dt>Gross profit</dt><dd className={estimatedMargin < 0 ? 'booking-loss' : 'booking-profit'}>{money(estimatedMargin)}</dd></div></>}
            </dl><p>{form.provider_name ? form.provider_type === 'prepaid' ? `${form.provider_name} wallet will be debited on booking.` : `${form.provider_name} cost will be recorded in the provider ledger.` : 'Choose a provider account to see how the cost will be settled.'}</p></section>
            <section className="booking-summary"><h3>Before you book</h3><ul>{checks.map(([label, done]) => <li key={label} className={done ? 'is-complete' : ''}><CheckCircle2 size={18} />{label}</li>)}</ul></section></aside>
        </div>
    </div>;
};
export default ShipmentModal;
