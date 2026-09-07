import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Modern Circular Spinner with glowing gradient & customizable size/color
 */
export const LoadingSpinner = ({ 
    size = 'md', 
    color = 'primary', 
    text = null, 
    className = '',
    inline = false 
}) => {
    const sizeMap = {
        xs: 12,
        sm: 15,
        md: 20,
        lg: 28,
        xl: 40
    };

    const pixelSize = typeof size === 'number' ? size : (sizeMap[size] || 20);

    const spinner = (
        <Loader2 
            size={pixelSize} 
            className={`fmc-spin-icon ${color === 'white' ? 'fmc-spin-white' : ''}`}
            style={{ 
                animation: 'fmc-spin 0.75s linear infinite',
                display: 'inline-block',
                verticalAlign: 'middle'
            }} 
        />
    );

    if (inline) {
        return (
            <span className={`fmc-inline-spinner ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {spinner}
                {text && <span style={{ fontSize: '12px', fontWeight: 500 }}>{text}</span>}
            </span>
        );
    }

    return (
        <div className={`fmc-spinner-wrapper ${className}`} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            gap: '10px'
        }}>
            {spinner}
            {text && (
                <div style={{
                    fontSize: '12.5px',
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: '0.2px'
                }}>
                    {text}
                </div>
            )}
        </div>
    );
};

/**
 * Micro-spinner tailored for form buttons during async submission
 */
export const ButtonSpinner = ({ size = 14, color = 'white', text = null }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <Loader2 
            size={size} 
            style={{ 
                animation: 'fmc-spin 0.7s linear infinite',
                color: color === 'white' ? '#ffffff' : '#0284c7'
            }} 
        />
        {text && <span>{text}</span>}
    </span>
);

/**
 * Skeleton loader for data tables
 */
export const TableSkeleton = ({ rows = 5, cols = 7 }) => (
    <>
        {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={`skel-row-${rIdx}`} className="fmc-skeleton-tr">
                {Array.from({ length: cols }).map((_, cIdx) => (
                    <td key={`skel-td-${cIdx}`} style={{ padding: '14px 16px' }}>
                        <div 
                            className="fmc-skeleton-bar" 
                            style={{ 
                                height: '14px', 
                                width: cIdx === 0 ? '60%' : cIdx === 1 ? '85%' : cIdx === cols - 1 ? '40%' : '70%',
                                borderRadius: '4px'
                            }} 
                        />
                    </td>
                ))}
            </tr>
        ))}
    </>
);

/**
 * Card skeleton loader for KPI widgets
 */
export const CardSkeleton = ({ count = 4 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: '12px', width: '100%' }}>
        {Array.from({ length: count }).map((_, idx) => (
            <div 
                key={`skel-card-${idx}`} 
                style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}
            >
                <div className="fmc-skeleton-bar" style={{ height: '12px', width: '50%', borderRadius: '4px' }} />
                <div className="fmc-skeleton-bar" style={{ height: '24px', width: '70%', borderRadius: '6px' }} />
                <div className="fmc-skeleton-bar" style={{ height: '10px', width: '40%', borderRadius: '4px' }} />
            </div>
        ))}
    </div>
);

/**
 * Full page / panel blur loading overlay
 */
export const OverlayLoader = ({ message = 'Synchronizing real-time records...' }) => (
    <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        borderRadius: 'inherit'
    }}>
        <div style={{
            background: '#ffffff',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }}>
            <Loader2 size={18} className="fmc-spin-icon" style={{ color: '#0284c7', animation: 'fmc-spin 0.75s linear infinite' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{message}</span>
        </div>
    </div>
);

export default LoadingSpinner;
