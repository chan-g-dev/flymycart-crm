import PaymentDetails from './PaymentDetails';
import { clearShipmentCustomer, selectShipmentCustomer } from '../utils/shipmentCustomer';
import { customerTypeOptions } from '../utils/customerTypes';
import { resolveWeightRule, calculateWeights, parcelsInCm } from '../utils/weightRules';
import { businessDate } from '../utils/businessDates';
import { paymentOptions } from '../utils/businessOptions';
import { ENTITY_OPTIONS, DEFAULT_ENTITY, getEntityMeta } from '../utils/entityConstants';
import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, Loader2, Search, Building2, User, MapPin, Package, Truck, Receipt, Plus, Trash2, Calculator, Check, Globe, Plane, Upload, ChevronDown, Printer, SlidersHorizontal } from 'lucide-react';
import ParcelLabelModal from './ParcelLabelModal';
import { useAuth } from '../context/authSession';
import { apiClient } from '../api/client';

const INDIAN_STATES = [
    'Andaman and Nicobar Islands',
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chandigarh',
    'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi (NCT)',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu and Kashmir',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Ladakh',
    'Lakshadweep',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Puducherry',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Other'
];

const WORLD_COUNTRIES = [
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Antigua and Barbuda',
    'Argentina',
    'Armenia',
    'Australia',
    'Austria',
    'Azerbaijan',
    'Bahamas',
    'Bahrain',
    'Bangladesh',
    'Barbados',
    'Belarus',
    'Belgium',
    'Belize',
    'Benin',
    'Bhutan',
    'Bolivia',
    'Bosnia and Herzegovina',
    'Botswana',
    'Brazil',
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cambodia',
    'Cameroon',
    'Canada',
    'Cape Verde',
    'Central African Republic',
    'Chad',
    'Chile',
    'China',
    'Colombia',
    'Comoros',
    'Congo (Brazzaville)',
    'Congo (DRC)',
    'Costa Rica',
    'Croatia',
    'Cuba',
    'Cyprus',
    'Czech Republic',
    'Denmark',
    'Djibouti',
    'Dominica',
    'Dominican Republic',
    'Ecuador',
    'Egypt',
    'El Salvador',
    'Equatorial Guinea',
    'Eritrea',
    'Estonia',
    'Eswatini',
    'Ethiopia',
    'Fiji',
    'Finland',
    'France',
    'Gabon',
    'Gambia',
    'Georgia',
    'Germany',
    'Ghana',
    'Greece',
    'Grenada',
    'Guatemala',
    'Guinea',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Honduras',
    'Hong Kong',
    'Hungary',
    'Iceland',
    'India',
    'Indonesia',
    'Iran',
    'Iraq',
    'Ireland',
    'Israel',
    'Italy',
    'Ivory Coast',
    'Jamaica',
    'Japan',
    'Jordan',
    'Kazakhstan',
    'Kenya',
    'Kiribati',
    'Kuwait',
    'Kyrgyzstan',
    'Laos',
    'Latvia',
    'Lebanon',
    'Lesotho',
    'Liberia',
    'Libya',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Madagascar',
    'Malawi',
    'Malaysia',
    'Maldives',
    'Mali',
    'Malta',
    'Marshall Islands',
    'Mauritania',
    'Mauritius',
    'Mexico',
    'Micronesia',
    'Moldova',
    'Monaco',
    'Mongolia',
    'Montenegro',
    'Morocco',
    'Mozambique',
    'Myanmar',
    'Namibia',
    'Nauru',
    'Nepal',
    'Netherlands',
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'North Korea',
    'North Macedonia',
    'Norway',
    'Oman',
    'Pakistan',
    'Palau',
    'Palestine',
    'Panama',
    'Papua New Guinea',
    'Paraguay',
    'Peru',
    'Philippines',
    'Poland',
    'Portugal',
    'Qatar',
    'Romania',
    'Russia',
    'Rwanda',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'San Marino',
    'Sao Tome and Principe',
    'Saudi Arabia',
    'Senegal',
    'Serbia',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'Somalia',
    'South Africa',
    'South Korea',
    'South Sudan',
    'Spain',
    'Sri Lanka',
    'Sudan',
    'Suriname',
    'Sweden',
    'Switzerland',
    'Syria',
    'Taiwan',
    'Tajikistan',
    'Tanzania',
    'Thailand',
    'Timor-Leste',
    'Togo',
    'Tonga',
    'Trinidad and Tobago',
    'Tunisia',
    'Turkey',
    'Turkmenistan',
    'Tuvalu',
    'Uganda',
    'Ukraine',
    'United Arab Emirates (UAE)',
    'United Kingdom (UK)',
    'United States (USA)',
    'Uruguay',
    'Uzbekistan',
    'Vanuatu',
    'Vatican City',
    'Venezuela',
    'Vietnam',
    'Yemen',
    'Zambia',
    'Zimbabwe',
    'Other'
];

