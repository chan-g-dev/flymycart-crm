import { useRemoteData } from '../utils/useRemoteData';
import React, { useState, useMemo, useCallback } from 'react';
import { apiClient } from '../api/client';
import JSZip from 'jszip';
import { 
    ShieldCheck, 
    Trash2, 
    Calendar, 
    HardDrive, 
    AlertTriangle, 
    Image as ImageIcon, 
    CheckCircle2, 
    Loader2, 
    RefreshCw, 
    Search, 
    Eye, 
    Download,
    X,
    CheckSquare,
    Square,
    FileArchive,
    FileText,
    SlidersHorizontal
} from 'lucide-react';

export default function KycStorageSettings({ canManage }) {
    const [actionLoading, setActionLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmModal, setConfirmModal] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);

    // Date range & batch selection state
    const [datePreset, setDatePreset] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [page, setPage] = useState(0);
    const filterKey = JSON.stringify([searchQuery, startDate, endDate]);
    const [previousFilters, setPreviousFilters] = useState(filterKey);
    if (previousFilters !== filterKey) {
        setPreviousFilters(filterKey);
        setPage(0);
        setSelectedIds(new Set());
    }
    const requestRecords = useCallback(() => apiClient.getKycStorage({
        limit: 50, offset: page * 50, search: searchQuery, date_from: startDate, date_to: endDate,
    }), [page, searchQuery, startDate, endDate]);
    const { data, loading, error: loadError, reload } = useRemoteData(requestRecords);
    const stats = useMemo(() => data || { total_documents: 0, older_than_3_months: 0, older_than_6_months: 0, records: [], filtered_total: 0 }, [data]);
    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);

    // Customized Deletion states
    const [deleteMode, setDeleteMode] = useState('date_range'); // 'date_range' | 'selected' | 'age_threshold'
    const [deleteStartDate, setDeleteStartDate] = useState('');
    const [deleteEndDate, setDeleteEndDate] = useState('');
    const [customMonths, setCustomMonths] = useState('3');

    const showToast = (msg, isSuccess = true) => {
        setToastMessage({ text: msg, isSuccess });
        setTimeout(() => setToastMessage(null), 4000);
    };

    const handleDownloadImage = (src, filename = 'id_proof_document.png') => {
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const fetchStats = () => {
        setSelectedIds(new Set());
        setPage(0);
        reload();
    };

    // Date preset logic
    const handlePresetChange = (preset) => {
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
        } else if (preset === 'last_30') {
            const d30 = new Date(today);
            d30.setDate(d30.getDate() - 30);
            const d30Str = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;
            setStartDate(d30Str);
            setEndDate(todayStr);
        }
    };

    const filteredRecords = stats.records || [];

    // Selection handlers
    const handleToggleSelectAll = () => {
        if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        }
    };

    const handleToggleSelectOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const fetchImageBlob = async (src) => {
        if (!src) return null;
        if (src.startsWith('data:')) {
            const parts = src.split(';base64,');
            const contentType = parts[0].split(':')[1];
            const raw = window.atob(parts[1]);
            const rawLength = raw.length;
            const uInt8Array = new Uint8Array(rawLength);
            for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }
            return new Blob([uInt8Array], { type: contentType });
        } else {
            const res = await fetch(src);
            return await res.blob();
        }
    };

    const imageExtension = (src) => {
        if (String(src || '').startsWith('data:application/pdf')) return 'pdf';
        const mime = String(src || '').match(/^data:image\/(png|jpe?g|webp);/i)?.[1]?.toLowerCase();
        if (mime === 'jpeg' || mime === 'jpg') return 'jpg';
        if (mime === 'webp') return 'webp';
        return 'png';
    };

    const isPdfDocument = src => String(src || '').startsWith('data:application/pdf');

    const renderProofFiles = (record, party) => {
        const person = party === 'sender' ? (record.sender_name || 'Sender') : (record.receiver_name || 'Receiver');
        const files = [
            ['front', record[`${party}_front`]],
            ['back', record[`${party}_back`]],
        ].filter(([, src]) => Boolean(src));
        if (!files.length) return <span className="text-muted" style={{ fontSize: '11px' }}>No Proof File</span>;

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {files.map(([side, src]) => {
                    const titleSide = side[0].toUpperCase() + side.slice(1);
                    const filename = `${record.awb}_${party}_id_proof_${side}.${imageExtension(src)}`;
                    return (
                        <div key={side} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                type="button"
                                className="kyc-thumb-btn"
                                onClick={() => setPreviewImage({
                                    title: `${record.awb} - ${person} ${titleSide} Copy`,
                                    src,
                                    filename,
                                })}
                                title={`Preview ${party} ${side} copy`}
                            >
                                {isPdfDocument(src) ? <FileText size={19} color="#ef4444" /> : <img src={src} alt={`${person} ID proof ${side} copy`} className="kyc-thumb" />}
                                <span style={{ position: 'absolute', left: '3px', bottom: '2px', padding: '1px 4px', borderRadius: '4px', background: 'rgba(15,23,42,.82)', color: '#fff', fontSize: '8px', fontWeight: 700 }}>
                                    {titleSide}
                                </span>
                                <Eye size={12} className="kyc-thumb-eye" />
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                style={{ padding: '4px 6px', height: '28px', color: '#1e64f0', borderColor: '#cbd5e1' }}
                                onClick={() => handleDownloadImage(src, filename)}
                                title={`Download ${party} ${side} copy`}
                            >
                                <Download size={13} />
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Bulk ZIP Exporter
    const handleDownloadZipBatch = async () => {
        const targetRecords = selectedIds.size > 0
            ? filteredRecords.filter(r => selectedIds.has(r.id))
            : filteredRecords;

        if (targetRecords.length === 0) {
            alert('No shipment ID proof files available to download.');
            return;
        }

        setIsZipping(true);
        setZipProgress(0);

        try {
            const zip = new JSZip();
            const folder = zip.folder(`KYC_Documents_${new Date().toISOString().slice(0, 10)}`);

            const manifestHeaders = [
                'AWB', 'Date', 'Type',
                'Sender Name', 'Sender Phone', 'Sender ID Proof Number', 'Sender Front Saved', 'Sender Back Saved',
                'Receiver Name', 'Receiver Phone', 'Receiver ID Proof Number', 'Receiver Front Saved', 'Receiver Back Saved'
            ];
            const manifestRows = [];

            let processed = 0;
            const total = targetRecords.length;

            for (const r of targetRecords) {
                const safeAwb = (r.awb || 'NO_AWB').replace(/[^a-zA-Z0-9_-]/g, '_');
                const safeSender = (r.sender_name || 'Sender').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
                const subFolder = folder.folder(`${safeAwb}_${safeSender}`);

                const files = [
                    ['sender_front', 'sender_id_proof_front'],
                    ['sender_back', 'sender_id_proof_back'],
                    ['receiver_front', 'receiver_id_proof_front'],
                    ['receiver_back', 'receiver_id_proof_back'],
                ];
                const saved = Object.fromEntries(files.map(([key]) => [key, 'No']));
                for (const [key, filename] of files) {
                    if (!r[key]) continue;
                    try {
                        const blob = await fetchImageBlob(r[key]);
                        if (blob) {
                            subFolder.file(`${filename}_${safeAwb}.${imageExtension(r[key])}`, blob);
                            saved[key] = 'Yes';
                        }
                    } catch (e) {
                        console.warn(`Could not add ${key}:`, e);
                    }
                }

                manifestRows.push([
                    r.awb || '',
                    r.date || '',
                    r.type || '',
                    r.sender_name || '',
                    r.sender_phone || '',
                    r.sender_id_proof || '',
                    saved.sender_front,
                    saved.sender_back,
                    r.receiver_name || '',
                    r.receiver_phone || '',
                    r.receiver_id_proof || '',
                    saved.receiver_front,
                    saved.receiver_back
                ]);

                processed++;
                setZipProgress(Math.round((processed / total) * 90));
            }

            const csvContent = [
                manifestHeaders.join(','),
                ...manifestRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            folder.file('KYC_Manifest_Index.csv', csvContent);

            setZipProgress(95);
            const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
                setZipProgress(95 + Math.round(metadata.percent * 0.05));
            });

            const url = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FlyMyCart_KYC_Batch_${startDate || 'all'}_to_${endDate || 'latest'}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showToast(`Successfully packaged and downloaded ${targetRecords.length} ID proof records as ZIP!`);
        } catch (err) {
            console.error('Failed to generate ZIP archive', err);
            showToast('Failed to create ZIP package', false);
        } finally {
            setIsZipping(false);
            setZipProgress(0);
        }
    };

    // Calculate count for custom deletion preview
    const deleteMatchingCount = useMemo(() => {
        if (deleteMode === 'selected') {
            return selectedIds.size;
        }
        if (deleteMode === 'date_range') {
            const fStart = deleteStartDate || startDate;
            const fEnd = deleteEndDate || endDate;
            if (!fStart && !fEnd) return stats.total_documents;
            return (stats.records || []).filter(r => {
                const rDate = String(r.date || '').slice(0, 10);
                if (fStart && rDate < fStart) return false;
                if (fEnd && rDate > fEnd) return false;
                return true;
            }).length;
        }
        if (deleteMode === 'age_threshold') {
            if (customMonths === '3') return stats.older_than_3_months;
            if (customMonths === '6') return stats.older_than_6_months;
            return stats.total_documents;
        }
        return stats.total_documents;
    }, [deleteMode, deleteStartDate, deleteEndDate, startDate, endDate, selectedIds, stats, customMonths]);

    // Trigger Delete Dialog
    const handleOpenDeleteDialog = (mode = deleteMode) => {
        let title = '';
        let desc = '';
        let payload = {};

        if (mode === 'selected') {
            if (selectedIds.size === 0) {
                alert('Please select at least one consignment using the checkboxes.');
                return;
            }
            title = `Delete ID Proofs for ${selectedIds.size} Selected Consignments`;
            desc = `This will permanently delete the uploaded Sender & Receiver ID photos for the ${selectedIds.size} selected shipments.`;
            payload = { record_ids: Array.from(selectedIds) };
        } else if (mode === 'date_range') {
            const fStart = deleteStartDate || startDate;
            const fEnd = deleteEndDate || endDate;
            if (!fStart && !fEnd) {
                title = `Delete All Consignment ID Proofs`;
                desc = `This will delete ID proof photos for ALL stored consignments in the database.`;
                payload = { from_date: '1970-01-01', to_date: '2099-12-31' };
            } else {
                title = `Delete ID Proofs from ${fStart || 'Earliest'} to ${fEnd || 'Latest'}`;
                desc = `This will delete ID photos for consignments booked between ${fStart || 'Earliest'} and ${fEnd || 'Latest'} (${deleteMatchingCount} matching records).`;
                payload = { from_date: fStart || undefined, to_date: fEnd || undefined };
            }
        } else {
            title = `Delete ID Proofs Older Than ${customMonths} Month(s)`;
            desc = `This will delete ID photos for all consignments older than ${customMonths} month(s).`;
            payload = { older_than_months: parseInt(customMonths, 10) };
        }

        setConfirmModal({
            title,
            desc,
            count: deleteMatchingCount,
            payload
        });
    };

    // Execute Delete
    const handleExecuteDelete = async () => {
        if (!confirmModal?.payload) return;
        setActionLoading(true);
        try {
            const res = await apiClient.cleanupKycStorage(confirmModal.payload);
            showToast(`Successfully deleted ${res.cleaned_count} ID proof image files!`);
            setConfirmModal(null);
            setSelectedIds(new Set());
            await fetchStats();
        } catch (err) {
            console.error('Failed to delete KYC storage', err);
            showToast('Failed to delete images.', false);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteSingle = async (recordId, name) => {
        if (!window.confirm(`Are you sure you want to delete stored ID images for ${name}?`)) return;
        try {
            await apiClient.deleteKycDocument(recordId);
            showToast('ID images deleted successfully');
            await fetchStats();
        } catch (err) {
            console.error('Failed to delete ID document', err);
            showToast('Failed to delete image', false);
        }
    };

    const isAllSelected = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;

    return (
        <div className="kyc-storage-container">
            {loadError && <p role="alert">Failed to load KYC records. Use Refresh to retry.</p>}
            {toastMessage && (
                <div className={`kyc-toast ${toastMessage.isSuccess ? 'success' : 'error'}`}>
                    {toastMessage.isSuccess ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Header Banner */}
            <div className="kyc-banner-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '22px 26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', flexShrink: 0 }}>
                        <ShieldCheck size={26} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                                ID Proof & Document Storage
                            </h3>
                            <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(147,197,253,0.3)' }}>
                                Document Management
                            </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.5 }}>
                            View, download in bulk ZIP, and delete Sender & Receiver ID proofs by customized date ranges or selected shipments.
                        </p>
                    </div>
                </div>

                <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#f8fafc', borderColor: 'rgba(255,255,255,0.2)', fontSize: '12px', height: '36px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={fetchStats}
                    disabled={loading}
                    title="Refresh Records"
                >
                    <RefreshCw size={13} className={loading ? 'spin' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Storage Metric Cards */}
            <div className="kyc-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="kyc-stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HardDrive size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block' }}>Total Stored Consignments</span>
                        <strong style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{stats.total_documents}</strong>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', display: 'block' }}>All Active Records</span>
                    </div>
                </div>

                <div className="kyc-stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block' }}>Records on This Page</span>
                        <strong style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>{filteredRecords.length}</strong>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', display: 'block' }}>Ready for ZIP Download</span>
                    </div>
                </div>

                <div className="kyc-stat-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, display: 'block' }}>Older Than 90 Days</span>
                        <strong style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>{stats.older_than_3_months}</strong>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', display: 'block' }}>Eligible to free storage</span>
                    </div>
                </div>
            </div>

            {/* Date Range & Calendar Filter Bar */}
            <div className="dash-box settings-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SlidersHorizontal size={16} color="#1e64f0" />
                        <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>Filter by Date & Calendar Range</strong>
                    </div>

                    {/* Presets */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {[
                            ['all', 'All Time'],
                            ['today', 'Today'],
                            ['yesterday', 'Yesterday'],
                            ['this_week', 'This Week'],
                            ['this_month', 'This Month'],
                            ['last_30', 'Last 30 Days']
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                className={`btn btn-sm ${datePreset === key ? 'btn-primary-blue' : 'btn-outline'}`}
                                onClick={() => handlePresetChange(key)}
                                style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px' }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Calendar Input Pickers & Search Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>From:</span>
                        <input
                            type="date"
                            className="filter-input"
                            style={{ border: 'none', background: 'transparent', padding: '2px', fontSize: '12px', flex: 1 }}
                            value={startDate}
                            onChange={e => {
                                setStartDate(e.target.value);
                                setDeleteStartDate(e.target.value);
                                setDatePreset('custom');
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>To:</span>
                        <input
                            type="date"
                            className="filter-input"
                            style={{ border: 'none', background: 'transparent', padding: '2px', fontSize: '12px', flex: 1 }}
                            value={endDate}
                            onChange={e => {
                                setEndDate(e.target.value);
                                setDeleteEndDate(e.target.value);
                                setDatePreset('custom');
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <Search size={14} color="#64748b" />
                        <input
                            type="text"
                            placeholder="Search AWB, party name, phone..."
                            style={{ border: 'none', background: 'transparent', padding: '2px', fontSize: '12px', flex: 1, outline: 'none' }}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Records List Table Card */}
            <div className="dash-box settings-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
                {/* Table Header Controls & Batch Download / Delete Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '14.5px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                                Stored Consignment ID Proofs ({stats.filtered_total || 0})
                            </h4>
                            {selectedIds.size > 0 && (
                                <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                                    {selectedIds.size} Selected
                                </span>
                            )}
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {selectedIds.size > 0 ? `Selected ${selectedIds.size} shipments for download or deletion` : `Downloads include selected records or the current page`}
                        </span>
                    </div>

                    {/* Batch Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {canManage && selectedIds.size > 0 && (
                            <button
                                type="button"
                                className="btn btn-outline text-rose"
                                onClick={() => handleOpenDeleteDialog('selected')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                                title="Delete ID images for the checked shipments only"
                            >
                                <Trash2 size={14} />
                                <span>Delete Selected ({selectedIds.size})</span>
                            </button>
                        )}

                        <button
                            type="button"
                            className="btn btn-primary-blue"
                            onClick={handleDownloadZipBatch}
                            disabled={isZipping || filteredRecords.length === 0}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, padding: '7px 14px' }}
                            title="Download selected ID proofs, or all ID proofs on this page"
                        >
                            {isZipping ? (
                                <>
                                    <Loader2 size={14} className="spin" />
                                    <span>Creating ZIP ({zipProgress}%)...</span>
                                </>
                            ) : (
                                <>
                                    <FileArchive size={15} />
                                    <span>Download Batch ZIP {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filteredRecords.length})`}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12 }}>
                    <button type="button" className="btn btn-outline" disabled={loading || page === 0} onClick={() => { setSelectedIds(new Set()); setPage(value => value - 1); }}>Previous</button>
                    <span>Page {page + 1} - {stats.filtered_total || 0} matching records</span>
                    <button type="button" className="btn btn-outline" disabled={loading || (page + 1) * 50 >= (stats.filtered_total || 0)} onClick={() => { setSelectedIds(new Set()); setPage(value => value + 1); }}>Next</button>
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        <Loader2 size={26} className="spin text-primary-blue" style={{ margin: '0 auto 10px' }} />
                        <span style={{ fontSize: '13px' }}>Loading stored ID proof records...</span>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        <ImageIcon size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontSize: '13px' }}>
                            {searchQuery || startDate || endDate ? 'No ID proof records found for the selected calendar range.' : 'No ID proof documents stored in database.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <table className="kyc-table" style={{ width: '100%', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ width: '36px', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={handleToggleSelectAll}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isAllSelected ? '#2563eb' : '#94a3b8' }}
                                            title={isAllSelected ? 'Deselect all' : 'Select all'}
                                        >
                                            {isAllSelected ? <CheckSquare size={16} color="#2563eb" /> : <Square size={16} />}
                                        </button>
                                    </th>
                                    <th>Date</th>
                                    <th>AWB / Record</th>
                                    <th>Sender & ID Details</th>
                                    <th>Receiver & ID Details</th>
                                    <th>Sender ID Proof</th>
                                    <th>Receiver ID Proof</th>
                                    {canManage && <th style={{ textAlign: 'center' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map(r => {
                                    const isChecked = selectedIds.has(r.id);
                                    return (
                                        <tr key={r.id} style={{ background: isChecked ? 'rgba(37,99,235,0.03)' : 'transparent' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSelectOne(r.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isChecked ? '#2563eb' : '#cbd5e1' }}
                                                >
                                                    {isChecked ? <CheckSquare size={16} color="#2563eb" /> : <Square size={16} />}
                                                </button>
                                            </td>
                                            <td><span className="kyc-date-badge">{r.date || 'N/A'}</span></td>
                                            <td>
                                                <strong style={{ color: '#0f172a' }}>{r.awb}</strong>
                                                <div style={{ marginTop: '2px' }}>
                                                    <span className="kyc-tag">{r.type}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.sender_name || '—'}</div>
                                                {r.sender_phone && <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {r.sender_phone}</div>}
                                                {r.sender_id_proof && <code className="kyc-doc-num" style={{ marginTop: '2px', display: 'inline-block' }}>{r.sender_id_proof}</code>}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.receiver_name || '—'}</div>
                                                {r.receiver_phone && r.receiver_phone !== '—' && <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {r.receiver_phone}</div>}
                                                {r.receiver_id_proof && r.receiver_id_proof !== '—' && <code className="kyc-doc-num" style={{ marginTop: '2px', display: 'inline-block' }}>{r.receiver_id_proof}</code>}
                                            </td>
                                            <td>
                                                {renderProofFiles(r, 'sender')}
                                            </td>
                                            <td>
                                                {renderProofFiles(r, 'receiver')}
                                            </td>
                                            {canManage && (
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline text-rose"
                                                        onClick={() => handleDeleteSingle(r.id, r.sender_name || r.awb)}
                                                        title="Delete images for this shipment"
                                                        style={{ padding: '4px 7px', height: '28px' }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Customized Image Deletion & Free Storage Box */}
            <div className="dash-box settings-card kyc-actions-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
                <div className="kyc-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                            🧹 Delete Stored Images & Free Up Storage
                        </h4>
                        <p className="kyc-card-desc" style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                            Delete heavy ID image files by custom date range, age, or selected rows to keep database fast.
                        </p>
                    </div>
                    <span className="kyc-safe-badge" style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '3px 9px', borderRadius: '8px' }}>
                        ✓ Preserves AWB, customer profile & booking records
                    </span>
                </div>

                {/* Deletion Mode Tabs */}
                <div style={{ display: 'flex', gap: '8px', margin: '14px 0 12px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className={`btn btn-sm ${deleteMode === 'date_range' ? 'btn-primary-blue' : 'btn-outline'}`}
                        onClick={() => setDeleteMode('date_range')}
                        style={{ fontSize: '11.5px', padding: '4px 12px' }}
                    >
                        📅 Delete by Custom Date Range
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${deleteMode === 'selected' ? 'btn-primary-blue' : 'btn-outline'}`}
                        onClick={() => setDeleteMode('selected')}
                        style={{ fontSize: '11.5px', padding: '4px 12px' }}
                    >
                        ☑️ Delete Checked Rows ({selectedIds.size})
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${deleteMode === 'age_threshold' ? 'btn-primary-blue' : 'btn-outline'}`}
                        onClick={() => setDeleteMode('age_threshold')}
                        style={{ fontSize: '11.5px', padding: '4px 12px' }}
                    >
                        ⏳ Delete by Age (30/90/180 Days)
                    </button>
                </div>

                {/* Delete Controls based on mode */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    {deleteMode === 'date_range' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>From Date:</span>
                                <input
                                    type="date"
                                    className="filter-input"
                                    style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
                                    value={deleteStartDate || startDate}
                                    onChange={e => setDeleteStartDate(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>To Date:</span>
                                <input
                                    type="date"
                                    className="filter-input"
                                    style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
                                    value={deleteEndDate || endDate}
                                    onChange={e => setDeleteEndDate(e.target.value)}
                                />
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                ({deleteMatchingCount} matching records found)
                            </span>
                        </div>
                    )}

                    {deleteMode === 'selected' && (
                        <div>
                            <span style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>
                                {selectedIds.size > 0 
                                    ? `Ready to delete ID proof images for ${selectedIds.size} checked consignments.` 
                                    : 'No consignments checked yet. Use the checkboxes in the table above to pick shipments.'}
                            </span>
                        </div>
                    )}

                    {deleteMode === 'age_threshold' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Select Age Cutoff:</span>
                            <select
                                value={customMonths}
                                onChange={e => setCustomMonths(e.target.value)}
                                className="kyc-select"
                                disabled={!canManage}
                                style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            >
                                <option value="1">Older than 1 Month (30+ Days)</option>
                                <option value="2">Older than 2 Months (60+ Days)</option>
                                <option value="3">Older than 3 Months (90+ Days)</option>
                                <option value="6">Older than 6 Months (180+ Days)</option>
                                <option value="12">Older than 1 Year (365+ Days)</option>
                            </select>
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                ({deleteMatchingCount} matching records found)
                            </span>
                        </div>
                    )}

                    <button
                        type="button"
                        className="btn btn-outline text-rose"
                        disabled={!canManage || stats.total_documents === 0 || actionLoading || (deleteMode === 'selected' && selectedIds.size === 0)}
                        onClick={() => handleOpenDeleteDialog(deleteMode)}
                        style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                    >
                        <Trash2 size={14} />
                        <span>Delete Matching Images</span>
                    </button>
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="kyc-modal-backdrop" onClick={() => setPreviewImage(null)}>
                    <div className="kyc-modal-dialog" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
                        <div className="kyc-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', background: '#0f172a', color: '#f8fafc' }}>
                            <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{previewImage.title}</h5>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-primary-blue"
                                    onClick={() => handleDownloadImage(previewImage.src, previewImage.filename || 'id_proof_document.png')}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '4px 10px' }}
                                    title="Download high-resolution ID proof"
                                >
                                    <Download size={13} /> Download ID Proof
                                </button>
                                <button type="button" className="kyc-modal-close" onClick={() => setPreviewImage(null)} style={{ color: '#cbd5e1' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="kyc-modal-body" style={{ textAlign: 'center', background: '#020617', padding: '16px', borderRadius: '0 0 8px 8px' }}>
                            {isPdfDocument(previewImage.src) ? (
                                <iframe src={previewImage.src} title="KYC PDF Document Preview" style={{ width: '100%', height: '70vh', border: 0, borderRadius: '6px', background: '#fff' }} />
                            ) : (
                                <img src={previewImage.src} alt="KYC Document Preview" className="kyc-modal-img" style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {confirmModal && (
                <div className="kyc-modal-backdrop" onClick={() => !actionLoading && setConfirmModal(null)}>
                    <div className="kyc-modal-dialog kyc-confirm-dialog" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <div className="kyc-confirm-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <AlertTriangle size={26} />
                        </div>
                        <div className="kyc-confirm-content" style={{ textAlign: 'center' }}>
                            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                                {confirmModal.title}
                            </h4>
                            <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 14px', lineHeight: 1.5 }}>
                                {confirmModal.desc}
                            </p>
                            <div className="kyc-confirm-notice" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '11.5px', color: '#64748b', textAlign: 'left', marginBottom: '16px' }}>
                                <strong>🛡️ Safety Guarantee:</strong> All booking history, customer contact numbers, AWBs, billing, and text ID numbers will remain 100% intact. Only heavy image attachments will be removed to free storage.
                            </div>
                        </div>
                        <div className="kyc-confirm-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setConfirmModal(null)}
                                disabled={actionLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger-solid"
                                onClick={handleExecuteDelete}
                                disabled={actionLoading}
                                style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 16px', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                {actionLoading ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                                <span>{actionLoading ? 'Deleting Images...' : 'Confirm & Delete Images'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
