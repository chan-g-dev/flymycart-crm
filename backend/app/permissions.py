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
    REPORTS_VIEW_FINANCIAL = "reports.view_financial"
    REPORTS_EXPORT = "reports.export"

    # B2B
    B2B_VIEW = "b2b.view"
    B2B_ADD = "b2b.add"
    B2B_EDIT = "b2b.edit"
    B2B_MANAGE_CREDIT = "b2b.manage_credit"

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

    # Dashboard
    DASHBOARDS_VIEW = "dashboards.view"


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
        # Customers
        PermissionCode.CUSTOMERS_VIEW,
        PermissionCode.CUSTOMERS_ADD,
        PermissionCode.CUSTOMERS_EDIT,
        PermissionCode.CUSTOMERS_EXPORT,
        # Shipments
        PermissionCode.SHIPMENTS_VIEW,
        PermissionCode.SHIPMENTS_ADD,
        PermissionCode.SHIPMENTS_EDIT,
        PermissionCode.SHIPMENTS_CANCEL,
        PermissionCode.SHIPMENTS_EXPORT,
        # Invoices
        PermissionCode.INVOICES_VIEW,
        PermissionCode.INVOICES_ADD,
        PermissionCode.INVOICES_EDIT,
        # Accounts
        PermissionCode.ACCOUNTS_VIEW,
        PermissionCode.ACCOUNTS_EDIT,
        # Refunds
        PermissionCode.REFUNDS_VIEW,
        PermissionCode.REFUNDS_REQUEST,
        PermissionCode.REFUNDS_APPROVE,
        # Reports
        PermissionCode.REPORTS_VIEW,
        PermissionCode.REPORTS_VIEW_FINANCIAL,
        # B2B
        PermissionCode.B2B_VIEW,
        PermissionCode.B2B_ADD,
        PermissionCode.B2B_EDIT,
        # Users
        PermissionCode.USERS_VIEW,
        PermissionCode.USERS_INVITE,
        PermissionCode.USERS_EDIT,
        # Settings
        PermissionCode.SETTINGS_VIEW,
        PermissionCode.SETTINGS_MANAGE,
        # Reconciliation
        PermissionCode.RECONCILIATION_VIEW,
        PermissionCode.RECONCILIATION_RUN,
        # Followups
        PermissionCode.FOLLOWUPS_VIEW,
        PermissionCode.FOLLOWUPS_ADD,
        PermissionCode.FOLLOWUPS_EDIT,
        # Search
        PermissionCode.SEARCH_GLOBAL,
    ],
    "operations_staff": [
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
    ],
    "accounts_staff": [
        # Customers (view only)
        PermissionCode.CUSTOMERS_VIEW,
        # Shipments (view only)
        PermissionCode.SHIPMENTS_VIEW,
        # Invoices
        PermissionCode.INVOICES_VIEW,
        PermissionCode.INVOICES_ADD,
        PermissionCode.INVOICES_EDIT,
        PermissionCode.INVOICES_EXPORT,
        # Accounts (full access)
        PermissionCode.ACCOUNTS_VIEW,
        PermissionCode.ACCOUNTS_EDIT,
        PermissionCode.ACCOUNTS_RECONCILE,
        PermissionCode.ACCOUNTS_EXPORT,
        # Refunds (view only, can't approve)
        PermissionCode.REFUNDS_VIEW,
        # Reports
        PermissionCode.REPORTS_VIEW,
        PermissionCode.REPORTS_VIEW_FINANCIAL,
        PermissionCode.REPORTS_EXPORT,
        # B2B (view only)
        PermissionCode.B2B_VIEW,
        # Search
        PermissionCode.SEARCH_GLOBAL,
    ],
    "counter_staff": [
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
