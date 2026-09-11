import React from 'react';

// ================================================================
// EXACT REQUIRED COURIER & PROVIDER LOGOS (BRIEF SEC 6 & 9)
// ================================================================

export const FedExLogo = ({ height = 18 }) => (
    <svg height={height} viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <text x="0" y="24" fontFamily="'Arial Black', 'Impact', sans-serif" fontSize="28" fontWeight="900" fill="#4D148C" letterSpacing="-1.5">Fed</text>
        <text x="50" y="24" fontFamily="'Arial Black', 'Impact', sans-serif" fontSize="28" fontWeight="900" fill="#FF6600" letterSpacing="-1.5">Ex</text>
    </svg>
);

export const AramexLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 95 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="95" height="24" rx="4" fill="#E31837" />
        <text x="47.5" y="17" fontFamily="'Helvetica Neue', Arial, sans-serif" fontSize="15" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="0.5">aramex</text>
    </svg>
);

export const DelhiveryLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 105 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="105" height="24" rx="4" fill="#1C1917" />
        <circle cx="12" cy="12" r="5" fill="#EF4444" />
        <text x="60" y="16.5" fontFamily="'Arial Black', sans-serif" fontSize="12.5" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="0.8">DELHIVERY</text>
    </svg>
);

export const BlueDartLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 110 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="110" height="24" rx="4" fill="#002F87" />
        <path d="M 6 4 L 14 12 L 6 20 Z" fill="#FFCC00" />
        <text x="62" y="16.5" fontFamily="'Arial Black', sans-serif" fontSize="12" fontWeight="900" fontStyle="italic" fill="#FFFFFF" textAnchor="middle" letterSpacing="0.5">BLUE DART</text>
    </svg>
);

export const DHLLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 75 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="75" height="24" rx="4" fill="#FFCC00" />
        <line x1="6" y1="7" x2="20" y2="7" stroke="#D40511" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="12" x2="22" y2="12" stroke="#D40511" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="17" x2="18" y2="17" stroke="#D40511" strokeWidth="2" strokeLinecap="round" />
        <text x="48" y="18" fontFamily="'Arial Black', sans-serif" fontSize="16" fontWeight="900" fontStyle="italic" fill="#D40511" textAnchor="middle" letterSpacing="-0.5">DHL</text>
    </svg>
);

export const UPSLogo = ({ height = 18 }) => (
    <svg height={height} viewBox="0 0 70 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="70" height="24" rx="4" fill="#351C15" />
        <path d="M 8 4 L 18 4 L 18 14 C 18 18 13 20 13 20 C 13 20 8 18 8 14 Z" fill="#FFB500" />
        <text x="44" y="17" fontFamily="'Arial Black', sans-serif" fontSize="14" fontWeight="900" fill="#FFB500" textAnchor="middle" letterSpacing="0.5">UPS</text>
    </svg>
);

export const ICLLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 75 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="75" height="24" rx="4" fill="#047857" />
        <text x="37.5" y="16.5" fontFamily="'Arial Black', sans-serif" fontSize="13" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="1">ICL</text>
    </svg>
);

export const BRVLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 75 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="75" height="24" rx="4" fill="#0284C7" />
        <text x="37.5" y="16.5" fontFamily="'Arial Black', sans-serif" fontSize="13" fontWeight="900" fill="#FFFFFF" textAnchor="middle" letterSpacing="1">BRV</text>
    </svg>
);

export const SreeMaruthiLogo = ({ height = 16 }) => (
    <svg height={height} viewBox="0 0 115 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <rect width="115" height="24" rx="4" fill="#7C2D12" />
        <text x="57.5" y="16.5" fontFamily="'Arial Black', sans-serif" fontSize="11" fontWeight="900" fill="#FEF08A" textAnchor="middle" letterSpacing="0.5">SREE MARUTHI</text>
    </svg>
);

// Official WhatsApp Vector Icon
export const WhatsAppIcon = ({ size = 15, color = '#25D366' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle', display: 'inline-block' }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.888 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill={color} />
    </svg>
);

// Map courier string strictly to the required logos
export const CourierLogo = ({ courier, height = 17, showLabel = false }) => {
    const c = (courier || '').toLowerCase();
    let logoComponent = null;

    if (c.includes('fedex')) {
        logoComponent = <FedExLogo height={height} />;
    } else if (c.includes('aramex')) {
        logoComponent = <AramexLogo height={height} />;
    } else if (c.includes('delhivery')) {
        logoComponent = <DelhiveryLogo height={height} />;
    } else if (c.includes('blue dart')) {
        logoComponent = <BlueDartLogo height={height} />;
    } else if (c.includes('dhl')) {
        logoComponent = <DHLLogo height={height} />;
    } else if (c.includes('ups')) {
        logoComponent = <UPSLogo height={height} />;
    } else if (c.includes('maruthi')) {
        logoComponent = <SreeMaruthiLogo height={height} />;
    } else if (c.includes('icl')) {
        logoComponent = <ICLLogo height={height} />;
    } else if (c.includes('brv')) {
        logoComponent = <BRVLogo height={height} />;

    } else {
        logoComponent = (
            <span style={{ 
                background: '#475569', 
                color: 'white', 
                fontWeight: 800, 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                height: `${height}px`
            }}>
                {courier || 'Express'}
            </span>
        );
    }

    return (
        <span 
            className="courier-logo-badge" 
            style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px',
                verticalAlign: 'middle'
            }}
        >
            {logoComponent}
            {showLabel && <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>{courier}</span>}
        </span>
    );
};

export default CourierLogo;
