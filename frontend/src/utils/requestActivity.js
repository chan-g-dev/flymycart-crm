export function createRequestActivity() {
    const pending = new Map();
    const listeners = new Set();
    let sequence = 0;
    let snapshot = { count: 0, message: '' };
    const notify = () => {
        const messages = [...pending.values()];
        // Reads use their screen's own loader; only actions need a global indicator.
        const message = ['Uploading file...', 'Downloading file...', 'Deleting...', 'Saving changes...'].find(value => messages.includes(value)) || '';
        snapshot = { count: pending.size, message };
        listeners.forEach(listener => listener());
    };
    return {
        getSnapshot: () => snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        begin(config) {
            const id = ++sequence;
            const upload = typeof FormData !== 'undefined' && config.data instanceof FormData;
            const method = (config.method || 'get').toLowerCase();
            pending.set(id, upload ? 'Uploading file...' : config.responseType === 'blob' ? 'Downloading file...' : method === 'delete' ? 'Deleting...' : ['get', 'head', 'options'].includes(method) ? '' : 'Saving changes...');
            notify();
            return () => { if (pending.delete(id)) notify(); };
        },
    };
}

export const requestActivity = createRequestActivity();

export function trackRequests(client, activity = requestActivity) {
    const finishes = new WeakMap();
    client.interceptors.request.use(config => {
        finishes.set(config, activity.begin(config));
        return config;
    });
    const finish = config => {
        if (!config) return;
        finishes.get(config)?.();
        finishes.delete(config);
    };
    client.interceptors.response.use(response => {
        finish(response.config);
        return response;
    }, error => {
        finish(error.config);
        return Promise.reject(error);
    });
}
