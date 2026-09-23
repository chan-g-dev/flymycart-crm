export const DEFAULT_CUSTOMER_TYPES = ['C2C', 'B2C', 'B2B'];

export function customerTypeOptions(settings, existing = []) {
    const values = [...DEFAULT_CUSTOMER_TYPES, ...(settings?.customerTypes || []), ...existing];
    const seen = new Set();
    return values.filter(value => {
        if (typeof value !== 'string' || !value.trim()) return false;
        const key = value.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(value => value.trim());
}
