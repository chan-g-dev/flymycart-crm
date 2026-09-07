# ================================================================
# FLY MY CART CRM - SYSTEM INITIALIZATION SEED SCRIPT (app/seed.py)
# ================================================================

import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models import (
    SystemSettings, User, UserProfile, Role, Permission, UserRole,
    RolePermission, UserCenterAccess
)
from app.auth import hash_password


def migrate_database_schema(db: Session):
    """Ensures newly added columns exist in live Postgres or SQLite tables if running against pre-existing tables."""
    is_sqlite = (db.bind.dialect.name == "sqlite") if db.bind else False
    if is_sqlite:
        sqlite_sqls = [
            "ALTER TABLE users ADD COLUMN center VARCHAR(100) DEFAULT 'Main Hub (Bangalore)';",
            "ALTER TABLE user_profiles ADD COLUMN customer_id VARCHAR(50);",
            "ALTER TABLE user_profiles ADD COLUMN b2b_company_id VARCHAR(50);",
            "ALTER TABLE shipments ADD COLUMN booking_request_id VARCHAR(50);",
            "ALTER TABLE customers ADD COLUMN documents JSON DEFAULT '[]';",
        ]
        for sql in sqlite_sqls:
            try:
                db.execute(text(sql))
                db.commit()
            except Exception:
                db.rollback()
        return

    migration_sqls = [
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) DEFAULT 'audit';",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result VARCHAR(20) DEFAULT 'success';",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(60);",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);",
        "ALTER TABLE audit_logs ALTER COLUMN entity_id DROP NOT NULL;",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS recovery_codes JSONB DEFAULT '[]'::jsonb;",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS authorization_version INTEGER DEFAULT 1;",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS b2b_company_id VARCHAR(50);",
        "ALTER TABLE shipments ADD COLUMN IF NOT EXISTS booking_request_id VARCHAR(50);",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;",
    ]
    for sql in migration_sqls:
        try:
            db.execute(text(sql))
            db.commit()
        except Exception:
            db.rollback()

SUPERADMIN_EMAIL = "chanakyagangabathina77@gmail.com"
SUPERADMIN_NAME = "Chanakya"
SUPERADMIN_USERNAME = "Chanakya"
SUPERADMIN_ID = "055d37da-38d0-4fe9-9ca3-4b956dede81d"
SUPERADMIN_PASSWORD_HASH = hash_password("Chanu@123")

