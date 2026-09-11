import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export const ROLES = {
    super_admin: {
        id: 'super_admin',
        name: 'Super Admin',
        badge: 'badge-danger',
        description: 'Full Access (Financials, Cost Margins, Reconciliation, Settings, Staff Approvals)',
        permissions: {
            viewFinancials: true,
            viewCostMargins: true,
            addShipment: true,
            editShipment: true,
            deleteShipment: true,
            approveRefunds: true,
            manageAccounts: true,
            runReconciliation: true,
            exportReports: true,
            manageSettings: true,
            manageUsers: true
        }
    },
    operations_staff: {
        id: 'operations_staff',
        name: 'Operations Staff',
        badge: 'badge-primary',
        description: 'Operational Bookings, Customer 360, Tracking (Financial Margins Masked)',
        permissions: {
            viewFinancials: false,
            viewCostMargins: false,
            addShipment: true,
            editShipment: true,
            deleteShipment: false,
            approveRefunds: false,
            manageAccounts: false,
            runReconciliation: false,
            exportReports: true,
            manageSettings: false,
            manageUsers: false
        }
    },
    counter_staff: {
        id: 'counter_staff',
        name: 'Front Counter Staff',
        badge: 'badge-warning',
        description: 'Counter Shipment Entry & Receipts (Restricted Operations)',
        permissions: {
            viewFinancials: false,
            viewCostMargins: false,
            addShipment: true,
            editShipment: false,
            deleteShipment: false,
            approveRefunds: false,
            manageAccounts: false,
            runReconciliation: false,
            exportReports: false,
            manageSettings: false,
            manageUsers: false
        }
    }
};

const AuthContext = createContext();

const getAvatarForRole = (roleId) => {
    switch (roleId) {
        case 'super_admin': return '👑';
        case 'operations_staff': return '💼';
        case 'counter_staff': return '📝';
        default: return '👤';
    }
};

