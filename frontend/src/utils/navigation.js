// ================================================================
// FLY MY CART - CLEAN HTML5 CLIENT-SIDE ROUTER & NAVIGATION HELPER
// Zero Hash Fragments - Pure Enterprise Path Routing
// ================================================================

export const getCurrentPath = () => {
    if (typeof window === 'undefined') return '/';
    
    // Automatically clean legacy hash if present (e.g. /#/admin -> /admin, /#/ -> /)
    if (window.location.hash) {
        const rawHash = window.location.hash.replace(/^#\/?/, '/');
        const clean = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
        try {
            window.history.replaceState({}, '', clean === '//' || clean === '' ? '/' : clean);
        } catch (e) {}
        return clean === '//' || clean === '' ? '/' : clean;
    }

    const path = window.location.pathname || '/';
    return path === '' ? '/' : path;
};

export const navigate = (path, replace = false) => {
    if (typeof window === 'undefined') return;
    
    // Ensure leading slash
    let target = path.startsWith('/') ? path : `/${path}`;
    // Strip trailing slash unless root
    if (target.length > 1 && target.endsWith('/')) {
        target = target.slice(0, -1);
    }

    const current = window.location.pathname;
    if (current !== target || window.location.hash) {
        if (replace) {
            window.history.replaceState({}, '', target);
        } else {
            window.history.pushState({}, '', target);
        }
        window.dispatchEvent(new Event('popstate'));
        window.dispatchEvent(new CustomEvent('fmc-navigation', { detail: { path: target } }));
    }
};
