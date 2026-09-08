import axios from 'axios';

const configuredUrl = import.meta.env.VITE_API_URL;
let API_BASE_URL = '/api';
if (configuredUrl) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const rawUrl = configuredUrl.replace(
        /^https?:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/,
        (host) => host.replace(/localhost|127\.0\.0\.1/, currentHost)
    );
    API_BASE_URL = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;
}

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Enables HttpOnly session cookies across requests
    timeout: 15000, // 15s timeout prevents infinite spinners if server is unreachable
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor to attach fallback token or headers
api.interceptors.request.use((config) => {
    try {
        const token = localStorage.getItem('fmc_access_token') || localStorage.getItem('fmc_token') || localStorage.getItem('fmc_session_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (e) {
        // Fallback for SSR or localStorage restrictions
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            try {
                localStorage.removeItem('fmc_access_token');
                localStorage.removeItem('fmc_token');
                localStorage.removeItem('fmc_session_token');
            } catch (e) {}
        }
        return Promise.reject(error);
    }
);

export const apiClient = {
    // Staff Auth & Sessions
    login: (data) => api.post('/auth/login', data).then(res => res.data),
    signup: (data) => api.post('/auth/signup', data).then(res => res.data),
    getAuthMe: () => api.get('/auth/me').then(res => res.data),
    logout: () => api.post('/auth/logout').then(res => res.data),
    logoutAll: () => api.post('/auth/logout-all').then(res => res.data),
    getSessions: () => api.get('/auth/sessions').then(res => res.data),
    revokeSession: (id) => api.delete(`/auth/sessions/${id}`).then(res => res.data),
    changePassword: (data) => api.post('/auth/change-password', data).then(res => res.data),

    // Users, Roles & Permissions
    getUsers: (params) => api.get('/users/', { params }).then(res => res.data),
    inviteUser: (data) => api.post('/users/invitations', data).then(res => res.data),
    approveStaff: (id, data = {}) => api.post(`/users/${id}/approve`, data).then(res => res.data),
    rejectStaff: (id, data = {}) => api.post(`/users/${id}/reject`, data).then(res => res.data),
    suspendUser: (id) => api.post(`/users/${id}/suspend`).then(res => res.data),
    reactivateUser: (id) => api.post(`/users/${id}/reactivate`).then(res => res.data),
    updateUserRoles: (id, role_ids) => api.put(`/users/${id}/roles`, { role_ids }).then(res => res.data),
    updateUserCenters: (id, center_ids, scope = 'operate') => api.put(`/users/${id}/centers`, { center_ids, scope }).then(res => res.data),
    updateUserRole: (id, data = {}) => {
        if (Array.isArray(data.role_ids)) {
            return api.put(`/users/${id}/roles`, { role_ids: data.role_ids }).then(res => res.data);
        }
        if (data.role) {
            return api.put(`/users/${id}/roles`, { role_ids: [data.role] }).then(res => res.data);
        }
        if (Array.isArray(data.center_ids)) {
            return api.put(`/users/${id}/centers`, { center_ids: data.center_ids, scope: data.scope || 'operate' }).then(res => res.data);
        }
        if (typeof data.is_active === 'boolean' || data.status) {
            return (data.is_active ? api.post(`/users/${id}/reactivate`) : api.post(`/users/${id}/suspend`)).then(res => res.data);
        }
        return api.put(`/users/${id}/roles`, data).then(res => res.data);
    },
    deleteUser: (id) => api.delete(`/users/${id}`).then(res => res.data),
    getRoles: () => api.get('/users/roles').then(res => res.data),
    createRole: (data) => api.post('/users/roles', data).then(res => res.data),
    updateRolePermissions: (role_id, permissions) => api.put(`/users/roles/${role_id}/permissions`, { permissions }).then(res => res.data),
    getPermissions: () => api.get('/users/permissions').then(res => res.data),
    getAuditLogs: (params) => api.get('/users/audit-logs', { params }).then(res => res.data),

    // Super Admin Staff Approvals
    getAdminPending: () => api.get('/admin/pending').then(res => res.data),
    getPendingStaffCount: () => api.get('/users/').then(res => ({ pending_count: (res.data || []).filter(u => (u.status || '').toLowerCase().includes('pending')).length })).catch(() => ({ pending_count: 0 })),
    checkApprovalStatus: (user) => api.get('/users/').then(res => (res.data || []).find(u => u.email === user?.email || u.id === user?.id)).catch(() => null),
    approveUser: (id) => api.post(`/users/${id}/reactivate`).then(res => res.data),
    rejectUser: (id) => api.post(`/users/${id}/suspend`).then(res => res.data),
    adminReject: (id, data) => api.post(`/admin/reject/${id}`, data).then(res => res.data),
    adminSuspend: (id, data) => api.post(`/admin/suspend/${id}`, data).then(res => res.data),
    adminReactivate: (id, data) => api.post(`/admin/reactivate/${id}`, data).then(res => res.data),
    adminChangeRole: (id, data) => api.post(`/admin/role/${id}`, data).then(res => res.data),
    getAdminAuditLog: (id) => api.get(`/admin/audit-log/${id}`).then(res => res.data),
    getAllAuditLogs: (params) => api.get('/admin/audit-logs', { params }).then(res => res.data),

    // Global Search
    globalSearch: (q) => api.get('/search/', { params: { q } }).then(res => res.data),

    // Dashboard
    getDashboardSummary: () => api.get('/dashboard/summary').then(res => res.data),

    // Customers
    getCustomers: (params) => api.get('/customers/', { params }).then(res => res.data),
    lookupCustomerByMobile: (mobile) => api.get('/customers/lookup', { params: { mobile } }).then(res => res.data),
    getCustomer360: (id) => api.get(`/customers/${id}/360`).then(res => res.data),
    createCustomer: (data) => api.post('/customers/', data).then(res => res.data),
    updateCustomer: (id, data) => api.put(`/customers/${id}`, data).then(res => res.data),
    deleteCustomer: (id) => api.delete(`/customers/${id}`).then(res => res.data),
    uploadCustomerDocument: (id, formData) => api.post(`/customers/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
    getCustomerDocuments: (id) => api.get(`/customers/${id}/documents`).then(res => res.data),

    // Shipments
    getShipments: (params) => api.get('/shipments/', { params }).then(res => res.data),
    createShipment: (data) => api.post('/shipments/', data).then(res => res.data),
    updateShipmentStatus: (id, data) => api.patch(`/shipments/${id}/status`, data).then(res => res.data),
    deleteShipment: (id) => api.delete(`/shipments/${id}`).then(res => res.data),

    // Invoices
    getInvoices: (params) => api.get('/invoices/', { params }).then(res => res.data),
    getInvoice: (id) => api.get(`/invoices/${id}`).then(res => res.data),
    recordInvoicePayment: (id, data) => api.post(`/invoices/${id}/payments`, data).then(res => res.data),

    // Accounts & Wallets
    getAccountsSummary: () => api.get('/accounts/summary').then(res => res.data),
    getWalletTransactions: (walletName) => api.get(`/accounts/wallets/${walletName}/transactions`).then(res => res.data),
    rechargeWallet: (data) => api.post('/accounts/wallets/recharge', data).then(res => res.data),

    // B2B Corporate Credit
    getB2BSummary: () => api.get('/b2b/summary').then(res => res.data),
    getB2BCompanies: () => api.get('/b2b/companies').then(res => res.data),
    createB2BCompany: (data) => api.post('/b2b/companies', data).then(res => res.data),

    // Reconciliation
    getReconciliationBatches: () => api.get('/reconciliation/batches').then(res => res.data),
    getReconciliationBatch: (id) => api.get(`/reconciliation/batches/${id}`).then(res => res.data),
    processReconciliation: (data) => api.post('/reconciliation/process', data).then(res => res.data),
    applyReconciliation: (data) => api.post('/reconciliation/apply', data).then(res => res.data),
    uploadReconciliationFile: (formData) => api.post('/reconciliation/upload-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),

    // Refunds
    getRefunds: () => api.get('/refunds/').then(res => res.data),
    createRefund: (data) => api.post('/refunds/', data).then(res => res.data),
    updateRefundStatus: (id, status, extra = {}) => api.patch(`/refunds/${id}/status`, { status, ...extra }).then(res => res.data),

    // Follow-ups & Comms
    getFollowups: () => api.get('/followups/').then(res => res.data),
    createFollowup: (data) => api.post('/followups/', data).then(res => res.data),
    completeFollowup: (id) => api.patch(`/followups/${id}/complete`).then(res => res.data),
    logCommunication: (data) => api.post('/followups/communications', data).then(res => res.data),

    // Reports
    getEODReport: (date) => api.get('/reports/eod', { params: { date } }).then(res => res.data),
    getWeeklyReport: (endDate) => api.get('/reports/weekly', { params: { end_date: endDate } }).then(res => res.data),
    getMonthlyReport: (month) => api.get('/reports/monthly', { params: { month } }).then(res => res.data),
    getMonthlyPLReport: (month) => api.get('/reports/monthly', { params: { month } }).then(res => res.data),
    getLiveDashboard: () => api.get('/reports/live', { params: { center: 'All Centers' } }).then(res => res.data),

    // Settings
    getSettings: () => api.get('/settings/').then(res => res.data),
    updateSettings: (data) => api.put('/settings/', data).then(res => res.data),
    getSystemAuditLogs: (limit = 50) => api.get('/settings/audit-logs', { params: { limit } }).then(res => res.data)
};