const normalizeUserStatus = (status) => {
    const normalized = String(status || 'pending').trim().toLowerCase();
    if (normalized === 'active') return 'approved';
    if (normalized === 'pending approval') return 'pending';
    return normalized;
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(() => {
        const isLoggedOut = localStorage.getItem('fmc_logged_out') === 'true';
        const isLoggedIn = localStorage.getItem('fmc_logged_in') === 'true';
        let savedEmail = localStorage.getItem('fmc_user_email');
        let savedRole = localStorage.getItem('fmc_user_role');
        if (isLoggedOut || !isLoggedIn || !savedEmail) {
            return null;
        }

        const roleId = savedRole || 'counter_staff';
        return {
            id: localStorage.getItem('fmc_user_id') || '055d37da-38d0-4fe9-9ca3-4b956dede81d',
            email: savedEmail,
            name: localStorage.getItem('fmc_user_name') || 'Gangabathina Chanakya',
            roleId: roleId,
            center: localStorage.getItem('fmc_user_center') || 'Main Hub (Bangalore)',
            status: localStorage.getItem('fmc_user_status') || 'approved',
            permissions: ROLES[roleId]?.permissions || ROLES.super_admin.permissions,
            avatar: getAvatarForRole(roleId),
            isSuperAdmin: roleId === 'super_admin'
        };
    });

    const [activeRoleOverride, setActiveRoleOverride] = useState(() => {
        const isLoggedOut = localStorage.getItem('fmc_logged_out') === 'true';
        const isLoggedIn = localStorage.getItem('fmc_logged_in') === 'true';
        let r = (isLoggedIn && !isLoggedOut) ? (localStorage.getItem('fmc_user_role') || 'super_admin') : null;
        return r;
    });
    const [userStatus, setUserStatus] = useState(() => normalizeUserStatus(localStorage.getItem('fmc_user_status')));
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiClient.getAuthMe().then(data => {
            if (!active) return;
            const roleId = data.user.role_id;
            setCurrentUser({ id: data.user.id, email: data.user.email, name: data.user.name, roleId, roles: data.roles, permissions: data.permissions, center: data.centers?.[0], isSuperAdmin: data.is_super_admin });
            setActiveRoleOverride(roleId);
            setUserStatus(normalizeUserStatus(data.user.status));
        }).catch(() => { if (active) setCurrentUser(null); }).finally(() => { if (active) setAuthLoading(false); });
        return () => { active = false; };
    }, []);

    const currentRoleId = activeRoleOverride || currentUser?.roleId || 'counter_staff';
    const currentRole = ROLES[currentRoleId] || { id: currentRoleId, name: currentRoleId, permissions: {} };
    const normalizedStatus = normalizeUserStatus(userStatus);
    const isApproved = normalizedStatus === 'approved';
    const isPendingApproval = normalizedStatus === 'pending';
    const isRejected = normalizedStatus === 'rejected';
    const isSuspended = normalizedStatus === 'suspended';

    const parseApiError = (err, fallback = 'Operation failed.') => {
        if (!err) return fallback;
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            return 'Server response timed out. Please check that the backend is running.';
        }
        if (err.code === 'ERR_NETWORK' || !err.response) {
            return 'Cannot reach backend server. Please make sure backend is running on port 8000.';
        }
        const detail = err.response?.data?.detail || err.message;
        if (typeof detail === 'string') return detail;
        if (detail && typeof detail === 'object') {
            return detail.message || detail.msg || JSON.stringify(detail);
        }
        return String(detail || fallback);
    };

    // Login
    const login = async (email, password, fullName = '') => {
        setAuthLoading(true);
        try {
            const data = await apiClient.login({ 
                full_name: (fullName || '').trim() || undefined,
                email: email.trim(), 
                password 
            });
            localStorage.removeItem('fmc_logged_out');

            if (data.access_token || data.session_token) {
                const tok = data.access_token || data.session_token;
                localStorage.setItem('fmc_access_token', tok);
                localStorage.setItem('fmc_token', tok);
                localStorage.setItem('fmc_session_token', tok);
            }

            if (data.user) {
                const u = data.user;
                const roleId = u.role || 'operations_staff';
                const status = normalizeUserStatus(u.status || data.profile?.status || data.account_status);
                const name = (fullName || '').trim() || u.name || email.split('@')[0];
                const centerName = (u.centers && u.centers[0]) || 'Main Hub (Bangalore)';

                localStorage.setItem('fmc_user_id', u.id);
                localStorage.setItem('fmc_user_email', u.email);
                localStorage.setItem('fmc_user_name', name);
                localStorage.setItem('fmc_user_role', roleId);
                localStorage.setItem('fmc_user_status', status);
                localStorage.setItem('fmc_user_center', centerName);
                localStorage.setItem('fmc_user_permissions', JSON.stringify(u.permissions || {}));
                localStorage.setItem('fmc_logged_in', 'true');
                localStorage.removeItem('fmc_logged_out');

                setActiveRoleOverride(roleId);
                setUserStatus(status);
                setCurrentUser({
                    id: u.id,
                    email: u.email,
                    name: name,
                    roleId: roleId,
                    roles: u.roles || [roleId],
                    status: status,
                    center: centerName,
                    permissions: u.permissions || {},
                    isSuperAdmin: roleId === 'super_admin' || (u.roles && u.roles.includes('SUPER_ADMIN')),
                    avatar: getAvatarForRole(roleId)
                });
                return { status: 'authenticated', success: true, user: u };
            }
            return { status: 'authenticated', success: true };
        } catch (err) {
            throw new Error(parseApiError(err, 'Login failed. Please check your credentials.'));
        } finally {
            setAuthLoading(false);
        }
    };

    // Logout / Clear session
    const logout = () => {
        localStorage.removeItem('fmc_access_token');
        localStorage.removeItem('fmc_token');
        localStorage.removeItem('fmc_session_token');
        localStorage.removeItem('fmc_logged_in');
        localStorage.removeItem('fmc_user_id');
        localStorage.removeItem('fmc_user_email');
        localStorage.removeItem('fmc_user_name');
        localStorage.removeItem('fmc_user_role');
        localStorage.removeItem('fmc_user_status');
        localStorage.removeItem('fmc_user_center');
        localStorage.removeItem('fmc_customer_id');
        localStorage.removeItem('fmc_b2b_company_id');
        localStorage.setItem('fmc_logged_out', 'true');
        setCurrentUser(null);
        setActiveRoleOverride(null);
    };

    // Logout All Devices
    const logoutAll = () => {
        logout();
    };

    // Check granular permission & scope safely
    const hasPermission = (permKey, minScope = 'own') => {
        if (!isApproved) return false;
        if (currentUser?.isSuperAdmin) return true;

        // Check array permissions
        if (Array.isArray(currentUser?.permissions)) {
            if (currentUser.permissions.includes('*') || currentUser.permissions.includes(permKey)) return true;
        }

        // Check object permissions
        if (currentUser?.permissions && typeof currentUser.permissions === 'object' && !Array.isArray(currentUser.permissions)) {
            if (currentUser.permissions['*']) return true;
            const grantedScope = currentUser.permissions[permKey];
            if (grantedScope !== undefined && grantedScope !== null) {
                if (typeof grantedScope === 'boolean') {
                    return grantedScope;
                }
                if (typeof grantedScope === 'string') {
                    const scopeLevels = { own: 1, center: 2, all: 3 };
                    const uLevel = scopeLevels[grantedScope.toLowerCase()] || 1;
                    const rLevel = scopeLevels[minScope.toLowerCase()] || 1;
                    return uLevel >= rLevel;
                }
                return !!grantedScope;
            }
        }

        const aliases = { viewFinancials: 'reports.view_financial', viewCostMargins: 'reports.view_financial', addShipment: 'shipments.add', editShipment: 'shipments.edit', deleteShipment: 'shipments.delete', approveRefunds: 'refunds.approve', manageAccounts: 'accounts.edit', runReconciliation: 'reconciliation.run', exportReports: 'reports.export', manageSettings: 'settings.manage', manageUsers: 'users.manage_permissions' };
        return !!currentUser?.permissions?.[aliases[permKey]];
    };

    // Direct Self-Registration & Immediate Login
    const registerStaff = async (payload) => {
        setAuthLoading(true);
        try {
            const data = await apiClient.signup({
                email: payload.email.trim().toLowerCase(),
                password: payload.password,
                full_name: payload.name.trim(),
                name: payload.name.trim(),
                phone: payload.phone?.trim() || '',
                requested_role: payload.requested_role || 'counter_staff',
                center: payload.center || 'Main Hub (Bangalore)'
            });
            localStorage.removeItem('fmc_logged_out');

            if (data.access_token || data.session_token) {
                const tok = data.access_token || data.session_token;
                localStorage.setItem('fmc_access_token', tok);
                localStorage.setItem('fmc_token', tok);
                localStorage.setItem('fmc_session_token', tok);
            }

            if (data.user) {
                const u = data.user;
                const roleId = u.role || payload.requested_role || 'counter_staff';
                const status = normalizeUserStatus(u.status || data.profile?.status || data.account_status);
                const name = u.name || payload.name;
                const centerName = (u.centers && u.centers[0]) || payload.center || 'Main Hub (Bangalore)';

                localStorage.setItem('fmc_user_id', u.id);
                localStorage.setItem('fmc_user_email', u.email);
                localStorage.setItem('fmc_user_name', name);
                localStorage.setItem('fmc_user_role', roleId);
                localStorage.setItem('fmc_user_status', status);
                localStorage.setItem('fmc_user_center', centerName);
                localStorage.setItem('fmc_user_permissions', JSON.stringify(u.permissions || {}));
                localStorage.setItem('fmc_logged_in', 'true');

                setActiveRoleOverride(roleId);
                setUserStatus(status);
                setCurrentUser({
                    id: u.id,
                    email: u.email,
                    name: name,
                    roleId: roleId,
                    roles: u.roles || [roleId],
                    status: status,
                    center: centerName,
                    permissions: ROLES[roleId]?.permissions || {},
                    isSuperAdmin: roleId === 'super_admin',
                    avatar: getAvatarForRole(roleId)
                });
            }
            return data;
        } catch (err) {
            throw new Error(parseApiError(err, 'Registration failed.'));
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{
            session: { user: { email: currentUser?.email || '' } },
            user: currentUser,
            currentUser: currentUser,
            currentRole: currentRole || ROLES.super_admin,
            userStatus,
            isAuthenticated: !!currentUser?.email && localStorage.getItem('fmc_logged_out') !== 'true',
            isApproved,
            isPendingApproval,
            isRejected,
            isSuspended,
            authLoading,
            login,
            registerStaff,
            logout,
            logoutAll,
            hasPermission,
            roles: ROLES
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
