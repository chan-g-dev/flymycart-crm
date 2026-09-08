import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, 
    MapPin, 
    Calendar, 
    Plus, 
    Bell, 
    ShieldCheck, 
    Package, 
    Users, 
    FileText, 
    Wallet,
    Building2,
    RotateCcw,
    TrendingUp,
    Settings as SettingsIcon,
    ArrowUpRight,
    X,
    LogOut,
    Menu,
    Command,
    Sparkles,
    CheckCircle2,
    SlidersHorizontal,
    Boxes,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { navigate } from '../utils/navigation';

const PAGE_CONFIG = {
    dashboard: { 
        title: 'Executive Dashboard', 
        subtitle: 'Real-time overview of courier bookings, collections & P&L',
        icon: TrendingUp,
        color: '#1e64f0'
    },
    'booking-requests': {
        title: 'Booking Requests & Quotes',
        subtitle: 'Review customer booking submissions, issue quotes & convert to shipments',
        icon: Boxes,
        color: '#f59e0b'
    },
    customers: { 
        title: 'Customer 360° Directory', 
        subtitle: 'Permanent customer profiles & booking ledgers',
        icon: Users,
        color: '#8b5cf6'
    },
    shipments: { 
        title: 'Shipment Master Engine', 
        subtitle: 'Single-entry bookings, volumetric calculation & tracking',
        icon: Package,
        color: '#0284c7'
    },
    invoices: { 
        title: 'Invoices & Billing', 
        subtitle: 'Auto-generated GST tax invoices & receipts',
        icon: FileText,
        color: '#10b981'
    },
    accounts: { 
        title: 'Accounts & Wallets', 
        subtitle: 'Collections, Prepaid wallets & Postpaid ledgers',
        icon: Wallet,
        color: '#f59e0b'
    },
    b2b: { 
        title: 'B2B Corporate Credit', 
        subtitle: 'Credit limits, payment terms & aging receivables',
        icon: Building2,
        color: '#6366f1'
    },
    refunds: { 
        title: 'Refunds & Disputes', 
        subtitle: '5-state lifecycle management & approvals',
        icon: RotateCcw,
        color: '#ef4444'
    },
    followups: { 
        title: 'Follow-ups & Retention', 
        subtitle: 'Retention alerts, invoice reminders & call logs',
        icon: Bell,
        color: '#ec4899'
    },
    reports: { 
        title: 'Reports & Business P&L', 
        subtitle: 'EOD operations, Weekly & Monthly business P&L',
        icon: TrendingUp,
        color: '#06b6d4'
    },
    users: { 
        title: 'Users & Permissions', 
        subtitle: 'Role-based access matrix & staff approvals',
        icon: ShieldCheck,
        color: '#14b8a6'
    },
    settings: { 
        title: 'System Settings', 
        subtitle: 'Couriers, centers, wallets, banks & GST rates',
        icon: SettingsIcon,
        color: '#64748b'
    }
};

