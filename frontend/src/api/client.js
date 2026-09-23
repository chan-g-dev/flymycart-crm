import { trackRequests } from '../utils/requestActivity';
import axios from 'axios';
import { createPaymentSender } from '../utils/paymentRequests';
import { fetchAllPages } from '../utils/pagination';

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        const customUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
        return customUrl.endsWith('/api') ? customUrl : `${customUrl}/api`;
    }
    // Default to same-origin /api which is proxied by Vite in dev and by vercel.json rewrites in production
    return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Enables HttpOnly session cookies across requests
    timeout: 60000, // 60s timeout allows cloud servers (e.g. Render) to wake from cold sleep
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
    } catch {
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
            } catch {}
        }
        return Promise.reject(error);
    }
);

trackRequests(api);

let paymentStorage;
try { paymentStorage = globalThis.sessionStorage; } catch { /* Browser storage is optional. */ }
const paymentMutation = createPaymentSender({ send: config => api.request(config), storage: paymentStorage, crypto: globalThis.crypto });

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
    getUserAccess: id => api.get(`/users/${id}/access`).then(res => res.data),
    updateUserAccess: (id, payload) => api.put(`/users/${id}/access`, payload).then(res => res.data),
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

    getInvoiceBranding: () => api.get('/invoices/branding').then(res => res.data),
    updateInvoiceBranding: (logo) => api.put('/invoices/branding', { logo }).then(res => res.data),

    // Global Search
    globalSearch: (q) => api.get('/search/', { params: { q } }).then(res => res.data),

    // Dashboard
    getDashboardSummary: () => api.get('/dashboard/summary').then(res => res.data),
    recordAccountingEntry: (data) => paymentMutation('post', '/accounts/entries', data),

    // Customers
    getCustomers: (params) => params?.limit != null || params?.offset != null ? api.get('/customers', { params }).then(res => res.data) : fetchAllPages(page => api.get('/customers', { params: { ...params, ...page } })),
    lookupCustomerByMobile: (mobile) => api.get('/customers/lookup', { params: { mobile } }).then(res => res.data),
    getCustomer360: (id) => api.get(`/customers/${id}/360`).then(res => res.data),
    createCustomer: (data) => api.post('/customers', data).then(res => res.data),
    updateCustomer: (id, data) => api.put(`/customers/${id}`, data).then(res => res.data),
    deleteCustomer: (id) => api.delete(`/customers/${id}`).then(res => res.data),
    uploadCustomerDocument: (id, formData) => api.post(`/customers/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),
    downloadCustomerDocument: (id, docId) => api.get(`/customers/${id}/documents/${docId}/download`, { responseType: 'blob' }).then(res => res.data),
    getCustomerDocuments: (id) => api.get(`/customers/${id}/documents`).then(res => res.data),

    // Shipments
    getShipments: (params) => params?.limit != null || params?.offset != null ? api.get('/shipments', { params }).then(res => res.data) : fetchAllPages(page => api.get('/shipments', { params: { ...params, ...page } })),
    getShipmentsPage: (params, signal) => api.get('/shipments', { params, signal }).then(res => ({
        items: res.data,
        total: Number(res.headers['x-total-count'] ?? res.data.length),
    })),
    createShipment: (data) => paymentMutation('post', '/shipments', data),
    updateShipmentStatus: (id, data) => api.patch(`/shipments/${id}/status`, data).then(res => res.data),
    deleteShipment: (id) => api.delete(`/shipments/${id}`).then(res => res.data),

    // Invoices
    getInvoices: (params) => params?.limit != null || params?.offset != null ? api.get('/invoices', { params }).then(res => res.data) : fetchAllPages(page => api.get('/invoices', { params: { ...params, ...page } })),
    getInvoice: (id) => api.get(`/invoices/${id}`).then(res => res.data),
    recordInvoicePayment: (id, data) => paymentMutation('post', `/invoices/${id}/payments`, data),

    // Accounts & Wallets
    getAccountsSummary: () => api.get('/accounts/summary').then(res => res.data),
    getAccountsOverview: (params) => api.get('/accounts/overview', { params }).then(res => res.data),
    getShipmentLedger: (params) => api.get('/accounts/shipment-ledger', { params }).then(res => res.data),
    getAccountingEntries: (params) => api.get('/accounts/entries', { params }).then(res => res.data),
    uploadExpenseBill: (id, file) => {
        const body = new FormData(); body.append('file', file);
        return api.post(`/accounts/entries/${id}/bill`, body, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);
    },
    downloadExpenseBill: (id) => api.get(`/accounts/entries/${id}/bill`, { responseType: 'blob' }).then(res => res.data),

    getDateRangeReport: (date_from, date_to) => api.get('/reports/range', { params: { date_from, date_to } }).then(res => res.data),
    getAccountReceipts: params => api.get('/accounts/receipts', { params }).then(res => res.data),
    getAccountCheckOptions: () => api.get('/accounts/check-options').then(res => res.data),
    getAccountChecks: params => api.get('/accounts/checks', { params }).then(res => res.data),
    recordAccountCheck: data => api.post('/accounts/checks', data).then(res => res.data),
    getWalletTransactions: (walletName) => api.get(`/accounts/wallets/${walletName}/transactions`).then(res => res.data),
    rechargeWallet: (data) => paymentMutation('post', '/accounts/wallets/recharge', data),

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
        headers: { 'Content-Type': undefined }
    }).then(res => res.data),

    // Refunds
    getRefunds: () => api.get('/refunds/').then(res => res.data),
    createRefund: (data) => api.post('/refunds/', data).then(res => res.data),
    updateRefundStatus: (id, status, extra = {}) => paymentMutation('patch', `/refunds/${id}/status`, { status, ...extra }),

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
    getExpenseCategories: () => api.get('/accounts/expense-categories').then(res => res.data),
    updateExpenseCategories: (categories) => api.put('/accounts/expense-categories', { categories }).then(res => res.data),
    getSettings: () => api.get('/settings/').then(res => res.data),
    updateSettings: (data) => api.put('/settings/', data).then(res => res.data),
    saveSettings: (data) => api.put('/settings/', data).then(res => res.data),
    getSystemAuditLogs: (limit = 50) => api.get('/settings/audit-logs', { params: { limit } }).then(res => res.data),

    // Attendance
    getAttendanceSummary: (params) => api.get('/attendance/summary', { params }).then(res => res.data),
    getAttendanceEvents: (params) => api.get('/attendance/events', { params }).then(res => res.data),
    getAttendanceDailyBreakdown: (params) => api.get('/attendance/daily-breakdown', { params }).then(res => res.data),
    recordAttendancePunch: (data) => api.post('/attendance/punch', data).then(res => res.data),
    getAttendanceStaffList: () => api.get('/attendance/staff-list').then(res => res.data),

    // Generic Request helper
    request: (urlOrConfig, options = {}) => {
        if (typeof urlOrConfig === 'string') {
            const url = urlOrConfig.startsWith('/api') ? urlOrConfig.slice(4) : urlOrConfig;
            const method = (options.method || 'GET').toLowerCase();
            const config = {
                method,
                url,
                headers: options.headers,
                data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
                params: options.params
            };
            return api(config).then(res => res.data);
        }
        return api(urlOrConfig).then(res => res.data);
    }
};