const SearchableSuggestInput = ({ value, onChange, placeholder, required, readOnly, suggestions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const trimmedValue = String(value || '').trim();
    const hasExactMatch = (suggestions || []).some(item => item.toLowerCase() === trimmedValue.toLowerCase());

    const filtered = (suggestions || []).filter(item => 
        !trimmedValue || item.toLowerCase().includes(trimmedValue.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="fmc-custom-dropdown-wrap" ref={containerRef}>
            <div className="booking-input-icon-wrap" style={{ position: 'relative' }}>
                <input
                    type="text"
                    value={value || ''}
                    onChange={e => {
                        if (readOnly) return;
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        if (!readOnly) setIsOpen(true);
                    }}
                    onClick={() => {
                        if (!readOnly) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    required={required}
                    readOnly={readOnly}
                    className="booking-input"
                    autoComplete="off"
                />
                {!readOnly && (
                    <button
                        type="button"
                        tabIndex={-1}
                        className="booking-input-icon-btn"
                        onClick={() => setIsOpen(prev => !prev)}
                        title={placeholder || "Toggle options list"}
                        aria-label="Toggle options list"
                    >
                        <ChevronDown size={15} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                )}
            </div>
            {isOpen && !readOnly && (
                <div className="fmc-custom-dropdown-menu">
                    {filtered.map(item => (
                        <button
                            key={item}
                            type="button"
                            className={`fmc-custom-dropdown-item ${item.toLowerCase() === trimmedValue.toLowerCase() ? 'active' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(item);
                                setIsOpen(false);
                            }}
                        >
                            <span>{item}</span>
                            {item.toLowerCase() === trimmedValue.toLowerCase() && (
                                <Check size={14} className="text-blue" />
                            )}
                        </button>
                    ))}

                    {trimmedValue && !hasExactMatch && (
                        <button
                            type="button"
                            className="fmc-custom-dropdown-item custom-add"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(trimmedValue);
                                setIsOpen(false);
                            }}
                        >
                            <span>+ Use &ldquo;{trimmedValue}&rdquo;</span>
                            <Plus size={14} />
                        </button>
                    )}

                    {filtered.length === 0 && !trimmedValue && (
                        <div className="fmc-custom-dropdown-empty">No matching options found</div>
                    )}
                </div>
            )}
        </div>
    );
};

const PhoneWithCountryCodeInput = ({ 
    phoneCode, 
    onCodeChange, 
    phoneNumber, 
    onNumberChange, 
    placeholder = 'Enter mobile number', 
    required = false,
    onSearch = null,
    isSearching = false,
    suggestions = [],
    onSelectSuggestion = null
}) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="booking-phone-wrap" style={{ position: 'relative' }}>
            <input
                type="text"
                value={phoneCode || ''}
                onChange={e => {
                    let val = e.target.value;
                    if (val && !val.startsWith('+')) {
                        val = '+' + val.replace(/[^\d]/g, '');
                    }
                    onCodeChange(val);
                }}
                placeholder="+91"
                className="booking-phone-code-input"
                title="Enter Country Code (e.g. +91, +1, +44)"
                aria-label="Country Calling Code"
            />
            <div className="booking-input-icon-wrap" style={{ flex: 1, position: 'relative' }}>
                <input
                    type="tel"
                    value={phoneNumber || ''}
                    onChange={e => onNumberChange(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 220)}
                    placeholder={placeholder}
                    required={required}
                    className="booking-input"
                    autoComplete="off"
                />
                {onSearch && (
                    <button
                        type="button"
                        className="booking-input-icon-btn"
                        onClick={onSearch}
                        disabled={isSearching}
                        title="Search Profile"
                        aria-label="Search Profile"
                    >
                        {isSearching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                    </button>
                )}
            </div>

            {/* Live Autocomplete Popover */}
            {isFocused && suggestions && suggestions.length > 0 && (
                <div 
                    className="booking-suggestions-popover"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--card-border, #cbd5e1)',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.18), 0 4px 6px -2px rgba(15, 23, 42, 0.08)',
                        maxHeight: '260px',
                        overflowY: 'auto'
                    }}
                >
                    <div style={{ padding: '6px 12px', fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-app, #f8fafc)', borderBottom: '1px solid var(--card-border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>⚡ Matching Profiles ({suggestions.length})</span>
                        <span style={{ fontSize: '10px', color: 'var(--primary-blue)' }}>Click to auto-fill</span>
                    </div>
                    {suggestions.map((item, idx) => (
                        <div
                            key={item.id || idx}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelectSuggestion?.(item);
                            }}
                            style={{
                                padding: '9px 12px',
                                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--card-border, #f1f5f9)' : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px',
                                transition: 'background 0.15s'
                            }}
                            className="booking-suggestion-item"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <div style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '6px',
                                    background: item.customer_type === 'B2B' ? 'rgba(99, 102, 241, 0.14)' : 'rgba(59, 130, 246, 0.12)',
                                    color: item.customer_type === 'B2B' ? '#6366f1' : '#3b82f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 800,
                                    flexShrink: 0
                                }}>
                                    {item.customer_type === 'B2B' ? '🏢' : '👤'}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.company ? `${item.company} (${item.name})` : item.name}
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                                        <strong style={{ color: 'var(--primary-blue, #1e64f0)' }}>📱 {item.mobile}</strong> {item.email ? `• ✉️ ${item.email}` : ''} {item.address ? `• 📍 ${item.address.slice(0, 30)}...` : ''}
                                    </div>
                                </div>
                            </div>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: item.customer_type === 'B2B' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: item.customer_type === 'B2B' ? '#6366f1' : '#059669',
                                flexShrink: 0
                            }}>
                                {item.customer_type || 'C2C'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const getInitialShipmentForm = (todayStr, settings, initialEntity) => ({
    entity: initialEntity || DEFAULT_ENTITY,
    awb: '',
    date: todayStr,
    pickup_date: todayStr,
    delivery_date: '',
    center: settings?.centers?.[0] || 'Main Hub (Bangalore)',
    employee: (typeof settings?.employees?.[0] === 'string' ? settings.employees[0] : settings?.employees?.[0]?.name) || '',
    customer_id: '',
    b2b_company_id: '',
    customer_name: '',
    customer_type: 'C2C',
    is_gst_applicable: true,
    gst_rate: String(settings?.defaultGstRate ?? 18),
    custom_gst_rate: '',
    sender_phone: '',
    sender_phone_code: '+91',
    same_sender: true,
    alternate_sender_name: '',
    alternate_sender_phone: '',
    alternate_sender_phone_code: '+91',
    sender_city: '',
    sender_state: '',
    sender_zip: '',
    sender_country: 'India',
    sender_address: '',
    sender_email: '',
    sender_id_proof: '',
    id_proof_front: '',
    id_proof_back: '',
    receiver_email: '',
    receiver_state: '',
    receiver_id_proof: '',
    receiver_id_proof_front: '',
    receiver_id_proof_back: '',
    boxes: [],
    receiver_name: '',
    receiver_phone: '',
    receiver_phone_code: '+91',
    receiver_city: '',
    receiver_country: 'USA',
    receiver_zip: '',
    receiver_address: '',
    description: '',
    packages_count: 1,
    actual_weight: '',
    dimension_unit: 'cm',
    length: '',
    width: '',
    height: '',
    volumetric_weight: 0,
    chargeable_weight: 0,
    courier: settings?.couriers?.[0] || 'FedEx',
    domestic_international: 'International',
    service_type: settings?.serviceTypes?.[0] || 'International Priority',
    is_ddp: false,
    provider_type: '',
    provider_name: '',
    price: '',
    additional_charges: [],
    provider_cost: '',
    payment_status: 'Unpaid',
    payment_reference: '',
    payment_details: {},
    amount_received: '',
    payment_method: paymentOptions(settings)[0],
    paid_to: settings?.paidToAccounts?.[0] || 'Office QR',
    collected_by: (typeof settings?.employees?.[0] === 'string' ? settings.employees[0] : settings?.employees?.[0]?.name) || '',
    status: 'Booked',
    delay_reason: ''
});

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

const ShipmentModalForm = ({ isOpen, onClose, onCreated, settings, initialEntity }) => {
    const { hasPermission, currentUser } = useAuth();
    const canEnterShipmentCosts = hasPermission('costs.carrier_cost') || hasPermission('costs.view');
    const canViewCustomerPrice = hasPermission('costs.customer_price');
    const canViewNetValue = (hasPermission('costs.net_value') || hasPermission('reports.view_financial')) && canViewCustomerPrice && canEnterShipmentCosts;
    const todayStr = businessDate();
    const [rawForm, setForm] = useState(() => {
        const initial = getInitialShipmentForm(todayStr, settings, initialEntity);
        const operator = currentUser?.display_name || currentUser?.name || '';
        return { ...initial, employee: initial.employee || operator, collected_by: operator || initial.collected_by };
    });
    const lookupSequence = useRef(0);
    const workspaceRef = useRef(null);
    const [customerFound, setCustomerFound] = useState(null);
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [customerLookupError, setCustomerLookupError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showLabelModal, setShowLabelModal] = useState(false);

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

    const postpaidProviders = settings?.postpaidProviders?.length ? settings.postpaidProviders : defaultPostpaid;
    const prepaidWallets = settings?.prepaidWallets?.length ? settings.prepaidWallets : defaultPrepaid;
    const appliedWeightRule = resolveWeightRule(settings, rawForm.courier, rawForm.service_type, rawForm.domestic_international);
    const weights = calculateWeights(parcelsInCm(rawForm), appliedWeightRule);
    const prepaid = rawForm.provider_type === 'prepaid' && prepaidWallets.some(p => p.name === rawForm.provider_name);
    const provider = postpaidProviders.find(p => p.name === rawForm.provider_name)
        || postpaidProviders.find(p => courierKey(p.name) === courierKey(rawForm.courier)) || postpaidProviders[0];
    const form = {
        ...rawForm,
        ...(rawForm.boxes.length ? { actual_weight: weights.actual_weight, packages_count: rawForm.boxes.length } : {}),
        volumetric_weight: weights.volumetric_weight,
        chargeable_weight: weights.chargeable_weight,
        provider_type: prepaid ? 'prepaid' : 'postpaid',
        provider_name: prepaid ? rawForm.provider_name : provider?.name || rawForm.courier,
    };

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

    // Direct 1-click select customer profile (B2B corporate or regular)
    const handleSelectCustomer = (customer) => {
        ++lookupSequence.current;
        setIsSearchingCustomer(false);
        setCustomerLookupError('');
        setCustomerFound(customer.company || customer.name);
        setCustomerSuggestions([]);
        setForm(prev => selectShipmentCustomer(prev, customer));
    };

    // Live mobile lookup & auto-fill customer profile
    const handleMobileLookup = async (mobileVal, targetCategory = null) => {
        const sequence = ++lookupSequence.current;
        const currentCategory = targetCategory !== null ? targetCategory : form.customer_type;
        setCustomerFound(null);
        setCustomerSuggestions([]);
        setCustomerLookupError('');
        setIsSearchingCustomer(false);
        setForm(prev => ({
            ...(prev.customer_id || prev.b2b_company_id || targetCategory ? clearShipmentCustomer(prev) : prev),
            sender_phone: mobileVal,
            customer_id: '',
            b2b_company_id: '',
            ...(targetCategory ? { customer_type: targetCategory, payment_status: targetCategory !== 'B2B' && prev.payment_status === 'B2B Credit' ? 'Unpaid' : prev.payment_status } : {}),
        }));

        if (mobileVal.trim().length >= 2 || currentCategory === 'B2B') {
            setIsSearchingCustomer(true);
            try {
                const res = await apiClient.lookupCustomerByMobile(mobileVal.trim(), currentCategory);
                if (sequence !== lookupSequence.current) return;
                if (res && res.matches && res.matches.length > 0) {
                    setCustomerSuggestions(res.matches);

                    // Direct auto-fill if exact 10-digit number match
                    const cleanQ = mobileVal.replace(/\D/g, '');
                    const exactMatch = res.matches.find(m => {
                        const cleanM = String(m.mobile || '').replace(/\D/g, '');
                        return cleanM && cleanQ && (cleanM === cleanQ || cleanM.endsWith(cleanQ));
                    });

                    if (exactMatch && cleanQ.length >= 10) {
                        handleSelectCustomer(exactMatch);
                    }
                } else if (res && res.found && res.customer) {
                    setCustomerSuggestions([res.customer]);
                    handleSelectCustomer(res.customer);
                } else {
                    setCustomerSuggestions([]);
                    setCustomerFound(null);
                }
            } catch (err) {
                if (sequence === lookupSequence.current) setCustomerLookupError(err.response?.data?.detail || 'Customer lookup failed. Please search again.');
            } finally {
                if (sequence === lookupSequence.current) setIsSearchingCustomer(false);
            }
        } else {
            setCustomerSuggestions([]);
            setCustomerFound(null);
        }
    };

    const handleImageUpload = (key, file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large. Please select an image under 5MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            setForm(prev => ({ ...prev, [key]: e.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const effectiveGstRate = form.is_gst_applicable 
        ? (form.gst_rate === 'custom' ? (Number(form.custom_gst_rate) || 0) : (Number(form.gst_rate) || 0))
        : 0;

    const addFee = (name = 'Custom Fee', amount = 0) => {
        setForm(prev => ({
            ...prev,
            additional_charges: [
                ...(prev.additional_charges || []),
                { id: 'fee_' + Math.random().toString(36).slice(2, 9), name, amount: amount ? String(amount) : '' }
            ]
        }));
    };

    const updateFee = (index, field, value) => {
        setForm(prev => {
            const next = [...(prev.additional_charges || [])];
            if (next[index]) {
                next[index] = { ...next[index], [field]: value };
            }
            return { ...prev, additional_charges: next };
        });
    };

    const removeFee = (index) => {
        setForm(prev => ({
            ...prev,
            additional_charges: (prev.additional_charges || []).filter((_, i) => i !== index)
        }));
    };

    const customerBasePrice = parseFloat(form.price) || 0;
    const customFeesTotal = (form.additional_charges || []).reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    const taxableBase = Math.round((customerBasePrice + customFeesTotal) * 100) / 100;
    const gst = form.is_gst_applicable ? Math.round(taxableBase * effectiveGstRate) / 100 : 0;
    const invoiceTotal = Math.round((taxableBase + gst) * 100) / 100;
    const estimatedMargin = Math.round((invoiceTotal - (parseFloat(form.provider_cost) || 0)) * 100) / 100;

    const couriersList = React.useMemo(() => {
        const base = settings?.couriers || ['FedEx', 'Aramex', 'Delhivery', 'Blue Dart', 'DHL', 'UPS', 'Sree Maruthi', 'ICL', 'BRV'];
        const fromWallets = (settings?.prepaidWallets || []).map(w => typeof w === 'string' ? w : w?.name);
        const fromPostpaid = (settings?.postpaidProviders || []).map(p => typeof p === 'string' ? p : p?.name);
        return Array.from(new Set([...base, ...fromWallets, ...fromPostpaid])).filter(Boolean);
    }, [settings]);

    const serviceTypesList = form.domestic_international === 'Domestic'
        ? settings?.domesticServiceTypes || ['Domestic Express', 'Surface Standard', 'Air Express', 'Document / Flyer', 'Cargo']
        : settings?.serviceTypes || ['International Priority', 'Express Worldwide', 'Economy', 'Cargo', 'Document'];

    const handleScopeChange = (scope) => {
        const isDomestic = scope === 'Domestic';
        setForm(prev => {
            const newCountry = isDomestic ? 'India' : (prev.receiver_country === 'India' || !prev.receiver_country ? 'USA' : prev.receiver_country);
            
            // Pick appropriate courier
            let newCourier = prev.courier;
            if (isDomestic) {
                const domOptions = ['Blue Dart', 'DTDC', 'Delhivery', 'Trackon', 'Speed Post', 'Sree Maruthi'];
                if (!domOptions.includes(prev.courier)) {
                    newCourier = couriersList.find(c => domOptions.includes(c)) || 'Blue Dart';
                }
            } else {
                const intlOptions = ['FedEx', 'DHL Express', 'DHL', 'Aramex', 'UPS'];
                if (!intlOptions.includes(prev.courier)) {
                    newCourier = couriersList.find(c => intlOptions.includes(c)) || 'FedEx';
                }
            }

            const availableServices = isDomestic
                ? (settings?.domesticServiceTypes || ['Domestic Express', 'Surface Standard', 'Air Express', 'Document / Flyer', 'Cargo'])
                : (settings?.serviceTypes || ['International Priority', 'Express Worldwide', 'Economy', 'Cargo', 'Document']);
            const newService = availableServices[0] || (isDomestic ? 'Domestic Express' : 'International Priority');

            const account = postpaidProviders.find(p => courierKey(p.name) === courierKey(newCourier));

            return {
                ...prev,
                domestic_international: scope,
                is_ddp: isDomestic ? false : prev.is_ddp,
                receiver_country: newCountry,
                courier: newCourier,
                service_type: newService,
                provider_type: 'postpaid',
                provider_name: account?.name || newCourier
            };
        });
    };
    const centersList = settings?.centers || ['Main Hub (Bangalore)', 'Delhi Regional Hub', 'Mumbai Branch', 'Hyderabad Hub', 'Kolkata Center'];
    const employeesList = [...new Set([...(settings?.employees || []).map(e => typeof e === 'string' ? e : e.name), currentUser?.display_name || currentUser?.name, form.collected_by].filter(Boolean))];
    const paidToAccounts = settings?.paidToAccounts || ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];
    const paymentMethods = paymentOptions(settings);

    const money = value => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
    const isCashPayment = form.payment_method.trim().toLowerCase() === 'cash';
    const payingNow = ['Paid', 'Partial'].includes(form.payment_status);
    const update = (key, value) => {
        if (key === 'customer_type') {
            handleMobileLookup('', value);
        } else {
            setForm(prev => ({ ...prev, [key]: value, ...(key === 'payment_method' ? { payment_details: {} } : {}) }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.awb.trim()) {
            alert('Please enter an AWB tracking number');
            return;
        }

        if (!form.customer_type) {
            alert('Please select a Customer Category');
            return;
        }

        if (!form.provider_type || !form.provider_name) {
            alert('Select a billing account for this courier');
            return;
        }

        if (!form.sender_id_proof || !form.sender_id_proof.trim()) {
            alert('Please enter the mandatory Sender ID Proof');
            return;
        }

        if (!form.id_proof_front) {
            alert('Please upload the Sender ID proof image');
            return;
        }

        if (!form.receiver_id_proof || !form.receiver_id_proof.trim()) {
            alert('Please enter the mandatory Receiver ID Proof');
            return;
        }

        if (!form.receiver_id_proof_front) {
            alert('Please upload the Receiver ID proof image');
            return;
        }

        if (!form.sender_address || !form.sender_address.trim()) {
            alert('Please enter the Pickup / Sender Address');
            return;
        }

        if (!form.sender_city || !form.sender_city.trim()) {
            alert('Please enter the Sender City');
            return;
        }

        if (!form.sender_state || !form.sender_state.trim()) {
            alert('Please enter the Sender State');
            return;
        }

        if (!form.sender_zip || !form.sender_zip.trim()) {
            alert('Please enter the Sender ZIP / Pincode');
            return;
        }

        if (!form.sender_country || !form.sender_country.trim()) {
            alert('Please enter the Sender Country');
            return;
        }

        if (!form.receiver_name || !form.receiver_name.trim()) {
            alert('Please enter the Receiver Full Name');
            return;
        }

        if (!form.receiver_phone || !form.receiver_phone.trim()) {
            alert('Please enter the Receiver Contact Number');
            return;
        }

        if (!form.receiver_email || !form.receiver_email.trim()) {
            alert('Please enter the Receiver Email');
            return;
        }

        if (!form.receiver_country || !form.receiver_country.trim()) {
            alert('Please enter the Destination Country');
            return;
        }

        if (!form.receiver_address || !form.receiver_address.trim()) {
            alert('Please enter the Delivery Address');
            return;
        }

        if (!form.receiver_city || !form.receiver_city.trim()) {
            alert('Please enter the Destination City');
            return;
        }

        if (!form.receiver_zip || !form.receiver_zip.trim()) {
            alert('Please enter the Receiver ZIP / PIN Code');
            return;
        }

        if (!form.receiver_state || !form.receiver_state.trim()) {
            alert('Please enter the Receiver State / Province');
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const formatPhone = (code, phone) => {
                const p = String(phone || '').trim();
                if (!p) return '';
                const c = String(code || '').trim();
                if (p.startsWith('+')) return p;
                return c ? `${c} ${p}` : p;
            };

            const payload = {
                awb: form.awb.trim().toUpperCase(),
                date: form.date,
                pickup_date: form.pickup_date || form.date,
                delivery_date: form.delivery_date || null,
                customer_id: form.customer_id || null,
                b2b_company_id: form.customer_type === 'B2B' ? form.b2b_company_id || null : null,
                customer_name: form.customer_name.trim(),
                customer_type: form.customer_type,
                customer_mobile: formatPhone(form.sender_phone_code, form.sender_phone),
                entity: form.entity || DEFAULT_ENTITY,
                is_gst_applicable: !!form.is_gst_applicable,
                gst_rate: effectiveGstRate,
                center: form.center,
                employee: form.employee,
                sender: {
                    email: form.sender_email,
                    id_proof: form.sender_id_proof,
                    id_proof_front: form.id_proof_front || null,
                    id_proof_back: form.id_proof_back || null,
                    name: (form.same_sender ? form.customer_name : form.alternate_sender_name).trim(),
                    phone: formatPhone(form.same_sender ? form.sender_phone_code : form.alternate_sender_phone_code, form.same_sender ? form.sender_phone : form.alternate_sender_phone),
                    address: [form.sender_address.trim(), form.sender_city, form.sender_state, form.sender_zip, form.sender_country].filter(Boolean).join(', ')
                },
                receiver: {
                    email: form.receiver_email,
                    state: form.receiver_state,
                    name: form.receiver_name.trim(),
                    phone: formatPhone(form.receiver_phone_code, form.receiver_phone),
                    city: form.receiver_city.trim(),
                    country: form.receiver_country.trim(),
                    zip: form.receiver_zip.trim(),
                    address: form.receiver_address.trim(),
                    id_proof: form.receiver_id_proof,
                    id_proof_front: form.receiver_id_proof_front || null,
                    id_proof_back: form.receiver_id_proof_back || null
                },
                parcel: {
                    boxes: form.boxes.length ? parcelsInCm(form) : [],
                    description: form.description,
                    packages_count: parseInt(form.packages_count) || 1,
                    actual_weight: parseFloat(form.actual_weight) || 0,
                    ...parcelsInCm({ ...form, boxes: [] })[0],
                    volumetric_weight: form.volumetric_weight,
                    chargeable_weight: form.chargeable_weight
                },
                courier: form.courier,
                domestic_international: form.domestic_international,
                service_type: form.service_type,
                is_ddp: !!form.is_ddp,
                provider_type: form.provider_type,
                provider_name: form.provider_name,
                price: taxableBase,
                provider_cost: parseFloat(form.provider_cost) || 0,
                payment_status: ['Paid', 'Partial'].includes(form.payment_status) ? (Number(form.amount_received) >= invoiceTotal ? 'Paid' : 'Partial') : form.payment_status,
                amount_received: ['Paid', 'Partial'].includes(form.payment_status) ? Number(form.amount_received) : null,
                payment_reference: form.payment_reference,
                payment_details: payingNow ? form.payment_details : {},
                payment_method: form.payment_method,
                paid_to: isCashPayment ? 'Cash in Hand' : form.paid_to,
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
                {label}{options.required && !options.hideStar && <span className="required-star">*</span>}
            </label>
            {options.suggestions ? (
                <SearchableSuggestInput
                    value={form[key]}
                    onChange={val => options.onChange ? options.onChange(val) : update(key, val)}
                    placeholder={options.placeholder}
                    required={options.required}
                    readOnly={options.readOnly}
                    suggestions={options.suggestions}
                />
            ) : options.phone ? (
                <PhoneWithCountryCodeInput
                    phoneCode={form[options.codeKey || `${key}_code`] || '+91'}
                    onCodeChange={code => update(options.codeKey || `${key}_code`, code)}
                    phoneNumber={form[key]}
                    onNumberChange={val => key === 'sender_phone' ? handleMobileLookup(val) : update(key, val)}
                    placeholder={options.placeholder}
                    required={options.required}
                />
            ) : options.items ? (
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
                        step={options.type === 'number' ? (['length', 'width', 'height'].includes(key) ? 'any' : '0.01') : undefined}
                        readOnly={options.readOnly}
                        className="booking-input"
                    />
                </div>
            )}
            {options.hint && <span className="booking-field-hint">{options.hint}</span>}
        </div>
    );

    const checks = [
        ['Customer & Sender details', !!(form.customer_name && form.sender_phone && form.sender_email && form.sender_address && form.sender_city && form.sender_state && form.sender_zip)],
        ['Sender ID Proof & image', !!(form.sender_id_proof && form.id_proof_front)],
        ['Receiver details & ID proof', !!(form.receiver_name && form.receiver_phone && form.receiver_email && form.receiver_country && form.receiver_address && form.receiver_city && form.receiver_state && form.receiver_zip && form.receiver_id_proof && form.receiver_id_proof_front)],
        ['Parcel measured', Number(form.actual_weight) > 0],
        ['Customer Price & provider account', !!(Number(taxableBase) > 0 && form.provider_name && (!canEnterShipmentCosts || form.provider_cost !== ''))],
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
                        
                        {/* 0. Operating Entity Selector */}
                        <div className="booking-entity-container">
                            <div className="booking-entity-header">
                                <div className="booking-entity-title-wrap">
                                    <Building2 size={16} color="var(--primary-blue, #2563eb)" />
                                    <span className="booking-entity-title">Operating Entity</span>
                                </div>
                                <span className="booking-entity-desc">Select under which business entity this shipment is booked</span>
                            </div>
                            <div className="booking-entity-pill-group">
                                {ENTITY_OPTIONS.map(entity => {
                                    const isActive = (form.entity || DEFAULT_ENTITY) === entity.name;
                                    const btnClass = entity.name === 'Globe Courier' ? 'globe' : entity.name === 'USU Enterprises' ? 'usu' : 'via';
                                    return (
                                        <button
                                            key={entity.id}
                                            type="button"
                                            className={`booking-entity-btn ${isActive ? `active ${btnClass}` : ''}`}
                                            onClick={() => update('entity', entity.name)}
                                        >
                                            <div className="booking-entity-btn-icon">
                                                {entity.icon === 'Globe' && <Globe size={18} />}
                                                {entity.icon === 'Building2' && <Building2 size={18} />}
                                                {entity.icon === 'Plane' && <Plane size={18} />}
                                            </div>
                                            <div className="booking-entity-btn-content">
                                                <div className="booking-entity-btn-title-row">
                                                    <span className="booking-entity-btn-title">{entity.name}</span>
                                                    {isActive && <span className="booking-entity-badge">Selected</span>}
                                                </div>
                                                <span className="booking-entity-btn-sub">{entity.description}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Starting Shipment Scope Selector */}
                        <div className="booking-scope-container">
                            <div className="booking-scope-header">
                                <span className="booking-scope-title">Shipment Scope</span>
                            </div>
                            <div className="booking-scope-pill-group">
                                <button
                                    type="button"
                                    className={`booking-scope-btn ${form.domestic_international === 'International' ? 'active intl' : ''}`}
                                    onClick={() => handleScopeChange('International')}
                                >
                                    <div className="booking-scope-btn-icon">
                                        <Plane size={18} />
                                    </div>
                                    <div className="booking-scope-btn-content">
                                        <span className="booking-scope-btn-title">International</span>
                                        <span className="booking-scope-btn-sub">Worldwide cross-border delivery & customs</span>
                                    </div>
                                    {form.domestic_international === 'International' && <span className="booking-scope-badge">Active</span>}
                                </button>

                                <button
                                    type="button"
                                    className={`booking-scope-btn ${form.domestic_international === 'Domestic' ? 'active dom' : ''}`}
                                    onClick={() => handleScopeChange('Domestic')}
                                >
                                    <div className="booking-scope-btn-icon">
                                        <Truck size={18} />
                                    </div>
                                    <div className="booking-scope-btn-content">
                                        <span className="booking-scope-btn-title">Domestic</span>
                                        <span className="booking-scope-btn-sub">Pan-India express & surface delivery</span>
                                    </div>
                                    {form.domestic_international === 'Domestic' && <span className="booking-scope-badge">Active</span>}
                                </button>
                            </div>
                        </div>

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
                            </div>
                            
                            <div className="booking-lookup-row">
                                <div className="booking-field booking-lookup-field">
                                    <label className="booking-field-label">Customer Mobile <span className="required-star">*</span></label>
                                    <PhoneWithCountryCodeInput
                                        phoneCode={form.sender_phone_code || '+91'}
                                        onCodeChange={code => update('sender_phone_code', code)}
                                        phoneNumber={form.sender_phone}
                                        onNumberChange={val => handleMobileLookup(val)}
                                        placeholder="Enter 10-digit mobile number"
                                        required={true}
                                        onSearch={() => handleMobileLookup(form.sender_phone)}
                                        isSearching={isSearchingCustomer}
                                        suggestions={customerSuggestions}
                                        onSelectSuggestion={handleSelectCustomer}
                                    />
                                </div>
                            </div>

                            {customerFound && (
                                <div className="booking-linked-banner">
                                    <CheckCircle2 size={16} />
                                    <span>Profile Found & Linked: <strong>{customerFound}</strong></span>
                                </div>
                            )}

                            {customerLookupError && <p role="alert">{customerLookupError}</p>}
                            {form.customer_type === 'B2B' && customerSuggestions.length > 0 && (
                                <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px dashed rgba(99, 102, 241, 0.35)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#4f46e5', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        🏢 1-Click Select B2B Corporate Account:
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {customerSuggestions.map(b => (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => handleSelectCustomer(b)}
                                                style={{
                                                    padding: '5px 10px',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(99, 102, 241, 0.25)',
                                                    background: '#ffffff',
                                                    fontSize: '11.5px',
                                                    fontWeight: 700,
                                                    color: '#1e293b',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <span style={{ color: '#4f46e5' }}>🏢 {b.company || b.name}</span>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>({b.mobile})</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="booking-fields" style={{ marginTop: '14px' }}>
                                {field('customer_name', 'Customer / Company Name', { required: true, placeholder: 'Full Name / Company' })}
                                {field('customer_type', 'Customer Category', { items: customerTypeOptions(settings, [form.customer_type]), required: true })}
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
                                {field(form.same_sender ? 'sender_phone' : 'alternate_sender_phone', 'Sender Mobile', { 
                                    required: true, 
                                    phone: true,
                                    codeKey: form.same_sender ? 'sender_phone_code' : 'alternate_sender_phone_code',
                                    placeholder: 'Enter 10-digit mobile number',
                                })}
                                {field('sender_email', 'Sender Email', { type: 'email', required: true, placeholder: 'sender@example.com' })}
                                {field('sender_id_proof', 'ID Proof', { 
                                    required: true,
                                    placeholder: 'Enter ID Proof Number (Aadhaar, Passport, PAN, etc.)',
                                    hint: form.domestic_international === 'Domestic'
                                        ? 'Mandatory ID Proof for domestic shipments'
                                        : 'Mandatory ID Proof for international shipments'
                                })}

                                <div className="booking-field booking-wide booking-kyc-upload-row">
                                    <label className="booking-field-label">
                                        Sender ID Proof Image <span className="required-star">*</span>
                                        <span className="booking-field-hint" style={{ display: 'inline', marginLeft: '8px', fontWeight: 'normal' }}>
                                            (Upload a clear, legible photo of government-issued ID proof)
                                        </span>
                                    </label>
                                    <div className="booking-kyc-grid" style={{ gridTemplateColumns: '1fr' }}>
                                        <div className="booking-kyc-box">
                                            {form.id_proof_front ? (
                                                <div className="booking-kyc-preview-wrap">
                                                    <img src={form.id_proof_front} alt="Sender ID Proof" className="booking-kyc-img" />
                                                    <div className="booking-kyc-preview-overlay">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline text-rose"
                                                            onClick={() => setForm(prev => ({ ...prev, id_proof_front: '' }))}
                                                        >
                                                            <Trash2 size={13} /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="booking-kyc-dropzone">
                                                    <Upload size={18} />
                                                    <span className="booking-kyc-upload-text">Upload Sender ID Photo</span>
                                                    <span className="booking-kyc-upload-hint">PNG, JPG, WebP up to 5MB</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={e => handleImageUpload('id_proof_front', e.target.files[0])}
                                                        className="booking-kyc-file-input"
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {field('sender_address', 'Pickup / Sender Address', { required: true, multiline: true, wide: true, placeholder: 'Street address, building, locality...' })}
                                {field('sender_city', 'City', { required: true, placeholder: 'City' })}
                                {field('sender_state', 'State', { 
                                    required: true, 
                                    placeholder: 'Type or select state (e.g. Karnataka)',
                                    suggestions: INDIAN_STATES
                                })}
                                {field('sender_zip', 'ZIP / Pincode', { required: true, placeholder: 'Pincode' })}
                                {field('sender_country', 'Country', { 
                                    required: true, 
                                    placeholder: 'Type or select country (e.g. India)',
                                    suggestions: ['India', ...WORLD_COUNTRIES.filter(c => c !== 'India')]
                                })}
                            </div>
                        </div>

                        {/* 4. Receiver Details */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <MapPin size={16} />
                                    <span>4. Destination & Consignee</span>
                                </div>
                                <span className="booking-card-subtitle">
                                    {form.domestic_international === 'Domestic' ? 'Delivery address within India' : 'International receiver & destination address'}
                                </span>
                            </div>
                            <div className="booking-fields">
                                {field('receiver_name', 'Receiver Full Name', { required: true, placeholder: 'Consignee Name' })}
                                {field('receiver_phone', form.domestic_international === 'Domestic' ? 'Receiver Mobile Number' : 'Receiver Phone / Mobile', { 
                                    required: true, 
                                    phone: true,
                                    codeKey: 'receiver_phone_code',
                                    placeholder: form.domestic_international === 'Domestic' ? 'Enter 10-digit mobile number' : 'Contact number' 
                                })}
                                {field('receiver_email', 'Receiver Email', { type: 'email', required: true, placeholder: 'receiver@example.com' })}
                                {field('receiver_country', 'Destination Country', { 
                                    required: true, 
                                    readOnly: form.domestic_international === 'Domestic',
                                    placeholder: form.domestic_international === 'Domestic' ? 'India' : 'Type or select Destination Country (e.g. USA, UK, UAE)',
                                    suggestions: form.domestic_international === 'Domestic' ? ['India'] : WORLD_COUNTRIES,
                                    onChange: value => {
                                        const val = String(value || '').trim();
                                        setForm(prev => ({ 
                                            ...prev, 
                                            receiver_country: value, 
                                            domestic_international: val.toLowerCase() === 'india' ? 'Domestic' : 'International' 
                                        }));
                                    }
                                })}
                                {field('receiver_id_proof', 'Receiver ID Proof', { 
                                    required: true,
                                    placeholder: 'Enter Consignee ID / Passport / National ID / Tax Number', 
                                    hint: form.domestic_international === 'Domestic'
                                        ? 'Mandatory consignee ID proof for domestic shipments'
                                        : 'Mandatory consignee ID proof for customs clearance & international shipments'
                                })}

                                <div className="booking-field booking-wide booking-kyc-upload-row">
                                    <label className="booking-field-label">
                                        Receiver ID Proof Image <span className="required-star">*</span>
                                        <span className="booking-field-hint" style={{ display: 'inline', marginLeft: '8px', fontWeight: 'normal' }}>
                                            (Upload a clear, legible photo of consignee ID proof / customs document)
                                        </span>
                                    </label>
                                    <div className="booking-kyc-grid" style={{ gridTemplateColumns: '1fr' }}>
                                        <div className="booking-kyc-box">
                                            {form.receiver_id_proof_front ? (
                                                <div className="booking-kyc-preview-wrap">
                                                    <img src={form.receiver_id_proof_front} alt="Receiver ID Proof" className="booking-kyc-img" />
                                                    <div className="booking-kyc-preview-overlay">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline text-rose"
                                                            onClick={() => setForm(prev => ({ ...prev, receiver_id_proof_front: '' }))}
                                                        >
                                                            <Trash2 size={13} /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="booking-kyc-dropzone">
                                                    <Upload size={18} />
                                                    <span className="booking-kyc-upload-text">Upload Receiver ID Photo</span>
                                                    <span className="booking-kyc-upload-hint">PNG, JPG, WebP up to 5MB</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={e => handleImageUpload('receiver_id_proof_front', e.target.files[0])}
                                                        className="booking-kyc-file-input"
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {field('receiver_address', 'Delivery Address', { required: true, multiline: true, wide: true, placeholder: 'Full delivery street address...' })}
                                {field('receiver_city', 'City', { required: true, placeholder: 'Destination City' })}
                                {field('receiver_zip', form.domestic_international === 'Domestic' ? 'PIN Code (6 Digits)' : 'ZIP / Postal Code', { 
                                    required: true, 
                                    placeholder: form.domestic_international === 'Domestic' ? 'e.g. 560001' : 'Postal / ZIP code' 
                                })}
                                {field('receiver_state', form.domestic_international === 'Domestic' ? 'State' : 'State / Province', { 
                                    required: true,
                                    placeholder: form.domestic_international === 'Domestic' ? 'Type or select state (e.g. Karnataka)' : 'State or Province',
                                    suggestions: form.domestic_international === 'Domestic' ? INDIAN_STATES : undefined
                                })}
                            </div>
                        </div>

                        {/* 5. Parcel Details */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <Package size={16} />
                                    <span>5. Package & Dimensions</span>
                                </div>
                                <span className="booking-card-subtitle">Weight (kg) and dimensions ({form.dimension_unit})</span>
                            </div>
                            <div className="booking-fields">
                                {field('dimension_unit', 'Dimension unit', { items: ['cm', 'in'], onChange: unit => setForm(prev => {
                                    const factor = unit === 'in' ? 1 / 2.54 : 2.54;
                                    const convert = parcel => ({ ...parcel, ...Object.fromEntries(['length', 'width', 'height'].map(key => [key, parcel[key] === '' ? '' : Number((Number(parcel[key]) * factor).toFixed(8))])) });
                                    return { ...convert(prev), dimension_unit: unit, boxes: prev.boxes.map(convert) };
                                }) })}
                                {field('description', form.domestic_international === 'International' ? 'Package Contents (Customs Declaration)' : 'Package Contents / Items', { 
                                    wide: true, 
                                    placeholder: form.domestic_international === 'International' ? 'e.g. Cotton garments, commercial samples, spices, documents...' : 'e.g. Documents, garments, dry snacks, electronics...' 
                                })}
                                {field('packages_count', 'No. of Packages', { type: 'number', min: 1, readOnly: form.boxes.length > 0 })}
                                {field('actual_weight', 'Total Actual Weight (kg)', { type: 'number', min: 0.01, required: true, readOnly: form.boxes.length > 0 })}
                                {!form.boxes.length && (
                                    <>
                                        {field('length', `Length (${form.dimension_unit})`, { type: 'number', min: appliedWeightRule.basis === 'volumetric' ? 0.01 : 0, required: appliedWeightRule.basis === 'volumetric' })}
                                        {field('width', `Width (${form.dimension_unit})`, { type: 'number', min: appliedWeightRule.basis === 'volumetric' ? 0.01 : 0, required: appliedWeightRule.basis === 'volumetric' })}
                                        {field('height', `Height (${form.dimension_unit})`, { type: 'number', min: appliedWeightRule.basis === 'volumetric' ? 0.01 : 0, required: appliedWeightRule.basis === 'volumetric' })}
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
                                                    {key === 'actual_weight' ? 'Weight (kg)' : `${key.toUpperCase()} (${form.dimension_unit})`}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    min="0.01" 
                                                    step={key === 'actual_weight' ? '0.01' : 'any'}
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
                                <span className="booking-card-subtitle">Tracking number & carrier routing ({form.domestic_international})</span>
                            </div>
                            <div className="booking-fields">
                                {field('courier', 'Courier Carrier', { items: couriersList, required: true, onChange: handleCourierChange })}
                                {field('service_type', 'Service Type', { required: true, items: serviceTypesList })}
                                {field('awb', 'Courier AWB Number', { required: true, placeholder: 'Enter tracking AWB' })}
                                {field('date', 'Booking Date', { type: 'date', required: true, onChange: value => setForm(prev => ({ ...prev, date: value, pickup_date: value })) })}

                                {form.domestic_international === 'International' && (
                                    <div className="booking-field booking-wide booking-ddp-field">
                                        <label className="booking-field-label">DDP Status</label>
                                        <div className="booking-ddp-group">
                                            <button
                                                type="button"
                                                className={`booking-ddp-option ${!form.is_ddp ? 'active' : ''}`}
                                                onClick={() => update('is_ddp', false)}
                                            >
                                                <span className="booking-ddp-opt-title">DDP Not Paid</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`booking-ddp-option ${form.is_ddp ? 'active ddp-highlight' : ''}`}
                                                onClick={() => update('is_ddp', true)}
                                            >
                                                <span className="booking-ddp-opt-title">DDP Paid</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 7. Pricing, GST & Payment */}
                        <div className="booking-card">
                            <div className="booking-card-header">
                                <div className="booking-card-title">
                                    <Receipt size={16} />
                                    <span>7. Pricing, GST & Billing Settlement</span>
                                </div>
                                <span className="booking-card-subtitle">Customer price, customized line items, predicted provider value, and tax terms</span>
                            </div>

                            <div className="booking-fields">
                                {field('price', 'Customer Price', { type: 'number', min: 0, required: true, hint: form.is_gst_applicable ? `${effectiveGstRate}% GST will be computed` : 'Bill of supply / Non-GST rate' })}
                                
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

                                {canEnterShipmentCosts && field('provider_cost', 'Carrier Cost (Predicted)', { type: 'number', min: 0, required: true, hint: 'Cost payable to courier / carrier charges' })}

                                {/* GST Customization Card - Placed right next to Predicted Provider Value */}
                                <div className="booking-field">
                                    <label className="booking-field-label">GST Invoicing & Tax Terms</label>
                                    <div className="booking-gst-inline-card">
                                        <div className="booking-gst-inline-header">
                                            <label className="booking-compact-toggle">
                                                <input 
                                                    type="checkbox" 
                                                    checked={form.is_gst_applicable} 
                                                    onChange={e => update('is_gst_applicable', e.target.checked)} 
                                                />
                                                <span className="booking-switch-sm" />
                                                <strong style={{ fontSize: '12.5px' }}>Apply GST (Tax Invoice)</strong>
                                            </label>

                                            {form.is_gst_applicable && (
                                                <div className="booking-gst-rate-selector">
                                                    <span className="booking-gst-label">Rate:</span>
                                                    <select 
                                                        value={form.gst_rate} 
                                                        onChange={e => update('gst_rate', e.target.value)}
                                                        className="booking-select booking-gst-select"
                                                    >
                                                        {[...new Set([...(settings?.gstRates || [0, 5, 12, 14, 18]), Number(settings?.defaultGstRate ?? 18)])].map(rate => <option key={rate} value={String(rate)}>{rate}%</option>)}
                                                        <option value="custom">Custom...</option>
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
                                                <span>✓ <strong>{effectiveGstRate}% GST ({money(gst)})</strong> added. Total: <strong>{money(invoiceTotal)}</strong></span>
                                            ) : (
                                                <span>✓ <strong>Bill of Supply:</strong> ₹0.00 tax. Total: <strong>{money(invoiceTotal)}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Customizable Additional Fees & Surcharges (Platform Fee, Handling, Packaging, Insurance, etc.) */}
                            <div className="booking-custom-fees-card">
                                <div className="booking-custom-fees-header">
                                    <div className="booking-custom-fees-title">
                                        <SlidersHorizontal size={14} color="var(--primary-blue, #1e64f0)" />
                                        <span>Customized Charges & Line Items</span>
                                    </div>
                                    <div className="booking-fee-pills">
                                        <span className="booking-fee-preset-label">Quick Add:</span>
                                        <button type="button" className="fee-preset-chip" onClick={() => addFee('Platform Fee', 50)}>+ Platform Fee (₹50)</button>
                                        <button type="button" className="fee-preset-chip" onClick={() => addFee('Packaging Fee', 100)}>+ Packaging (₹100)</button>
                                        <button type="button" className="fee-preset-chip" onClick={() => addFee('Handling Charge', 50)}>+ Handling (₹50)</button>
                                        <button type="button" className="fee-preset-chip" onClick={() => addFee('Insurance', 150)}>+ Insurance</button>
                                        <button type="button" className="fee-preset-chip fee-preset-chip-add" onClick={() => addFee('Custom Fee', '')}>+ Add Custom Line Item</button>
                                    </div>
                                </div>

                                {(form.additional_charges || []).length > 0 ? (
                                    <div className="booking-fees-list">
                                        {form.additional_charges.map((charge, idx) => (
                                            <div key={charge.id || idx} className="booking-fee-row-item">
                                                <div className="booking-fee-name-col">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Fee name / description (e.g. Platform Fee)" 
                                                        value={charge.name}
                                                        onChange={e => updateFee(idx, 'name', e.target.value)}
                                                        className="booking-input booking-fee-input"
                                                    />
                                                </div>
                                                <div className="booking-fee-amount-col">
                                                    <span className="booking-fee-curr">₹</span>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        step="any"
                                                        placeholder="0.00"
                                                        value={charge.amount}
                                                        onChange={e => updateFee(idx, 'amount', e.target.value)}
                                                        className="booking-input booking-fee-input"
                                                    />
                                                </div>
                                                <button 
                                                    type="button" 
                                                    className="booking-fee-remove-btn"
                                                    onClick={() => removeFee(idx)}
                                                    title="Remove fee"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="booking-fees-total-summary">
                                            <span>Custom Line Items Total:</span>
                                            <strong style={{ color: 'var(--primary-blue, #1e64f0)' }}>+{money(customFeesTotal)}</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="booking-fees-empty-hint">
                                        <span>No extra line items added. Click quick presets above (e.g. + Platform Fee) to customize additional charges.</span>
                                    </div>
                                )}
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
                                    {!isCashPayment && field('paid_to', 'Paid To Account', { items: paidToAccounts, required: true, hint: 'Bank or UPI account' })}
                                    {field('collected_by', 'Collected By', { items: employeesList, required: true })}
                                    <PaymentDetails method={form.payment_method} value={form.payment_details} onChange={value => update('payment_details', value)} reference={form.payment_reference} onReferenceChange={value => update('payment_reference', value)} profiles={settings?.paymentAccounts || []} onAccountChange={value => update('paid_to', value)} />
                                </div>
                            )}

                            {!payingNow && form.customer_type === 'B2B' && field('payment_status', 'Payment Terms', { items: ['Unpaid', 'B2B Credit'] })}
                        </div>

                        {/* Action Buttons */}
                        <div className="booking-actions-card">
                            <button 
                                type="button" 
                                className="btn btn-outline" 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: 'auto', borderColor: 'var(--card-border, #cbd5e1)', color: 'var(--text-main, #1e293b)' }}
                                onClick={() => setShowLabelModal(true)}
                                title="Preview, print or download address box label sticker"
                            >
                                <Printer size={16} color="var(--primary-blue, #1e64f0)" />
                                <span>Print / Download Box Label</span>
                            </button>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calculator size={16} />
                                    <h3>Live Calculation</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span className={`entity-badge ${getEntityMeta(form.entity).badgeClass}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                                        {getEntityMeta(form.entity).shortName}
                                    </span>
                                    <span className={`booking-scope-badge-sm ${form.domestic_international.toLowerCase()}`}>
                                        {form.domestic_international}
                                    </span>
                                </div>
                            </div>
                            <div className="booking-calc-list">
                                <div className="booking-calc-row">
                                    <span>Volumetric Weight</span>
                                    <strong>{Number(form.volumetric_weight).toFixed(2)} kg</strong>
                                </div>
                                <div className="booking-calc-row booking-calc-highlight">
                                    <span>Chargeable Weight</span>
                                    <strong className="text-primary-blue">{Number(form.chargeable_weight).toFixed(2)} kg</strong>
                                </div>
                                <div className="booking-calc-row">
                                    <span>Customer Price</span>
                                    <span>{money(form.price)}</span>
                                </div>

                                {(form.additional_charges || []).filter(c => parseFloat(c.amount) > 0).map((c, i) => (
                                    <div key={c.id || i} className="booking-calc-row booking-calc-subrow">
                                        <span style={{ paddingLeft: '8px', color: '#475569' }}>+ {c.name || 'Extra Fee'}</span>
                                        <span style={{ color: '#0369a1', fontWeight: 600 }}>+{money(c.amount)}</span>
                                    </div>
                                ))}

                                {customFeesTotal > 0 && (
                                    <div className="booking-calc-row" style={{ borderTop: '1px dotted var(--card-border, #e2e8f0)', paddingTop: '4px' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>Subtotal (Price + Fees)</span>
                                        <strong style={{ color: 'var(--text-main, #1e293b)' }}>{money(taxableBase)}</strong>
                                    </div>
                                )}

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
                                        <div className="booking-calc-row" style={{ borderTop: '1px dashed var(--card-border, #cbd5e1)', paddingTop: '10px' }}>
                                            <span>Carrier Cost</span>
                                            <span>{money(form.provider_cost)}</span>
                                        </div>
                                        {canViewNetValue && (
                                            <div className="booking-calc-row booking-calc-profit">
                                                <span>Estimated Profit</span>
                                                <strong className={estimatedMargin < 0 ? 'text-rose' : 'text-emerald'} style={{ fontSize: '13px', fontWeight: 800 }}>
                                                    {money(estimatedMargin)}
                                                </strong>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="booking-sidebar-note">
                                {form.provider_name ? (
                                    form.provider_type === 'prepaid' ? (
                                        <span>💰 <strong>{form.provider_name}</strong> wallet will be debited on booking.</span>
                                    ) : (
                                        <span>📋 <strong>{form.provider_name}</strong> value recorded in provider payable ledger.</span>
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

            {/* Address Box Label Preview / Print Modal */}
            <ParcelLabelModal
                isOpen={showLabelModal}
                onClose={() => setShowLabelModal(false)}
                data={form}
                settings={settings}
            />
        </div>
    );
};

export default function ShipmentModal(props) {
    return props.isOpen ? <ShipmentModalForm {...props} /> : null;
}
