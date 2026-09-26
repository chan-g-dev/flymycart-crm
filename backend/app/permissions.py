# ================================================================
# FLY MY CART CRM - PERMISSION CATALOG & RBAC CONSTANTS
# ================================================================
"""
Standardized permission definitions following OWASP authorization guidance.
All permissions use `resource.action` format for consistency and scalability.
"""

from enum import Enum
from typing import List, Dict

# Permission Codes (resource.action format)
class PermissionCode(str, Enum):
    # Customers
    CUSTOMERS_VIEW = "customers.view"
    CUSTOMERS_ADD = "customers.add"
    CUSTOMERS_EDIT = "customers.edit"
    CUSTOMERS_DELETE = "customers.delete"
    CUSTOMERS_EXPORT = "customers.export"
    CUSTOMERS_STATEMENT = "customers.statement"

    # Shipments
    SHIPMENTS_VIEW = "shipments.view"
    SHIPMENTS_ADD = "shipments.add"
    SHIPMENTS_EDIT = "shipments.edit"
    SHIPMENTS_DELETE = "shipments.delete"
    SHIPMENTS_CANCEL = "shipments.cancel"
    SHIPMENTS_EXPORT = "shipments.export"

    # Invoices
    INVOICES_VIEW = "invoices.view"
    INVOICES_ADD = "invoices.add"
    INVOICES_EDIT = "invoices.edit"
    INVOICES_EXPORT = "invoices.export"
    INVOICES_PRINT = "invoices.print"

    # Accounts
    ACCOUNTS_VIEW = "accounts.view"
    ACCOUNTS_EDIT = "accounts.edit"
    ACCOUNTS_RECONCILE = "accounts.reconcile"
    ACCOUNTS_EXPORT = "accounts.export"

    # Refunds
    REFUNDS_VIEW = "refunds.view"
    REFUNDS_REQUEST = "refunds.request"
    REFUNDS_APPROVE = "refunds.approve"
    REFUNDS_PROCESS = "refunds.process"

    # Reports
    REPORTS_VIEW = "reports.view"
    REPORTS_EOD = "reports.eod"
    REPORTS_WEEKLY = "reports.weekly"
    REPORTS_CUSTOM_RANGE = "reports.custom_range"
    REPORTS_MONTHLY_PNL = "reports.monthly_pnl"
    REPORTS_PRINT = "reports.print"
    REPORTS_VIEW_FINANCIAL = "reports.view_financial"
    REPORTS_EXPORT = "reports.export"

    # B2B
    B2B_VIEW = "b2b.view"
    B2B_ADD = "b2b.add"
    B2B_EDIT = "b2b.edit"
    B2B_MANAGE_CREDIT = "b2b.manage_credit"
    B2B_EXPORT = "b2b.export"

    # Users & Access Control
    USERS_VIEW = "users.view"
    USERS_INVITE = "users.invite"
    USERS_EDIT = "users.edit"
    USERS_SUSPEND = "users.suspend"
    USERS_MANAGE_PERMISSIONS = "users.manage_permissions"

    # Settings
    SETTINGS_VIEW = "settings.view"
    SETTINGS_MANAGE = "settings.manage"

    # Reconciliation
    RECONCILIATION_VIEW = "reconciliation.view"
    RECONCILIATION_RUN = "reconciliation.run"

    # Followups
    FOLLOWUPS_VIEW = "followups.view"
    FOLLOWUPS_ADD = "followups.add"
    FOLLOWUPS_EDIT = "followups.edit"

    # Search
    SEARCH_GLOBAL = "search.global"

    # Dashboard Widgets
    DASHBOARDS_VIEW = "dashboards.view"
    DASHBOARDS_BOOKING_TRENDS = "dashboards.booking_trends"
    DASHBOARDS_RECENT_BOOKINGS = "dashboards.recent_bookings"
    DASHBOARDS_FLEET_VOLUME = "dashboards.fleet_volume"
    DASHBOARDS_ACCOUNTS_SNAPSHOT = "dashboards.accounts_snapshot"
    DASHBOARDS_FINANCIAL_ANALYTICS = "dashboards.financial_analytics"
    DASHBOARDS_FOLLOWUPS = "dashboards.followups"
    DASHBOARDS_QUICK_ACTIONS = "dashboards.quick_actions"

    # Attendance
    ATTENDANCE_VIEW = "attendance.view"
    ATTENDANCE_MANAGE = "attendance.manage"
    ATTENDANCE_PUNCH = "attendance.punch"
    ATTENDANCE_LEAVE = "attendance.leave"

    # Costs & Financials
    COSTS_CUSTOMER_PRICE = "costs.customer_price"
    COSTS_CARRIER_COST = "costs.carrier_cost"
    COSTS_NET_VALUE = "costs.net_value"
    COSTS_MARGINS = "costs.margins"
    COSTS_VIEW = "costs.view"


