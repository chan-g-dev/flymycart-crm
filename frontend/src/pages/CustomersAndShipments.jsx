import { openWhatsApp, openEmail, openCall, CommTemplates } from '../utils/communication';
import { exportToExcel } from '../utils/excelExport';
import { customerTypeOptions } from '../utils/customerTypes';
import { DEFAULT_ENTITY, getEntityMeta, getEntityOptions } from '../utils/entityConstants';
import TablePagination from '../components/TablePagination';
import useTablePage from '../components/useTablePage';
import ShipmentPaymentCells from '../components/ShipmentPaymentCells';
import { businessDate } from '../utils/businessDates';
import React, { useState, useDeferredValue, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, History, Trash2, Phone, Search, Mail, Building, Building2, MapPin, ArrowUpRight, FileText, Download, Calendar, Edit3, Tag, MessageSquare, Globe, Plane, Truck, X, Eye, EyeOff, ChevronsLeft, ChevronsRight } from 'lucide-react';
import '../components/DashboardSummary.css';
import { useAuth } from '../context/authSession';
import { CourierLogo } from '../components/CourierLogos';
import { TableSkeleton, ButtonSpinner } from '../components/LoadingSpinner';
import { TrackingLink } from '../components/TrackingLink';
import ParcelLabelModal from '../components/ParcelLabelModal';

