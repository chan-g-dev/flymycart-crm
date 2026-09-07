# ================================================================
# FLY MY CART CRM - ENTERPRISE DATABASE ENGINE (app/database.py)
# ================================================================

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Normalize PostgreSQL URL if provided as postgres:// (e.g. from Render/Supabase)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Configure engine arguments depending on database dialect
engine_kwargs = {}

if db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # High-performance Production PostgreSQL (Supabase / AWS RDS / Neon) settings
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 15
    engine_kwargs["max_overflow"] = 25
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_timeout"] = 15
    engine_kwargs["connect_args"] = {"connect_timeout": 10}

engine = create_engine(db_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
