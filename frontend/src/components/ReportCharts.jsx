import React from 'react';
import { CourierLogo } from './CourierLogos';
import { providerCostLabel } from '../utils/costLabels';

const COURIER_COLORS = {
    'FedEx': '#4D148C',
    'Aramex': '#E31837',
    'DHL Express': '#FFCC00',
    'Blue Dart': '#003399',
    'UPS': '#351C15',
    'DTDC': '#0083CA',
    'Delhivery': '#E21A22',
    'ICL': '#2563eb',
    'BRV': '#7c3aed',
    'Other': '#64748b'
};

const PALETTE = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#14b8a6'];

const formatCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/**
 * Donut / Pie Chart for Courier or Category Distribution
 */
export const CourierDonutChart = ({ data = {}, title = 'Courier Distribution' }) => {
    const entries = Object.entries(data).filter(([_, count]) => count > 0);
    const total = entries.reduce((sum, [_, count]) => sum + Number(count), 0);

    if (total === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No courier shipment data available.
            </div>
        );
    }

    let accumulatedAngle = 0;
    const slices = entries.map(([name, count], i) => {
        const value = Number(count);
        const percentage = ((value / total) * 100);
        const angle = (value / total) * 360;
        const startAngle = accumulatedAngle;
        const endAngle = accumulatedAngle + angle;
        accumulatedAngle += angle;

        // SVG Arc coordinates
        const radius = 42;
        const cx = 50;
        const cy = 50;
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;
        const pathData = entries.length === 1 
            ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        const color = COURIER_COLORS[name] || PALETTE[i % PALETTE.length];

        return { name, count: value, percentage: percentage.toFixed(1), pathData, color };
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {/* Donut Chart SVG */}
            <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(0deg)' }}>
                    {slices.map((s, idx) => (
                        <path 
                            key={idx} 
                            d={s.pathData} 
                            fill={s.color} 
                            stroke="var(--card-bg)" 
                            strokeWidth="2"
                            style={{ transition: 'all 0.3s ease' }}
                        />
                    ))}
                    {/* Inner hole for Donut */}
                    <circle cx="50" cy="50" r="26" fill="var(--card-bg)" />
                </svg>
                <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{total}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Total</span>
                </div>
            </div>

            {/* Legend Breakdown */}
            <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {slices.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <CourierLogo courier={s.name} height={14} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: 'var(--text-main)' }}>{s.count}</strong>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '1px 5px', borderRadius: '4px' }}>
                                {s.percentage}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Visual Progress Bar with label and percentage
 */
export const ProgressItem = ({ label, value, total, color = '#3b82f6', subtitle, icon }) => {
    const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
    return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    {icon}
                    <span>{label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: color }}>{formatCurrency(value)}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({pct}%)</span>
                </div>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
        </div>
    );
};

/**
 * Daily Trend Bar Chart for Weekly & Custom Reports
 */
export const DailyTrendChart = ({ dailyData = [], showFinancials = false }) => {
    if (!dailyData || dailyData.length === 0) {
        return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No trend data available.</div>;
    }

    const maxBookings = Math.max(...dailyData.map(d => Number(d.shipments_count || 0)), 1);
    const maxRevenue = Math.max(...dailyData.map(d => Number(d.revenue_with_gst || d.revenue || d.collections || 0)), 1);

    return (
        <div style={{ width: '100%', padding: '12px 0 6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', paddingBottom: '24px', position: 'relative', borderBottom: '1px solid var(--card-border)' }}>
                {dailyData.map((d, i) => {
                    const bookings = Number(d.shipments_count || 0);
                    const revenue = Number(d.revenue_with_gst || d.revenue || d.collections || 0);
                    const bookingHeight = Math.max(8, Math.round((bookings / maxBookings) * 100));
                    const revenueHeight = Math.max(8, Math.round((revenue / maxRevenue) * 100));
                    const dayLabel = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });

                    return (
                        <div key={d.date || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                            {/* Bar Group */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '80%', height: '100%' }}>
                                {/* Bookings Bar */}
                                <div 
                                    title={`${dayLabel}: ${bookings} Shipments`}
                                    style={{
                                        flex: 1,
                                        height: `${bookingHeight}%`,
                                        background: 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)',
                                        borderRadius: '4px 4px 0 0',
                                        transition: 'height 0.3s ease',
                                        cursor: 'pointer',
                                        minWidth: '6px'
                                    }} 
                                />
                                {showFinancials && (
                                    /* Revenue Bar */
                                    <div 
                                        title={`${dayLabel}: ${formatCurrency(revenue)} Revenue`}
                                        style={{
                                            flex: 1,
                                            height: `${revenueHeight}%`,
                                            background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                                            borderRadius: '4px 4px 0 0',
                                            transition: 'height 0.3s ease',
                                            cursor: 'pointer',
                                            minWidth: '6px'
                                        }} 
                                    />
                                )}
                            </div>
                            {/* Label */}
                            <span style={{ 
                                position: 'absolute', 
                                bottom: '-22px', 
                                fontSize: '10px', 
                                color: 'var(--text-muted)', 
                                whiteSpace: 'nowrap',
                                fontWeight: 600
                            }}>
                                {dayLabel}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Chart Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '30px', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6' }} />
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Shipments Dispatched</span>
                </div>
                {showFinancials && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }} />
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Revenue Realized</span>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Visual P&L Waterfall Horizontal Step Bar for Monthly Report
 */
export const MonthlyWaterfallChart = ({ 
    grossSales = 0, 
    providerCost = 0, 
    grossProfit = 0, 
    refunds = 0, 
    operatingExpenses = 0, 
    netProfit = 0 
}) => {
    const base = Math.max(grossSales, 1);

    const steps = [
        { label: '1. Customer Sales', value: grossSales, pct: 100, color: '#6366f1', type: 'inflow' },
        { label: '2. Provider Costs', value: providerCost, pct: Math.round((providerCost / base) * 100), color: '#ef4444', type: 'outflow' },
        { label: '3. Gross Profit', value: grossProfit, pct: Math.round((grossProfit / base) * 100), color: '#10b981', type: 'subtotal' },
        { label: '4. Refunds Deducted', value: refunds, pct: Math.round((refunds / base) * 100), color: '#f59e0b', type: 'outflow' },
        { label: '5. Operating Expenses', value: operatingExpenses, pct: Math.round((operatingExpenses / base) * 100), color: '#ec4899', type: 'outflow' },
        { label: '6. Net Profit', value: netProfit, pct: Math.round((netProfit / base) * 100), color: '#10b981', type: 'total' }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {steps.map((step, idx) => (
                <div key={idx} style={{ background: step.type === 'total' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0,0,0,0.02)', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${step.type === 'total' ? 'rgba(16, 185, 129, 0.3)' : 'var(--card-border)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '12px' }}>
                        <strong style={{ color: step.type === 'total' ? '#10b981' : 'var(--text-main)' }}>{step.label}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: step.color, fontSize: step.type === 'total' ? '14px' : '12.5px' }}>
                                {step.type === 'outflow' && step.value > 0 ? '- ' : ''}{formatCurrency(step.value)}
                            </strong>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>({step.pct}%)</span>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: '7px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(4, step.pct))}%`, height: '100%', background: step.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>
                </div>
            ))}
        </div>
    );
};