STANDARD_PERMISSIONS = [
    # Customers
    ("customers", "view", "customers.view", "Customers", False, "View customer directory and contact details"),
    ("customers", "add", "customers.add", "Customers", False, "Create new customers and KYC records"),
    ("customers", "edit", "customers.edit", "Customers", False, "Edit customer profiles and credit limits"),
    ("customers", "delete", "customers.delete", "Customers", False, "Archive or remove customer records"),
    ("customers", "export", "customers.export", "Customers", False, "Bulk export customer data"),
    # Shipments
    ("shipments", "view", "shipments.view", "Shipments", False, "View shipments and AWB statuses"),
    ("shipments", "add", "shipments.add", "Shipments", False, "Book new international & domestic shipments"),
    ("shipments", "edit", "shipments.edit", "Shipments", False, "Update shipment packages, dims, and weights"),
    ("shipments", "cancel", "shipments.cancel", "Shipments", False, "Cancel active shipments"),
    ("shipments", "export", "shipments.export", "Shipments", False, "Export shipment manifest data"),
    # Invoices & Accounts
    ("invoices", "view", "invoices.view", "Invoices", True, "View customer invoices and payment balances"),
    ("invoices", "add", "invoices.add", "Invoices", True, "Generate GST invoices and payment links"),
    ("invoices", "edit", "invoices.edit", "Invoices", True, "Modify invoice line items and applied taxes"),
    ("invoices", "export", "invoices.export", "Invoices", True, "Export tax invoice registers"),
    ("accounts", "view", "accounts.view", "Accounts", True, "View collection bank balances and carrier wallets"),
    ("accounts", "edit", "accounts.edit", "Accounts", True, "Record payments and wallet recharges"),
    ("accounts", "reconcile", "accounts.reconcile", "Accounts", True, "Perform carrier bill reconciliations"),
    ("accounts", "export", "accounts.export", "Accounts", True, "Export accounting and cash drawer sheets"),
    # Refunds
    ("refunds", "view", "refunds.view", "Refunds", True, "View customer refund requests"),
    ("refunds", "request", "refunds.request", "Refunds", True, "Initiate customer refund ticket"),
    ("refunds", "approve", "refunds.approve", "Refunds", True, "Approve requested refund (requires recent MFA)"),
    ("refunds", "process", "refunds.process", "Refunds", True, "Disburse approved refund via UPI/Bank"),
    # Reports
    ("reports", "view", "reports.view", "Reports", False, "View operational dashboards & shipment volumes"),
    ("reports", "view_financial", "reports.view_financial", "Reports", True, "View financial margins and gross profit metrics"),
    ("reports", "export", "reports.export", "Reports", False, "Export analytical reports"),
    # Users & Roles
    ("users", "view", "users.view", "Users", False, "View staff roster and center assignments"),
    ("users", "invite", "users.invite", "Users", False, "Invite new staff members via email"),
    ("users", "edit", "users.edit", "Users", False, "Edit staff profile and center access"),
    ("users", "suspend", "users.suspend", "Users", False, "Suspend or reactivate staff accounts"),
    ("users", "manage_permissions", "users.manage_permissions", "Users", False, "Configure roles and permissions"),
    # Settings
    ("settings", "view", "settings.view", "Settings", False, "View system configuration and carrier parameters"),
    ("settings", "manage", "settings.manage", "Settings", True, "Modify company details, banks, and API keys"),
]

STANDARD_ROLES = [
    ("SUPER_ADMIN", "Protected System Super Administrator with complete system authority", True),
    ("Center Manager", "Branch manager overseeing assigned center shipments, staff, and customer accounts", False),
    ("Operations Staff", "Operations team handling shipment booking, customer creation, and dispatch", False),
    ("Front Counter Staff", "Counter shipment entry and receipt operations", False),
    ("Accounts Staff", "Finance personnel managing invoices, reconciliations, and payment records", False),
    ("Refund Approver", "Authorized manager with approval rights over customer refunds and credits", False),
    ("Report Viewer", "Read-only analytics access for operational tracking", False),
]


