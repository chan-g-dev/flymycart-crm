// Business calendar dates use IST on every browser, matching the API.
export function businessDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

// Legacy API timestamps without an offset are stored in UTC.
export function formatRecordTime(value) {
    if (!value) return '—';
    const text = String(value);
    const instant = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`);
    if (Number.isNaN(instant.getTime())) return '—';
    return instant.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
}

export function formatBusinessDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
    return value ? new Date(value).toLocaleDateString('en-IN', { ...options, timeZone: 'Asia/Kolkata' }) : '-';
}

export function shiftCalendarDate(value, days) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
