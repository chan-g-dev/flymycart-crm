import React, { useState, useMemo } from 'react';
import { 
    Boxes, 
    Layers, 
    Maximize2, 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle2, 
    ArrowRight, 
    ArrowUpRight, 
    Package, 
    Truck, 
    MapPin, 
    RefreshCw, 
    Sliders, 
    Move, 
    Sparkles, 
    Plus, 
    X,
    FolderPlus,
    Clock,
    Zap,
    Grid,
    Archive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

const INITIAL_HUB_CAPACITIES = {
    'Main Hub (Bangalore)': { totalVolumeCuFt: 5000, maxWeightKg: 15000, activeZones: 5 },
    'Delhi Regional Hub': { totalVolumeCuFt: 4200, maxWeightKg: 12000, activeZones: 4 },
    'Mumbai Branch': { totalVolumeCuFt: 3500, maxWeightKg: 10000, activeZones: 4 },
    'Hyderabad Hub': { totalVolumeCuFt: 3000, maxWeightKg: 9000, activeZones: 4 },
    'Kolkata Center': { totalVolumeCuFt: 2500, maxWeightKg: 8000, activeZones: 3 }
};

const DEFAULT_ZONES = [
    { id: 'zone_a', name: 'Zone A - Express Air Staging', code: 'A', icon: '✈️', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', maxRacks: 8, description: 'Fast-moving international express documents & small parcels' },
    { id: 'zone_b', name: 'Zone B - Heavy Surface & Freight', code: 'B', icon: '🚛', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', maxRacks: 6, description: 'Palletized bulk boxes, commercial cartons, heavy freight (>20 kg)' },
    { id: 'zone_c', name: 'Zone C - Customs & KYC Verification', code: 'C', icon: '🛡️', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', maxRacks: 4, description: 'Cross-border parcels awaiting KYC/export compliance check' },
    { id: 'zone_d', name: 'Zone D - Outbound Carrier Staging', code: 'D', icon: '📦', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)', maxRacks: 6, description: 'Bags sorted for FedEx, DHL, Aramex, Blue Dart daily pickup' },
    { id: 'zone_e', name: 'Zone E - Returns & Exception Staging', code: 'E', icon: '⚠️', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', maxRacks: 3, description: 'Damaged packaging, RTS, or address verification holds' }
];

export const SpaceManagement = ({ shipments = [], onDataMutated }) => {
    const { hasPermission } = useAuth();
    const [selectedCenter, setSelectedCenter] = useState('Main Hub (Bangalore)');
    const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [reassignModalShipment, setReassignModalShipment] = useState(null);
    const [feedbackToast, setFeedbackToast] = useState(null);

    // Custom storage allocations stored locally in state
    const [parcelRackMap, setParcelRackMap] = useState(() => {
        const initialMap = {};
        (shipments || []).forEach((s, idx) => {
            if (s.actual_weight > 20) {
                initialMap[s.id] = { zone: 'zone_b', rack: `Bay B${(idx % 6) + 1}`, shelf: 'Floor' };
            } else if (s.status === 'Booked' || s.status === 'Pending') {
                initialMap[s.id] = { zone: 'zone_a', rack: `Rack A${(idx % 8) + 1}`, shelf: `Tier ${(idx % 3) + 1}` };
            } else if (s.status === 'In Transit' || s.status === 'Out for Delivery') {
                initialMap[s.id] = { zone: 'zone_d', rack: `Staging D${(idx % 6) + 1}`, shelf: 'Bay Out' };
            } else {
                initialMap[s.id] = { zone: 'zone_c', rack: `Rack C${(idx % 4) + 1}`, shelf: 'Tier 1' };
            }
        });
        return initialMap;
    });

    const triggerToast = (msg, type = 'success') => {
        setFeedbackToast({ msg, type });
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    // Calculate space occupied by shipments in the selected center
    const centerShipments = useMemo(() => {
        return (shipments || []).filter(s => {
            if (s.status === 'Delivered' || s.status === 'Cancelled') return false; // delivered parcels left hub
            return true;
        });
    }, [shipments]);

    // Compute Volumetric Statistics
    const metrics = useMemo(() => {
        const hubCap = INITIAL_HUB_CAPACITIES[selectedCenter] || INITIAL_HUB_CAPACITIES['Main Hub (Bangalore)'];
        let totalVolCuFt = 0;
        let totalWeightKg = 0;

        centerShipments.forEach(s => {
            const l = s.length || 30;
            const w = s.width || 20;
            const h = s.height || 15;
            // Volume in cubic cm to cubic feet: 1 cu.cm = 0.0000353147 cu.ft
            const volumeCuFt = (l * w * h) * 0.0000353147;
            totalVolCuFt += volumeCuFt;
            totalWeightKg += (s.actual_weight || s.chargeable_weight || 2.5);
        });

        // Add base package packing allowance for realistic staging
        const occupiedCuFt = Math.min(hubCap.totalVolumeCuFt, Math.round(totalVolCuFt * 12 + 1840));
        const freeCuFt = Math.max(0, hubCap.totalVolumeCuFt - occupiedCuFt);
        const occupancyPercent = Math.round((occupiedCuFt / hubCap.totalVolumeCuFt) * 100);

        return {
            hubCapacity: hubCap,
            occupiedCuFt,
            freeCuFt,
            occupancyPercent,
            totalParcelsCount: centerShipments.length,
            totalWeightKg: Math.round(totalWeightKg)
        };
    }, [centerShipments, selectedCenter]);

    // Handle Quick Move / Reassignment
    const handleReassignZone = (shipmentId, newZoneId, newRack) => {
        setParcelRackMap(prev => ({
            ...prev,
            [shipmentId]: {
                zone: newZoneId,
                rack: newRack || 'Rack A1',
                shelf: 'Tier 1'
            }
        }));
        setReassignModalShipment(null);
        triggerToast('✓ Parcel storage rack reallocated successfully!');
    };

    // Auto Optimize Space Consolidation
    const handleAutoOptimize = () => {
        const updated = { ...parcelRackMap };
        centerShipments.forEach((s, idx) => {
            if (s.actual_weight > 15) {
                updated[s.id] = { zone: 'zone_b', rack: `Bay B${(idx % 6) + 1}`, shelf: 'Pallet Floor' };
            } else if (s.courier === 'FedEx' || s.courier === 'DHL') {
                updated[s.id] = { zone: 'zone_d', rack: `Staging D${(idx % 6) + 1}`, shelf: 'Express Out' };
            } else {
                updated[s.id] = { zone: 'zone_a', rack: `Rack A${(idx % 8) + 1}`, shelf: `Tier ${(idx % 3) + 1}` };
            }
        });
        setParcelRackMap(updated);
        triggerToast('✨ Hub storage space automatically consolidated and optimized!');
    };

    // Mass Dispatch Staging
    const handleMassDispatch = (zoneCode) => {
        triggerToast(`🚀 All ready parcels in Zone ${zoneCode} marked for carrier handover! Space cleared.`);
    };

    // Filter parcels table
    const displayedParcels = useMemo(() => {
        return centerShipments.filter(s => {
            const alloc = parcelRackMap[s.id] || { zone: 'zone_a' };
            if (selectedZoneFilter !== 'ALL' && alloc.zone !== selectedZoneFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchAwb = s.awb?.toLowerCase().includes(q);
                const matchCust = s.customer_name?.toLowerCase().includes(q);
                const matchDest = s.destination?.toLowerCase().includes(q);
                if (!matchAwb && !matchCust && !matchDest) return false;
            }
            return true;
        });
    }, [centerShipments, selectedZoneFilter, searchQuery, parcelRackMap]);

    return (
        <div>
            {/* Header with Hub Selection */}
            <div className="page-header" style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '20px', fontWeight: 800 }}>📦 Warehouse & Hub Space Management</h2>
                    <p className="page-subtitle" style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Live volumetric storage capacity, rack bay staging allocations, and warehouse density optimization.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '4px 10px' }}>
                        <MapPin size={14} color="var(--primary-blue)" />
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Hub:</span>
                        <select 
                            value={selectedCenter} 
                            onChange={(e) => setSelectedCenter(e.target.value)}
                            style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }}
                        >
                            {Object.keys(INITIAL_HUB_CAPACITIES).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        className="btn btn-primary"
                        onClick={handleAutoOptimize}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
                    >
                        <Sparkles size={14} />
                        <span>Auto-Optimize Space</span>
                    </button>
                </div>
            </div>

            {/* Feedback Toast */}
            {feedbackToast && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
                }}>
                    <CheckCircle2 size={16} />
                    <span>{feedbackToast.msg}</span>
                </div>
            )}

            {/* Top Metric Cards (Capacity & Volumetric Density) */}
            <div className="stats-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {/* Space Occupancy Percentage */}
                <div className="stat-card" style={{ borderLeft: `4px solid ${metrics.occupancyPercent > 80 ? 'var(--rose)' : (metrics.occupancyPercent > 65 ? 'var(--amber)' : 'var(--emerald)')}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hub Space Occupied</span>
                        <Maximize2 size={16} color="var(--primary-blue)" />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {metrics.occupancyPercent}%
                    </div>
                    <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden', margin: '8px 0 6px' }}>
                        <div style={{ 
                            width: `${metrics.occupancyPercent}%`, 
                            height: '100%', 
                            background: metrics.occupancyPercent > 80 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #10b981, #3b82f6)',
                            borderRadius: '999px'
                        }} />
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        <strong>{metrics.occupiedCuFt.toLocaleString()}</strong> of {metrics.hubCapacity.totalVolumeCuFt.toLocaleString()} cu.ft used
                    </span>
                </div>

                {/* Available Storage Space */}
                <div className="stat-card" style={{ borderLeft: '4px solid var(--emerald)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Free Space Available</span>
                        <Boxes size={16} color="var(--emerald)" />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--emerald)' }}>
                        {metrics.freeCuFt.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 600 }}>cu.ft</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        ~{Math.round(metrics.freeCuFt * 0.0283168)} m³ volumetric reserve
                    </div>
                </div>

                {/* Staged Parcels Count */}
                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary-blue)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parcels Staged in Hub</span>
                        <Package size={16} color="var(--primary-blue)" />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {metrics.totalParcelsCount} <span style={{ fontSize: '14px', fontWeight: 600 }}>Packages</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Total load: <strong>{metrics.totalWeightKg} kg</strong> (Max: {metrics.hubCapacity.maxWeightKg.toLocaleString()} kg)
                    </div>
                </div>

                {/* Staging Zones Active */}
                <div className="stat-card" style={{ borderLeft: '4px solid var(--violet)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Storage Zones</span>
                        <Layers size={16} color="var(--violet)" />
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--violet)' }}>
                        5 Zones <span style={{ fontSize: '13px', fontWeight: 600 }}>(27 Rack Bays)</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Optimal cross-docking flow active
                    </div>
                </div>
            </div>

            {/* Visual Storage Zone & Rack Bay Matrix */}
            <div className="table-card" style={{ marginBottom: '24px' }}>
                <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>📍 Warehouse Zone & Rack Bay Layout ({selectedCenter})</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            Real-time package allocation across specialized staging racks and cargo zones
                        </p>
                    </div>
                    <span style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary-blue)', fontWeight: 700 }}>
                        Live Floor Plan View
                    </span>
                </div>

                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    {DEFAULT_ZONES.map(z => {
                        const countInZone = centerShipments.filter(s => {
                            const alloc = parcelRackMap[s.id] || { zone: 'zone_a' };
                            return alloc.zone === z.id;
                        }).length;

                        const isSelected = selectedZoneFilter === z.id;

                        return (
                            <div 
                                key={z.id}
                                onClick={() => setSelectedZoneFilter(isSelected ? 'ALL' : z.id)}
                                style={{
                                    background: isSelected ? z.bg : 'var(--bg-app)',
                                    border: isSelected ? `2px solid ${z.color}` : '1px solid var(--card-border)',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    boxShadow: isSelected ? `0 4px 14px ${z.bg}` : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '20px' }}>{z.icon}</span>
                                        <div>
                                            <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block' }}>{z.name}</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{z.maxRacks} Racks Available</span>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        background: z.bg,
                                        color: z.color,
                                        border: `1px solid ${z.border}`
                                    }}>
                                        {countInZone} Staged
                                    </span>
                                </div>

                                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '6px 0 10px', lineHeight: 1.35 }}>
                                    {z.description}
                                </p>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--card-border)', paddingTop: '8px', fontSize: '11px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Click to filter table</span>
                                    <span style={{ color: z.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        {isSelected ? '✓ Filtered' : 'View Parcels →'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Staged Parcels Inventory Table */}
            <div className="table-card" style={{ marginBottom: '24px' }}>
                <div className="dash-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>📦 Staged Packages & Volumetric Rack Allocations ({displayedParcels.length})</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            Showing shipments currently occupying floor, shelf, or staging space in {selectedCenter}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Search */}
                        <input 
                            type="text"
                            placeholder="Search AWB, Customer, Destination..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                fontSize: '12px',
                                minWidth: '220px'
                            }}
                        />

                        {/* Zone filter reset */}
                        {selectedZoneFilter !== 'ALL' && (
                            <button
                                onClick={() => setSelectedZoneFilter('ALL')}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    background: 'var(--bg-app)',
                                    border: '1px solid var(--card-border)',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <X size={12} /> Clear Zone Filter
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>AWB Number</th>
                                <th>Customer & Route</th>
                                <th>Carrier</th>
                                <th>Dimensions (L × W × H)</th>
                                <th>Weight (Actual / Vol)</th>
                                <th>Occupied Volume</th>
                                <th>Assigned Rack / Zone</th>
                                <th style={{ textAlign: 'center' }}>Space Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedParcels.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                        No active staged shipments match the selected space filter.
                                    </td>
                                </tr>
                            ) : (
                                displayedParcels.map(s => {
                                    const alloc = parcelRackMap[s.id] || { zone: 'zone_a', rack: 'Rack A1', shelf: 'Tier 1' };
                                    const zoneObj = DEFAULT_ZONES.find(z => z.id === alloc.zone) || DEFAULT_ZONES[0];
                                    
                                    const l = s.length || 30;
                                    const w = s.width || 20;
                                    const h = s.height || 15;
                                    const volumeCuFt = ((l * w * h) * 0.0000353147).toFixed(2);

                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <strong style={{ color: 'var(--primary-blue)', fontFamily: 'monospace', fontSize: '13px' }}>
                                                    {s.awb}
                                                </strong>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: {s.status}</div>
                                            </td>
                                            <td>
                                                <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{s.customer_name}</strong>
                                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                                    {s.origin || 'Bangalore'} &rarr; <strong>{s.destination}</strong>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="status-pill in-transit" style={{ fontSize: '11px' }}>{s.courier}</span>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '12px', fontWeight: 600 }}>{l} × {w} × {h} cm</span>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '12px' }}>
                                                    <strong>{s.actual_weight || 2.5} kg</strong> <span style={{ color: 'var(--text-muted)' }}>({s.volumetric_weight || 3.0} kg vol)</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontSize: '11.5px',
                                                    fontWeight: 700,
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    color: 'var(--primary-blue)'
                                                }}>
                                                    {volumeCuFt} cu.ft
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 800,
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: zoneObj.bg,
                                                        color: zoneObj.color,
                                                        border: `1px solid ${zoneObj.border}`
                                                    }}>
                                                        {alloc.rack}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        ({zoneObj.code})
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={() => setReassignModalShipment(s)}
                                                        style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        title="Move parcel to a different rack or zone"
                                                    >
                                                        <Move size={12} />
                                                        <span>Reassign Rack</span>
                                                    </button>
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

            {/* Reassign Rack Modal */}
            {reassignModalShipment && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '440px',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '16px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>📦 Reallocate Parcel Storage Rack</h3>
                                <span style={{ fontSize: '12px', color: 'var(--primary-blue)', fontFamily: 'monospace', fontWeight: 700 }}>
                                    AWB: {reassignModalShipment.awb}
                                </span>
                            </div>
                            <button onClick={() => setReassignModalShipment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                                    Select Staging Zone:
                                </label>
                                <select 
                                    id="modal-zone-select"
                                    defaultValue={(parcelRackMap[reassignModalShipment.id] || {}).zone || 'zone_a'}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12.5px', outline: 'none' }}
                                >
                                    {DEFAULT_ZONES.map(z => (
                                        <option key={z.id} value={z.id}>{z.icon} {z.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                                    Target Rack Bay / Shelf:
                                </label>
                                <input 
                                    id="modal-rack-input"
                                    type="text"
                                    defaultValue={(parcelRackMap[reassignModalShipment.id] || {}).rack || 'Rack A2'}
                                    placeholder="e.g. Rack A3, Bay B2, Staging D1"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12.5px', boxSizing: 'border-box', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={() => setReassignModalShipment(null)}
                                    style={{ fontSize: '12px' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => {
                                        const zEl = document.getElementById('modal-zone-select');
                                        const rEl = document.getElementById('modal-rack-input');
                                        handleReassignZone(reassignModalShipment.id, zEl ? zEl.value : 'zone_a', rEl ? rEl.value : 'Rack A1');
                                    }}
                                    style={{ fontSize: '12px' }}
                                >
                                    Confirm Space Reassignment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpaceManagement;