export const Customers = ({ 
    customers: allCustomers,
    settings,
    selectedCenter,
    onOpenCustomerModal, 
    onOpenCustomerDrawer, 
    onDeleteCustomer, 
    isLoading = false 
}) => {
    const { hasPermission } = useAuth();
    const [searchVal, setSearchVal] = useState('');
    const [typeVal, setTypeVal] = useState('');
    const [customerToDelete, setCustomerToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const deferredSearch = useDeferredValue(searchVal);
    const customers = useMemo(() => (allCustomers || []).filter(c =>
        (!typeVal || c.customer_type === typeVal) &&
        (!deferredSearch || [c.name, c.mobile, c.company, c.email].some(value => String(value || '').toLowerCase().includes(deferredSearch.toLowerCase())))
    ), [allCustomers, typeVal, deferredSearch]);
    const tablePage = useTablePage(customers, JSON.stringify([deferredSearch, typeVal, selectedCenter]));

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const handleSearchChange = (e) => {
        setSearchVal(e.target.value);
    };

    const handleTypeChange = (e) => {
        setTypeVal(e.target.value);
    };

    const exportToCSV = () => {
        if (!customers || customers.length === 0) return;
        const headers = ['Name', 'Company', 'Mobile', 'Email', 'Type', 'Center', 'Total Bookings', 'Total Spend (INR)', 'Outstanding (INR)', 'Address'];
        const rows = customers.map(c => [
            c.name || '',
            c.company || '',
            c.mobile || '',
            c.email || '',
            c.customer_type || '',
            c.center || '',
            Number(c.total_bookings || 0),
            Number(c.total_spend || 0),
            Number(c.outstanding_balance || 0),
            c.address || ''
        ]);
        exportToExcel(headers, rows, `FMC_Customers_${businessDate()}.xlsx`, 'Customers');
    };

    const typeOptions = useMemo(() => customerTypeOptions(settings, (allCustomers || []).map(c => c.customer_type)), [settings, allCustomers]);
    const typeCounts = useMemo(() => customers.reduce((counts, customer) => {
        counts.set(customer.customer_type, (counts.get(customer.customer_type) || 0) + 1);
        return counts;
    }, new Map()), [customers]);

    return (
        <div className="customer-directory-page">
            {/* Header with KPI chips */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">👥 Permanent Customer Directory</h2>
                    <p className="page-subtitle">One customer profile with 360° history of shipments, payments, invoices & follow-ups</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <span className="pill-stat">Total: <strong>{customers?.length || 0}</strong></span>
                        {typeOptions.map(type => <span className="pill-stat" key={type}>{type}: <strong>{typeCounts.get(type) || 0}</strong></span>)}
                    </div>
                    <button className="btn btn-outline" disabled={!hasPermission('customers.export')} onClick={exportToCSV} title="Export Customers to Excel">
                        <Download size={14} /> Export Excel
                    </button>
                    <button className="btn btn-primary-blue" disabled={!hasPermission('customers.add')} onClick={onOpenCustomerModal}>
                        <Plus size={15} /> Add Customer
                    </button>
                </div>
            </div>

            {/* Filter Search Bar */}
            <div className="filter-bar">
                <div style={{ position: 'relative', flex: 1, minWidth: 'min(260px, 100%)' }}>
                    <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        className="filter-input" 
                        style={{ paddingLeft: '36px' }}
                        placeholder="Search by name, mobile, company or email..." 
                        value={searchVal}
                        onChange={handleSearchChange}
                    />
                </div>
                <select className="filter-select" value={typeVal} onChange={handleTypeChange}>
                    <option value="">All Customer Types</option>
                    {typeOptions.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>

            {/* Customers Table */}
            <div className="table-card">
                <div className="table-wrap customer-directory-scroll" role="region" aria-label="Customer directory" tabIndex={0}>
                    <table className="data-table customer-directory-table">
                        <thead>
                            <tr>
                                <th style={{ width: '18%' }}>Customer Name</th>
                                <th style={{ width: '24%' }}>Contact Info</th>
                                <th style={{ width: '7%' }}>Type</th>
                                <th style={{ width: '16%' }}>Center</th>
                                <th style={{ width: '9%' }}>Shipments</th>
                                {hasPermission('costs.customer_price') && <th style={{ width: '10%' }}>Total Spend</th>}
                                <th style={{ width: '16%' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (!customers || customers.length === 0) ? (
                                <TableSkeleton rows={5} cols={hasPermission('costs.customer_price') ? 7 : 6} />
                            ) : customers?.length === 0 ? (
                                <tr><td colSpan={hasPermission('costs.customer_price') ? 7 : 6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No customers found matching search.</td></tr>
                            ) : (
                                tablePage.rows.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '10.5px' }}>{c.name}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                                {c.company ? <><Building size={11} /> {c.company}</> : 'Individual Walk-in'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}>
                                                <Phone size={12} color="var(--emerald)" /> {c.mobile}
                                            </div>
                                            {c.email && (
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                                    <Mail size={11} /> {c.email}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`status-pill ${c.customer_type === 'B2B' ? 'picked-up' : c.customer_type === 'B2C' ? 'booked' : 'delivered'}`}>
                                                {c.customer_type}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={12} color="var(--text-muted)" /> {c.center || 'Main Hub'}
                                            </span>
                                        </td>
                                        <td>
                                            <strong style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>{c.total_bookings || 0}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{c.total_bookings === 1 ? 'booking' : 'bookings'}</span>
                                        </td>
                                        {hasPermission('costs.customer_price') && (
                                            <td style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '11.5px' }}>
                                                {formatCurrency(c.total_spend || 0)}
                                            </td>
                                        )}
                                        <td className="customer-actions-cell">
                                            <div className="customer-actions-stack" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                {c.mobile && (
                                                    <button 
                                                        type="button" 
                                                        className="btn-action-icon" 
                                                        title="Chat on WhatsApp" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openWhatsApp({ phone: c.mobile, message: (c.outstanding_balance > 0) ? CommTemplates.paymentReminder({ customerName: c.name, dueAmount: c.outstanding_balance }) : CommTemplates.generalGreeting({ customerName: c.name }) });
                                                        }}
                                                    >
                                                        <MessageSquare size={13} color="#25D366" />
                                                    </button>
                                                )}
                                                {c.mobile && (
                                                    <button 
                                                        type="button" 
                                                        className="btn-action-icon" 
                                                        title="Call Customer" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openCall({ phone: c.mobile });
                                                        }}
                                                    >
                                                        <Phone size={13} color="#10b981" />
                                                    </button>
                                                )}
                                                {c.email && (
                                                    <button 
                                                        type="button" 
                                                        className="btn-action-icon" 
                                                        title="Send Email" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEmail({ email: c.email, subject: 'Update from Fly My Cart Logistics', body: (c.outstanding_balance > 0) ? CommTemplates.paymentReminder({ customerName: c.name, dueAmount: c.outstanding_balance }) : CommTemplates.generalGreeting({ customerName: c.name }) });
                                                        }}
                                                    >
                                                        <Mail size={13} color="#3b82f6" />
                                                    </button>
                                                )}
                                                <button className="btn-action-customer" onClick={() => onOpenCustomerDrawer(c.id)}>
                                                    <History size={13} />
                                                    <span>
                                                        <strong>View customer</strong>
                                                    </span>
                                                </button>
                                                {hasPermission('customers.delete') && (
                                                    <button 
                                                        className="btn-action-delete" 
                                                        title="Delete customer profile" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCustomerToDelete(c);
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination {...tablePage} />
            </div>

            {/* Luxury Interactive Delete Confirmation Modal */}
            {customerToDelete && (
                <div className="delete-modal-overlay" onClick={() => !isDeleting && setCustomerToDelete(null)}>
                    <div className="delete-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="delete-modal-glow-header"></div>
                        
                        <div className="delete-pulse-badge">
                            <Trash2 size={26} />
                        </div>

                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', marginBottom: '6px' }}>
                            Delete Customer Profile?
                        </h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '16px' }}>
                            This action will permanently remove this customer from the CRM directory.
                        </p>

                        {/* Customer Identification Card */}
                        <div className="delete-customer-badge">
                            <div className="delete-avatar">
                                {customerToDelete.name ? customerToDelete.name.slice(0, 2).toUpperCase() : 'CU'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {customerToDelete.name}
                                    </strong>
                                    <span className="status-pill booked" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                                        {customerToDelete.customer_type}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                    <span>📞 {customerToDelete.mobile}</span>
                                    {customerToDelete.company && <span>🏢 {customerToDelete.company}</span>}
                                </div>
                            </div>
                        </div>

                        {/* Live Impact Breakdown */}
                        <div className="delete-impact-grid">
                            <div className="delete-impact-card">
                                <div className="delete-impact-val">{customerToDelete.total_bookings || 0}</div>
                                <div className="delete-impact-lbl">Bookings</div>
                            </div>
                            <div className="delete-impact-card">
                                <div className="delete-impact-val" style={{ color: 'var(--emerald, #10b981)' }}>
                                    {formatCurrency(customerToDelete.total_spend || 0)}
                                </div>
                                <div className="delete-impact-lbl">Total Spend</div>
                            </div>
                            <div className="delete-impact-card">
                                <div className="delete-impact-val" style={{ color: (customerToDelete.outstanding_balance || 0) > 0 ? 'var(--rose, #ef4444)' : 'var(--text-main)' }}>
                                    {formatCurrency(customerToDelete.outstanding_balance || 0)}
                                </div>
                                <div className="delete-impact-lbl">Outstanding</div>
                            </div>
                        </div>

                        {/* Warning Box */}
                        <div className="delete-warning-banner">
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <div>
                                <strong>Irreversible Operation:</strong> All linked shipment histories, GST invoices, and communication follow-ups will be permanently deleted.
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button 
                                className="btn btn-outline" 
                                onClick={() => setCustomerToDelete(null)}
                                disabled={isDeleting}
                                style={{ padding: '8px 16px', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-danger-glow" 
                                disabled={isDeleting}
                                onClick={async () => {
                                    setIsDeleting(true);
                                    try {
                                        await onDeleteCustomer(customerToDelete.id, customerToDelete.name);
                                    } finally {
                                        setIsDeleting(false);
                                        setCustomerToDelete(null);
                                    }
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                {isDeleting ? (
                                    <ButtonSpinner size={14} text="Deleting Profile..." />
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        <span>Yes, Delete Profile</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Shipments = ({ 
    shipments,
    invoices = [],
    settings,
    onOpenShipmentModal, 
    onOpenCustomerDrawer, 
    onViewInvoice, 
    onDeleteShipment, 
    onOpenStatusModal, 
    selectedCenter,
    selectedScope = '',
    onSelectScope,
    selectedEntity = '',
    onSelectEntity,
    isLoading = false 
}) => {
    const { hasPermission } = useAuth();
    const [searchVal, setSearchVal] = useState('');
    const entityOptions = useMemo(() => getEntityOptions(settings), [settings]);
    const entityVal = selectedEntity;
    const setEntityVal = (valOrFn) => {
        if (typeof valOrFn === 'function') {
            const next = valOrFn(entityVal);
            onSelectEntity?.(next);
        } else {
            onSelectEntity?.(valOrFn);
        }
    };

    const scopeVal = selectedScope;
    const setScopeVal = (valOrFn) => {
        if (typeof valOrFn === 'function') {
            const next = valOrFn(scopeVal);
            onSelectScope?.(next);
        } else {
            onSelectScope?.(valOrFn);
        }
    };
    const [statusVal, setStatusVal] = useState('');
    const [courierVal, setCourierVal] = useState('');
    const [billingType, setBillingType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [datePreset, setDatePreset] = useState('all');
    const [showDdpStatus, setShowDdpStatus] = useState(() => {
        try {
            return window.localStorage.getItem('shipments.showDdpStatus') === 'true';
        } catch {
            return false;
        }
    });

    const tableScrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const updateScrollState = useCallback(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 10);
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }, []);

    const scrollToStart = useCallback(() => {
        if (tableScrollRef.current) {
            tableScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
    }, []);

    const scrollToEnd = useCallback(() => {
        if (tableScrollRef.current) {
            tableScrollRef.current.scrollTo({
                left: tableScrollRef.current.scrollWidth,
                behavior: 'smooth'
            });
        }
    }, []);

    const toggleDdpStatus = () => {
        setShowDdpStatus(current => {
            const next = !current;
            try {
                window.localStorage.setItem('shipments.showDdpStatus', String(next));
            } catch {
                // The UI preference still works when browser storage is unavailable.
            }
            return next;
        });
    };

    const entityCounts = useMemo(() => {
        const counts = { total: 0 };
        entityOptions.forEach(e => { counts[e.name] = 0; });
        (shipments || []).forEach(s => {
            const isDom = s.domestic_international === 'Domestic' || (s.receiver_country && s.receiver_country.toLowerCase() === 'india' && s.domestic_international !== 'International');
            if (scopeVal === 'International' && isDom) return;
            if (scopeVal === 'Domestic' && !isDom) return;

            counts.total += 1;
            const ent = s.entity || DEFAULT_ENTITY;
            const meta = getEntityMeta(ent, settings);
            const key = meta.name;
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [shipments, scopeVal, entityOptions, settings]);

    const scopeCounts = useMemo(() => {
        let intl = 0;
        let dom = 0;
        let total = 0;
        (shipments || []).forEach(s => {
            const sEntity = s.entity || DEFAULT_ENTITY;
            if (entityVal && entityVal !== 'all' && sEntity !== entityVal) return;

            total += 1;
            const isDom = s.domestic_international === 'Domestic' || (s.receiver_country && s.receiver_country.toLowerCase() === 'india' && s.domestic_international !== 'International');
            if (isDom) dom += 1;
            else intl += 1;
        });
        return { all: total, intl, dom };
    }, [shipments, entityVal]);

    const handleDatePreset = (preset) => {
        setDatePreset(preset);
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (preset === 'all') {
            setStartDate('');
            setEndDate('');
        } else if (preset === 'today') {
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (preset === 'yesterday') {
            const yest = new Date(today);
            yest.setDate(yest.getDate() - 1);
            const yStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
            setStartDate(yStr);
            setEndDate(yStr);
        } else if (preset === 'this_week') {
            const d = new Date(today);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            const mStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
            setStartDate(mStr);
            setEndDate(todayStr);
        } else if (preset === 'this_month') {
            const firstDay = `${yyyy}-${mm}-01`;
            setStartDate(firstDay);
            setEndDate(todayStr);
        }
    };

    const deferredSearch = useDeferredValue(searchVal);
    const invoiceNumbers = useMemo(() => new Map(invoices.map(i => [i.shipment_id, i.invoice_no])), [invoices]);
    const visibleShipments = useMemo(() => (shipments || []).filter(s => {
        if (startDate) {
            const sDate = String(s.date || '').slice(0, 10);
            if (sDate && sDate < startDate) return false;
        }
        if (endDate) {
            const sDate = String(s.date || '').slice(0, 10);
            if (sDate && sDate > endDate) return false;
        }
        const sEntity = s.entity || DEFAULT_ENTITY;
        if (entityVal && entityVal !== 'all' && sEntity !== entityVal) {
            return false;
        }
        const isShipmentDom = s.domestic_international === 'Domestic' || (s.receiver_country && s.receiver_country.toLowerCase() === 'india' && s.domestic_international !== 'International');
        if (scopeVal === 'International' && isShipmentDom) return false;
        if (scopeVal === 'Domestic' && !isShipmentDom) return false;

        return (
            (!billingType || s.provider_type === billingType) &&
            (!statusVal || s.status === statusVal) &&
            (!courierVal || s.courier === courierVal) &&
            (!deferredSearch || [s.awb, s.customer_name, s.receiver_city, s.receiver_name, s.receiver_phone, s.sender_phone, s.entity, invoiceNumbers.get(s.id)].some(value => String(value || '').toLowerCase().includes(deferredSearch.toLowerCase())))
        );
    }), [shipments, billingType, statusVal, courierVal, entityVal, scopeVal, deferredSearch, invoiceNumbers, startDate, endDate]);
    const tablePage = useTablePage(visibleShipments, JSON.stringify([deferredSearch, billingType, statusVal, courierVal, entityVal, scopeVal, selectedCenter, startDate, endDate]));
    const [shipmentToDelete, setShipmentToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedLabelShipment, setSelectedLabelShipment] = useState(null);

    useEffect(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        updateScrollState();
        el.addEventListener('scroll', updateScrollState, { passive: true });
        window.addEventListener('resize', updateScrollState);
        return () => {
            el.removeEventListener('scroll', updateScrollState);
            window.removeEventListener('resize', updateScrollState);
        };
    }, [updateScrollState, visibleShipments, tablePage.rows]);

    // Dynamic aggregated courier and provider list
    const availableCouriers = React.useMemo(() => {
        const fromSettings = settings?.couriers || [];
        const fromWallets = (settings?.prepaidWallets || []).map(w => typeof w === 'string' ? w : w?.name);
        const fromPostpaid = (settings?.providerAccounts || []).map(p => typeof p === 'string' ? p : p?.name);
        const fromShipments = (shipments || []).map(s => s.courier).filter(Boolean);

        const list = fromSettings.length > 0 ? fromSettings : [
            'FedEx', 'Aramex', 'DHL', 'Blue Dart', 'Delhivery', 'UPS', 'Sree Maruthi', 'ICL', 'BRV'
        ];

        const all = new Set([
            ...list,
            ...fromWallets,
            ...fromPostpaid,
            ...fromShipments
        ]);
        return Array.from(all).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }, [settings, shipments]);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const exportToCSV = (targetEntity = entityVal) => {
        const activeEntityFilter = targetEntity && targetEntity !== 'all' ? targetEntity : null;
        
        let exportShipments = visibleShipments;
        if (activeEntityFilter && entityVal !== activeEntityFilter) {
            exportShipments = (shipments || []).filter(s => (s.entity || DEFAULT_ENTITY) === activeEntityFilter);
        }

        if (!exportShipments || exportShipments.length === 0) {
            alert(`No shipments found for ${activeEntityFilter || 'All Entities'} to download.`);
            return;
        }

        let headers = [
            'AWB', 
            'Operating Entity', 
            'Date', 
            'Customer', 
            'Type', 
            'Courier', 
            'Carrier Billing', 
            'Billing Account', 
            'Destination City', 
            'Destination Country', 
            'DDP Status', 
            'Actual Wt (kg)', 
            'Chargeable Wt (kg)', 
            'Customer Price (INR)',
            'Carrier Cost (INR)',
            'Refund (INR)',
            'Profit (INR)',
            'Payment Status', 
            'Status'
        ];
        
        let rows = exportShipments.map(s => [
            s.awb || '',
            s.entity || DEFAULT_ENTITY,
            s.date || '',
            s.customer_name || '',
            s.customer_type || '',
            s.courier || '',
            s.provider_type || '',
            s.provider_name || '',
            s.receiver_city || '',
            s.receiver_country || '',
            s.domestic_international === 'International' ? (s.is_ddp ? 'DDP Paid' : 'DDP Not Paid') : 'Domestic',
            Number(s.actual_weight || 0),
            Number(s.chargeable_weight || 0),
            Number(s.total_amount ?? (Number(s.price || 0) + Number(s.gst_amount || 0))),
            s.provider_cost !== null ? Number(s.provider_cost) : 'MASKED',
            Number(s.refund_amount || 0),
            s.gross_profit !== null ? Number(s.gross_profit) : 'MASKED',
            s.payment_status || '',
            s.status || ''
        ]);

        const keepColumns = headers.map((_, index) => index).filter(index => {
            if (index === 13) return hasPermission('costs.customer_price');
            if (index === 14) return hasPermission('costs.carrier_cost') || hasPermission('costs.view');
            if (index === 15) return hasPermission('costs.customer_price');
            if (index === 16) return hasPermission('costs.net_value') || hasPermission('reports.view_financial');
            return true;
        });
        headers = keepColumns.map(index => headers[index]);
        rows = rows.map(row => keepColumns.map(index => row[index]));

        const entityLabel = activeEntityFilter ? activeEntityFilter.replace(/[^a-zA-Z0-9]/g, '_') : 'All_Entities';
        const sheetName = activeEntityFilter ? activeEntityFilter.slice(0, 31) : 'All Shipments';
        const filename = `FMC_Shipments_${entityLabel}_${businessDate()}.xlsx`;

        exportToExcel(headers, rows, filename, sheetName);
    };

    const getCourierBadge = (courier) => {
        return <CourierLogo courier={courier} height={18} />;
    };

    const getCountryBadge = (shipment) => {
        const country = typeof shipment === 'string' ? shipment : (shipment?.receiver_country || shipment?.receiver_city || '—');
        const isIntl = typeof shipment === 'object' && (
            shipment?.domestic_international === 'International' || 
            (shipment?.receiver_country && shipment?.receiver_country.toLowerCase() !== 'india')
        );
        return (
            <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {country}
                </span>
                {isIntl && showDdpStatus && (
                    <div style={{ marginTop: '3px' }}>
                        <span className={shipment?.is_ddp ? 'ddp-tag-paid' : 'ddp-tag-unpaid'}>
                            {shipment?.is_ddp ? '✓ DDP Paid' : 'DDP Not Paid'}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    const canViewCustomerPrice = hasPermission('costs.customer_price');
    const canViewCarrierCost = hasPermission('costs.carrier_cost') || hasPermission('costs.view');
    const canViewNetValue = (hasPermission('costs.net_value') || hasPermission('reports.view_financial')) && canViewCustomerPrice && canViewCarrierCost;
    const shipmentColCount = 11 + (canViewCustomerPrice ? 1 : 0) + (canViewNetValue ? 1 : 0);

    const currentEntityMeta = entityVal ? getEntityMeta(entityVal) : null;
    const hasActiveFilters = Boolean(searchVal || statusVal || courierVal || billingType || scopeVal || entityVal || startDate || endDate || (datePreset && datePreset !== 'all'));
    const resetAllFilters = () => {
        setSearchVal('');
        setStatusVal('');
        setCourierVal('');
        setBillingType('');
        setScopeVal('');
        setEntityVal('');
        setStartDate('');
        setEndDate('');
        setDatePreset('all');
    };

    return (
        <div className="shipment-directory-page shipment-directory-workspace">
            {/* 1. Page Header & Actions */}
            <div className="page-header" style={{ marginBottom: 0 }}>
                <div>
                    <h2 className="page-title">📦 Shipment Master Engine</h2>
                    <p className="page-subtitle">Track parcel volumetric weights, selling prices, provider values, and delivery statuses</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                        className="btn btn-outline" 
                        onClick={() => exportToCSV(entityVal)} 
                        title={entityVal ? `Download Excel of ${entityVal} shipments (${visibleShipments.length})` : `Download Excel of All shipments (${visibleShipments.length})`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600,
                            borderColor: currentEntityMeta ? currentEntityMeta.border : undefined,
                            background: currentEntityMeta ? currentEntityMeta.bg : undefined,
                            color: currentEntityMeta ? currentEntityMeta.accentColor : undefined
                        }}
                    >
                        <Download size={14} /> 
                        <span>
                            {entityVal ? `Download ${currentEntityMeta?.shortName || entityVal} (${visibleShipments.length})` : `Download Excel (${visibleShipments.length})`}
                        </span>
                    </button>
                    {hasPermission('addShipment') && (
                        <button className="btn btn-primary-blue" onClick={() => onOpenShipmentModal(entityVal || DEFAULT_ENTITY)}>
                            <Plus size={15} /> New Shipment
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Sticky Top Scope & Entity Switcher Bar */}
            <div className="scope-entity-bar-sticky" style={{ margin: '0 0 4px' }}>
                {/* Left: Scope Selection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        SCOPE:
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="scope-pill-btn"
                            onClick={() => setScopeVal('')}
                            style={!scopeVal ? {
                                background: '#eff6ff',
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                fontWeight: 700
                            } : {}}
                        >
                            <Globe size={15} color={!scopeVal ? '#1d4ed8' : '#64748b'} />
                            <span>Both: <strong>{scopeCounts.all}</strong></span>
                        </button>
                        <button
                            type="button"
                            className="scope-pill-btn"
                            onClick={() => setScopeVal(scopeVal === 'International' ? '' : 'International')}
                            style={scopeVal === 'International' ? {
                                background: '#eff6ff',
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                fontWeight: 700
                            } : {}}
                        >
                            <Plane size={15} color={scopeVal === 'International' ? '#1d4ed8' : '#64748b'} />
                            <span>Intl: <strong>{scopeCounts.intl}</strong></span>
                        </button>
                        <button
                            type="button"
                            className="scope-pill-btn"
                            onClick={() => setScopeVal(scopeVal === 'Domestic' ? '' : 'Domestic')}
                            style={scopeVal === 'Domestic' ? {
                                background: '#fffbeb',
                                borderColor: '#fcd34d',
                                color: '#b45309',
                                fontWeight: 700
                            } : {}}
                        >
                            <Truck size={15} color={scopeVal === 'Domestic' ? '#b45309' : '#64748b'} />
                            <span>Dom: <strong>{scopeCounts.dom}</strong></span>
                        </button>
                    </div>
                </div>

                {/* Right: Entity Selection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ENTITY:
                    </span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="entity-pill-btn"
                            onClick={() => setEntityVal('')}
                            style={!entityVal ? {
                                background: '#eff6ff',
                                borderColor: '#93c5fd',
                                color: '#1d4ed8',
                                fontWeight: 700
                            } : {}}
                        >
                            <Building2 size={15} color={!entityVal ? '#1d4ed8' : '#64748b'} />
                            <span>All: <strong>{entityCounts.total}</strong></span>
                        </button>
                        {entityOptions.map(ent => {
                            const count = entityCounts[ent.name] ?? 0;
                            const isSelected = entityVal === ent.name;
                            const activeStyle = isSelected ? {
                                background: ent.bg || '#eff6ff',
                                borderColor: ent.border || ent.color || '#93c5fd',
                                color: ent.accentColor || ent.color || '#1d4ed8',
                                fontWeight: 700,
                                boxShadow: `0 1px 3px ${ent.border || 'rgba(0,0,0,0.08)'}`
                            } : {};
                            return (
                                <button
                                    key={ent.id}
                                    type="button"
                                    className="entity-pill-btn"
                                    onClick={() => setEntityVal(isSelected ? '' : ent.name)}
                                    style={activeStyle}
                                    title={`Filter by ${ent.name}`}
                                >
                                    <span>{ent.shortName || ent.name}: <strong>{count}</strong></span>
                                </button>
                            );
                        })}
                        {(hasActiveFilters || entityVal || scopeVal) ? (
                            <button 
                                type="button"
                                className="entity-pill-btn" 
                                onClick={resetAllFilters}
                                style={{
                                    borderColor: '#fecdd3',
                                    background: '#fff1f2',
                                    color: '#e11d48',
                                    fontWeight: 600
                                }}
                                title="Reset all filters"
                            >
                                <X size={13} /> Clear
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* 3. Search & Filter Controls Bar */}
            <div className="filter-bar shipment-directory-filters">
                <div style={{ position: 'relative', flex: 1, minWidth: 'min(200px, 100%)' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        className="filter-input" 
                        placeholder="Search AWB, Customer, Receiver City..." 
                        style={{ paddingLeft: '32px' }}
                        value={searchVal}
                        onChange={e => setSearchVal(e.target.value)}
                    />
                </div>

                {/* Calendar Date Range Pickers */}
                <div className="shipment-date-range-filter">
                    <Calendar size={13} color="var(--primary-blue, #1e64f0)" />
                    <span style={{ color: 'var(--text-muted)' }}>From:</span>
                    <input
                        type="date"
                        className="filter-input"
                        style={{ border: 'none', background: 'transparent', padding: '3px', fontSize: '11.5px' }}
                        value={startDate}
                        onChange={e => {
                            setStartDate(e.target.value);
                            setDatePreset('custom');
                        }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>To:</span>
                    <input
                        type="date"
                        className="filter-input"
                        style={{ border: 'none', background: 'transparent', padding: '3px', fontSize: '11.5px' }}
                        value={endDate}
                        onChange={e => {
                            setEndDate(e.target.value);
                            setDatePreset('custom');
                        }}
                    />
                </div>

                <select 
                    className="filter-select" 
                    value={datePreset} 
                    onChange={e => handleDatePreset(e.target.value)}
                    style={{ fontSize: '11.5px' }}
                >
                    <option value="all">All Dates</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="custom">Custom Date</option>
                </select>

                <select 
                    className="filter-select" 
                    value={statusVal} 
                    onChange={e => {
                        setStatusVal(e.target.value);
                    }}
                >
                    <option value="">All Statuses</option>
                    <option value="Booked">Booked</option>
                    <option value="Picked Up">Picked Up</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>

                <select 
                    className="filter-select" 
                    value={courierVal} 
                    onChange={e => {
                        setCourierVal(e.target.value);
                    }}
                >
                    <option value="">All Couriers ({availableCouriers.length})</option>
                    {availableCouriers.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <select className="filter-select" value={billingType} onChange={e => setBillingType(e.target.value)}>
                    <option value="">All billing types</option><option value="prepaid">Prepaid</option><option value="postpaid">Postpaid</option>
                </select>

                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={toggleDdpStatus}
                    aria-pressed={showDdpStatus}
                    title={showDdpStatus ? 'Hide DDP payment status from shipment rows' : 'Show DDP payment status in shipment rows'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', color: showDdpStatus ? '#1d4ed8' : 'var(--text-muted)' }}
                >
                    {showDdpStatus ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showDdpStatus ? 'Hide DDP' : 'Show DDP'}
                </button>
            </div>

            <div className="table-card shipment-directory-table-card">
                <div className="shipment-table-wrapper-relative">
                    {/* Floating Side Jump Controls for fast navigation */}
                    {canScrollLeft && (
                        <button
                            type="button"
                            className="floating-table-scroll-btn floating-scroll-left"
                            onClick={scrollToStart}
                            title="Scroll Full Left"
                            aria-label="Scroll to first columns"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                    )}
                    {canScrollRight && (
                        <button
                            type="button"
                            className="floating-table-scroll-btn floating-scroll-right"
                            onClick={scrollToEnd}
                            title="Scroll Full Right"
                            aria-label="Scroll to end columns"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    )}

                    <div 
                        ref={tableScrollRef}
                        className="table-wrap shipment-directory-scroll" 
                        tabIndex={0} 
                        role="region" 
                        aria-label="Shipment directory"
                    >
                    <table className="data-table shipment-directory-table">
                        <thead>
                            <tr>
                                <th>AWB No.</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Courier</th>
                                <th>Carrier Billing</th><th>Destination</th>
                                <th>Weight</th>
                                {canViewCustomerPrice && <th>Customer Price</th>}
                                {canViewCarrierCost && <th>Carrier Cost</th>}
                                {canViewNetValue && <th>Profit</th>}
                                <th>Payment Mode</th><th>Collection Status</th><th>Payment to Courier</th><th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (!shipments || shipments.length === 0) ? (
                                <TableSkeleton rows={6} cols={shipmentColCount} />
                            ) : visibleShipments.length === 0 ? (
                                <tr><td colSpan={shipmentColCount} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No shipments found matching filters.</td></tr>
                            ) : (
                                tablePage.rows.map(s => {
                                    const billed = Number(s.total_amount ?? (Number(s.price || 0) + Number(s.gst_amount || 0)));
                                    const cost = s.cost_reconciled ? Number(s.actual_provider_cost ?? s.provider_cost ?? 0) : Number(s.provider_cost || 0);
                                    const refund = Number(s.refund_amount || 0);
                                    const profit = (s.gross_profit !== undefined && s.gross_profit !== null) ? Number(s.gross_profit) : (billed - cost - refund);
                                    const isProfitVisible = canViewNetValue;

                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <strong><TrackingLink awb={s.awb} courier={s.courier} style={{ fontFamily: 'monospace', fontSize: '11px' }} /></strong>
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                    <span className={`status-pill ${s.payment_status === 'Paid' ? 'delivered' : 'delayed'}`} style={{ fontSize: '9.5px', padding: '1px 6px', marginRight: '4px' }}>
                                                        {s.payment_status}
                                                    </span>
                                                    <span>{s.paid_to || 'Not recorded'}</span>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                                                {formatDate(s.date)}
                                            </td>
                                            <td>
                                                <a 
                                                    href="javascript:void(0)" 
                                                    onClick={() => onOpenCustomerDrawer(s.customer_id || s.customer_name)}
                                                    style={{ fontWeight: 800, color: 'var(--text-main)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px' }}
                                                >
                                                    {s.customer_name} <ArrowUpRight size={11} color="var(--primary-blue)" />
                                                </a>
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                    <span className={`entity-badge ${getEntityMeta(s.entity).badgeClass}`} title={`Operating Entity: ${getEntityMeta(s.entity).name}`}>
                                                        {getEntityMeta(s.entity).shortName}
                                                    </span>
                                                    <span style={{ fontWeight: 600, color: s.customer_type === 'B2B' ? '#7c3aed' : '#0284c7' }}>{s.customer_type}</span> • {s.employee || 'Staff'}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {getCourierBadge(s.courier)}
                                            </td><td><span className={`status-pill ${s.provider_type === 'prepaid' ? 'delivered' : 'picked-up'}`}>{s.provider_type === 'prepaid' ? 'Prepaid' : s.provider_type === 'postpaid' ? 'Postpaid' : 'Not set'}</span><small style={{display:'block', color:'var(--text-muted)'}}>{s.provider_name}</small></td>
                                            <td>
                                                {getCountryBadge(s)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <strong style={{ fontSize: '10.5px' }}>{s.chargeable_weight || s.actual_weight}</strong> <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>kg</span>
                                            </td>
                                            {canViewCustomerPrice && (
                                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{formatCurrency(billed)}</div>
                                                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: s.is_gst_applicable !== false && (s.gst_amount > 0 || s.gst_rate > 0) ? '#2563eb' : '#64748b' }}>
                                                        {s.is_gst_applicable !== false && (s.gst_amount > 0 || s.gst_rate > 0) ? `GST Applicable (${s.gst_rate || 18}%)` : 'Non-GST'}
                                                    </div>
                                                </td>
                                            )}
                                            {canViewCarrierCost && (
                                                <td style={{ fontWeight: 700, color: '#475569', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {formatCurrency(cost)}
                                                </td>
                                            )}
                                            {canViewNetValue && (
                                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    {isProfitVisible ? (
                                                        <strong style={{ color: profit >= 0 ? 'var(--emerald)' : 'var(--rose)', fontSize: '11px' }}>
                                                            {formatCurrency(profit)}
                                                        </strong>
                                                    ) : (
                                                        '—'
                                                    )}
                                                    {refund > 0 && <div style={{ fontSize: '9.5px', color: '#dc2626', fontWeight: 700 }}>Refund: -{formatCurrency(refund)}</div>}
                                                </td>
                                            )}
                                            <ShipmentPaymentCells shipment={s} />
                                            <td style={{ textAlign: 'center' }}>
                                                <span 
                                                    className={`status-pill ${s.status === 'Delivered' ? 'delivered' : s.status === 'Delayed' ? 'delayed' : 'in-transit'}`}
                                                    onClick={() => onOpenStatusModal(s)}
                                                    style={{ cursor: 'pointer', fontSize: '10.5px', padding: '3px 8px' }}
                                                    title="Click to update shipment status"
                                                >
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                    <button className="btn-action-icon" title="Print / Download Box Address Label" onClick={() => setSelectedLabelShipment(s)}>
                                                        <Tag size={13} color="var(--emerald, #10b981)" />
                                                    </button>
                                                    <button className="btn-action-icon" title="Update status" onClick={() => onOpenStatusModal(s)}>
                                                        <Edit3 size={13} color="var(--text-muted)" />
                                                    </button>
                                                    <button className="btn-action-icon" title="View Tax Invoice" onClick={() => onViewInvoice(s.id)}>
                                                        <FileText size={13} color="var(--primary-blue)" />
                                                    </button>
                                                    {hasPermission('deleteShipment') && (
                                                        <button 
                                                            className="btn-action-delete" 
                                                            title="Delete shipment" 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShipmentToDelete(s);
                                                            }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                </div>
                <TablePagination {...tablePage} />
            </div>

            {/* Luxury Interactive Delete Confirmation Modal for Shipments */}
            {shipmentToDelete && (
                <div className="delete-modal-overlay" onClick={() => !isDeleting && setShipmentToDelete(null)}>
                    <div className="delete-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="delete-modal-glow-header"></div>
                        
                        <div className="delete-pulse-badge">
                            <Trash2 size={26} />
                        </div>

                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', marginBottom: '6px' }}>
                            Delete Shipment Booking?
                        </h3>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '16px' }}>
                            This will permanently remove this shipment and its associated financial records.
                        </p>

                        {/* Shipment Identification Card */}
                        <div className="delete-customer-badge">
                            <div className="delete-avatar" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                                📦
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <strong style={{ fontSize: '14px', fontFamily: 'monospace', color: 'var(--primary-blue)' }}>
                                        {shipmentToDelete.awb}
                                    </strong>
                                    <span className="status-pill booked" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                                        {shipmentToDelete.courier}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                    <span>👤 {shipmentToDelete.customer_name}</span>
                                    <span>📍 {shipmentToDelete.receiver_city || shipmentToDelete.receiver_country}</span>
                                </div>
                            </div>
                        </div>

                        {/* Live Impact Breakdown */}
                        <div className="delete-impact-grid">
                            <div className="delete-impact-card">
                                <div className="delete-impact-val">{shipmentToDelete.chargeable_weight || shipmentToDelete.actual_weight || 0} kg</div>
                                <div className="delete-impact-lbl">Chargeable Wt</div>
                            </div>
                            <div className="delete-impact-card">
                                <div className="delete-impact-val" style={{ color: 'var(--emerald, #10b981)' }}>
                                    {formatCurrency(shipmentToDelete.price || 0)}
                                </div>
                                <div className="delete-impact-lbl">Customer Sale</div>
                            </div>
                            <div className="delete-impact-card">
                                <div className="delete-impact-val" style={{ color: 'var(--primary-blue)' }}>
                                    {shipmentToDelete.status}
                                </div>
                                <div className="delete-impact-lbl">Status</div>
                            </div>
                        </div>

                        {/* Warning Box */}
                        <div className="delete-warning-banner">
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <div>
                                <strong>Irreversible Operation:</strong> All linked tax invoices, carrier provider cost entries, and wallet deductions for this AWB will be permanently deleted.
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button 
                                className="btn btn-outline" 
                                onClick={() => setShipmentToDelete(null)}
                                disabled={isDeleting}
                                style={{ padding: '8px 16px', fontWeight: 600 }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-danger-glow" 
                                disabled={isDeleting}
                                onClick={async () => {
                                    setIsDeleting(true);
                                    try {
                                        await onDeleteShipment(shipmentToDelete.id, shipmentToDelete.awb);
                                    } finally {
                                        setIsDeleting(false);
                                        setShipmentToDelete(null);
                                    }
                                }}
                            >
                                {isDeleting ? (
                                    <ButtonSpinner text="Deleting Shipment..." />
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        Yes, Delete Shipment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Address Box Label Preview / Print Modal */}
            <ParcelLabelModal
                isOpen={Boolean(selectedLabelShipment)}
                onClose={() => setSelectedLabelShipment(null)}
                data={selectedLabelShipment}
                settings={settings}
            />
        </div>
    );
};
