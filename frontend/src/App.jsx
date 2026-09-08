import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import { apiClient } from './api/client';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import CustomerDrawer from './components/CustomerDrawer';
import ShipmentModal from './components/ShipmentModal';
import CustomerModal from './components/CustomerModal';
import InvoiceModal from './components/InvoiceModal';
import ReconciliationModal from './components/ReconciliationModal';
import { 
    WalletRechargeModal, 
    RefundModal, 
    CommunicationModal, 
    B2BCompanyModal, 
    ShipmentStatusModal 
} from './components/ActionModals';

import { Dashboard } from './pages/Dashboard';
import { Customers, Shipments } from './pages/CustomersAndShipments';
import { Invoices, Accounts, B2B } from './pages/InvoicesAccountsB2B';
import { Refunds, Followups, Reports, Users, Settings } from './pages/OperationsAndReports';
import { AuthPage } from './components/AuthPage';
import { StepUpModal } from './components/StepUpModal';
import { getCurrentPath, navigate } from './utils/navigation';

const VALID_PAGES = [
    'dashboard', 'customers', 'shipments', 'invoices', 
    'accounts', 'b2b', 'refunds', 'followups', 'reports', 'users', 'settings'
];

const getInitialPage = () => {
    try {
        const path = getCurrentPath().toLowerCase();
        const clean = path.replace(/^\/(?:admin|crm)?\/?/, '').split('/')[0];
        if (clean && VALID_PAGES.includes(clean)) {
            return clean;
        }
        const saved = localStorage.getItem('fmc_active_page');
        if (saved && VALID_PAGES.includes(saved)) return saved;
    } catch (e) {
        // Fallback for iframe/sandbox
    }
    return 'dashboard';
};

