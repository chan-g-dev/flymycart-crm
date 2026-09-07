import React, { useState } from 'react';
import { 
    Plus, 
    History, 
    Trash2, 
    Phone, 
    Search, 
    Mail, 
    Building, 
    MapPin, 
    ArrowUpRight, 
    FileText, 
    Download, 
    Truck,
    Globe,
    Send,
    Edit3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CourierLogo } from '../components/CourierLogos';
import { TableSkeleton, ButtonSpinner } from '../components/LoadingSpinner';

export const Customers = ({ 
    customers, 
    onOpenCustomerModal, 
    onOpenCustomerDrawer, 
    onDeleteCustomer, 
    onSearch,
    isLoading = false 
}) => {
    const { hasPermission } = useAuth();
    const [searchVal, setSearchVal] = useState('');
    const [typeVal, setTypeVal] = useState('');
    const [customerToDelete, setCustomerToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const handleSearchChange = (e) => {
        setSearchVal(e.target.value);
        onSearch(e.target.value, typeVal);
    };

    const handleTypeChange = (e) => {
        setTypeVal(e.target.value);
        onSearch(searchVal, e.target.value);
    };

    const exportToCSV = () => {
        if (!customers || customers.length === 0) return;
        const headers = ['Name', 'Company', 'Mobile', 'Email', 'Type', 'Center', 'Total Bookings', 'Total Spend (INR)', 'Outstanding (INR)', 'Address'];
        const rows = customers.map(c => [
            `"${c.name}"`,
            `"${c.company || ''}"`,
            `"${c.mobile}"`,
            `"${c.email || ''}"`,
            `"${c.customer_type}"`,
            `"${c.center || ''}"`,
            c.total_bookings || 0,
            c.total_spend || 0,
            c.outstanding_balance || 0,
            `"${(c.address || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `FMC_Customers_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const b2bCount = (customers || []).filter(c => c.customer_type === 'B2B').length;
    const b2cCount = (customers || []).filter(c => c.customer_type === 'B2C').length;
    const c2cCount = (customers || []).filter(c => c.customer_type === 'C2C').length;

    return (
        <div>
            {/* Header with KPI chips */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">👥 Permanent Customer Directory</h2>
                    <p className="page-subtitle">One customer profile with 360° history of shipments, payments, invoices & follow-ups</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="pill-stat">Total: <strong>{customers?.length || 0}</strong></span>
                        <span className="pill-stat" style={{ background: '#f3e8ff', color: '#6b21a8' }}>B2B: <strong>{b2bCount}</strong></span>
                        <span className="pill-stat" style={{ background: '#e0f2fe', color: '#0369a1' }}>B2C: <strong>{b2cCount}</strong></span>
                        <span className="pill-stat" style={{ background: '#dcfce7', color: '#15803d' }}>C2C: <strong>{c2cCount}</strong></span>
                    </div>
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Customers to CSV">
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn btn-primary-blue" onClick={onOpenCustomerModal}>
                        <Plus size={15} /> Add Customer
                    </button>
                </div>
            </div>

            {/* Filter Search Bar */}
            <div className="filter-bar">
                <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
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
                    <option value="">All Customer Types (C2C, B2C, B2B)</option>
                    <option value="C2C">C2C (Customer to Customer)</option>
                    <option value="B2C">B2C (Business to Customer)</option>
                    <option value="B2B">B2B (Corporate Monthly Credit)</option>
                </select>
            </div>

            {/* Customers Table */}
            <div className="table-card">
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '22%' }}>Customer Name</th>
                                <th style={{ width: '20%' }}>Contact Info</th>
                                <th style={{ width: '8%', textAlign: 'center' }}>Type</th>
                                <th style={{ width: '16%' }}>Center</th>
                                <th style={{ width: '10%' }}>Shipments</th>
                                <th style={{ width: '12%' }}>Total Spend</th>
                                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (!customers || customers.length === 0) ? (
                                <TableSkeleton rows={5} cols={7} />
                            ) : customers?.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No customers found matching search.</td></tr>
                            ) : (
                                customers?.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '13px' }}>{c.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                                {c.company ? <><Building size={11} /> {c.company}</> : 'Individual Walk-in'}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px' }}>
                                                <Phone size={12} color="var(--emerald)" /> {c.mobile}
                                            </div>
                                            {c.email && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
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
                                            <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{c.total_bookings || 0}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{c.total_bookings === 1 ? 'booking' : 'bookings'}</span>
                                        </td>
                                        <td style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '13px' }}>
                                            {formatCurrency(c.total_spend || 0)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                <button className="btn-action-360" onClick={() => onOpenCustomerDrawer(c.id)}>
                                                    <History size={12} />
                                                    <span>360° Profile</span>
                                                </button>
                                                {hasPermission('deleteShipment') && (
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
    onOpenShipmentModal, 
    onOpenCustomerDrawer, 
    onViewInvoice, 
    onDeleteShipment, 
    onOpenStatusModal, 
    onFilter,
    isLoading = false 
}) => {
    const { hasPermission } = useAuth();
    const [searchVal, setSearchVal] = useState('');
    const [statusVal, setStatusVal] = useState('');
    const [courierVal, setCourierVal] = useState('');
    const [shipmentToDelete, setShipmentToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const handleSearch = (s, st, c) => {
        onFilter({ search: s, status: st, courier: c });
    };

    const exportToCSV = () => {
        if (!shipments || shipments.length === 0) return;
        const headers = ['AWB', 'Date', 'Customer', 'Type', 'Courier', 'Destination City', 'Destination Country', 'Actual Wt (kg)', 'Chargeable Wt (kg)', 'Price (INR)', 'Provider Cost (INR)', 'Gross Profit (INR)', 'Payment Status', 'Status'];
        const rows = shipments.map(s => [
            `"${s.awb}"`,
            `"${s.date}"`,
            `"${s.customer_name}"`,
            `"${s.customer_type}"`,
            `"${s.courier}"`,
            `"${s.receiver_city || ''}"`,
            `"${s.receiver_country}"`,
            s.actual_weight || 0,
            s.chargeable_weight || 0,
            s.price || 0,
            s.provider_cost !== null ? s.provider_cost : 'MASKED',
            s.gross_profit !== null ? s.gross_profit : 'MASKED',
            `"${s.payment_status}"`,
            `"${s.status}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `FMC_Shipments_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getCourierBadge = (courier) => {
        return <CourierLogo courier={courier} height={18} />;
    };

    const getCountryBadge = (country, city) => {
        const dest = (city || country || '').toLowerCase();
        let code = 'IN';
        let name = city || country || 'Domestic';
        if (dest.includes('usa') || dest.includes('francisco') || dest.includes('palo alto') || dest.includes('new york') || dest.includes('states')) { code = 'US'; }
        else if (dest.includes('dubai') || dest.includes('uae') || dest.includes('sharjah') || dest.includes('abu dhabi')) { code = 'AE'; }
        else if (dest.includes('london') || dest.includes('uk') || dest.includes('united kingdom')) { code = 'GB'; }
        else if (dest.includes('berlin') || dest.includes('germany') || dest.includes('munich') || dest.includes('frankfurt')) { code = 'DE'; }
        else if (dest.includes('riyadh') || dest.includes('saudi') || dest.includes('jeddah')) { code = 'SA'; }
        else if (dest.includes('doha') || dest.includes('qatar')) { code = 'QA'; }
        else if (dest.includes('singapore')) { code = 'SG'; }
        else if (dest.includes('sydney') || dest.includes('melbourne') || dest.includes('australia')) { code = 'AU'; }
        else if (dest.includes('toronto') || dest.includes('canada') || dest.includes('vancouver')) { code = 'CA'; }
        else if (dest.includes('paris') || dest.includes('france')) { code = 'FR'; }
        else if (dest.includes('tokyo') || dest.includes('japan')) { code = 'JP'; }

        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="country-iso-badge">{code}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{name}</span>
            </div>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2 className="page-title">📦 Shipment Master Engine</h2>
                    <p className="page-subtitle">Track parcel volumetric weights, selling prices, provider costs, and delivery statuses</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pill-stat">Total: <strong>{shipments?.length || 0}</strong></span>
                    <button className="btn btn-outline" onClick={exportToCSV} title="Export Shipments to CSV">
                        <Download size={14} /> Export CSV
                    </button>
                    {hasPermission('addShipment') && (
                        <button className="btn btn-primary-blue" onClick={onOpenShipmentModal}>
                            <Plus size={15} /> New Shipment
                        </button>
                    )}
                </div>
            </div>

            <div className="filter-bar">
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        className="filter-input" 
                        placeholder="Search AWB, Customer, Receiver City..." 
                        style={{ paddingLeft: '32px' }}
                        value={searchVal}
                        onChange={e => {
                            setSearchVal(e.target.value);
                            handleSearch(e.target.value, statusVal, courierVal);
                        }}
                    />
                </div>
                <select 
                    className="filter-select" 
                    value={statusVal} 
                    onChange={e => {
                        setStatusVal(e.target.value);
                        handleSearch(searchVal, e.target.value, courierVal);
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
                        handleSearch(searchVal, statusVal, e.target.value);
                    }}
                >
                    <option value="">All Couriers</option>
                    <option value="FedEx">FedEx</option>
                    <option value="DHL">DHL</option>
                    <option value="Aramex">Aramex</option>
                    <option value="Blue Dart">Blue Dart</option>
                    <option value="Delhivery">Delhivery</option>
                    <option value="LTL">LTL Heavy Cargo</option>
                </select>
            </div>

            <div className="table-card">
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>AWB & Payment</th>
                                <th style={{ width: '10%' }}>Date</th>
                                <th style={{ width: '18%' }}>Customer</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Courier</th>
                                <th style={{ width: '14%' }}>Destination</th>
                                <th style={{ width: '8%', textAlign: 'center' }}>Weight</th>
                                <th style={{ width: '9%', textAlign: 'right' }}>Price (INR)</th>
                                <th style={{ width: '8%', textAlign: 'right' }}>Profit</th>
                                <th style={{ width: '9%', textAlign: 'center' }}>Status</th>
                                <th style={{ width: '9%', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (!shipments || shipments.length === 0) ? (
                                <TableSkeleton rows={6} cols={10} />
                            ) : shipments?.length === 0 ? (
                                <tr><td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No shipments found matching filters.</td></tr>
                            ) : (
                                shipments?.map(s => {
                                    const profit = s.gross_profit !== undefined && s.gross_profit !== null
                                        ? s.gross_profit 
                                        : (s.price || 0) - (s.actual_provider_cost || s.provider_cost || 0);
                                    const isProfitVisible = s.gross_profit !== null && hasPermission('viewCostMargins');

                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <strong style={{ color: 'var(--primary-blue)', fontFamily: 'monospace', fontSize: '13px' }}>{s.awb}</strong>
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                    <span className={`status-pill ${s.payment_status === 'Paid' ? 'delivered' : 'delayed'}`} style={{ fontSize: '9.5px', padding: '1px 6px', marginRight: '4px' }}>
                                                        {s.payment_status}
                                                    </span>
                                                    <span>{s.paid_to || 'Office QR'}</span>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                                                {formatDate(s.date)}
                                            </td>
                                            <td>
                                                <a 
                                                    href="javascript:void(0)" 
                                                    onClick={() => onOpenCustomerDrawer(s.customer_id || s.customer_name)}
                                                    style={{ fontWeight: 800, color: 'var(--text-main)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12.5px' }}
                                                >
                                                    {s.customer_name} <ArrowUpRight size={11} color="var(--primary-blue)" />
                                                </a>
                                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    <span style={{ fontWeight: 600, color: s.customer_type === 'B2B' ? '#7c3aed' : '#0284c7' }}>{s.customer_type}</span> • {s.employee || 'Staff'}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {getCourierBadge(s.courier)}
                                            </td>
                                            <td>
                                                {getCountryBadge(s.receiver_country, s.receiver_city)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <strong style={{ fontSize: '12.5px' }}>{s.chargeable_weight || s.actual_weight}</strong> <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>kg</span>
                                            </td>
                                            <td style={{ fontWeight: 800, color: 'var(--text-main)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                {formatCurrency(s.price)}
                                            </td>
                                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                {isProfitVisible ? (
                                                    <strong style={{ color: profit >= 0 ? 'var(--emerald)' : 'var(--rose)', fontSize: '12px' }}>
                                                        {formatCurrency(profit)}
                                                    </strong>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Protected</span>
                                                )}
                                            </td>
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
        </div>
    );
};
