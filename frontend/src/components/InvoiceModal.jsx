import React, { useState } from 'react';
import { X, Printer, Mail, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { WhatsAppIcon, CourierLogo } from './CourierLogos';
import { FlyMyCartLogo } from './FlyMyCartLogo';
import { getTrackingUrl, TrackingLink } from './TrackingLink';

const InvoiceModal = ({ isOpen, onClose, invoice, onPaymentRecorded, settings }) => {
    const { hasPermission } = useAuth();
    const canRecordPayment = hasPermission('invoices.edit');
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('PhonePe');

    const employeesList = (settings?.employees || [{ name: 'Nawaz' }, { name: 'Lata' }, { name: 'Umesh' }, { name: 'Uma' }]).map(e => typeof e === 'string' ? e : e.name);
    const paidToList = settings?.paidToAccounts || ['Office QR', 'Current Account (HDFC)', 'Savings Account (ICICI)', 'Lata UPI', 'Nawaz UPI'];

    const [paidTo, setPaidTo] = useState(paidToList[0] || 'Office QR');
    const [collectedBy, setCollectedBy] = useState(employeesList[0] || 'Nawaz');

    if (!isOpen || !invoice) return null;

    const isGst = invoice.is_gst_invoice !== false && Number(invoice.gst) > 0;
    const effectiveTaxRate = Number(invoice.tax_rate) > 0 ? Number(invoice.tax_rate) : (isGst ? 18 : 0);
    const docTitle = isGst ? `Official GST Tax Invoice (${effectiveTaxRate}%)` : 'Commercial Invoice / Bill of Supply (Non-GST)';

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsAppShare = () => {
        const msg = encodeURIComponent(
            `Dear ${invoice.customer_name},\n\nThank you for choosing Fly My Cart Logistics!\n\n📄 Document: ${docTitle}\n🧾 No: ${invoice.invoice_no}\n📦 AWB: ${invoice.awb}\n💰 Total Amount: ₹${invoice.total}\n💳 Amount Paid: ₹${invoice.paid}\n⚠️ Balance: ₹${invoice.balance}\n\n${getTrackingUrl(invoice.courier) ? `Track your ${invoice.courier} shipment: ${getTrackingUrl(invoice.courier)}` : `Contact Fly My Cart for tracking assistance.`}\n\nFly My Cart Bangalore Hub`
        );
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    const handleEmailShare = () => {
        const subject = encodeURIComponent(`${docTitle} - ${invoice.invoice_no} - Fly My Cart Logistics`);
        const body = encodeURIComponent(
            `Dear ${invoice.customer_name},\n\nPlease find attached your invoice details for shipment AWB ${invoice.awb}.\n\nDocument: ${docTitle}\nTotal: ₹${invoice.total}\nPaid: ₹${invoice.paid}\nBalance: ₹${invoice.balance}\n\nThank you for partnering with Fly My Cart.`
        );
        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    };

    const handleSubmitPayment = async (e) => {
        e.preventDefault();
        if (!canRecordPayment || isSubmittingPayment) return;
        const amt = parseFloat(paymentAmount);
        if (!amt || amt <= 0) {
            alert('Please enter a valid payment amount');
            return;
        }

        setIsSubmittingPayment(true);
        try {
            await apiClient.recordInvoicePayment(invoice.id, {
                amount: amt,
                payment_method: paymentMethod,
                paid_to: paidTo,
                collected_by: collectedBy
            });
            alert('Payment recorded successfully!');
            setIsRecordingPayment(false);
            if (onPaymentRecorded) onPaymentRecorded();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error recording payment');
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal modal-lg" style={{ maxWidth: '680px' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✈️
                        </div>
                        <h3 style={{ fontSize: '15px', fontWeight: 800 }}>{docTitle}</h3>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Printable Invoice Container */}
                <div className="invoice-container" id="printable-invoice" style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: '24px', background: 'var(--bg-card)' }}>
                    {/* Header */}
                    <div className="invoice-brand" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--primary-blue)', paddingBottom: '16px', marginBottom: '18px' }}>
                        <div>
                            <div style={{ marginBottom: '6px' }}>
                                <FlyMyCartLogo height={42} theme="light" />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                                International Courier & Cargo Logistics
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                GSTIN: <strong>29AAACF9842M1Z0</strong> • Bangalore Main Hub
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {isGst ? 'TAX INVOICE' : 'BILL OF SUPPLY / RECEIPT'}
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{invoice.invoice_no}</h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Date: <strong>{formatDate(invoice.date)}</strong></div>
                            <div style={{ marginTop: '6px' }}>
                                <span className={`status-pill ${invoice.status === 'Paid' ? 'delivered' : 'delayed'}`}>
                                    {invoice.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="invoice-metadata-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                        <div style={{ background: 'var(--bg-app)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billed Customer:</div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', marginTop: '3px' }}>{invoice.customer_name}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Billing Mode: {isGst ? `GST Registered (${effectiveTaxRate}%)` : 'Non-GST / Bill of Supply'}</div>
                        </div>
                        <div style={{ background: 'var(--bg-app)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Logistics Consignment:</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '3px' }}>AWB: <TrackingLink awb={invoice.awb} courier={invoice.courier} style={{ fontFamily: 'monospace' }} /></div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Carrier: {invoice.courier} ({invoice.service || 'Express'}) • HSN/SAC: 996812</div>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <table className="data-table" style={{ marginBottom: '18px' }}>
                        <thead>
                            <tr>
                                <th>Service Item Description</th>
                                <th>AWB</th>
                                <th>Carrier</th>
                                <th style={{ textAlign: 'right' }}>Base Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>{invoice.description || 'International Courier & Freight Forwarding'}</strong></td>
                                <td style={{ fontFamily: 'monospace' }}><TrackingLink awb={invoice.awb} courier={invoice.courier} /></td>
                                <td><CourierLogo courier={invoice.courier} height={18} /></td>
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(invoice.amount)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Total Box */}
                    <div style={{ marginLeft: 'auto', maxWidth: '320px', background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                            <span>Subtotal (Base):</span><strong>{formatCurrency(invoice.amount)}</strong>
                        </div>
                        {isGst ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    <span>CGST ({(effectiveTaxRate / 2).toFixed(1)}%):</span><span>{formatCurrency(invoice.cgst ?? (invoice.gst / 2))}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    <span>SGST ({(effectiveTaxRate / 2).toFixed(1)}%):</span><span>{formatCurrency(invoice.sgst ?? (invoice.gst / 2))}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--primary-blue)', marginBottom: '6px', borderTop: '1px dashed var(--card-border)', paddingTop: '4px' }}>
                                    <span>Total GST ({effectiveTaxRate}%):</span><span>{formatCurrency(invoice.gst)}</span>
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                <span>GST (0% / Non-GST):</span><span>₹0.00</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: 'var(--emerald)', marginBottom: '6px', borderTop: '1px solid var(--card-border)', paddingTop: '6px' }}>
                            <span>Invoice Total:</span><strong>{formatCurrency(invoice.total)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                            <span>Amount Collected:</span><strong>{formatCurrency(invoice.paid)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, borderTop: '2px solid var(--card-border)', paddingTop: '8px', color: invoice.balance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                            <span>Balance Due:</span><span>{formatCurrency(invoice.balance)}</span>
                        </div>
                    </div>
                </div>

                {/* Record Payment Drawer Form if toggled */}
                {canRecordPayment && isRecordingPayment && (
                    <form onSubmit={handleSubmitPayment} style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-blue)', marginTop: '14px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 800, marginBottom: '10px', color: 'var(--primary-blue)' }}>💳 Record Payment Settlement</h4>
                        <div className="form-grid invoice-payment-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                            <div className="form-group">
                                <label>Amount (₹)</label>
                                <input type="number" min="1" max={invoice.balance} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={`Max ${invoice.balance}`} required />
                            </div>
                            <div className="form-group">
                                <label>Payment Mode</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                    <option value="PhonePe">PhonePe / UPI</option>
                                    <option value="Google Pay">Google Pay</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Office QR">Office QR</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Paid To Account</label>
                                <select value={paidTo} onChange={e => setPaidTo(e.target.value)}>
                                    {paidToList.map(acc => (
                                        <option key={acc} value={acc}>{acc}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Collected By</label>
                                <select value={collectedBy} onChange={e => setCollectedBy(e.target.value)}>
                                    {employeesList.map(emp => (
                                        <option key={emp} value={emp}>{emp}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setIsRecordingPayment(false)} disabled={isSubmittingPayment}>Cancel</button>
                            <button type="submit" className="btn btn-sm btn-primary-blue" disabled={isSubmittingPayment} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: isSubmittingPayment ? 'wait' : 'pointer' }}>
                                {isSubmittingPayment ? (
                                    <>
                                        <Loader2 size={13} className="spin" />
                                        <span>Recording Payment...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={13} />
                                        <span>Confirm Payment</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Footer Action Bar */}
                <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--card-border)' }}>
                    <div>
                        {canRecordPayment && invoice.balance > 0 && !isRecordingPayment && (
                            <button 
                                className="btn btn-sm btn-outline" 
                                style={{ color: 'var(--emerald)', borderColor: 'var(--emerald)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }} 
                                onClick={() => { setPaymentAmount(invoice.balance); setIsRecordingPayment(true); }}
                            >
                                <CreditCard size={14} /> Record Payment
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button 
                            className="btn btn-outline" 
                            onClick={onClose}
                            style={{ padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Close
                        </button>
                        <button 
                            className="btn" 
                            onClick={handleWhatsAppShare}
                            style={{ 
                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)', 
                                color: '#ffffff', 
                                border: 'none', 
                                padding: '7px 15px', 
                                borderRadius: '8px', 
                                fontWeight: 700, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <WhatsAppIcon size={16} color="#ffffff" /> WhatsApp
                        </button>
                        <button 
                            className="btn" 
                            onClick={handleEmailShare}
                            style={{ 
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                                color: '#ffffff', 
                                border: 'none', 
                                padding: '7px 16px', 
                                borderRadius: '8px', 
                                fontWeight: 700, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '7px', 
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Mail size={15} color="#ffffff" /> Email Invoice
                        </button>
                        <button 
                            className="btn btn-primary-blue" 
                            onClick={handlePrint}
                            style={{ 
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '7px 16px', 
                                borderRadius: '8px', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                            }}
                        >
                            <Printer size={15} /> Print / PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceModal;
