# ================================================================
# FLY MY CART CRM - COMPLETE DATA WIPE & RESET SCRIPT (scripts/reset_to_clean_slate.py)
# ================================================================

import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import (
    Customer, Shipment, Invoice, WalletTransaction,
    ReconciliationBatch, ReconciliationItem, Refund,
    Followup, CommunicationLog, B2BCompany, AuditLog,
    User, UserProfile, Profile, ProfileAuditLog,
    BookingRequest, BookingParcel, ShipmentTrackingEvent
)
from app.seed import seed_database
from app.dependencies import get_supabase_service_client

SUPERADMIN_EMAIL = "chanakyagangabathina77@gmail.com"

def reset_all_application_data():
    print("=" * 70)
    print("FLY MY CART CRM - COMPLETE DATA PURGE (PRESERVING SUPER ADMIN)")
    print(f"Super Admin Email: {SUPERADMIN_EMAIL}")
    print("=" * 70)

    db = SessionLocal()
    try:
        # 1. Delete all operational data in foreign-key safe order
        print("\n[1] Deleting operational entities in safe cascade order...")
        num_tracking = db.query(ShipmentTrackingEvent).delete(synchronize_session=False)
        num_recon_items = db.query(ReconciliationItem).delete(synchronize_session=False)
        num_recon_batches = db.query(ReconciliationBatch).delete(synchronize_session=False)
        num_invoices = db.query(Invoice).delete(synchronize_session=False)
        num_shipments = db.query(Shipment).delete(synchronize_session=False)
        num_booking_parcels = db.query(BookingParcel).delete(synchronize_session=False)
        num_booking_requests = db.query(BookingRequest).delete(synchronize_session=False)
        num_comms = db.query(CommunicationLog).delete(synchronize_session=False)
        num_followups = db.query(Followup).delete(synchronize_session=False)
        num_refunds = db.query(Refund).delete(synchronize_session=False)
        num_wallet_tx = db.query(WalletTransaction).delete(synchronize_session=False)
        num_customers = db.query(Customer).delete(synchronize_session=False)
        num_b2b = db.query(B2BCompany).delete(synchronize_session=False)
        num_audits = db.query(AuditLog).delete(synchronize_session=False)

        print(f" -> Deleted {num_tracking} Shipment Tracking Events")
        print(f" -> Deleted {num_invoices} Invoices")
        print(f" -> Deleted {num_shipments} Shipments")
        print(f" -> Deleted {num_booking_parcels} Booking Parcels")
        print(f" -> Deleted {num_booking_requests} Booking Requests")
        print(f" -> Deleted {num_customers} Customers")
        print(f" -> Deleted {num_wallet_tx} Wallet Transactions")
        print(f" -> Deleted {num_refunds} Refunds")
        print(f" -> Deleted {num_followups} Follow-ups")
        print(f" -> Deleted {num_b2b} B2B Companies")
        print(f" -> Deleted {num_recon_batches} Reconciliation Batches")
        print(f" -> Deleted {num_audits} Audit Logs")

        # 2. Retain only Super Admin in Users & UserProfiles tables
        print("\n[2] Cleaning User accounts table...")
        deleted_users = db.query(User).filter(User.email != SUPERADMIN_EMAIL).delete(synchronize_session=False)
        deleted_user_profiles = db.query(UserProfile).filter(UserProfile.email != SUPERADMIN_EMAIL).delete(synchronize_session=False)
        print(f" -> Deleted {deleted_users} non-admin Users, {deleted_user_profiles} non-admin UserProfiles")

        from app.cache import cache_engine
        cache_engine.clear()
        print(" -> In-memory cache cleared")

        db.commit()

        # 3. Clean Supabase PostgreSQL public.profiles & profile_audit_log
        print("\n[3] Cleaning Supabase PostgreSQL public.profiles...")
        with engine.begin() as conn:
            # Delete profiles except Chanakya
            conn.execute(text("DELETE FROM public.profiles WHERE email != :email"), {"email": SUPERADMIN_EMAIL})
            # Clean non-admin audit entries
            conn.execute(text("""
                DELETE FROM public.profile_audit_log 
                WHERE profile_id NOT IN (SELECT id FROM public.profiles WHERE email = :email)
            """), {"email": SUPERADMIN_EMAIL})

        # 4. Clean Supabase Auth Users
        print("\n[4] Cleaning Supabase Auth Users...")
        supabase = get_supabase_service_client()
        if supabase:
            try:
                auth_users = supabase.auth.admin.list_users()
                for u in auth_users:
                    if u.email and u.email.lower() != SUPERADMIN_EMAIL.lower():
                        supabase.auth.admin.delete_user(u.id)
                        print(f" -> Deleted Supabase Auth User: {u.email} ({u.id})")
            except Exception as e:
                print(f"Supabase auth user cleanup info: {e}")

        # 5. Run baseline seeder to ensure Super Admin & Settings are intact
        print("\n[5] Re-verifying baseline Super Admin setup...")
        seed_database(db)

        # 6. Verify final record counts
        print("\n" + "=" * 70)
        print("VERIFICATION OF CLEAN PRODUCTION SLATE:")
        print(f" -> Customers Count: {db.query(Customer).count()}")
        print(f" -> Booking Requests Count: {db.query(BookingRequest).count()}")
        print(f" -> Shipments Count: {db.query(Shipment).count()}")
        print(f" -> Invoices Count: {db.query(Invoice).count()}")
        print(f" -> Refunds Count: {db.query(Refund).count()}")
        print(f" -> Users Count: {db.query(User).count()}")
        
        super_admin = db.query(User).filter(User.email == SUPERADMIN_EMAIL).first()
        if super_admin:
            print(f" -> Active Super Admin: {super_admin.name} ({super_admin.email}) | Role: {super_admin.role} | Status: {super_admin.status}")

        print("=" * 70)
        print("ALL DATA CLEANED SUCCESSFULLY! Ready for fresh production usage.")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"ERROR during data reset: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    reset_all_application_data()
