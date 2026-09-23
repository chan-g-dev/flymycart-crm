import { LoadingSpinner } from './components/LoadingSpinner';
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useAuth } from './context/authSession';
import { apiClient } from './api/client';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
const RefundPayoutModal = lazy(() => import('./components/RefundPayoutModal'));
const CustomerDrawer = lazy(() => import('./components/CustomerDrawer'));
const ShipmentModal = lazy(() => import('./components/ShipmentModal'));
const CustomerModal = lazy(() => import('./components/CustomerModal'));
const InvoiceModal = lazy(() => import('./components/InvoiceModal'));
const ReconciliationModal = lazy(() => import('./components/ReconciliationModal'));
const WalletRechargeModal = lazy(() => import('./components/ActionModals').then(module => ({ default: module.WalletRechargeModal })));
const RefundModal = lazy(() => import('./components/ActionModals').then(module => ({ default: module.RefundModal })));
const CommunicationModal = lazy(() => import('./components/ActionModals').then(module => ({ default: module.CommunicationModal })));
const B2BCompanyModal = lazy(() => import('./components/ActionModals').then(module => ({ default: module.B2BCompanyModal })));
const ShipmentStatusModal = lazy(() => import('./components/ActionModals').then(module => ({ default: module.ShipmentStatusModal })));

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Customers = lazy(() => import('./pages/CustomersAndShipments').then(module => ({ default: module.Customers })));
const Shipments = lazy(() => import('./pages/CustomersAndShipments').then(module => ({ default: module.Shipments })));
const Invoices = lazy(() => import('./pages/InvoicesAccountsB2B').then(module => ({ default: module.Invoices })));
const Accounts = lazy(() => import('./pages/InvoicesAccountsB2B').then(module => ({ default: module.Accounts })));
const B2B = lazy(() => import('./pages/InvoicesAccountsB2B').then(module => ({ default: module.B2B })));
const Refunds = lazy(() => import('./pages/Refunds').then(module => ({ default: module.Refunds })));
const Followups = lazy(() => import('./pages/Followups').then(module => ({ default: module.Followups })));
const Reports = lazy(() => import('./pages/Reports').then(module => ({ default: module.Reports })));
const Attendance = lazy(() => import('./pages/Attendance').then(module => ({ default: module.Attendance })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Users = lazy(() => import('./pages/UsersSection').then(module => ({ default: module.Users })));
import { AuthPage } from './components/AuthPage';
import { getCurrentPath, navigate } from './utils/navigation';

const VALID_PAGES = [
    'dashboard', 'customers', 'shipments', 'invoices',
    'accounts', 'b2b', 'refunds', 'followups', 'reports', 'attendance', 'users', 'settings'
];

const PAGE_LOADING_MESSAGES = {
    dashboard: 'Loading dashboard...',
    customers: 'Loading customers...',
    shipments: 'Loading shipments...',
    invoices: 'Loading invoices...',
    accounts: 'Loading accounts...',
    b2b: 'Loading corporate accounts...',
    refunds: 'Loading refunds...',
    followups: 'Loading follow-ups...',
    reports: 'Loading reports...',
    attendance: 'Loading attendance...',
    users: 'Loading staff...',
    settings: 'Loading settings...',
};

const getInitialPage = () => {
    try {
        const path = getCurrentPath().toLowerCase();
        const clean = path.replace(/^\/(?:admin|crm)?\/?/, '').split('/')[0];
        if (clean && VALID_PAGES.includes(clean)) {
            return clean;
        }
        const saved = localStorage.getItem('fmc_active_page');
        if (saved && VALID_PAGES.includes(saved)) return saved;
    } catch {
        // Fallback for iframe/sandbox
    }
    return 'dashboard';
};

const loadCached = (_key, fallback) => fallback;


export function App() {
    const { isAuthenticated, isPendingApproval, isRejected, isSuspended, logout, authLoading, currentUser } = useAuth();
    const [currentPage, setCurrentPage] = useState(getInitialPage);
    const [activeSubPage, setActiveSubPage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawerLoading, setIsDrawerLoading] = useState(false);
    const [selectedCenter, setSelectedCenter] = useState('All Centers');
    const [dashboardData, setDashboardData] = useState(() => loadCached('dashboard', null));
    const [customers, setCustomers] = useState(() => loadCached('customers', []));
    const [shipments, setShipments] = useState(() => loadCached('shipments', []));
    const [invoices, setInvoices] = useState(() => loadCached('invoices', []));
    const [accountsData, setAccountsData] = useState(() => loadCached('accounts', null));
    const [reconciliations, setReconciliations] = useState(() => loadCached('reconciliations', []));
    const [b2bData, setB2BData] = useState(() => loadCached('b2b', null));
    const [refunds, setRefunds] = useState(() => loadCached('refunds', []));
    const [followups, setFollowups] = useState(() => loadCached('followups', []));
    const [settings, setSettings] = useState(() => loadCached('settings', null));
    const [pendingStaffCount, setPendingStaffCount] = useState(0);

    // Modal States
    const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isReconModalOpen, setIsReconModalOpen] = useState(false);
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [activeWalletName, setActiveWalletName] = useState('ICL');
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isCommModalOpen, setIsCommModalOpen] = useState(false);
    const [activeCommCustomer, setActiveCommCustomer] = useState('');
    const [isB2BModalOpen, setIsB2BModalOpen] = useState(false);
    const [selectedStatusShipment, setSelectedStatusShipment] = useState(null);

    // Drawer & Invoice Preview
    const [drawerData, setDrawerData] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState(null);
    const [toast, setToast] = useState(null);

    // Welcome back greeting banner state for authenticated users
    const [welcomeGreeting, setWelcomeGreeting] = useState(() => {
        const isLoggedIn = localStorage.getItem('fmc_logged_in') === 'true';
        const isLoggedOut = localStorage.getItem('fmc_logged_out') === 'true';
        if (isLoggedIn && !isLoggedOut) {
            return {
                name: localStorage.getItem('fmc_user_name') || 'Admin',
                role: localStorage.getItem('fmc_user_role') || 'super_admin',
                center: localStorage.getItem('fmc_user_center') || 'Main Hub (Bangalore)'
            };
        }
        return null;
    });

    useEffect(() => {
        if (welcomeGreeting) {
            const timer = setTimeout(() => {
                setWelcomeGreeting(null);
            }, 4500);
            return () => clearTimeout(timer);
        }
    }, [welcomeGreeting]);

    // Synchronize current page with URL path & LocalStorage
    const navigateToPage = (page) => {
        if (!VALID_PAGES.includes(page)) page = 'dashboard';
        setCurrentPage(page);
        try {
            navigate(`/${page}`);
            localStorage.setItem('fmc_active_page', page);
        } catch {}
    };

    // Listen to browser Back/Forward (popstate) and FMC navigation events
    useEffect(() => {
        const onLocationChange = () => {
            const path = getCurrentPath().toLowerCase();
            const clean = path.replace(/^\/(?:admin|crm)?\/?/, '').split('/')[0];

            if (clean && VALID_PAGES.includes(clean)) {
                if (clean !== currentPage) {
                    setCurrentPage(clean);
                    try {
                        localStorage.setItem('fmc_active_page', clean);
                    } catch {}
                }
            } else if (path === '/' || path === '' || path === '/dashboard' || path === '/admin') {
                if (currentPage !== 'dashboard') {
                    setCurrentPage('dashboard');
                }
            }
        };

        window.addEventListener('popstate', onLocationChange);
        window.addEventListener('fmc-navigation', onLocationChange);
        onLocationChange();

        return () => {
            window.removeEventListener('popstate', onLocationChange);
            window.removeEventListener('fmc-navigation', onLocationChange);
        };
    }, [currentPage]);

    // Unauthenticated protection
    useEffect(() => {
        if (!authLoading && (!isAuthenticated || !currentUser)) {
            const path = getCurrentPath().toLowerCase();
            if (path !== '/login') {
                navigate('/login');
            }
        }
    }, [isAuthenticated, currentUser, authLoading]);

    // Authenticated redirect from login to dashboard
    useEffect(() => {
        if (!authLoading && isAuthenticated && currentUser) {
            const path = getCurrentPath().toLowerCase();
            if (path === '/login' || path === '/register' || path.startsWith('/login') || path.startsWith('/register')) {
                navigate('/', true);
                setCurrentPage('dashboard');
            }
        }
    }, [isAuthenticated, currentUser, authLoading]);

    const loadGeneration = useRef(0);
    const [loadError, setLoadError] = useState('');
    const loadPage = useCallback(async (silent = false) => {
        const generation = ++loadGeneration.current;
        if (!silent) setIsLoading(true);
        setLoadError('');
        const resources = {
            dashboard: [apiClient.getDashboardSummary, setDashboardData],
            customers: [apiClient.getCustomers, setCustomers],
            shipments: [apiClient.getShipments, setShipments],
            invoices: [apiClient.getInvoices, setInvoices],
            accounts: [apiClient.getAccountsSummary, setAccountsData],
            reconciliations: [apiClient.getReconciliationBatches, setReconciliations],
            b2b: [apiClient.getB2BSummary, setB2BData],
            refunds: [apiClient.getRefunds, setRefunds],
            followups: [apiClient.getFollowups, setFollowups],
            settings: [apiClient.getSettings, value => {
                setSettings(value);
                window.__FMC_SETTINGS__ = value;
                if (value?.courierLogos) {
                    try { localStorage.setItem('fmc_courier_logos', JSON.stringify(value.courierLogos)); } catch {}
                }
            }],
        };
        const pages = {
            dashboard: ['accounts', 'b2b', 'followups', ...(selectedCenter && selectedCenter !== 'All Centers' ? ['customers'] : [])],
            customers: ['customers'],
            shipments: ['shipments', 'invoices'],
            invoices: ['invoices', 'shipments', 'customers'],
            accounts: ['accounts', 'reconciliations', 'b2b', 'refunds', 'shipments', 'invoices', 'customers'],
            b2b: ['b2b', 'shipments'],
            refunds: ['refunds', 'shipments'],
            followups: ['followups', 'customers'],
        };
        await Promise.all(['dashboard', 'settings', ...(pages[currentPage] || [])].map(async key => {
            try {
                const [fetch, publish] = resources[key];
                const value = await fetch();
                if (generation === loadGeneration.current) publish(value);
            } catch (error) {
                if (generation === loadGeneration.current && error.response?.status !== 403) {
                    setLoadError('Some data could not be loaded. Please retry.');
                }
            }
        }));
        if (generation === loadGeneration.current) setIsLoading(false);
    }, [currentPage, selectedCenter]);

    const refreshAll = async (silent = false) => {
        await loadPage(silent === true);
        if (isDrawerOpen && drawerData?.customer?.id) {
            const customerId = drawerData.customer.id;
            const profile = await apiClient.getCustomer360(customerId);
            setDrawerData(current => current?.customer?.id === customerId ? profile : current);
        }
    };

    useEffect(() => {
        setDashboardData(null);
        setCustomers([]);
        setShipments([]);
        setInvoices([]);
        setAccountsData(null);
        setReconciliations([]);
        setB2BData(null);
        setRefunds([]);
        setFollowups([]);
        setSettings(null);
        setDrawerData(null);
        setPreviewInvoice(null);
        setPendingStaffCount(0);
    }, [currentUser?.id, currentUser?.roleId]);

    useEffect(() => {
        if (!isAuthenticated || authLoading) return;
        loadPage();
        return () => { ++loadGeneration.current; };
    }, [isAuthenticated, authLoading, currentUser?.id, currentUser?.roleId, loadPage]);

    useEffect(() => {
        if (!isAuthenticated || authLoading) return;
        let active = true;
        apiClient.getPendingStaffCount().then(value => {
            if (active) setPendingStaffCount(value?.pending_count || 0);
        }).catch(() => {});
        return () => { active = false; };
    }, [isAuthenticated, authLoading, currentUser?.id, currentUser?.roleId]);

    const handleLoginSuccess = async () => {
        navigate('/dashboard');
        setCurrentPage('dashboard');
        try {
            localStorage.setItem('fmc_active_page', 'dashboard');
        } catch {}
        const name = localStorage.getItem('fmc_user_name') || 'Admin';
        const role = localStorage.getItem('fmc_user_role') || 'super_admin';
        const center = localStorage.getItem('fmc_user_center') || 'Main Hub (Bangalore)';
        setWelcomeGreeting({ name, role, center });
        showToast(`Welcome back, ${name}! Logged in successfully.`, 'success');
    };

    // Navigation and subnavigation handlers
    const handleSubNavigate = (parent, sub) => {
        setActiveSubPage(sub);
        navigateToPage(parent);
        if (sub === 'reconciliation') {
            setIsReconModalOpen(true);
        } else if (sub === 'icl_wallet') {
            handleOpenWalletModal('ICL');
        } else if (sub === 'brv_wallet') {
            handleOpenWalletModal('BRV');
        }
    };

    const handleOpenCustomerDrawer = async (customerIdOrName) => {
        setIsDrawerLoading(true);
        try {
            const data = await apiClient.getCustomer360(customerIdOrName);
            setDrawerData(data);
            setIsDrawerOpen(true);
        } catch {
            showToast('Customer profile not found', 'danger');
        } finally {
            setIsDrawerLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
        setTimeout(() => setToast(null), 3500);
    };

    const handleDeleteCustomer = async (id, name) => {
        try {
            setCustomers(prev => (prev || []).filter(c => c.id !== id));
            await apiClient.deleteCustomer(id);
            showToast(`Customer profile "${name || 'User'}" permanently deleted.`, 'danger');
            refreshAll();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Error deleting customer profile', 'danger');
            refreshAll();
        }
    };

    const handleDeleteShipment = async (id, awb) => {
        try {
            setShipments(prev => (prev || []).filter(s => s.id !== id));
            await apiClient.deleteShipment(id);
            showToast(`Shipment ${awb || 'record'} permanently deleted.`, 'danger');
            refreshAll();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Error deleting shipment', 'danger');
            refreshAll();
        }
    };

    const handleApproveRefund = async (id) => {
        try {
            await apiClient.updateRefundStatus(id, 'Approved');
            refreshAll();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error approving refund');
        }
    };

    const [payoutRefundId, setPayoutRefundId] = useState(null);
    const handleProcessRefund = id => setPayoutRefundId(id);

    const handleRejectRefund = async (id) => {
        try {
            await apiClient.updateRefundStatus(id, 'Rejected');
            refreshAll();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error rejecting refund');
        }
    };

    const handleCompleteFollowup = async (id) => {
        try {
            await apiClient.completeFollowup(id);
            refreshAll();
        } catch {
            alert('Error completing follow-up');
        }
    };

    const handleOpenWalletModal = (walletName) => {
        setActiveWalletName(walletName);
        setIsWalletModalOpen(true);
    };

    const handleOpenCommModal = (customerName) => {
        setActiveCommCustomer(customerName);
        setIsCommModalOpen(true);
    };

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Center matching logic
    const matchesCenter = useCallback((itemCenter) => {
        if (!selectedCenter || selectedCenter === 'All Centers') return true;
        if (!itemCenter) return true;
        const normSelected = selectedCenter.toLowerCase().replace(/hub|branch|center|\(|\)/g, '').trim();
        const normItem = itemCenter.toLowerCase().replace(/hub|branch|center|\(|\)/g, '').trim();
        return normItem.includes(normSelected) || normSelected.includes(normItem);
    }, [selectedCenter]);

    const filteredShipments = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return shipments;
        return shipments.filter(s => matchesCenter(s.center));
    }, [shipments, selectedCenter, matchesCenter]);

    const filteredCustomers = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return customers;
        return customers.filter(c => matchesCenter(c.center));
    }, [customers, selectedCenter, matchesCenter]);

    const filteredInvoices = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return invoices;
        return invoices.filter(inv => {
            const ship = shipments.find(s => s.id === inv.shipment_id || s.awb === inv.awb);
            if (ship) return matchesCenter(ship.center);
            const cust = customers.find(c => c.id === inv.customer_id);
            if (cust) return matchesCenter(cust.center);
            return true;
        });
    }, [invoices, shipments, customers, selectedCenter, matchesCenter]);

    const filteredFollowups = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return followups;
        return followups.filter(f => {
            const cust = customers.find(c => c.id === f.customer_id || c.name === (f.customer_name || f.customer));
            return cust ? matchesCenter(cust.center) : true;
        });
    }, [followups, customers, selectedCenter, matchesCenter]);

    const filteredRefunds = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return refunds;
        return refunds.filter(r => {
            const ship = shipments.find(s => s.id === r.shipment_id || s.awb === r.awb);
            return ship ? matchesCenter(ship.center) : true;
        });
    }, [refunds, shipments, selectedCenter, matchesCenter]);

    const filteredDashboardData = useMemo(() => {
        if (!dashboardData) return null;
        if (!selectedCenter || selectedCenter === 'All Centers') return dashboardData;

        const summary = dashboardData.center_summaries?.[selectedCenter];
        return {
            ...dashboardData,
            ...summary,
            today_shipments_count: summary?.today_shipments_count ?? 0,
            today_sales: summary?.today_sales ?? 0,
            today_collected: dashboardData.collections_by_center?.[selectedCenter] ?? 0,
            pending_collection: summary?.pending_collection ?? 0,
            b2b_outstanding: summary?.b2b_outstanding ?? 0,
            recent_shipments: (dashboardData.recent_shipments || []).filter(s => matchesCenter(s.center))
        };
    }, [dashboardData, selectedCenter, matchesCenter]);

    const filteredAccountsData = useMemo(() => {
        if (!accountsData) return null;
        if (!selectedCenter || selectedCenter === 'All Centers') return accountsData;

        const totalSales = filteredShipments.reduce((acc, s) => acc + (s.price || 0), 0);
        const totalCollected = filteredShipments.reduce((acc, s) => {
            if (s.payment_status === 'Paid') return acc + (s.price || 0);
            if (s.payment_status === 'Partial') return acc + filteredInvoices.filter(inv => inv.shipment_id === s.id).reduce((total, inv) => total + (inv.paid || 0), 0);
            return acc;
        }, 0);

        return {
            ...accountsData,
            total_sales: dashboardData?.center_summaries?.[selectedCenter]?.total_sales ?? totalSales,
            total_sales_with_gst: dashboardData?.center_summaries?.[selectedCenter]?.total_sales_with_gst ?? filteredShipments.reduce((sum, s) => sum + Number(s.total_amount ?? (Number(s.price || 0) + Number(s.gst_amount || 0))), 0),
            total_collected: dashboardData?.center_summaries?.[selectedCenter]?.total_collected ?? totalCollected,
            pending_collection: Math.max(0, (dashboardData?.center_summaries?.[selectedCenter]?.total_sales_with_gst ?? totalSales) - (dashboardData?.center_summaries?.[selectedCenter]?.total_collected ?? totalCollected)),
            recent_invoices: filteredInvoices.slice(0, 10)
        };
    }, [accountsData, dashboardData, filteredShipments, filteredInvoices, selectedCenter]);

    const filteredB2BData = useMemo(() => {
        if (!b2bData) return null;
        if (!selectedCenter || selectedCenter === 'All Centers') return b2bData;

        const centerB2BShips = filteredShipments.filter(s => s.customer_type === 'B2B');
        const totalOutstanding = centerB2BShips
            .filter(s => s.payment_status !== 'Paid')
            .reduce((acc, s) => acc + (s.price || 0), 0);

        return {
            ...b2bData,
            total_outstanding: dashboardData?.center_summaries?.[selectedCenter]?.b2b_outstanding ?? totalOutstanding,
            recent_shipments: centerB2BShips.slice(0, 10)
        };
    }, [b2bData, dashboardData, filteredShipments, selectedCenter]);

    if (authLoading) return <main className="fmc-workspace-loading"><LoadingSpinner size="lg" text="Loading your workspace..." /></main>;

    if (!isAuthenticated || !currentUser) {
        return (
            <AuthPage
                onLoginSuccess={handleLoginSuccess}
            />
        );
    }

    if (isPendingApproval || isRejected || isSuspended) {
        return <main style={{ padding: 48 }}><h1>{isPendingApproval ? 'Awaiting approval' : 'Account unavailable'}</h1><p>{isPendingApproval ? 'Your account is awaiting Super Admin approval. Sign in again after approval.' : 'Contact Super Admin about your account status.'}</p><button onClick={logout}>Sign out</button></main>;
    }

    return (
        <div className={`app-shell ${currentPage === 'accounts' ? 'accounts-shell' : ''}`}>
            <Sidebar
                settings={settings}
                currentPage={currentPage}
                activeSubPage={activeSubPage}
                onNavigate={(page) => {
                    navigateToPage(page);
                    setIsMobileSidebarOpen(false);
                }}
                onSubNavigate={(page, sub) => {
                    handleSubNavigate(page, sub);
                    setIsMobileSidebarOpen(false);
                }}
                stats={{
                    ...(filteredDashboardData || dashboardData || {}),
                    pending_staff_count: pendingStaffCount
                }}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            <div className="main-content">
                {welcomeGreeting && (
                    <div className="fmc-welcome-banner" role="status" aria-live="polite">
                        <div className="fmc-welcome-content">
                            <span className="fmc-welcome-icon">
                                {welcomeGreeting.role === 'super_admin' ? '👑' : '💼'}
                            </span>
                            <div className="fmc-welcome-text">
                                <span className="fmc-welcome-title">
                                    Welcome back, <strong>{welcomeGreeting.name}</strong>!
                                </span>
                                <span className="fmc-welcome-meta">
                                    {welcomeGreeting.role === 'super_admin' ? 'Super Admin' : 'Operations Staff'} • {welcomeGreeting.center} • Session active
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="fmc-welcome-dismiss"
                            onClick={() => setWelcomeGreeting(null)}
                            title="Dismiss greeting"
                        >
                            ✕
                        </button>
                    </div>
                )}
                <Topbar
                    currentPage={currentPage}
                    onOpenShipmentModal={() => setIsShipmentModalOpen(true)}
                    onOpenCustomerDrawer={handleOpenCustomerDrawer}
                    onPreviewInvoice={setPreviewInvoice}
                    onNavigate={navigateToPage}
                    settings={settings}
                    onDataMutated={refreshAll}
                    onToggleSidebar={() => setIsMobileSidebarOpen(open => !open)}
                    isSidebarOpen={isMobileSidebarOpen}
                    selectedCenter={selectedCenter}
                    onSelectCenter={setSelectedCenter}
                />

                <main className="page-content" aria-busy={isLoading}>
                    {loadError && <div role="alert">{loadError} <button className="btn btn-outline" onClick={() => loadPage()}>Retry</button></div>}
                    <Suspense fallback={<LoadingSpinner size="lg" text={PAGE_LOADING_MESSAGES[currentPage]} />}>
                    {isLoading && !['accounts', 'reports', 'attendance', 'users'].includes(currentPage) && !(currentPage === 'b2b' && !b2bData) && <div className="fmc-page-loading"><LoadingSpinner inline size="sm" text={PAGE_LOADING_MESSAGES[currentPage]} /></div>}
                    {currentPage === 'dashboard' && (
                        <Dashboard
                            data={filteredDashboardData}
                            shipments={dashboardData?.recent_shipments}
                            accountsData={filteredAccountsData}
                            b2bData={filteredB2BData}
                            followups={filteredFollowups}
                            selectedCenter={selectedCenter}
                            onOpenStatusModal={setSelectedStatusShipment}
                            onNavigate={navigateToPage}
                            onOpenShipmentModal={() => setIsShipmentModalOpen(true)}
                            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
                            onOpenReconciliationModal={() => setIsReconModalOpen(true)}
                            onOpenCustomerDrawer={handleOpenCustomerDrawer}
                            isLoading={isLoading}
                        />
                    )}

                    {currentPage === 'customers' && (
                        <Customers
                            customers={filteredCustomers}
                            settings={settings}
                            selectedCenter={selectedCenter}
                            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
                            onOpenCustomerDrawer={handleOpenCustomerDrawer}
                            onDeleteCustomer={handleDeleteCustomer}
                            isLoading={isLoading}
                        />
                    )}

                    {currentPage === 'shipments' && (
                        <Shipments
                            shipments={filteredShipments}
                            invoices={invoices}
                            settings={settings}
                            selectedCenter={selectedCenter}
                            onOpenShipmentModal={() => setIsShipmentModalOpen(true)}
                            onOpenCustomerDrawer={handleOpenCustomerDrawer}
                            isLoading={isLoading}
                            onViewInvoice={(shipId) => {
                                const inv = invoices.find(i => i.shipment_id === shipId);
                                if (inv) setPreviewInvoice(inv);
                            }}
                            onOpenStatusModal={(ship) => setSelectedStatusShipment(ship)}
                            onDeleteShipment={handleDeleteShipment}
                        />
                    )}

                    {currentPage === 'invoices' && (
                        <Invoices
                            invoices={filteredInvoices}
                            selectedCenter={selectedCenter}
                            onPreviewInvoice={setPreviewInvoice}
                        />
                    )}

                    {currentPage === 'accounts' && (
                        <Accounts
                            settings={settings}
                            onSectionChange={setActiveSubPage}
                            renderRelatedSection={tab => tab === 'b2b'
                                ? <B2B b2bData={filteredB2BData} selectedCenter={selectedCenter} onOpenCustomerDrawer={handleOpenCustomerDrawer} onOpenB2BModal={() => setIsB2BModalOpen(true)} onRefresh={() => refreshAll(false)} />
                                : <Refunds refunds={filteredRefunds} selectedCenter={selectedCenter} onOpenRefundModal={() => setIsRefundModalOpen(true)} onApproveRefund={handleApproveRefund} onProcessRefund={handleProcessRefund} onRejectRefund={handleRejectRefund} />}
                            overviewData={accountsData}
                            shipments={filteredShipments}
                            onRefresh={refreshAll}
                            accountsData={filteredAccountsData}
                            reconciliations={reconciliations}
                            selectedCenter={selectedCenter}
                            onOpenWalletModal={handleOpenWalletModal}
                            onOpenReconciliationModal={() => setIsReconModalOpen(true)}
                            onOpenReconciliationModalWithBatch={() => setIsReconModalOpen(true)}
                            activeSection={activeSubPage}
                        />
                    )}

                    {currentPage === 'b2b' && (
                        <B2B
                            b2bData={filteredB2BData}
                            selectedCenter={selectedCenter}
                            onOpenCustomerDrawer={handleOpenCustomerDrawer}
                            onOpenB2BModal={() => setIsB2BModalOpen(true)}
                            onRefresh={() => refreshAll(false)}
                        />
                    )}

                    {currentPage === 'refunds' && (
                        <Refunds
                            refunds={filteredRefunds}
                            selectedCenter={selectedCenter}
                            onOpenRefundModal={() => setIsRefundModalOpen(true)}
                            onApproveRefund={handleApproveRefund}
                            onProcessRefund={handleProcessRefund}
                            onRejectRefund={handleRejectRefund}
                        />
                    )}

                    {currentPage === 'followups' && (
                        <Followups
                            followups={filteredFollowups}
                            selectedCenter={selectedCenter}
                            customers={filteredCustomers}
                            settings={settings}
                            onRefresh={() => refreshAll(false)}
                            onCompleteFollowup={handleCompleteFollowup}
                            onOpenCommModal={handleOpenCommModal}
                        />
                    )}

                    {currentPage === 'reports' && (
                        <Reports activeTab={activeSubPage} refreshKey={dashboardData} />
                    )}

                    {currentPage === 'attendance' && (
                        <Attendance
                            settings={settings}
                        />
                    )}

                    {currentPage === 'users' && (
                        <Users
                            settings={settings}
                            onDataMutated={refreshAll}
                        />
                    )}

                    {currentPage === 'settings' && (
                        <Settings
                            settings={settings}
                            onUpdateSettings={async (newSetts) => {
                                const saved = await apiClient.updateSettings(newSetts);
                                setSettings(saved);
                                await refreshAll(true);
                            }}
                        />
                    )}
                    </Suspense>
                </main>
            </div>

            {/* Modals & Customer 360 Drawer */}
            <Suspense fallback={<div className="modal-overlay"><LoadingSpinner size="lg" text="Loading form..." className="fmc-form-loading" /></div>}>
            {(isDrawerOpen || isDrawerLoading) && <CustomerDrawer
                isOpen={isDrawerOpen || isDrawerLoading}
                isLoading={isDrawerLoading}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setIsDrawerLoading(false);
                }}
                data={drawerData}
                onOpenCommModal={handleOpenCommModal}
                onPreviewInvoice={setPreviewInvoice}
            />}

            {(isShipmentModalOpen) && <ShipmentModal
                isOpen={isShipmentModalOpen}
                onClose={() => setIsShipmentModalOpen(false)}
                onCreated={refreshAll}
                settings={settings}
            />}

            {(isCustomerModalOpen) && <CustomerModal
                settings={settings}
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onCreated={refreshAll}
            />}

            {(!!previewInvoice) && <InvoiceModal
                isOpen={!!previewInvoice}
                onClose={() => setPreviewInvoice(null)}
                invoice={previewInvoice}
                onPaymentRecorded={refreshAll}
                settings={settings}
            />}

            {isReconModalOpen && <ReconciliationModal
                isOpen={isReconModalOpen}
                onClose={() => setIsReconModalOpen(false)}
                onReconciled={refreshAll}
                settings={settings}
            />}

            {(isWalletModalOpen) && <WalletRechargeModal
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
                walletName={activeWalletName}
                onRecharged={refreshAll}
                settings={settings}
            />}

            {payoutRefundId && <RefundPayoutModal settings={settings} id={payoutRefundId} onClose={() => setPayoutRefundId(null)} onSaved={refreshAll} />}
            {(isRefundModalOpen) && <RefundModal
                isOpen={isRefundModalOpen}
                onClose={() => setIsRefundModalOpen(false)}
                onCreated={refreshAll}
            />}

            {(isCommModalOpen) && <CommunicationModal
                isOpen={isCommModalOpen}
                onClose={() => setIsCommModalOpen(false)}
                customerName={activeCommCustomer}
                onCreated={refreshAll}
                settings={settings}
            />}

            {(isB2BModalOpen) && <B2BCompanyModal
                settings={settings}
                isOpen={isB2BModalOpen}
                onClose={() => setIsB2BModalOpen(false)}
                onCreated={refreshAll}
            />}

            {(!!selectedStatusShipment) && <ShipmentStatusModal
                isOpen={!!selectedStatusShipment}
                onClose={() => setSelectedStatusShipment(null)}
                shipment={selectedStatusShipment}
                onUpdated={refreshAll}
            />}


            </Suspense>
            {/* Floating Toast Notification */}
            {toast && (
                <div className="fmc-toast-container">
                    <div className={`fmc-toast ${toast.type === 'danger' ? 'fmc-toast-danger' : 'fmc-toast-success'}`}>
                        <span style={{ fontSize: '18px' }}>{toast.type === 'danger' ? '🗑️' : '✨'}</span>
                        <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{toast.message}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