def seed_permissions_and_roles(db: Session):
    """Initializes standard roles, permissions catalogue, and role mappings."""
    existing_super = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
    if existing_super and db.query(Permission).count() >= len(STANDARD_PERMISSIONS):
        return

    # 1. Seed Permissions
    perm_map = {}
    for resource, action, code, module, is_fin, desc in STANDARD_PERMISSIONS:
        perm = db.query(Permission).filter(Permission.code == code).first()
        if not perm:
            perm = Permission(
                resource=resource,
                action=action,
                code=code,
                module=module,
                is_financial=is_fin,
                description=desc
            )
            db.add(perm)
            db.flush()
        perm_map[code] = perm

    # 2. Seed Roles
    role_map = {}
    for name, desc, is_sys in STANDARD_ROLES:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(
                name=name,
                description=desc,
                is_system=is_sys
            )
            db.add(role)
            db.flush()
        else:
            role.is_system = is_sys
        role_map[name] = role

    db.commit()

    # 3. Map Permissions to SUPER_ADMIN (All permissions with scope 'all')
    super_role = role_map.get("SUPER_ADMIN")
    if super_role:
        for code, perm in perm_map.items():
            rp = db.query(RolePermission).filter(
                RolePermission.role_id == super_role.id,
                RolePermission.permission_id == perm.id
            ).first()
            if not rp:
                rp = RolePermission(
                    role_id=super_role.id,
                    permission_id=perm.id,
                    scope="all"
                )
                db.add(rp)

    # 4. Map Permissions to Operations Staff
    ops_role = role_map.get("Operations Staff")
    if ops_role:
        ops_perms = [
            "customers.view", "customers.add", "customers.edit",
            "shipments.view", "shipments.add", "shipments.edit",
            "reports.view"
        ]
        for code in ops_perms:
            if code in perm_map:
                rp = db.query(RolePermission).filter(
                    RolePermission.role_id == ops_role.id,
                    RolePermission.permission_id == perm_map[code].id
                ).first()
                if not rp:
                    db.add(RolePermission(
                        role_id=ops_role.id,
                        permission_id=perm_map[code].id,
                        scope="center"
                    ))

    # 5. Map Permissions to Accounts Staff
    acc_role = role_map.get("Accounts Staff")
    if acc_role:
        acc_perms = [
            "invoices.view", "invoices.add", "invoices.edit", "invoices.export",
            "accounts.view", "accounts.edit", "accounts.reconcile", "accounts.export",
            "refunds.view", "refunds.request", "reports.view", "reports.view_financial"
        ]
        for code in acc_perms:
            if code in perm_map:
                rp = db.query(RolePermission).filter(
                    RolePermission.role_id == acc_role.id,
                    RolePermission.permission_id == perm_map[code].id
                ).first()
                if not rp:
                    db.add(RolePermission(
                        role_id=acc_role.id,
                        permission_id=perm_map[code].id,
                        scope="all"
                    ))

    # 6. Map Permissions to Refund Approver
    ref_role = role_map.get("Refund Approver")
    if ref_role:
        ref_perms = ["refunds.view", "refunds.approve", "refunds.process", "reports.view_financial"]
        for code in ref_perms:
            if code in perm_map:
                rp = db.query(RolePermission).filter(
                    RolePermission.role_id == ref_role.id,
                    RolePermission.permission_id == perm_map[code].id
                ).first()
                if not rp:
                    db.add(RolePermission(
                        role_id=ref_role.id,
                        permission_id=perm_map[code].id,
                        scope="all"
                    ))

    db.commit()


def seed_super_admin(db: Session):
    """Ensures Super Admin Gangabathina Chanakya is always seeded and active."""
    # 1. Sync in UserProfile ORM model
    prof = db.query(UserProfile).filter(UserProfile.email == SUPERADMIN_EMAIL).first()
    if not prof:
        prof = UserProfile(
            id=SUPERADMIN_ID,
            email=SUPERADMIN_EMAIL,
            display_name=SUPERADMIN_NAME,
            phone="+91 98765 43210",
            role="super_admin",
            status="active",
            requested_role="super_admin",
            mfa_required=True,
            password_hash=SUPERADMIN_PASSWORD_HASH,
            approved_by="System Root",
            approved_at=datetime.datetime.utcnow(),
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow()
        )
        db.add(prof)
        db.flush()
    else:
        prof.display_name = SUPERADMIN_NAME
        prof.role = "super_admin"
        prof.status = "active"
        prof.mfa_required = True
        prof.password_hash = SUPERADMIN_PASSWORD_HASH
        prof.approved_by = prof.approved_by or "System Root"
        prof.approved_at = prof.approved_at or datetime.datetime.utcnow()

    # 2. Attach SUPER_ADMIN role
    super_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
    if super_role:
        ur = db.query(UserRole).filter(
            UserRole.user_id == prof.id,
            UserRole.role_id == super_role.id
        ).first()
        if not ur:
            db.add(UserRole(user_id=prof.id, role_id=super_role.id))

    # 3. Attach User Center Access
    uca = db.query(UserCenterAccess).filter(
        UserCenterAccess.user_id == prof.id,
        UserCenterAccess.center_id == "Main Hub (Bangalore)"
    ).first()
    if not uca:
        db.add(UserCenterAccess(
            user_id=prof.id,
            center_id="Main Hub (Bangalore)",
            scope="manage"
        ))

    # 4. Sync in legacy User model for backward queries
    u_admin = db.query(User).filter(
        (User.email == SUPERADMIN_EMAIL) | (User.username == SUPERADMIN_USERNAME) | (User.username == SUPERADMIN_EMAIL)
    ).first()

    if not u_admin:
        u_admin = User(
            id=SUPERADMIN_ID,
            username=SUPERADMIN_USERNAME,
            name=SUPERADMIN_NAME,
            email=SUPERADMIN_EMAIL,
            password_hash=SUPERADMIN_PASSWORD_HASH,
            phone="+91 98765 43210",
            role="super_admin",
            center="Main Hub (Bangalore)",
            status="Active",
            is_active=True,
            approved_by="System Root",
            approval_date=datetime.datetime.utcnow(),
            created_at=datetime.datetime.utcnow()
        )
        db.add(u_admin)
    else:
        u_admin.username = SUPERADMIN_USERNAME
        u_admin.name = SUPERADMIN_NAME
        u_admin.role = "super_admin"
        u_admin.status = "Active"
        u_admin.is_active = True
        u_admin.password_hash = SUPERADMIN_PASSWORD_HASH

    db.commit()


