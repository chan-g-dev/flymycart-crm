# ================================================================
# FLY MY CART CRM - FASTAPI PRODUCTION SERVER (app/main.py)
# ================================================================

import time
import os
from fastapi import FastAPI, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed import seed_database, migrate_database_schema
from app.routers import (
    auth_router,
    admin_router,
    staff_router,
    users_router,
    dashboard_router,
    customers_router,
    shipments_router,
    search_router,
    invoices_router,
    accounts_router,
    b2b_router,
    reconciliation_router,
    refunds_router,
    followups_router,
    reports_router,
    settings_router
)
from app.auth import get_current_user_context
from app.dependencies import get_current_session_context
from app.routers.bookings import bookings_router

from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Finish schema initialization before accepting application traffic."""
    if settings.ENVIRONMENT == "production":
        if settings.DATABASE_URL.startswith("sqlite"):
            raise RuntimeError("Production requires PostgreSQL; SQLite is for local development only.")
        if len(settings.SECRET_KEY) < 32 or "change" in settings.SECRET_KEY.lower():
            raise RuntimeError("Set a unique SECRET_KEY of at least 32 characters before production startup.")

    def _init_db():
        try:
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            try:
                migrate_database_schema(db)
                seed_database(db)
            finally:
                db.close()
        except Exception as e:
            raise RuntimeError("Database initialization failed") from e

    await asyncio.to_thread(_init_db)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Staff Management, Super Admin Approval System & Enterprise Courier CRM",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None
)

# ================================================================
# SECURITY MIDDLEWARE (Applied in reverse order of registration)
# ================================================================

# Request latency tracking middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


# Security Headers Middleware (OWASP Standard Headers)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds security headers to all responses."""
    response = await call_next(request)
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent clickjacking (Fly My Cart CRM should not be embedded)
    response.headers["X-Frame-Options"] = "DENY"
    
    # Enable XSS protection in legacy browsers
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Enforce HTTPS and prevent downgrade attacks
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Referrer Policy: Send minimal referrer information
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Permissions Policy (Permissions-Policy replaces Feature-Policy)
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), "
        "microphone=(), payment=(), usb=()"
    )
    
    # Content Security Policy (CSP) - Strict but functional
    if settings.ENVIRONMENT == "production":
        frontend_url = os.getenv("FRONTEND_URL", "https://crm.flymycart.in")
        csp = (
            f"default-src 'self'; "
            f"script-src 'self' 'wasm-unsafe-eval' {frontend_url}; "
            f"style-src 'self' 'unsafe-inline' {frontend_url}; "
            f"img-src 'self' data: https:; "
            f"font-src 'self'; "
            f"connect-src 'self' {frontend_url}; "
            f"frame-ancestors 'none'; "
            f"base-uri 'self'; "
            f"form-action 'self';"
        )
    else:
        # Development: more permissive for debugging
        csp = "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*"
    
    response.headers["Content-Security-Policy"] = csp
    
    return response


from fastapi.middleware.gzip import GZipMiddleware

# High-Performance Response GZip Compression Middleware (Compresses large JSON responses > 500 bytes)
app.add_middleware(GZipMiddleware, minimum_size=500)

# ================================================================
# CORS CONFIGURATION (STRICT)
# ================================================================
base_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

allowed_origins = []

if settings.ENVIRONMENT == "production":
    # Production: allow deployment URLs plus local development convenience
    allowed_origins = [
        os.getenv("FRONTEND_URL", "https://crm.flymycart.in"),
        "https://crm.flymycart.in",
        "https://www.crm.flymycart.in",
        *base_allowed_origins,
    ]
elif settings.ENVIRONMENT == "staging":
    # Staging: allow staging frontend plus local development convenience
    allowed_origins = [
        os.getenv("FRONTEND_URL", "https://staging-crm.flymycart.in"),
        "https://staging-crm.flymycart.in",
        *base_allowed_origins,
    ]
else:
    # Development: allow localhost and common dev URLs
    allowed_origins = [
        *base_allowed_origins,
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ]

allowed_origins = list(dict.fromkeys([origin for origin in allowed_origins if origin]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,  # Required for HttpOnly cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page-Count", "X-Process-Time"],
    max_age=3600,  # Preflight cache duration
)

# Global Health Check Endpoint
@app.get("/api/health", tags=["System Health"])
def health_check():
    """System health check & database ping for cloud deployment monitors."""
    db_status = "healthy"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "operational",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status
    }

# Register All Routers with both /api and root prefixes for seamless integration
app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(auth_router, prefix="/api")

app.include_router(users_router)
app.include_router(users_router, prefix="/api")

app.include_router(admin_router)
app.include_router(admin_router, prefix="/api")

app.include_router(staff_router)
app.include_router(staff_router, prefix="/api")

app.include_router(dashboard_router)
app.include_router(dashboard_router, prefix="/api")

app.include_router(customers_router)
app.include_router(customers_router, prefix="/api")

app.include_router(shipments_router)
app.include_router(shipments_router, prefix="/api")

app.include_router(search_router)
app.include_router(search_router, prefix="/api")

app.include_router(invoices_router)
app.include_router(invoices_router, prefix="/api")

app.include_router(accounts_router)
app.include_router(accounts_router, prefix="/api")

app.include_router(b2b_router)
app.include_router(b2b_router, prefix="/api")

app.include_router(reconciliation_router)
app.include_router(reconciliation_router, prefix="/api")

app.include_router(refunds_router)
app.include_router(refunds_router, prefix="/api")

app.include_router(followups_router)
app.include_router(followups_router, prefix="/api")

app.include_router(reports_router)
app.include_router(reports_router, prefix="/api")

app.include_router(settings_router)
app.include_router(settings_router, prefix="/api")

@app.get("/", include_in_schema=False)
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health"
    }
