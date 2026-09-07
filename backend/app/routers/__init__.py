# ================================================================
# FLY MY CART CRM - ENTERPRISE MODULAR ROUTERS PACKAGE
# ================================================================

from app.routers.auth import auth_router
from app.routers.admin import admin_router
from app.routers.staff import staff_router
from app.routers.users import users_router
from app.routers.dashboard import dashboard_router
from app.routers.search import search_router
from app.routers.customers import customers_router
from app.routers.shipments import shipments_router
from app.routers.invoices import invoices_router
from app.routers.accounts import accounts_router
from app.routers.b2b import b2b_router
from app.routers.reconciliation import reconciliation_router
from app.routers.refunds import refunds_router
from app.routers.followups import followups_router
from app.routers.reports import reports_router
from app.routers.settings import settings_router

__all__ = [
    "auth_router",
    "admin_router",
    "staff_router",
    "users_router",
    "dashboard_router",
    "search_router",
    "customers_router",
    "shipments_router",
    "invoices_router",
    "accounts_router",
    "b2b_router",
    "reconciliation_router",
    "refunds_router",
    "followups_router",
    "reports_router",
    "settings_router"
]
