# ================================================================
# FLY MY CART CRM - ENTERPRISE CONFIGURATION ENGINE (app/config.py)
# ================================================================

import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=(".env", ".env.local"),
        extra="ignore"
    )

    PROJECT_NAME: str = "Fly My Cart CRM"
    VERSION: str = "2.4.0-production"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = False
    REMINDERS_ENABLED: bool = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_setting(cls, value):
        """Accept deployment-style values without crashing on a global DEBUG variable."""
        if isinstance(value, bool):
            return value
        normalized = str(value or "").strip().lower()
        if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
            return True
        if normalized in {"0", "false", "no", "off", "release", "production", "prod", ""}:
            return False
        raise ValueError("DEBUG must be a boolean, development/debug, or production/release value")

    # Database: Supports SQLite (Local Dev) & PostgreSQL / Supabase (Production)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'flymycart.db')}"
    )
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "20"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT_SECONDS: int = int(os.getenv("DB_POOL_TIMEOUT_SECONDS", "30"))
    DB_POOL_RECYCLE_SECONDS: int = int(os.getenv("DB_POOL_RECYCLE_SECONDS", "1800"))

    # Security & Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fmc-super-secret-key-change-in-production-7789")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS Allowed Origins
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
        "https://*.pages.dev",
        "https://*.render.com",
        "https://*.flymycart.com"
    ]

    # Storage Provider: "supabase" (default), "r2", or "local"
    STORAGE_PROVIDER: str = os.getenv("STORAGE_PROVIDER", "supabase")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://ftwjlunfjuzgfvwqmyqo.supabase.co")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "fly-my-cart-files")

    # Cloudflare R2 / S3 File Storage (Future Switch)
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "fly-my-cart-production")

settings = Settings()