# Data Scopes (geographic/organizational boundaries)
class DataScope(str, Enum):
    """Scope hierarchy: OWN < SELECTED_CENTERS < ALL_CENTERS"""
    OWN_CENTER = "own"  # User's assigned center only
    SELECTED_CENTERS = "center"  # Multiple assigned centers
    ALL_CENTERS = "all"  # All centers in organization


# Financial Permissions (require MFA)
FINANCIAL_PERMISSIONS = {
    PermissionCode.REFUNDS_APPROVE,
    PermissionCode.REFUNDS_PROCESS,
    PermissionCode.ACCOUNTS_EDIT,
    PermissionCode.ACCOUNTS_RECONCILE,
    PermissionCode.REPORTS_VIEW_FINANCIAL,
    PermissionCode.REPORTS_MONTHLY_PNL,
    PermissionCode.COSTS_CUSTOMER_PRICE,
    PermissionCode.COSTS_CARRIER_COST,
    PermissionCode.COSTS_NET_VALUE,
    PermissionCode.COSTS_MARGINS,
    PermissionCode.COSTS_VIEW,
    PermissionCode.DASHBOARDS_ACCOUNTS_SNAPSHOT,
    PermissionCode.DASHBOARDS_FINANCIAL_ANALYTICS,
    PermissionCode.REPORTS_EXPORT,
    PermissionCode.B2B_MANAGE_CREDIT,
    PermissionCode.SETTINGS_MANAGE,
}

# Sensitive Operations (require recent MFA within max_age_minutes)
SENSITIVE_OPERATIONS = {
    "approve_refund": {"permission": PermissionCode.REFUNDS_APPROVE, "mfa_minutes": 10},
    "process_refund": {"permission": PermissionCode.REFUNDS_PROCESS, "mfa_minutes": 10},
    "edit_accounts": {"permission": PermissionCode.ACCOUNTS_EDIT, "mfa_minutes": 10},
    "reconcile_accounts": {"permission": PermissionCode.ACCOUNTS_RECONCILE, "mfa_minutes": 10},
    "manage_permissions": {"permission": PermissionCode.USERS_MANAGE_PERMISSIONS, "mfa_minutes": 5},
    "suspend_user": {"permission": PermissionCode.USERS_SUSPEND, "mfa_minutes": 5},
    "manage_settings": {"permission": PermissionCode.SETTINGS_MANAGE, "mfa_minutes": 10},
    "export_financial": {"permission": PermissionCode.REPORTS_EXPORT, "mfa_minutes": 10},
}

