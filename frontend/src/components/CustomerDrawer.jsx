import React, { useState } from 'react';
import { 
    X, 
    Phone, 
    Mail, 
    MapPin, 
    Building, 
    Shield, 
    Package, 
    FileText, 
    MessageSquare, 
    RotateCcw, 
    Calendar, 
    Printer,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { WhatsAppIcon, CourierLogo } from './CourierLogos';
import { LoadingSpinner, CardSkeleton, TableSkeleton } from './LoadingSpinner';

const CustomerDrawer = ({ 
    isOpen, 
    onClose, 
    data, 
    onOpenCommModal,
    onPreviewInvoice,
    isLoading = false 
}) => {
    const [activeTab, setActiveTab] = useState('shipments');

    if (!isOpen) return null;

    if (isLoading && !data) {
        return (
            <>
                <div className="drawer-overlay" onClick={onClose}></div>
                <div className="customer-drawer" style={{ width: '580px', display: 'flex', flexDirection: 'column' }}>
                    <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <LoadingSpinner size={18} color="#ffffff" />
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>Loading Customer Profile...</h3>
                        </div>
                        <button className="modal-close" style={{ color: 'white', background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>
                    <div className="drawer-content" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <CardSkeleton count={3} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ height: '40px', background: '#e2e8f0', borderRadius: '6px', animation: 'pulse 1.5s infinite' }}></div>
                            <TableSkeleton rows={4} columns={3} />
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (!data) return null;

    const { 
        customer, 
        total_bookings = 0, 
        total_spent = 0.0, 
        outstanding_balance = 0.0, 
        shipments = [], 
        invoices = [], 
        followups = [], 
        communications = [], 
        refunds = [] 
    } = data;

    const customerDocuments = customer?.documents || [];

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const handleWhatsAppDirect = () => {
        const phoneClean = (customer.whatsapp || customer.mobile || '').replace(/[^0-9]/g, '');
        const msg = encodeURIComponent(`Hello ${customer.name}, greeting from Fly My Cart Logistics! How can we assist with your shipments today?`);
        window.open(`https://wa.me/${phoneClean.length === 10 ? '91' + phoneClean : phoneClean}?text=${msg}`, '_blank');
    };

    const handlePrintStatement = () => {
        window.print();
    };

    return (
        <>
            <div className="drawer-overlay" onClick={onClose}></div>
            <div className="customer-drawer" style={{ width: '580px', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'white' }}>{customer.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span className="status-pill delivered" style={{ fontSize: '10.5px' }}>{customer.customer_type}</span>
                            {customer.company && <span style={{ fontSize: '11px', color: '#cbd5e1' }}>• {customer.company}</span>}
                            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>• {customer.center || 'Main Hub'}</span>
                        </div>
                    </div>
                    <button className="modal-close" style={{ color: 'white', background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="drawer-content" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {/* Top KPI Cards */}
                    <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                        <div className="dash-mini-card" style={{ padding: '10px 12px' }}>
                            <span className="card-label">Total Bookings</span>
                            <div className="card-value" style={{ fontSize: '18px', color: 'var(--primary-blue)' }}>{total_bookings}</div>
                        </div>
                        <div className="dash-mini-card" style={{ padding: '10px 12px' }}>
                            <span className="card-label">Lifetime Spend (LTV)</span>
                            <div className="card-value" style={{ fontSize: '18px', color: 'var(--emerald)' }}>{formatCurrency(total_spent)}</div>
                        </div>
                        <div className="dash-mini-card" style={{ padding: '10px 12px' }}>
                            <span className="card-label">Outstanding Balance</span>
                            <div className="card-value" style={{ fontSize: '18px', color: outstanding_balance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                                {formatCurrency(outstanding_balance)}
                            </div>
                        </div>
                    </div>

                    {/* Profile Information Box */}
                    <div style={{ background: 'var(--bg-app)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', marginBottom: '16px', fontSize: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Phone size={13} color="var(--emerald)" />
                                <span><strong>Mobile:</strong> {customer.mobile}</span>
                            </div>
                            {customer.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Mail size={13} color="var(--primary-blue)" />
                                    <span><strong>Email:</strong> {customer.email}</span>
                                </div>
                            )}
                            {customer.id_proof && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Shield size={13} color="var(--amber)" />
                                    <span><strong>ID Proof:</strong> {customer.id_proof}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={13} color="var(--rose)" />
                                <span><strong>Center:</strong> {customer.center || 'Main Hub'}</span>
                            </div>
                        </div>
                        {customer.address && (
                            <div style={{ marginTop: '8px', borderTop: '1px solid var(--card-border)', paddingTop: '6px' }}>
                                <strong>Address:</strong> {customer.address}
                            </div>
                        )}
                        {customer.customer_type === 'B2B' && (
                            <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--primary-blue)' }}>
                                💼 <strong>Credit Terms:</strong> Limit ₹{Number(customer.credit_limit || 100000).toLocaleString('en-IN')} • Net {customer.credit_period_days || 30} Days
                            </div>
                        )}
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button 
                            className="btn btn-sm" 
                            onClick={handleWhatsAppDirect} 
                            style={{ flex: 1, background: '#25D366', color: '#ffffff', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <WhatsAppIcon size={14} color="#ffffff" /> WhatsApp
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => onOpenCommModal(customer.name)} style={{ flex: 1 }}>
                            <MessageSquare size={13} /> Log Interaction
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={handlePrintStatement}>
                            <Printer size={13} /> Statement
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', borderBottom: '2px solid var(--card-border)', marginBottom: '14px', gap: '4px' }}>
                        <button 
                            className={`btn btn-sm ${activeTab === 'shipments' ? 'btn-primary-blue' : 'btn-outline'}`}
                            onClick={() => setActiveTab('shipments')}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                        >
                            <Package size={13} /> Shipments ({shipments.length})
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'invoices' ? 'btn-primary-blue' : 'btn-outline'}`}
                            onClick={() => setActiveTab('invoices')}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                        >
                            <FileText size={13} /> Invoices ({invoices.length})
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'timeline' ? 'btn-primary-blue' : 'btn-outline'}`}
                            onClick={() => setActiveTab('timeline')}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                        >
                            <Clock size={13} /> Comms & Alerts ({communications.length + followups.length})
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'documents' ? 'btn-primary-blue' : 'btn-outline'}`}
                            onClick={() => setActiveTab('documents')}
                            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                        >
                            <Shield size={13} /> KYC Documents ({customerDocuments.length})
                        </button>
                        {refunds.length > 0 && (
                            <button 
                                className={`btn btn-sm ${activeTab === 'refunds' ? 'btn-primary-blue' : 'btn-outline'}`}
                                onClick={() => setActiveTab('refunds')}
                                style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
                            >
                                <RotateCcw size={13} /> Refunds ({refunds.length})
                            </button>
                        )}
                    </div>

                    {/* Tab 1: Shipments */}
                    {activeTab === 'shipments' && (
                        <div>
                            {shipments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>No shipments booked yet.</div>
                            ) : (
                                shipments.map(s => (
                                    <div key={s.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ color: 'var(--primary-blue)', fontFamily: 'monospace', fontSize: '13px' }}>{s.awb}</strong>
                                            <span className={`status-pill ${s.status === 'Delivered' ? 'delivered' : s.status === 'Delayed' ? 'delayed' : 'in-transit'}`} style={{ fontSize: '10px' }}>
                                                {s.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-muted)', margin: '4px 0', flexWrap: 'wrap' }}>
                                            <span>📅 {formatDate(s.date)}</span>
                                            <CourierLogo courier={s.courier} height={14} />
                                            <span>({s.service_type || 'Express'}) &rarr; To: {s.receiver_city || s.receiver_country} ({s.chargeable_weight} kg)</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', borderTop: '1px dashed var(--card-border)', paddingTop: '4px', marginTop: '4px' }}>
                                            <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>Price: {formatCurrency(s.price)}</span>
                                            <span className={`status-pill ${s.payment_status === 'Paid' ? 'delivered' : 'delayed'}`} style={{ fontSize: '10px' }}>
                                                {s.payment_status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Tab 2: Invoices */}
                    {activeTab === 'invoices' && (
                        <div>
                            {invoices.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>No invoices recorded.</div>
                            ) : (
                                invoices.map(i => (
                                    <div key={i.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong style={{ color: 'var(--primary-blue)', fontSize: '13px' }}>{i.invoice_no}</strong>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({formatDate(i.date)})</span>
                                            </div>
                                            <button className="btn btn-sm btn-outline" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={() => onPreviewInvoice(i)}>
                                                View
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', marginTop: '6px' }}>
                                            <span>Total: <strong>{formatCurrency(i.total)}</strong></span>
                                            <span>Paid: <strong style={{ color: 'var(--emerald)' }}>{formatCurrency(i.paid)}</strong></span>
                                            <span>Balance: <strong style={{ color: i.balance > 0 ? 'var(--rose)' : 'var(--text-muted)' }}>{formatCurrency(i.balance)}</strong></span>
                                            <span className={`status-pill ${i.status === 'Paid' ? 'delivered' : 'delayed'}`} style={{ fontSize: '10px' }}>{i.status}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Tab 3: Timeline (Comms & Follow-ups) */}
                    {activeTab === 'timeline' && (
                        <div>
                            {communications.length === 0 && followups.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>No communications logged.</div>
                            ) : (
                                [
                                    ...communications.map(c => ({ type: 'comm', date: c.date, title: `${c.channel} (${c.staff})`, content: c.message, status: c.status })),
                                    ...followups.map(f => ({ type: 'followup', date: f.due_date, title: `Follow-up: ${f.category}`, content: f.notes, status: f.status }))
                                ].map((ev, idx) => (
                                    <div key={idx} style={{ 
                                        padding: '9px 12px', 
                                        borderLeft: `3px solid ${ev.type === 'comm' ? 'var(--primary-blue)' : 'var(--amber)'}`, 
                                        background: 'var(--bg-app)', 
                                        marginBottom: '8px', 
                                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                        fontSize: '12px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ color: 'var(--text-main)' }}>{ev.title}</strong>
                                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{formatDate(ev.date)}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', marginTop: '3px', fontSize: '11.5px' }}>{ev.content}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Tab 4: Refunds */}
                    {activeTab === 'refunds' && (
                        <div>
                            {refunds.map(r => (
                                <div key={r.id} style={{ background: 'var(--bg-app)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '8px', fontSize: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ color: 'var(--rose)' }}>{formatCurrency(r.amount)}</strong>
                                        <span className={`status-pill ${r.status === 'Refunded' ? 'delivered' : (r.status === 'Approved' ? 'picked-up' : 'in-transit')}`} style={{ fontSize: '10px' }}>
                                            {r.status}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        AWB: <strong>{r.awb}</strong> • Reason: {r.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tab 5: KYC Documents */}
                    {activeTab === 'documents' && (
                        <div>
                            {customerDocuments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                    <Shield size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                    No KYC documents uploaded by customer yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {customerDocuments.map((doc, idx) => (
                                        <div key={idx} style={{ 
                                            background: 'var(--bg-app)', 
                                            border: '1px solid var(--card-border)', 
                                            borderRadius: 'var(--radius-sm)', 
                                            padding: '12px 14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '12px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                <div style={{ 
                                                    width: '32px', 
                                                    height: '32px', 
                                                    borderRadius: '6px', 
                                                    background: 'rgba(37,99,235,0.1)', 
                                                    color: 'var(--primary-blue)', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <FileText size={16} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                                        {doc.document_type ? doc.document_type.replace('_', ' ') : 'KYC Document'}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {doc.filename} • {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString('en-IN') : 'Uploaded'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                <span className="status-pill delivered" style={{ fontSize: '10px' }}>
                                                    {doc.status || 'Verified'}
                                                </span>
                                                {doc.file_url && (
                                                    <a 
                                                        href={doc.file_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="btn btn-sm btn-outline"
                                                        style={{ fontSize: '11px', padding: '3px 8px' }}
                                                    >
                                                        View
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CustomerDrawer;
