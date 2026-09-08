import React, { useState } from 'react';
import { X, Scale, CheckCheck, Upload } from 'lucide-react';
import { apiClient } from '../api/client';

const ReconciliationModal = ({ isOpen, onClose, onReconciled, settings }) => {
    const [provider, setProvider] = useState('Aramex');
    const [rawBillText, setRawBillText] = useState('');
    const [billReference, setBillReference] = useState('');
    const [previewResult, setPreviewResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setBillReference(file.name.replace(/\.[^/.]+$/, ''));
        const reader = new FileReader();
        reader.onload = (event) => {
            setRawBillText(event.target.result);
        };
        reader.readAsText(file);
    };

    const handleProcess = async (e) => {
        e.preventDefault();
        if (!rawBillText.trim()) {
            alert('Please paste provider bill text or upload a CSV/text file.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiClient.processReconciliation({
                provider,
                bill_reference: billReference || `${provider} Monthly Statement`,
                raw_bill_text: rawBillText
            });
            setPreviewResult(res);
        } catch (err) {
            alert(err.response?.data?.detail || 'Error processing provider bill');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!previewResult) return;
        if (!confirm(`Are you sure you want to apply ${previewResult.matched_count + previewResult.wrong_amount.length} actual provider costs to shipments and recalculate True Gross Profit?`)) {
            return;
        }

        try {
            const res = await apiClient.applyReconciliation(previewResult);
            alert(`Reconciliation applied successfully! Batch #${res.batch_no} created. ${res.updated_count} shipments updated.`);
            onReconciled();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error committing reconciliation');
        }
    };

    if (!isOpen) return null;

    const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

    // Providers list from settings or defaults
    const providersList = [
        ...(settings?.postpaidProviders?.map(p => p.name) || ['Aramex', 'Blue Dart']),
        ...(settings?.prepaidWallets?.map(w => w.name) || ['ICL', 'BRV'])
    ];

    const getItemsToDisplay = () => {
        if (!previewResult) return [];
        if (activeFilter === 'matched') return previewResult.matched || [];
        if (activeFilter === 'wrong_amount') return previewResult.wrong_amount || [];
        if (activeFilter === 'missing_in_crm') return previewResult.missing_in_crm || [];
        if (activeFilter === 'duplicate_awb') return previewResult.duplicate_awb || [];
        if (activeFilter === 'missing_in_bill') return previewResult.missing_in_bill || [];
        return [
            ...(previewResult.wrong_amount || []),
            ...(previewResult.missing_in_crm || []),
            ...(previewResult.duplicate_awb || []),
            ...(previewResult.matched || []),
            ...(previewResult.missing_in_bill || [])
        ];
    };

    const displayItems = getItemsToDisplay();

    return (
        <div className="modal-overlay">
            <div className="modal modal-lg" style={{ maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Scale size={19} color="var(--primary-blue)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Provider Cost Reconciliation Engine (Rule 4 & 6)</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Match courier monthly invoices AWB-by-AWB &rarr; resolve weight discrepancies & recalculate True Gross Profit
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    <form onSubmit={handleProcess}>
                        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                            <div className="form-group">
                                <label>Provider Account <span className="required">*</span></label>
                                <select value={provider} onChange={e => setProvider(e.target.value)}>
                                    {Array.from(new Set(providersList)).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Bill Reference / Invoice #</label>
                                <input 
                                    type="text" 
                                    value={billReference} 
                                    onChange={e => setBillReference(e.target.value)} 
                                    placeholder="e.g. ARX-INV-2026-AUG" 
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label>Upload File or Paste Bill Lines (AWB, Actual Cost) <span className="required">*</span></label>
                                    <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '11px' }}>
                                        <Upload size={12} /> Upload CSV/TXT
                                        <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <textarea 
                                    rows="3" 
                                    value={rawBillText}
                                    onChange={e => setRawBillText(e.target.value)}
                                    placeholder="Paste courier bill rows. Examples:&#10;FX260831001 3950&#10;ARX260831002 12400&#10;DLV260831003 1400"
                                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                            <button type="submit" className="btn btn-primary-blue" disabled={loading}>
                                {loading ? 'Matching AWBs...' : 'Match AWBs & Compare Variance'}
                            </button>
                        </div>
                    </form>

                    {previewResult && (
                        <div style={{ borderTop: '2px solid var(--card-border)', paddingTop: '16px' }}>
                            {/* Summary KPI Cards */}
                            <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Total in Bill</span>
                                    <div className="card-value" style={{ fontSize: '18px' }}>{previewResult.total_rows}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Exact Matches</span>
                                    <div className="card-value" style={{ fontSize: '18px', color: 'var(--emerald)' }}>{previewResult.matched_count}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Discrepancies</span>
                                    <div className="card-value" style={{ fontSize: '18px', color: 'var(--rose)' }}>{previewResult.discrepancy_count}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Total Predicted</span>
                                    <div className="card-value" style={{ fontSize: '16px' }}>{formatCurrency(previewResult.total_predicted)}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Actual Bill</span>
                                    <div className="card-value" style={{ fontSize: '16px', color: 'var(--primary-blue)' }}>{formatCurrency(previewResult.total_actual)}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Variance</span>
                                    <div className="card-value" style={{ fontSize: '16px', color: previewResult.variance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                                        {previewResult.variance > 0 ? '+' : ''}{formatCurrency(previewResult.variance)}
                                    </div>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <button className={`btn btn-sm ${activeFilter === 'all' ? 'btn-primary-blue' : 'btn-outline'}`} onClick={() => setActiveFilter('all')}>
                                    All ({previewResult.total_rows + (previewResult.missing_in_bill?.length || 0)})
                                </button>
                                <button className={`btn btn-sm ${activeFilter === 'wrong_amount' ? 'btn-primary-blue' : 'btn-outline'}`} onClick={() => setActiveFilter('wrong_amount')}>
                                    Wrong Amount ({previewResult.wrong_amount?.length || 0})
                                </button>
                                <button className={`btn btn-sm ${activeFilter === 'missing_in_crm' ? 'btn-primary-blue' : 'btn-outline'}`} onClick={() => setActiveFilter('missing_in_crm')}>
                                    Missing in CRM ({previewResult.missing_in_crm?.length || 0})
                                </button>
                                <button className={`btn btn-sm ${activeFilter === 'matched' ? 'btn-primary-blue' : 'btn-outline'}`} onClick={() => setActiveFilter('matched')}>
                                    Matched ({previewResult.matched?.length || 0})
                                </button>
                                <button className={`btn btn-sm ${activeFilter === 'missing_in_bill' ? 'btn-primary-blue' : 'btn-outline'}`} onClick={() => setActiveFilter('missing_in_bill')}>
                                    Unbilled in CRM ({previewResult.missing_in_bill?.length || 0})
                                </button>
                            </div>

                            {/* Discrepancy Breakdown Table */}
                            <div className="table-card" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>AWB</th>
                                            <th>Customer</th>
                                            <th>Predicted Cost</th>
                                            <th>Actual Cost</th>
                                            <th>Variance</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayItems.length === 0 ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No items in this category.</td></tr>
                                        ) : (
                                            displayItems.map((item, idx) => {
                                                const diff = item.variance !== undefined ? item.variance : (item.actual_cost - item.predicted_cost);
                                                return (
                                                    <tr key={idx}>
                                                        <td><strong style={{ fontFamily: 'monospace', color: 'var(--primary-blue)' }}>{item.awb}</strong></td>
                                                        <td>{item.customer_name || item.customer || '-'}</td>
                                                        <td>{formatCurrency(item.predicted_cost)}</td>
                                                        <td><strong>{formatCurrency(item.actual_cost)}</strong></td>
                                                        <td style={{ fontWeight: 800, color: diff > 0 ? 'var(--rose)' : (diff < 0 ? 'var(--amber)' : 'var(--emerald)') }}>
                                                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                                        </td>
                                                        <td>
                                                            <span className={`status-pill ${item.status === 'MATCHED' ? 'delivered' : (item.status === 'WRONG AMOUNT' ? 'delayed' : 'picked-up')}`}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Commit */}
                {previewResult && (
                    <div className="form-actions" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '12px', marginTop: '12px' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn btn-primary-blue" onClick={handleApply}>
                            <CheckCheck size={16} /> Recalculate Profit & Apply Actual Costs
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReconciliationModal;
