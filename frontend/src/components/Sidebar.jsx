import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, 
    Users, 
    Package,
    FileText, 
    Wallet, 
    Building2, 
    RotateCcw, 
    Bell, 
    TrendingUp, 
    Clock,
    ShieldCheck, 
    Settings,
    ChevronDown,
    ChevronRight,
    Moon,
    Sun,
    X
} from 'lucide-react';
import { FlyMyCartLogo } from './FlyMyCartLogo';
import { useAuth } from '../context/authSession';

const Sidebar = ({ currentPage, activeSubPage, onNavigate, onSubNavigate, stats, isOpen = false, onClose }) => {
    const { hasPermission } = useAuth();
    const [isAccountsOpen, setIsAccountsOpen] = useState(currentPage === 'accounts');
    const [isReportsOpen, setIsReportsOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    const canViewFinancials = hasPermission('viewFinancials');
    const canViewEod = hasPermission('reports.eod');
    const canViewWeekly = hasPermission('reports.weekly');
    const canViewCustom = hasPermission('reports.custom_range');
    const canViewMonthly = hasPermission('reports.monthly_pnl') && canViewFinancials;
    const canViewReports = hasPermission('reports.view') || canViewEod || canViewWeekly || canViewCustom || canViewMonthly;

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const toggleDarkMode = () => {
        const next = !isDarkMode;
        setIsDarkMode(next);
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    };

    const handleNavigate = (page) => {
        onNavigate?.(page);
        if (window.innerWidth <= 768) {
            onClose?.();
        }
    };

    const handleSubNavigate = (page, sub) => {
        onSubNavigate?.(page, sub);
        if (window.innerWidth <= 768) {
            onClose?.();
        }
    };

    return (
        <>
            {isOpen && <div className="sidebar-mobile-backdrop" onClick={onClose} />}
            <aside id="main-navigation" aria-label="Main navigation" className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            <button type="button" className="sidebar-mobile-close" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
            {/* Top Brand Banner */}
            <div className="sidebar-brand-header">
                <button type="button" className="sidebar-brand-button" aria-label="FlyMyCart dashboard" onClick={() => handleNavigate('dashboard')}>
                    <FlyMyCartLogo height={38} width="100%" theme="dark" />
                </button>
            </div>

            {/* Navigation Menu */}
            <nav className="sidebar-nav-container">
                
                {hasPermission('dashboards.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`}
                        onClick={() => handleNavigate('dashboard')}
                    >
                        <LayoutDashboard size={17} />
                        <span>Dashboard</span>
                        {stats?.today_shipments_count > 0 && (
                            <span className="sidebar-pill-badge">{stats.today_shipments_count}</span>
                        )}
                    </button>
                )}

                {hasPermission('customers.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'customers' ? 'active' : ''}`}
                        onClick={() => handleNavigate('customers')}
                    >
                        <Users size={17} />
                        <span>Customers</span>
                    </button>
                )}

                {hasPermission('shipments.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'shipments' ? 'active' : ''}`}
                        onClick={() => handleNavigate('shipments')}
                    >
                        <Package size={17} />
                        <span>Shipments</span>
                    </button>
                )}

                {hasPermission('invoices.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'invoices' ? 'active' : ''}`}
                        onClick={() => handleNavigate('invoices')}
                    >
                        <FileText size={17} />
                        <span>Invoices</span>
                    </button>
                )}

                {/* Accounts Submenu */}
                {hasPermission('accounts.view') && (
                    <>
                        <button
                            type="button"
                            className={`sidebar-link ${currentPage === 'accounts' ? 'active' : ''}`}
                            onClick={() => {
                                handleNavigate('accounts');
                                setIsAccountsOpen(!isAccountsOpen);
                            }}
                        >
                            <Wallet size={17} />
                            <span>Accounts</span>
                            <span className="menu-chevron">
                                {isAccountsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                        </button>

                        {isAccountsOpen && (
                            <div className="sidebar-submenu">
                                <button type="button" className={`sidebar-sublink ${!activeSubPage || activeSubPage === 'overview' ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'overview')}>Overview</button>
                                <button type="button" className={`sidebar-sublink ${activeSubPage === 'shipment_accounts' ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'shipment_accounts')}>Shipment Accounts</button>
                                <button type="button" className={`sidebar-sublink ${['customer_money', 'collections'].includes(activeSubPage) ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'customer_money')}>
                                    Customer Collections
                                </button>
                                <button type="button" className={`sidebar-sublink ${['prepaid', 'wallets'].includes(activeSubPage) || activeSubPage?.startsWith('wallet-') ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'prepaid')}>Prepaid</button>
                                <button type="button" className={`sidebar-sublink ${activeSubPage === 'postpaid' || activeSubPage?.startsWith('provider-') ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'postpaid')}>Postpaid</button>
                                {[['expenses', 'Expenses'], ['banks', 'Bank Accounts'], ['transfers', 'Account Transfers'], ['b2b', 'B2B Outstanding'], ['refunds', 'Refunds / Adjustments']].map(([section, label]) => (
                                    <button key={section} type="button" className={`sidebar-sublink ${activeSubPage === section ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', section)}>{label}</button>
                                ))}
                                <button type="button" className={`sidebar-sublink ${activeSubPage === 'account_checks' ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'account_checks')}>Receipts &amp; Account Checks</button>
                                <button type="button" className={`sidebar-sublink ${activeSubPage === 'reconciliation' ? 'active' : ''}`} onClick={() => handleSubNavigate('accounts', 'reconciliation')}>
                                    Reconciliation
                                </button>
                            </div>
                        )}
                    </>
                )}

                {hasPermission('b2b.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'b2b' ? 'active' : ''}`}
                        onClick={() => handleNavigate('b2b')}
                    >
                        <Building2 size={17} />
                        <span>B2B / Credit</span>
                        {stats?.b2b_outstanding > 0 && (
                            <span className="sidebar-pill-badge amber">Due</span>
                        )}
                    </button>
                )}

                {hasPermission('refunds.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'refunds' ? 'active' : ''}`}
                        onClick={() => handleNavigate('refunds')}
                    >
                        <RotateCcw size={17} />
                        <span>Refunds</span>
                        {stats?.refunds_pending > 0 && (
                            <span className="sidebar-pill-badge red">{stats.refunds_pending}</span>
                        )}
                    </button>
                )}

                {hasPermission('followups.view') && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'followups' ? 'active' : ''}`}
                        onClick={() => handleNavigate('followups')}
                    >
                        <Bell size={17} />
                        <span>Follow-ups & Communications</span>
                        {stats?.followups_due > 0 && (
                            <span className="sidebar-pill-badge">{stats.followups_due}</span>
                        )}
                    </button>
                )}

                {canViewReports && (
                    <>
                        <button
                            type="button"
                            className={`sidebar-link ${currentPage === 'reports' ? 'active' : ''}`}
                            onClick={() => {
                                handleNavigate('reports');
                                setIsReportsOpen(!isReportsOpen);
                            }}
                        >
                            <TrendingUp size={17} />
                            <span>Reports</span>
                            <span className="menu-chevron">
                                {isReportsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </span>
                        </button>

                        {isReportsOpen && (
                            <div className="sidebar-submenu">
                                {canViewEod && (
                                    <button type="button" className={`sidebar-sublink ${activeSubPage === 'eod' ? 'active' : ''}`} onClick={() => handleSubNavigate('reports', 'eod')}>
                                        EOD Report
                                    </button>
                                )}
                                {canViewWeekly && (
                                    <button type="button" className={`sidebar-sublink ${activeSubPage === 'weekly' ? 'active' : ''}`} onClick={() => handleSubNavigate('reports', 'weekly')}>
                                        Weekly Trends
                                    </button>
                                )}
                                {canViewCustom && (
                                    <button type="button" className={`sidebar-sublink ${activeSubPage === 'custom' ? 'active' : ''}`} onClick={() => handleSubNavigate('reports', 'custom')}>
                                        Custom Date Range
                                    </button>
                                )}
                                {canViewMonthly && (
                                    <button type="button" className={`sidebar-sublink ${activeSubPage === 'monthly' ? 'active' : ''}`} onClick={() => handleSubNavigate('reports', 'monthly')}>
                                        Monthly P&L
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Attendance follows the same read permission as the API. */}
                {hasPermission('attendance.view') && <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'attendance' ? 'active' : ''}`}
                    onClick={() => handleNavigate('attendance')}
                >
                    <Clock size={17} />
                    <span>Attendance</span>
                </button>}

                {(hasPermission('users.view') || hasPermission('users.manage_permissions')) && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'users' ? 'active' : ''}`}
                        onClick={() => handleNavigate('users')}
                    >
                        <ShieldCheck size={17} />
                        <span>Users & Access</span>
                    </button>
                )}

                {(hasPermission('settings.view') || hasPermission('settings.manage')) && (
                    <button
                        type="button"
                        className={`sidebar-link ${currentPage === 'settings' ? 'active' : ''}`}
                        onClick={() => handleNavigate('settings')}
                    >
                        <Settings size={17} />
                        <span>Settings</span>
                    </button>
                )}

            </nav>

            {/* Sidebar Bottom Footer */}
            <div className="sidebar-footer-card">
                <div className="sidebar-theme-toggle" onClick={toggleDarkMode}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isDarkMode ? <Moon size={13} color="#38bdf8" /> : <Sun size={13} color="#f59e0b" />}
                        <span style={{ fontSize: '11.5px', fontWeight: 600 }}>{isDarkMode ? 'Dark' : 'Light'}</span>
                    </div>
                    <span className="theme-pill-status">{isDarkMode ? 'ON' : 'OFF'}</span>
                </div>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
