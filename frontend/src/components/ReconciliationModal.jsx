import React, { useRef, useState } from 'react';
import { X, Scale, CheckCheck, Upload } from 'lucide-react';
import { apiClient } from '../api/client';
import { providerCostLabel } from '../utils/costLabels';

const ReconciliationModal = ({ isOpen, onClose, onReconciled, settings }) => {
    const applying = useRef(false);
    const [isApplying, setIsApplying] = useState(false);
    const [provider, setProvider] = useState('Aramex');
    const [rawBillText, setRawBillText] = useState('');
    const [billFile, setBillFile] = useState(null);
    const [importReviewed, setImportReviewed] = useState(false);
    const [billReference, setBillReference] = useState('');
    const [previewResult, setPreviewResult] = useState(null);
    const costLabel = providerCostLabel(previewResult?.provider || provider);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
            alert('Bill files must be 20 MB or smaller.');
            e.target.value = '';
            return;
        }

        setPreviewResult(null);
        setBillFile(file);
        setRawBillText('');
        setBillReference(file.name.replace(/\.[^/.]+$/, ''));
        e.target.value = '';
    };

    const handleProcess = async (e) => {
        e.preventDefault();
        if (!billFile && !rawBillText.trim()) {
            alert('Please upload an Excel, CSV, or PDF bill, or paste AWB and total lines.');
            return;
        }

        setLoading(true);
        setPreviewResult(null);
        setImportReviewed(false);
        try {
            let res;
            if (billFile) {
                const formData = new FormData();
                formData.append('file', billFile);
                formData.append('provider', provider);
                formData.append('bill_reference', billReference || billFile.name);
                res = await apiClient.uploadReconciliationFile(formData);
            } else {
                res = await apiClient.processReconciliation({
                provider,
                bill_reference: billReference || `${provider} Monthly Statement`,
                raw_bill_text: rawBillText
                });
            }
            setPreviewResult(res);
            setActiveFilter('all');
        } catch (err) {
            alert(err.response?.data?.detail || 'Error processing provider bill');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!previewResult || applying.current) return;
        if (!confirm(`Are you sure you want to apply ${previewResult.matched_count + previewResult.wrong_amount.length} ${costLabel} entries to shipments and recalculate True Gross Profit?`)) {
            return;
        }

        applying.current = true;
        setIsApplying(true);
        try {
            const res = await apiClient.applyReconciliation(previewResult);
            alert(`Reconciliation applied successfully! Batch #${res.batch_no} created. ${res.updated_count} shipments updated.`);
            setPreviewResult(null);
            setRawBillText('');
            setBillFile(null);
            setBillReference('');
            setActiveFilter('all');
            await onReconciled();
            onClose();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error committing reconciliation');
        } finally {
            applying.current = false;
            setIsApplying(false);
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
            <div className="modal modal-lg reconciliation-modal" style={{ maxWidth: '1180px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Scale size={19} color="var(--primary-blue)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Billing Reconciliation</h3>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Match each AWB and billed total against the saved provider cost.
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
                                <select disabled={loading || isApplying} value={provider} onChange={e => { setProvider(e.target.value); setPreviewResult(null); }}>
                                    {Array.from(new Set(providersList)).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Bill Reference / Invoice #</label>
                                <input 
                                    type="text" 
                                    disabled={loading || isApplying}
                                    value={billReference} 
                                    onChange={e => { setBillReference(e.target.value); setPreviewResult(null); }}
                                    placeholder="e.g. ARX-INV-2026-AUG" 
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <label>Upload Bill or Paste AWB and Total <span className="required">*</span></label>
                                    <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '11px' }}>
                                        <Upload size={12} /> Upload Excel / CSV / PDF
                                        <input aria-label="Upload carrier bill" type="file" disabled={loading || isApplying} accept=".xlsx,.xls,.pdf,.csv,.txt,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Any carrier with AWB and a recognized total heading: Total, Total Amount, Net Amount, Grand Total, Final Amount, and more. Uses the supplied total without adding GST or surcharges. Maximum 20 MB. Scanned PDFs need OCR first.
                                </p>
                                {billFile && <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <span>{billFile.name} ({Math.ceil(billFile.size / 1024)} KB)</span>
                                    <button type="button" className="btn btn-sm btn-outline" disabled={loading || isApplying} onClick={() => { setBillFile(null); setPreviewResult(null); }}>Remove file</button>
                                </div>}
                                <textarea 
                                    disabled={loading || isApplying || !!billFile}
                                    rows="3" 
                                    value={rawBillText}
                                    onChange={e => { setRawBillText(e.target.value); setPreviewResult(null); }}
                                    placeholder="Paste courier bill rows. Examples:&#10;FX260831001 3950&#10;ARX260831002 12400&#10;DLV260831003 1400"
                                    style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                    required={!billFile}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                            <button type="submit" className="btn btn-primary-blue" disabled={loading || isApplying}>
                                {loading ? 'Matching AWBs...' : 'Match AWBs & Compare Difference'}
                            </button>
                        </div>
                    </form>

                    {previewResult && (
                        <div style={{ borderTop: '2px solid var(--card-border)', paddingTop: '16px' }}>
                            {previewResult.import_info && <div style={{ padding: '12px', background: 'var(--bg-body, #f8fafc)', borderRadius: '8px', marginBottom: '12px' }}>
                                <strong>Imported {previewResult.import_info.row_count} AWB totals</strong>
                                {previewResult.import_info.columns.map((column, index) => <p key={index} style={{ fontSize: '12px', margin: '4px 0' }}>
                                    {column.source}: AWB = {column.awb_column}; billed total = {column.total_column}
                                </p>)}
                                {!!previewResult.import_info.warnings.length && <>
                                    <details><summary>Review excluded rows / sheets ({previewResult.import_info.warnings.length})</summary>
                                        <ul>{previewResult.import_info.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
                                    </details>
                                    <label style={{ display: 'flex', gap: '8px', marginTop: '8px' }}><input type="checkbox" checked={importReviewed} onChange={e => setImportReviewed(e.target.checked)} />I reviewed the excluded rows and confirmed the shipment totals are complete.</label>
                                </>}
                            </div>}
                            {/* Summary KPI Cards */}
                            <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Total in Bill</span>
                                    <div className="card-value" style={{ fontSize: '18px' }}>{previewResult.total_rows}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Matches Net Cost</span>
                                    <div className="card-value" style={{ fontSize: '18px', color: 'var(--emerald)' }}>{previewResult.matched_count}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Changes / Issues</span>
                                    <div className="card-value" style={{ fontSize: '18px', color: 'var(--rose)' }}>{previewResult.discrepancy_count}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Net Cost</span>
                                    <div className="card-value" style={{ fontSize: '16px' }}>{formatCurrency(previewResult.total_current ?? previewResult.total_predicted)}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">{costLabel}</span>
                                    <div className="card-value" style={{ fontSize: '16px', color: 'var(--primary-blue)' }}>{formatCurrency(previewResult.total_actual)}</div>
                                </div>
                                <div className="dash-mini-card" style={{ padding: '8px 10px' }}>
                                    <span className="card-label">Difference</span>
                                    <div className="card-value" style={{ fontSize: '16px', color: previewResult.variance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                                        {previewResult.variance > 0 ? '+' : ''}{formatCurrency(previewResult.variance)}
                                    </div>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
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
                            <div className="table-card reconciliation-table-wrap">
                                <table className="data-table reconciliation-table">
                                    <colgroup>
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '11%' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '10%' }} />
                                        <col style={{ width: '15%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>AWB</th>
                                            <th>Customer</th>
                                            <th>Predicted Cost</th><th>Net Cost</th>
                                            <th>{costLabel}</th>
                                            <th>Difference</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayItems.length === 0 ? (
                                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No items in this category.</td></tr>
                                        ) : (
                                            displayItems.map((item, idx) => {
                                                const diff = item.variance !== undefined ? item.variance : (item.actual_cost - item.predicted_cost);
                                                return (
                                                    <tr key={idx}>
                                                        <td><strong style={{ fontFamily: 'monospace', color: 'var(--primary-blue)' }}>{item.awb}</strong></td>
                                                        <td>{item.customer_name || item.customer || '-'}</td>
                                                        <td>{formatCurrency(item.predicted_cost)}</td><td>{formatCurrency(item.current_cost ?? item.predicted_cost)}</td>
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

                {previewResult && (previewResult.duplicate_awb?.length > 0 || previewResult.missing_in_crm?.length > 0) && <p role="alert">Remove duplicate AWBs and resolve unknown AWBs before applying costs.</p>}
                {/* Footer Commit */}
                {previewResult && (
                    <div className="form-actions" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '12px', marginTop: '12px' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn btn-primary-blue" onClick={handleApply} disabled={isApplying || loading || (!!previewResult.import_info?.warnings?.length && !importReviewed) || !!previewResult.duplicate_awb?.length || !!previewResult.missing_in_crm?.length}>
                            <CheckCheck size={16} /> {isApplying ? 'Applying costs...' : `Recalculate Profit & Apply ${costLabel}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReconciliationModal;
