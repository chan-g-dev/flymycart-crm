// ================================================================
// FLY MY CART CRM - OPERATING ENTITIES CONSTANTS & DYNAMIC ENGINE
// ================================================================

export const DEFAULT_ENTITIES = [
    {
        id: 'Globe Courier',
        name: 'Globe Courier',
        shortName: 'Globe',
        code: 'GC',
        icon: 'Globe',
        description: 'International & Express Courier',
        tagline: 'Global parcels & cross-border freight',
        badgeClass: 'entity-badge-globe',
        color: '#2563eb',
        accentColor: '#1d4ed8',
        bg: '#eff6ff',
        border: '#bfdbfe'
    },
    {
        id: 'USU Enterprises',
        name: 'USU Enterprises',
        shortName: 'USU',
        code: 'USU',
        icon: 'Building2',
        description: 'Corporate & Commercial Cargo',
        tagline: 'B2B commercial freight & accounts',
        badgeClass: 'entity-badge-usu',
        color: '#059669',
        accentColor: '#047857',
        bg: '#ecfdf5',
        border: '#a7f3d0'
    },
    {
        id: 'VIA Fly Logistics',
        name: 'VIA Fly Logistics',
        shortName: 'VIA Fly',
        code: 'VIA',
        icon: 'Plane',
        description: 'Air Cargo & Domestic Network',
        tagline: 'Priority airline freight & linehaul',
        badgeClass: 'entity-badge-via',
        color: '#7c3aed',
        accentColor: '#6d28d9',
        bg: '#f5f3ff',
        border: '#ddd6fe'
    }
];

export const COLOR_PALETTE = [
    { color: '#2563eb', accentColor: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', badgeClass: 'entity-badge-globe' },
    { color: '#059669', accentColor: '#047857', bg: '#ecfdf5', border: '#a7f3d0', badgeClass: 'entity-badge-usu' },
    { color: '#7c3aed', accentColor: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', badgeClass: 'entity-badge-via' },
    { color: '#d97706', accentColor: '#b45309', bg: '#fffbeb', border: '#fde68a', badgeClass: 'entity-badge-amber' },
    { color: '#e11d48', accentColor: '#be123c', bg: '#fff1f2', border: '#fecdd3', badgeClass: 'entity-badge-rose' },
    { color: '#0891b2', accentColor: '#0e7490', bg: '#ecfeff', border: '#a5f3fc', badgeClass: 'entity-badge-cyan' },
    { color: '#4f46e5', accentColor: '#3730a3', bg: '#eef2ff', border: '#c7d2fe', badgeClass: 'entity-badge-indigo' },
    { color: '#ea580c', accentColor: '#c2410c', bg: '#fff7ed', border: '#ffedd5', badgeClass: 'entity-badge-orange' }
];

export const DEFAULT_ENTITY = 'Globe Courier';

export const getEntityOptions = (settings) => {
    const custom = settings?.operatingEntities;
    if (Array.isArray(custom) && custom.length > 0) {
        return custom.map((item, idx) => {
            const base = typeof item === 'string' ? { name: item, id: item } : item;
            const name = base.name || base.id || 'Entity';
            const palette = COLOR_PALETTE[idx % COLOR_PALETTE.length];
            return {
                id: base.id || name,
                name: name,
                shortName: base.shortName || name.split(' ')[0],
                code: base.code || (base.shortName || name).slice(0, 3).toUpperCase(),
                icon: base.icon || (idx === 0 ? 'Globe' : idx === 1 ? 'Building2' : 'Plane'),
                description: base.description || `${name} Operations`,
                tagline: base.tagline || 'Operating Division',
                badgeClass: base.badgeClass || palette.badgeClass,
                color: base.color || palette.color,
                accentColor: base.accentColor || palette.accentColor,
                bg: base.bg || palette.bg,
                border: base.border || palette.border,
            };
        });
    }
    return DEFAULT_ENTITIES;
};

export const ENTITY_OPTIONS = DEFAULT_ENTITIES;
export const ENTITY_NAMES = DEFAULT_ENTITIES.map(e => e.name);

export const getEntityMeta = (entityName, settings) => {
    const list = getEntityOptions(settings);
    if (!entityName) return list[0];
    const norm = String(entityName).trim().toLowerCase();
    const found = list.find(e => 
        e.name.toLowerCase() === norm || 
        e.id.toLowerCase() === norm || 
        e.shortName.toLowerCase() === norm ||
        e.code.toLowerCase() === norm
    );
    if (found) return found;

    // Hash name to color palette for dynamic unconfigured entities
    let hash = 0;
    for (let i = 0; i < norm.length; i++) {
        hash = (hash << 5) - hash + norm.charCodeAt(i);
        hash |= 0;
    }
    const pal = COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];

    return {
        id: entityName,
        name: entityName,
        shortName: entityName.split(' ')[0] || entityName,
        code: (entityName.split(' ')[0] || entityName).slice(0, 3).toUpperCase(),
        icon: 'Globe',
        description: 'Operating division',
        tagline: 'Shipment division',
        badgeClass: pal.badgeClass,
        color: pal.color,
        accentColor: pal.accentColor,
        bg: pal.bg,
        border: pal.border
    };
};