const loadCached = (key, fallback) => {
    try {
        const raw = sessionStorage.getItem(`fmc_cache_${key}`);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

const setCached = (key, val) => {
    try {
        if (val !== null && val !== undefined) {
            sessionStorage.setItem(`fmc_cache_${key}`, JSON.stringify(val));
        }
    } catch (e) {}
};

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
        } catch (e) {}
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
                    } catch (e) {}
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

    // Load CRM data on demand (initial load, explicit refresh, or completed mutation).
    const refreshAll = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            // Phase 1: Critical UI Path (Dashboard + Shipments + Customers + Settings + Pending Counts)
            const [dash, custs, ships, setts, pCount] = await Promise.all([
                apiClient.getDashboardSummary().catch(() => null),
                apiClient.getCustomers().catch(() => []),
                apiClient.getShipments().catch(() => []),
                apiClient.getSettings().catch(() => null),
                apiClient.getPendingStaffCount().catch(() => ({ pending_count: 0 }))
            ]);

            if (dash) { 
                setDashboardData(dash); 
                setCached('dashboard', dash); 
            }
            if (Array.isArray(custs)) { setCustomers(custs); setCached('customers', custs); }
            if (Array.isArray(ships)) { setShipments(ships); setCached('shipments', ships); }
            if (setts) { setSettings(setts); setCached('settings', setts); }
            setPendingStaffCount(pCount?.pending_count || 0);

            // Phase 2: Asynchronous secondary stream in background
            Promise.all([
                apiClient.getInvoices().catch(() => []),
                apiClient.getAccountsSummary().catch(() => null),
                apiClient.getReconciliationBatches().catch(() => []),
                apiClient.getB2BSummary().catch(() => null),
                apiClient.getRefunds().catch(() => []),
                apiClient.getFollowups().catch(() => [])
            ]).then(([invs, acc, recons, b2b, refs, fus]) => {
                if (Array.isArray(invs)) { setInvoices(invs); setCached('invoices', invs); }
                if (acc) { setAccountsData(acc); setCached('accounts', acc); }
                if (Array.isArray(recons)) { setReconciliations(recons); setCached('reconciliations', recons); }
                if (b2b) { 
                    setB2BData(b2b); 
                    setCached('b2b', b2b); 
                } else {
                    setB2BData(prev => prev || {
                        total_credit_sales: 0,
                        collected: 0,
                        outstanding: 0,
                        due_this_week: 0,
                        overdue: 0,
                        aging: { not_due: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90_plus: 0, total_outstanding: 0, overdue_total: 0 },
                        companies: []
                    });
                }
                if (Array.isArray(refs)) { setRefunds(refs); setCached('refunds', refs); }
                if (Array.isArray(fus)) { setFollowups(fus); setCached('followups', fus); }
            }).catch(console.error);

        } catch (err) {
            console.error('Error fetching CRM data:', err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    // Perform one initial data load after authentication. No polling or automatic syncing.
    useEffect(() => {
        if (!isAuthenticated) return;
        refreshAll(false);
    }, [isAuthenticated, currentUser?.roleId]);

    // Eagerly hydrate B2B data when switching to B2B page if not already populated
    useEffect(() => {
        if (isAuthenticated && currentPage === 'b2b' && !b2bData) {
            apiClient.getB2BSummary()
                .then(res => {
                    if (res) {
                        setB2BData(res);
                        setCached('b2b', res);
                    }
                })
                .catch(err => {
                    console.warn('[B2B Hydration] Using safe fallback state:', err);
                    setB2BData(prev => prev || {
                        total_credit_sales: 0,
                        collected: 0,
                        outstanding: 0,
                        due_this_week: 0,
                        overdue: 0,
                        aging: { not_due: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90_plus: 0, total_outstanding: 0, overdue_total: 0 },
                        companies: []
                    });
                });
        }
    }, [isAuthenticated, currentPage, b2bData]);

    const handleLoginSuccess = async () => {
        navigate('/dashboard');
        setCurrentPage('dashboard');
        try {
            localStorage.setItem('fmc_active_page', 'dashboard');
        } catch (e) {}
        const name = localStorage.getItem('fmc_user_name') || 'Admin';
        const role = localStorage.getItem('fmc_user_role') || 'super_admin';
        const center = localStorage.getItem('fmc_user_center') || 'Main Hub (Bangalore)';
        setWelcomeGreeting({ name, role, center });
        showToast(`Welcome back, ${name}! Logged in successfully.`, 'success');
        await refreshAll(false);
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
        } catch (err) {
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

    const handleProcessRefund = async (id) => {
        try {
            await apiClient.updateRefundStatus(id, 'Refunded');
            refreshAll();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error processing refund');
        }
    };

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
        } catch (err) {
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
    const matchesCenter = (itemCenter) => {
        if (!selectedCenter || selectedCenter === 'All Centers') return true;
        if (!itemCenter) return true;
        const normSelected = selectedCenter.toLowerCase().replace(/hub|branch|center|\(|\)/g, '').trim();
        const normItem = itemCenter.toLowerCase().replace(/hub|branch|center|\(|\)/g, '').trim();
        return normItem.includes(normSelected) || normSelected.includes(normItem);
    };

    const filteredShipments = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return shipments;
        return shipments.filter(s => matchesCenter(s.center));
    }, [shipments, selectedCenter]);

    const filteredCustomers = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return customers;
        return customers.filter(c => matchesCenter(c.center));
    }, [customers, selectedCenter]);

    const filteredInvoices = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return invoices;
        return invoices.filter(inv => {
            const ship = shipments.find(s => s.id === inv.shipment_id || s.awb === inv.awb);
            if (ship) return matchesCenter(ship.center);
            const cust = customers.find(c => c.id === inv.customer_id);
            if (cust) return matchesCenter(cust.center);
            return true;
        });
    }, [invoices, shipments, customers, selectedCenter]);

    const filteredFollowups = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return followups;
        return followups.filter(f => {
            const cust = customers.find(c => c.id === f.customer_id || c.name === f.customer_name);
            return cust ? matchesCenter(cust.center) : true;
        });
    }, [followups, customers, selectedCenter]);

    const filteredRefunds = useMemo(() => {
        if (!selectedCenter || selectedCenter === 'All Centers') return refunds;
        return refunds.filter(r => {
            const ship = shipments.find(s => s.id === r.shipment_id || s.awb === r.awb);
            return ship ? matchesCenter(ship.center) : true;
        });
    }, [refunds, shipments, selectedCenter]);

    const filteredDashboardData = useMemo(() => {
        if (!dashboardData) return null;
        if (!selectedCenter || selectedCenter === 'All Centers') return dashboardData;

        const todayStr = new Date().toISOString().slice(0, 10);
        const todayCenterShips = filteredShipments.filter(s => s.date === todayStr);
        const todaySales = todayCenterShips.reduce((acc, s) => acc + (s.price || 0), 0);
        const todayCollected = todayCenterShips.reduce((acc, s) => {
            if (s.payment_status === 'Paid') return acc + (s.price || 0);
            if (s.payment_status === 'Partial') return acc + filteredInvoices.filter(inv => inv.shipment_id === s.id).reduce((total, inv) => total + (inv.paid || 0), 0);
            return acc;
        }, 0);
        const centerB2BOutstanding = filteredShipments
            .filter(s => s.customer_type === 'B2B' && s.payment_status !== 'Paid')
            .reduce((acc, s) => acc + Math.max(0, (s.price || 0) - filteredInvoices.filter(inv => inv.shipment_id === s.id).reduce((total, inv) => total + (inv.paid || 0), 0)), 0);

        return {
            ...dashboardData,
            today_shipments_count: todayCenterShips.length,
            today_sales: todaySales,
            today_collected: dashboardData.collections_by_center?.[selectedCenter] || 0,
            pending_collection: Math.max(0, todaySales - todayCollected),
            b2b_outstanding: centerB2BOutstanding,
            recent_shipments: filteredShipments.slice(0, 10)
        };
    }, [dashboardData, filteredShipments, filteredInvoices, selectedCenter]);

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
            total_sales: totalSales,
            total_collected: totalCollected,
            pending_collection: Math.max(0, totalSales - totalCollected),
            recent_invoices: filteredInvoices.slice(0, 10)
        };
    }, [accountsData, filteredShipments, filteredInvoices, selectedCenter]);

    const filteredB2BData = useMemo(() => {
        if (!b2bData) return null;
        if (!selectedCenter || selectedCenter === 'All Centers') return b2bData;

        const centerB2BShips = filteredShipments.filter(s => s.customer_type === 'B2B');
        const totalOutstanding = centerB2BShips
            .filter(s => s.payment_status !== 'Paid')
            .reduce((acc, s) => acc + (s.price || 0), 0);

        return {
            ...b2bData,
            total_outstanding: totalOutstanding,
            recent_shipments: centerB2BShips.slice(0, 10)
        };
    }, [b2bData, filteredShipments, selectedCenter]);

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
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <Sidebar 
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
                    onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                    selectedCenter={selectedCenter}
                    onSelectCenter={setSelectedCenter}
                />

                <main className="page-content">
                    {currentPage === 'dashboard' && (
                        <Dashboard 
                            data={filteredDashboardData}
                            shipments={filteredShipments}
                            accountsData={filteredAccountsData}
                            b2bData={filteredB2BData}
                            followups={filteredFollowups}
                            selectedCenter={selectedCenter}
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
                            selectedCenter={selectedCenter}
                            onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
                            onOpenCustomerDrawer={handleOpenCustomerDrawer}
                            onDeleteCustomer={handleDeleteCustomer}
                            isLoading={isLoading}
                            onSearch={async (s, t) => {
                                const res = await apiClient.getCustomers({ search: s, customer_type: t });
                                setCustomers(res);
                            }}
                        />
                    )}

                    {currentPage === 'shipments' && (
                        <Shipments 
                            shipments={filteredShipments}
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
                            onFilter={async (params) => {
                                const res = await apiClient.getShipments(params);
                                setShipments(res);
                            }}
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
                            onCompleteFollowup={handleCompleteFollowup}
                            onOpenCommModal={handleOpenCommModal}
                        />
                    )}

                    {currentPage === 'reports' && (
                        <Reports activeTab={activeSubPage} />
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
                                await apiClient.updateSettings(newSetts);
                                refreshAll();
                            }}
                        />
                    )}
                </main>
            </div>

            {/* Modals & Customer 360 Drawer */}
            <CustomerDrawer 
                isOpen={isDrawerOpen || isDrawerLoading}
                isLoading={isDrawerLoading}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setIsDrawerLoading(false);
                }}
                data={drawerData}
                onOpenCommModal={handleOpenCommModal}
                onPreviewInvoice={setPreviewInvoice}
            />

            <ShipmentModal 
                isOpen={isShipmentModalOpen}
                onClose={() => setIsShipmentModalOpen(false)}
                onCreated={refreshAll}
                settings={settings}
            />

            <CustomerModal 
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onCreated={refreshAll}
            />

            <InvoiceModal 
                isOpen={!!previewInvoice}
                onClose={() => setPreviewInvoice(null)}
                invoice={previewInvoice}
                onPaymentRecorded={refreshAll}
            />

            <ReconciliationModal 
                isOpen={isReconModalOpen}
                onClose={() => setIsReconModalOpen(false)}
                onReconciled={refreshAll}
                settings={settings}
            />

            <WalletRechargeModal 
                isOpen={isWalletModalOpen}
                onClose={() => setIsWalletModalOpen(false)}
                walletName={activeWalletName}
                onRecharged={refreshAll}
                settings={settings}
            />

            <RefundModal 
                isOpen={isRefundModalOpen}
                onClose={() => setIsRefundModalOpen(false)}
                onCreated={refreshAll}
            />

            <CommunicationModal 
                isOpen={isCommModalOpen}
                onClose={() => setIsCommModalOpen(false)}
                customerName={activeCommCustomer}
                onCreated={refreshAll}
                settings={settings}
            />

            <B2BCompanyModal 
                isOpen={isB2BModalOpen}
                onClose={() => setIsB2BModalOpen(false)}
                onCreated={refreshAll}
            />

            <ShipmentStatusModal 
                isOpen={!!selectedStatusShipment}
                onClose={() => setSelectedStatusShipment(null)}
                shipment={selectedStatusShipment}
                onUpdated={refreshAll}
            />

            {/* Enterprise Step-Up MFA Dialog */}
            <StepUpModal />

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
