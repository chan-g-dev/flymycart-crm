import React from 'react';

/**
 * Fly My Cart Official Brand Logo
 * Features the signature golden paper airplane origami flight symbol,
 * bold 'flymycart' typography, and 'DOMESTIC & GLOBAL COURIER DELIVERY' tagline.
 */
export const FlyMyCartLogo = ({ 
    height = 42, 
    width = 'auto', 
    theme = 'light', // 'light' | 'dark'
    className = '',
    style = {},
    onClick
}) => {
    // If dark theme (e.g. dark sidebar or dark navy hero), use dark mode variant with white/gold text
    const logoSrc = theme === 'dark' ? '/logo_dark_mode.png' : '/logo_transparent.png';

    return (
        <div
            className={`fmc-brand-logo-container ${className}`}
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
                ...style
            }}
            title="Fly My Cart — Domestic & Global Courier Delivery"
        >
            <img
                src={logoSrc}
                alt="Fly My Cart — Domestic & Global Courier Delivery"
                style={{
                    height: typeof height === 'number' ? `${height}px` : height,
                    width: typeof width === 'number' ? `${width}px` : width,
                    objectFit: 'contain',
                    display: 'block',
                    transition: 'transform 0.2s ease',
                }}
                onError={(e) => {
                    // Fallback to logo.png if specific variant is missing
                    if (e.target.src !== window.location.origin + '/logo.png') {
                        e.target.src = '/logo.png';
                    }
                }}
                draggable={false}
            />
        </div>
    );
};

export default FlyMyCartLogo;