const Topbar = ({ 
    currentPage = 'dashboard', 
    onOpenShipmentModal,
    onOpenCustomerDrawer,
    onPreviewInvoice,
    onNavigate,
    settings,
    pendingStaffCount = 0,
    onToggleSidebar,
    selectedCenter = 'All Centers',
    onSelectCenter,
    isSyncing = false
}) => {
    const { currentUser, currentRole, hasPermission, logout, switchUserRole } = useAuth();
    const pageMeta = PAGE_CONFIG[currentPage] || PAGE_CONFIG.dashboard;
    const PageIcon = pageMeta.icon;

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);
    const searchInputRef = useRef(null);
    const roleRef = useRef(null);

    // Dropdown state
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

    const centersList = ['All Centers', ...(settings?.centers || ['Main Hub (Bangalore)', 'Delhi Regional Hub', 'Mumbai Branch', 'Hyderabad Hub', 'Kolkata Center'])];

    // Global keyboard shortcut (Ctrl + K or / to focus search)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === '/' && document.activeElement !== searchInputRef.current && !['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'Escape') {
                setShowResults(false);
                setIsRoleDropdownOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Global Search debounced effect
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults(null);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await apiClient.globalSearch(searchQuery.trim());
                setSearchResults(res);
                setShowResults(true);
            } catch (err) {
                console.error('Global search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 220);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowResults(false);
            }
            if (roleRef.current && !roleRef.current.contains(e.target)) {
                setIsRoleDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="fmc-topbar-root">
            <div className="fmc-topbar-inner">
                {/* 1. Left Section: Mobile Menu + Dynamic Page Title */}
                <div className="fmc-topbar-left">
                    {onToggleSidebar && (
                        <button 
                            className="fmc-topbar-menu-btn" 
                            onClick={onToggleSidebar}
                            title="Toggle Navigation Menu"
                            aria-label="Toggle Sidebar"
                        >
                            <Menu size={18} />
                        </button>
                    )}

                    <div className="fmc-page-icon-badge" style={{ background: '#f8fafc', color: '#334155', borderColor: '#e2e8f0' }}>
                        <PageIcon size={15} />
                    </div>

                    <div className="fmc-page-title-box">
                        <div className="fmc-page-title-row">
                            <h1 className="fmc-page-title-heading">{pageMeta.title}</h1>
                            <span className="fmc-live-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }} title={isSyncing ? 'Real-time database synchronizing...' : 'Live socket connected'}>
                                {isSyncing ? (
                                    <RefreshCw size={9} className="fmc-spin-icon" style={{ color: '#0284c7' }} />
                                ) : (
                                    <span className="fmc-live-dot" />
                                )}
                                <span style={{ fontSize: '10px' }}>{isSyncing ? 'SYNCING' : 'LIVE'}</span>
                            </span>
                        </div>
                        <p className="fmc-page-subtitle-text">{pageMeta.subtitle}</p>
                    </div>
                </div>

                {/* 2. Middle Section: Global Search Bar */}
                <div className="fmc-topbar-search-container" ref={searchRef}>
                    <div className={`fmc-search-input-wrapper ${showResults ? 'fmc-search-active' : ''}`}>
                        <Search size={14} className="fmc-search-icon" />
                        <input 
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search AWB, Customer, Phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => { if (searchResults) setShowResults(true); }}
                            className="fmc-search-input"
                        />
                        {isSearching ? (
                            <div className="fmc-search-spinner" />
                        ) : searchQuery ? (
                            <button 
                                onClick={() => { setSearchQuery(''); setSearchResults(null); setShowResults(false); }}
                                className="fmc-search-clear-btn"
                                title="Clear search"
                            >
                                <X size={12} />
                            </button>
                        ) : (
                            <div className="fmc-search-kbd-hint">
                                <Command size={10} style={{ marginRight: '1px' }} /> K
                            </div>
                        )}
                    </div>

                    {/* Instant Search Results Dropdown */}
                    {showResults && searchResults && (
                        <div className="fmc-search-dropdown-menu">
                            {/* Shipments Results */}
                            {searchResults.shipments?.length > 0 && (
                                <div className="fmc-search-group">
                                    <div className="fmc-search-group-header">
                                        <Package size={12} />
                                        <span>Shipments ({searchResults.shipments.length})</span>
                                    </div>
                                    {searchResults.shipments.map(s => (
                                        <div 
                                            key={s.id}
                                            onClick={() => {
                                                setShowResults(false);
                                                onNavigate('shipments');
                                            }}
                                            className="fmc-search-result-row"
                                        >
                                            <div className="fmc-search-row-main">
                                                <span className="fmc-awb-code">{s.awb}</span>
                                                <span className="fmc-search-name">{s.customer_name}</span>
                                                <span className="fmc-search-dest">&rarr; {s.destination}</span>
                                            </div>
                                            <div className="fmc-search-row-badges">
                                                <span className="fmc-badge-courier">{s.courier}</span>
                                                <span className={`status-pill ${s.status === 'Delivered' ? 'delivered' : 'in-transit'}`}>
                                                    {s.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Customers Results */}
                            {searchResults.customers?.length > 0 && (
                                <div className="fmc-search-group">
                                    <div className="fmc-search-group-header">
                                        <Users size={12} />
                                        <span>Customers ({searchResults.customers.length})</span>
                                    </div>
                                    {searchResults.customers.map(c => (
                                        <div 
                                            key={c.id}
                                            onClick={() => {
                                                setShowResults(false);
                                                onOpenCustomerDrawer(c.id);
                                            }}
                                            className="fmc-search-result-row"
                                        >
                                            <div className="fmc-search-row-main">
                                                <span className="fmc-search-name">{c.name}</span>
                                                {c.company && <span className="fmc-search-comp">({c.company})</span>}
                                                <div className="fmc-search-subinfo">📱 {c.mobile} • {c.center}</div>
                                            </div>
                                            <button className="btn-action-360">
                                                360° Profile <ArrowUpRight size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Invoices Results */}
                            {searchResults.invoices?.length > 0 && (
                                <div className="fmc-search-group">
                                    <div className="fmc-search-group-header">
                                        <FileText size={12} />
                                        <span>Invoices ({searchResults.invoices.length})</span>
                                    </div>
                                    {searchResults.invoices.map(i => (
                                        <div 
                                            key={i.id}
                                            onClick={() => {
                                                setShowResults(false);
                                                onPreviewInvoice(i);
                                            }}
                                            className="fmc-search-result-row"
                                        >
                                            <div className="fmc-search-row-main">
                                                <span className="fmc-awb-code">{i.invoice_no}</span>
                                                <span className="fmc-search-name">{i.customer_name}</span>
                                            </div>
                                            <div className="fmc-search-row-badges">
                                                <strong className="fmc-invoice-amount">₹{Number(i.total).toLocaleString('en-IN')}</strong>
                                                <span className={`status-pill ${i.status === 'Paid' ? 'delivered' : 'delayed'}`}>
                                                    {i.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {searchResults.shipments?.length === 0 && searchResults.customers?.length === 0 && searchResults.invoices?.length === 0 && (
                                <div className="fmc-search-empty">
                                    No records found matching "{searchQuery}"
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Right Section: Hub Selector, Date, Quick Action, Profile */}
                <div className="fmc-topbar-right">
                    {/* Operating Center Hub Selector */}
                    <div className="fmc-hub-selector-pill" title="Filter Operations Center">
                        <MapPin size={13} className="fmc-hub-icon" />
                        <select 
                            value={selectedCenter} 
                            onChange={(e) => onSelectCenter && onSelectCenter(e.target.value)}
                            className="fmc-hub-select"
                        >
                            {centersList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Today's Date Pill */}
                    <div className="fmc-date-pill" title="Today's Operational Date">
                        <Calendar size={13} className="fmc-date-icon" />
                        <span className="fmc-date-text">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </div>



                    {/* New Shipment Action Button */}
                    {hasPermission('addShipment') && (
                        <button 
                            type="button"
                            className="fmc-new-shipment-btn" 
                            onClick={onOpenShipmentModal}
                            title="Create new international or domestic booking (Single Entry)"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            <span className="fmc-btn-label">New Shipment</span>
                        </button>
                    )}


                    {/* Executive User Profile Badge & Dropdown */}
                    <div className="fmc-user-badge-wrapper" ref={roleRef}>
                        <button 
                            type="button"
                            className={`fmc-user-badge-btn ${isRoleDropdownOpen ? 'fmc-badge-active' : ''}`}
                            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                            title="Account Profile & Session"
                        >
                            <div className="fmc-avatar-frame">
                                <span className="fmc-avatar-emoji">{currentUser?.avatar || '👑'}</span>
                                <span className="fmc-online-indicator" />
                            </div>
                            <div className="fmc-user-text-col">
                                <span className="fmc-user-fullname">{currentUser?.name || 'Administrator'}</span>
                                <span className="fmc-user-role-tag">{currentRole?.name || 'Super Admin'}</span>
                            </div>
                        </button>

                        {/* Interactive Profile / Account Dropdown */}
                        {isRoleDropdownOpen && (
                            <div className="fmc-profile-dropdown-card">
                                <div className="fmc-dropdown-header">
                                    <div className="fmc-dropdown-avatar">
                                        {currentUser?.avatar || '👑'}
                                    </div>
                                    <div className="fmc-dropdown-user-meta">
                                        <div className="fmc-dropdown-name">{currentUser?.name}</div>
                                        <div className="fmc-dropdown-email">{currentUser?.email}</div>
                                    </div>
                                </div>

                                <div className="fmc-dropdown-body">
                                    <div className="fmc-dropdown-stat-row">
                                        <span className="fmc-stat-label">Security Role</span>
                                        <span className="fmc-stat-role-pill">{currentRole?.name}</span>
                                    </div>
                                    <div className="fmc-dropdown-stat-row">
                                        <span className="fmc-stat-label">Session Status</span>
                                        <span className="fmc-stat-verified">
                                            <CheckCircle2 size={11} /> Verified Live
                                        </span>
                                    </div>
                                    <div className="fmc-dropdown-stat-row">
                                        <span className="fmc-stat-label">Current Hub</span>
                                        <span className="fmc-stat-value">{currentUser?.center || 'Main Hub (Bangalore)'}</span>
                                    </div>
                                </div>

                                <div className="fmc-dropdown-footer">
                                     <button
                                         type="button"
                                         onClick={() => {
                                             setIsRoleDropdownOpen(false);
                                             navigate('/login');
                                             logout();
                                         }}
                                         className="fmc-signout-btn"
                                     >
                                         <LogOut size={13} />
                                         <span>Sign Out Session</span>
                                     </button>
                                 </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Topbar;
