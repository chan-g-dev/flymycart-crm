// Persist only hashes and random request keys, never payment/account data.
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
}

export function createPaymentSender({ send, storage, crypto }) {
    const pending = new Map();
    const keys = new Map();
    return async (method, url, data) => {
        const encoded = new TextEncoder().encode(JSON.stringify([method, url, canonical(data)]));
        const digest = await crypto.subtle.digest('SHA-256', encoded);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        const storageKey = `fmc-payment-request:${hash}`;
        if (pending.has(hash)) return pending.get(hash);
        let key = keys.get(hash);
        try { key ||= storage?.getItem(storageKey); } catch { /* In-memory retries still work. */ }
        key ||= crypto.randomUUID();
        keys.set(hash, key);
        try { storage?.setItem(storageKey, key); } catch { /* Storage may be disabled. */ }
        const clear = () => {
            keys.delete(hash);
            try { storage?.removeItem(storageKey); } catch { /* Storage may be disabled. */ }
        };
        const operation = (async () => {
            try {
                const response = await Promise.resolve().then(() => send({ method, url, data, headers: { 'Idempotency-Key': key } }));
                clear();
                return response.data;
            } catch (error) {
                // A timeout or 5xx can follow a successful commit. Retry with the same key.
                if (error.response?.status >= 400 && error.response.status < 500) clear();
                throw error;
            } finally { pending.delete(hash); }
        })();
        pending.set(hash, operation);
        return operation;
    };
}