def seed_system_settings(db: Session):
    """Seeds baseline system settings and provider configurations."""
    rec = db.query(SystemSettings).first()
    if not rec:
        default_config = {
            "centerName": "Main Hub (Bangalore)",
            "centerPhone": "+91 98765 43210",
            "centerAddress": "Warehouse 4, Cargo Complex, Kempegowda International Airport Road, Bangalore, Karnataka - 560300",
            "gstin": "29AABCF1234M1Z5",
            "lutNumber": "LUT/INT/2026/0892",
            "invoicePrefix": "FMC-",
            "defaultVolumetricDivisor": 5000,
            "fuelSurchargePercentage": 14.5,
            "emergencySurchargePercentage": 3.0,
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "prepaidWallets": [
                {"name": "ICL", "openingBalance": 0.0, "currency": "INR", "notes": "ICL Logistics Prepaid Balance"},
                {"name": "BRV", "openingBalance": 0.0, "currency": "INR", "notes": "BRV Air Express Wallet"}
            ],
            "postpaidProviders": [
                {"name": "Aramex", "deposit": 200000.0, "paymentTerms": "15 Days", "accountNo": "ARX-IND-9082"},
                {"name": "Blue Dart", "deposit": 150000.0, "paymentTerms": "30 Days", "accountNo": "BD-MUM-4411"},
                {"name": "FedEx", "deposit": 300000.0, "paymentTerms": "30 Days", "accountNo": "FDX-BOMB-7782"},
                {"name": "DHL Express", "deposit": 250000.0, "paymentTerms": "30 Days", "accountNo": "DHL-EXP-1102"}
            ],
            "collectionAccounts": [
                {"id": "acc_office_qr", "name": "Office QR (PhonePe)", "accountType": "UPI / QR", "upiId": "flymycart@ybl"},
                {"id": "acc_hdfc_bank", "name": "HDFC Current Account", "accountType": "Bank", "accountNo": "50200088991234"},
                {"id": "acc_petty_cash", "name": "Main Office Petty Cash", "accountType": "Cash Drawer", "manager": "Nawaz"}
            ]
        }
        rec = SystemSettings(id=1, config_json=default_config)
        db.add(rec)
        db.commit()


def seed_database(db: Session):
    """Master database seeder for clean production setup."""
    migrate_database_schema(db)
    seed_permissions_and_roles(db)
    seed_super_admin(db)
    seed_system_settings(db)
    print("Baseline system initialized with Enterprise RBAC & Super Admin (Gangabathina Chanakya).")