# Default Role Permissions (can be overridden in database)
DEFAULT_ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "SUPER_ADMIN": [
        # Super admins have all permissions
        "*",
    ],
    "manager": [
        p.value for p in PermissionCode if p not in (PermissionCode.COSTS_NET_VALUE, PermissionCode.COSTS_MARGINS, PermissionCode.REPORTS_VIEW_FINANCIAL)
    ],
    "supervisor": [
        PermissionCode.DASHBOARDS_VIEW, PermissionCode.DASHBOARDS_BOOKING_TRENDS, PermissionCode.DASHBOARDS_RECENT_BOOKINGS,
        PermissionCode.DASHBOARDS_FLEET_VOLUME, PermissionCode.DASHBOARDS_FOLLOWUPS, PermissionCode.DASHBOARDS_QUICK_ACTIONS,
        PermissionCode.ATTENDANCE_VIEW, PermissionCode.ATTENDANCE_PUNCH,
        PermissionCode.USERS_VIEW, PermissionCode.CUSTOMERS_VIEW, PermissionCode.CUSTOMERS_ADD, PermissionCode.CUSTOMERS_EDIT, PermissionCode.CUSTOMERS_EXPORT,
        PermissionCode.SHIPMENTS_VIEW, PermissionCode.SHIPMENTS_ADD, PermissionCode.SHIPMENTS_EDIT, PermissionCode.SHIPMENTS_CANCEL, PermissionCode.SHIPMENTS_EXPORT,
        PermissionCode.INVOICES_VIEW, PermissionCode.INVOICES_ADD, PermissionCode.INVOICES_EDIT, PermissionCode.INVOICES_EXPORT, PermissionCode.INVOICES_PRINT,
        PermissionCode.ACCOUNTS_VIEW, PermissionCode.ACCOUNTS_RECONCILE, PermissionCode.REFUNDS_VIEW, PermissionCode.REFUNDS_REQUEST, PermissionCode.REFUNDS_APPROVE,
        PermissionCode.REPORTS_VIEW, PermissionCode.REPORTS_EOD, PermissionCode.REPORTS_WEEKLY, PermissionCode.REPORTS_CUSTOM_RANGE, PermissionCode.REPORTS_PRINT, PermissionCode.REPORTS_EXPORT,
        PermissionCode.B2B_VIEW, PermissionCode.B2B_ADD, PermissionCode.B2B_EDIT, PermissionCode.FOLLOWUPS_VIEW, PermissionCode.FOLLOWUPS_ADD, PermissionCode.FOLLOWUPS_EDIT,
        PermissionCode.SEARCH_GLOBAL, PermissionCode.SETTINGS_VIEW, PermissionCode.RECONCILIATION_VIEW,
    ],
    "account_executive": [
        PermissionCode.DASHBOARDS_VIEW, PermissionCode.DASHBOARDS_BOOKING_TRENDS, PermissionCode.DASHBOARDS_RECENT_BOOKINGS,
        PermissionCode.DASHBOARDS_FLEET_VOLUME, PermissionCode.DASHBOARDS_ACCOUNTS_SNAPSHOT, PermissionCode.DASHBOARDS_FINANCIAL_ANALYTICS,
        PermissionCode.DASHBOARDS_FOLLOWUPS, PermissionCode.DASHBOARDS_QUICK_ACTIONS,
        PermissionCode.ATTENDANCE_VIEW, PermissionCode.ATTENDANCE_PUNCH,
        PermissionCode.CUSTOMERS_VIEW, PermissionCode.CUSTOMERS_ADD, PermissionCode.CUSTOMERS_EDIT, PermissionCode.CUSTOMERS_EXPORT,
        PermissionCode.SHIPMENTS_VIEW, PermissionCode.SHIPMENTS_ADD, PermissionCode.SHIPMENTS_EDIT, PermissionCode.SHIPMENTS_CANCEL, PermissionCode.SHIPMENTS_EXPORT,
        PermissionCode.INVOICES_VIEW, PermissionCode.INVOICES_ADD, PermissionCode.INVOICES_EDIT, PermissionCode.INVOICES_EXPORT, PermissionCode.INVOICES_PRINT,
        PermissionCode.ACCOUNTS_VIEW, PermissionCode.ACCOUNTS_EDIT, PermissionCode.ACCOUNTS_RECONCILE, PermissionCode.ACCOUNTS_EXPORT,
        PermissionCode.REFUNDS_VIEW, PermissionCode.REFUNDS_REQUEST,
        PermissionCode.REPORTS_VIEW, PermissionCode.REPORTS_EOD, PermissionCode.REPORTS_WEEKLY, PermissionCode.REPORTS_EXPORT,
        PermissionCode.B2B_VIEW, PermissionCode.B2B_ADD, PermissionCode.B2B_EDIT, PermissionCode.B2B_MANAGE_CREDIT, PermissionCode.B2B_EXPORT,
        PermissionCode.FOLLOWUPS_VIEW, PermissionCode.FOLLOWUPS_ADD, PermissionCode.FOLLOWUPS_EDIT, PermissionCode.SEARCH_GLOBAL, PermissionCode.RECONCILIATION_VIEW,
    ],
    "operation_executive": [
        PermissionCode.DASHBOARDS_VIEW, PermissionCode.DASHBOARDS_BOOKING_TRENDS, PermissionCode.DASHBOARDS_RECENT_BOOKINGS,
        PermissionCode.DASHBOARDS_FLEET_VOLUME, PermissionCode.DASHBOARDS_FOLLOWUPS, PermissionCode.DASHBOARDS_QUICK_ACTIONS,
        PermissionCode.ATTENDANCE_VIEW, PermissionCode.ATTENDANCE_PUNCH,
        PermissionCode.CUSTOMERS_VIEW, PermissionCode.CUSTOMERS_ADD, PermissionCode.CUSTOMERS_EDIT,
        PermissionCode.SHIPMENTS_VIEW, PermissionCode.SHIPMENTS_ADD, PermissionCode.SHIPMENTS_EDIT, PermissionCode.SHIPMENTS_CANCEL, PermissionCode.SHIPMENTS_EXPORT,
        PermissionCode.INVOICES_VIEW, PermissionCode.INVOICES_ADD, PermissionCode.INVOICES_EDIT, PermissionCode.INVOICES_PRINT,
        PermissionCode.REFUNDS_VIEW, PermissionCode.REFUNDS_REQUEST,
        PermissionCode.REPORTS_VIEW, PermissionCode.REPORTS_EOD, PermissionCode.REPORTS_WEEKLY, PermissionCode.REPORTS_PRINT, PermissionCode.REPORTS_EXPORT,
        PermissionCode.FOLLOWUPS_VIEW, PermissionCode.FOLLOWUPS_ADD, PermissionCode.FOLLOWUPS_EDIT, PermissionCode.SEARCH_GLOBAL, PermissionCode.RECONCILIATION_VIEW,
    ],
    "operations_executive": [
        PermissionCode.DASHBOARDS_VIEW, PermissionCode.DASHBOARDS_BOOKING_TRENDS, PermissionCode.DASHBOARDS_RECENT_BOOKINGS,
        PermissionCode.DASHBOARDS_FLEET_VOLUME, PermissionCode.DASHBOARDS_FOLLOWUPS, PermissionCode.DASHBOARDS_QUICK_ACTIONS,
        PermissionCode.ATTENDANCE_VIEW, PermissionCode.ATTENDANCE_PUNCH,
        PermissionCode.CUSTOMERS_VIEW, PermissionCode.CUSTOMERS_ADD, PermissionCode.CUSTOMERS_EDIT,
        PermissionCode.SHIPMENTS_VIEW, PermissionCode.SHIPMENTS_ADD, PermissionCode.SHIPMENTS_EDIT, PermissionCode.SHIPMENTS_CANCEL, PermissionCode.SHIPMENTS_EXPORT,
        PermissionCode.INVOICES_VIEW, PermissionCode.INVOICES_ADD, PermissionCode.INVOICES_EDIT, PermissionCode.INVOICES_PRINT,
        PermissionCode.REFUNDS_VIEW, PermissionCode.REFUNDS_REQUEST,
        PermissionCode.REPORTS_VIEW, PermissionCode.REPORTS_EOD, PermissionCode.REPORTS_WEEKLY, PermissionCode.REPORTS_PRINT, PermissionCode.REPORTS_EXPORT,
        PermissionCode.FOLLOWUPS_VIEW, PermissionCode.FOLLOWUPS_ADD, PermissionCode.FOLLOWUPS_EDIT, PermissionCode.SEARCH_GLOBAL, PermissionCode.RECONCILIATION_VIEW,
    ],
    "operations_staff": [
        # Attendance (punch & personal view)
        PermissionCode.ATTENDANCE_VIEW,
        PermissionCode.ATTENDANCE_PUNCH,
        # Users & Directory (read-only view)
        PermissionCode.USERS_VIEW,
        # Customers (no delete)
        PermissionCode.CUSTOMERS_VIEW,
        PermissionCode.CUSTOMERS_ADD,
        PermissionCode.CUSTOMERS_EDIT,
        # Shipments (no cancel)
        PermissionCode.SHIPMENTS_VIEW,
        PermissionCode.SHIPMENTS_ADD,
        PermissionCode.SHIPMENTS_EDIT,
        # Invoices (read-only)
        PermissionCode.INVOICES_VIEW,
        # Accounts (view only)
        PermissionCode.ACCOUNTS_VIEW,
        # Refunds (can request, not approve)
        PermissionCode.REFUNDS_VIEW,
        PermissionCode.REFUNDS_REQUEST,
        # Reports (non-financial)
        PermissionCode.REPORTS_VIEW,
        # B2B (view only)
        PermissionCode.B2B_VIEW,
        # Followups
        PermissionCode.FOLLOWUPS_VIEW,
        PermissionCode.FOLLOWUPS_ADD,
        PermissionCode.FOLLOWUPS_EDIT,
        # Search
        PermissionCode.SEARCH_GLOBAL,
        # Settings (read-only)
        PermissionCode.SETTINGS_VIEW,
    ],
    "accounts_staff": [
        # Attendance (punch & personal view)
        PermissionCode.ATTENDANCE_VIEW,
        PermissionCode.ATTENDANCE_PUNCH,
        # Customers (view only)
        PermissionCode.CUSTOMERS_VIEW,
        # Shipments (view only)
        PermissionCode.SHIPMENTS_VIEW,
        # Invoices
        PermissionCode.INVOICES_VIEW,
        # Accounts (full access)
        PermissionCode.ACCOUNTS_VIEW,
        # Refunds (view only, can't approve)
        PermissionCode.REFUNDS_VIEW,
        # Reports
        PermissionCode.REPORTS_VIEW,
        # Search
        PermissionCode.SEARCH_GLOBAL,
    ],
    "counter_staff": [
        # Attendance (punch & personal view)
        PermissionCode.ATTENDANCE_VIEW,
        PermissionCode.ATTENDANCE_PUNCH,
        # Customers (minimal)
        PermissionCode.CUSTOMERS_VIEW,
        # Shipments (can view/add)
        PermissionCode.SHIPMENTS_VIEW,
        PermissionCode.SHIPMENTS_ADD,
        # Invoices (view)
        PermissionCode.INVOICES_VIEW,
        # Refunds (view, request)
        PermissionCode.REFUNDS_VIEW,
        PermissionCode.REFUNDS_REQUEST,
        # Reports (basic)
        PermissionCode.REPORTS_VIEW,
        # Search
        PermissionCode.SEARCH_GLOBAL,
    ],
    "viewer": [
        # Attendance
        PermissionCode.ATTENDANCE_VIEW,
        PermissionCode.ATTENDANCE_PUNCH,
        # Read-only access
        PermissionCode.CUSTOMERS_VIEW,
        PermissionCode.SHIPMENTS_VIEW,
        PermissionCode.INVOICES_VIEW,
        PermissionCode.ACCOUNTS_VIEW,
        PermissionCode.REFUNDS_VIEW,
        PermissionCode.REPORTS_VIEW,
        PermissionCode.B2B_VIEW,
        PermissionCode.FOLLOWUPS_VIEW,
        PermissionCode.SEARCH_GLOBAL,
    ],
}


def get_permissions_for_role(role_name: str) -> List[str]:
    """Returns list of permission codes for a given role."""
    return DEFAULT_ROLE_PERMISSIONS.get(role_name, DEFAULT_ROLE_PERMISSIONS.get("viewer", []))


def is_financial_permission(permission: str) -> bool:
    """Checks if a permission requires MFA (is a financial operation)."""
    return permission in FINANCIAL_PERMISSIONS


def get_mfa_requirement_for_operation(operation: str) -> int:
    """Returns required MFA age in minutes for a sensitive operation, or 0 if not sensitive."""
    return SENSITIVE_OPERATIONS.get(operation, {}).get("mfa_minutes", 0)
