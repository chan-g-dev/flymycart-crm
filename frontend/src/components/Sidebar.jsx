import React, { useState } from 'react';
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
    ShieldCheck, 
    Settings,
    ChevronDown,
    ChevronRight,
    Moon,
    Sun
} from 'lucide-react';
import { FlyMyCartLogo } from './FlyMyCartLogo';

const Sidebar = ({ currentPage, activeSubPage, onNavigate, onSubNavigate, stats, isOpen = false, onClose }) => {
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);
    const [isReportsOpen, setIsReportsOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    const toggleDarkMode = () => {
        const next = !isDarkMode;
        setIsDarkMode(next);
        document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    };

    return (
        <>
            {isOpen && <div className="sidebar-mobile-backdrop" onClick={onClose} />}
            <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            {/* Top Brand Banner */}
            <div className="sidebar-brand-header">
                <FlyMyCartLogo height={38} width="100%" theme="dark" />
            </div>

            {/* Navigation Menu */}
            <nav className="sidebar-nav-container">
                
                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`}
                    onClick={() => onNavigate('dashboard')}
                >
                    <LayoutDashboard size={17} />
                    <span>Dashboard</span>
                    {stats?.today_shipments_count > 0 && (
                        <span className="sidebar-pill-badge">{stats.today_shipments_count}</span>
                    )}
                </button>


                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'customers' ? 'active' : ''}`}
                    onClick={() => onNavigate('customers')}
                >
                    <Users size={17} />
                    <span>Customers</span>
                </button>

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'shipments' ? 'active' : ''}`}
                    onClick={() => onNavigate('shipments')}
                >
                    <Package size={17} />
                    <span>Shipments</span>
                </button>

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'invoices' ? 'active' : ''}`}
                    onClick={() => onNavigate('invoices')}
                >
                    <FileText size={17} />
                    <span>Invoices</span>
                </button>

                {/* Accounts Submenu */}
                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'accounts' ? 'active' : ''}`}
                    onClick={() => {
                        onNavigate('accounts');
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
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'customer_money' ? 'active' : ''}`} onClick={() => onSubNavigate('accounts', 'customer_money')}>
                            Customer Collections
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'icl_wallet' ? 'active' : ''}`} onClick={() => onSubNavigate('accounts', 'icl_wallet')}>
                            ICL Wallet
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'brv_wallet' ? 'active' : ''}`} onClick={() => onSubNavigate('accounts', 'brv_wallet')}>
                            BRV Wallet
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'aramex_account' ? 'active' : ''}`} onClick={() => onSubNavigate('accounts', 'aramex_account')}>
                            Aramex Account
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'bluedart_account' ? 'active' : ''}`} onClick={() => onSubNavigate('accounts', 'bluedart_account')}>
                            Blue Dart Account
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'reconciliation' ? 'active' : ''}`} onClick={() => onSubNavigate('accounts', 'reconciliation')}>
                            Reconciliation
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'b2b' ? 'active' : ''}`}
                    onClick={() => onNavigate('b2b')}
                >
                    <Building2 size={17} />
                    <span>B2B / Credit</span>
                    {stats?.b2b_outstanding > 0 && (
                        <span className="sidebar-pill-badge amber">Due</span>
                    )}
                </button>

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'refunds' ? 'active' : ''}`}
                    onClick={() => onNavigate('refunds')}
                >
                    <RotateCcw size={17} />
                    <span>Refunds</span>
                    {stats?.refunds_pending > 0 && (
                        <span className="sidebar-pill-badge red">{stats.refunds_pending}</span>
                    )}
                </button>

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'followups' ? 'active' : ''}`}
                    onClick={() => onNavigate('followups')}
                >
                    <Bell size={17} />
                    <span>Follow-ups & Communications</span>
                    {stats?.followups_due > 0 && (
                        <span className="sidebar-pill-badge">{stats.followups_due}</span>
                    )}
                </button>

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'reports' ? 'active' : ''}`}
                    onClick={() => {
                        onNavigate('reports');
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
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'eod' ? 'active' : ''}`} onClick={() => onSubNavigate('reports', 'eod')}>
                            EOD Report
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'weekly' ? 'active' : ''}`} onClick={() => onSubNavigate('reports', 'weekly')}>
                            Weekly Trends
                        </button>
                        <button type="button" className={`sidebar-sublink ${activeSubPage === 'monthly' ? 'active' : ''}`} onClick={() => onSubNavigate('reports', 'monthly')}>
                            Monthly P&L
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'users' ? 'active' : ''}`}
                    onClick={() => onNavigate('users')}
                >
                    <ShieldCheck size={17} />
                    <span>Users & Access</span>
                </button>

                <button
                    type="button"
                    className={`sidebar-link ${currentPage === 'settings' ? 'active' : ''}`}
                    onClick={() => onNavigate('settings')}
                >
                    <Settings size={17} />
                    <span>Settings</span>
                </button>

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
