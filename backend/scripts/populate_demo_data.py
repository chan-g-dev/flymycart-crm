"""
================================================================
FLY MY CART CRM - COMPREHENSIVE ENTERPRISE DEMO DATA SEEDER
================================================================
Seeds realistic, interconnected business data across all CRM modules:
- System Settings & Collection Accounts
- Staff Users & User Profiles
- B2B Companies with Credit Terms & Limits
- Diverse Customers (C2C, B2C, B2B) with contact & ID proofs
- Shipments across Couriers (FedEx, DHL, Aramex, Blue Dart, ICL, BRV)
- Invoices with accurate billing, GST, paid amounts & balances
- Follow-ups & Customer Communications (WhatsApp/Calls)
- Prepaid Wallet Transactions (ICL & BRV Recharges & Usage)
- Refund / Adjustment Claims across lifecycles
- Carrier Cost Reconciliation Batches & Items
- Audit Logs for traceability
"""

import sys
import os
import datetime
import uuid

# Force UTF-8 on Windows consoles
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal, engine, Base
from app.models import (
    User, Profile, Customer, B2BCompany, Shipment, Invoice, 
    Followup, CommunicationLog, WalletTransaction, Refund, 
    ReconciliationBatch, ReconciliationItem, AuditLog, SystemSettings,
    PostpaidProviderAccount
)
from app.seed import seed_super_admin, seed_system_settings

def run_seed():
    db = SessionLocal()
    try:
        print("[1/9] Initializing System Settings & Super Admin...", flush=True)
        seed_super_admin(db)
        seed_system_settings(db)

        now = datetime.datetime.utcnow()
        today_str = now.strftime('%Y-%m-%d')
        yesterday_str = (now - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
        prev2_str = (now - datetime.timedelta(days=2)).strftime('%Y-%m-%d')
        prev3_str = (now - datetime.timedelta(days=3)).strftime('%Y-%m-%d')
        prev5_str = (now - datetime.timedelta(days=5)).strftime('%Y-%m-%d')
        prev7_str = (now - datetime.timedelta(days=7)).strftime('%Y-%m-%d')
        prev10_str = (now - datetime.timedelta(days=10)).strftime('%Y-%m-%d')
        prev14_str = (now - datetime.timedelta(days=14)).strftime('%Y-%m-%d')
        prev20_str = (now - datetime.timedelta(days=20)).strftime('%Y-%m-%d')
        prev30_str = (now - datetime.timedelta(days=30)).strftime('%Y-%m-%d')

        next1_str = (now + datetime.timedelta(days=1)).strftime('%Y-%m-%d')
        next3_str = (now + datetime.timedelta(days=3)).strftime('%Y-%m-%d')
        next5_str = (now + datetime.timedelta(days=5)).strftime('%Y-%m-%d')

        # ----------------------------------------------------
        # 1. Staff Users & Profiles
        # ----------------------------------------------------
        print("👥 [2/9] Seeding Operations Staff & Profile Accounts...")
        staff_data = [
            {
                "id": "u_staff_nawaz",
                "profile_id": "a1111111-1111-4111-8111-111111111111",
                "email": "nawaz.khan@flymycart.com",
                "name": "Nawaz Khan",
                "role": "operations_staff",
                "phone": "+91 98450 77661",
                "center": "Main Hub (Bangalore)",
                "status": "Active"
            },
            {
                "id": "u_staff_lata",
                "profile_id": "b2222222-2222-4222-8222-222222222222",
                "email": "lata.ramesh@flymycart.com",
                "name": "Lata Ramesh",
                "role": "operations_staff",
                "phone": "+91 98860 33442",
                "center": "Main Hub (Bangalore)",
                "status": "Active"
            },
            {
                "id": "u_staff_umesh",
                "profile_id": "c3333333-3333-4333-8333-333333333333",
                "email": "umesh.gowda@flymycart.com",
                "name": "Umesh Gowda",
                "role": "counter_staff",
                "phone": "+91 99000 88776",
                "center": "Main Hub (Bangalore)",
                "status": "Active"
            },
            {
                "id": "u_staff_uma",
                "profile_id": "d4444444-4444-4444-8444-444444444444",
                "email": "uma.maheshwari@flymycart.com",
                "name": "Uma Maheshwari",
                "role": "operations_staff",
                "phone": "+91 97420 11998",
                "center": "Main Hub (Bangalore)",
                "status": "Active"
            }
        ]

        for s in staff_data:
            u = db.query(User).filter(User.email == s["email"]).first()
            if not u:
                u = User(
                    id=s["id"],
                    username=s["email"],
                    name=s["name"],
                    email=s["email"],
                    phone=s["phone"],
                    role=s["role"],
                    center=s["center"],
                    status=s["status"],
                    is_active=True,
                    approved_by="System Root",
                    approval_date=now,
                    created_at=now - datetime.timedelta(days=60)
                )
                db.add(u)

            p = db.query(Profile).filter(Profile.email == s["email"]).first()
            if not p:
                p = Profile(
                    id=s["profile_id"],
                    email=s["email"],
                    full_name=s["name"],
                    role="staff" if s["role"] == "counter_staff" else "manager",
                    status="approved",
                    requested_role="staff",
                    created_at=now - datetime.timedelta(days=60),
                    updated_at=now
                )
                db.add(p)
        db.commit()

        # ----------------------------------------------------
        # 2. B2B Corporate Clients
        # ----------------------------------------------------
        print("🏢 [3/9] Seeding B2B Corporate Clients...")
        b2b_seeds = [
            {
                "id": "b2b_apex_global",
                "company_name": "Apex Global Exports Pvt Ltd",
                "contact_person": "Rohan Mehra",
                "mobile": "+91 98450 11223",
                "email": "rohan@apexexports.com",
                "gst_number": "29AAACA1234F1Z1",
                "billing_address": "Plot 42, Electronic City Phase 1, Bangalore, Karnataka - 560100",
                "credit_limit": 300000.0,
                "credit_period_days": 30,
                "payment_terms": "Net 30 Days"
            },
            {
                "id": "b2b_nextech",
                "company_name": "NexTech Electronics Bangalore",
                "contact_person": "Suresh Kulkarni",
                "mobile": "+91 99001 55667",
                "email": "logistics@nextech-india.com",
                "gst_number": "29AABCN9876K1Z9",
                "billing_address": "Indiranagar 100 Feet Rd, HAL 2nd Stage, Bangalore, Karnataka - 560038",
                "credit_limit": 200000.0,
                "credit_period_days": 45,
                "payment_terms": "Net 45 Days"
            },
            {
                "id": "b2b_mysore_silks",
                "company_name": "Mysore Royal Silks & Handlooms",
                "contact_person": "Ananya Sharma",
                "mobile": "+91 97410 99881",
                "email": "exports@mysoresilks.in",
                "gst_number": "29AABCM5544R1ZQ",
                "billing_address": "Jayanagar 4th Block, Near 11th Main, Bangalore - 560011",
                "credit_limit": 150000.0,
                "credit_period_days": 30,
                "payment_terms": "Net 30 Days"
            },
            {
                "id": "b2b_biotech_labs",
                "company_name": "Avesthagen BioTech Laboratories",
                "contact_person": "Dr. Vivek Murthy",
                "mobile": "+91 94480 87654",
                "email": "dispatch@avesthagenbio.com",
                "gst_number": "29AAACA8899P1ZK",
                "billing_address": "Whitefield ITPL Main Rd, KIADB Export Zone, Bangalore - 560066",
                "credit_limit": 250000.0,
                "credit_period_days": 60,
                "payment_terms": "Net 60 Days"
            }
        ]

        b2b_map = {}
        for b in b2b_seeds:
            b_obj = db.query(B2BCompany).filter(B2BCompany.company_name == b["company_name"]).first()
            if not b_obj:
                b_obj = B2BCompany(
                    id=b["id"],
                    company_name=b["company_name"],
                    contact_person=b["contact_person"],
                    mobile=b["mobile"],
                    email=b["email"],
                    gst_number=b["gst_number"],
                    billing_address=b["billing_address"],
                    credit_limit=b["credit_limit"],
                    credit_period_days=b["credit_period_days"],
                    payment_terms=b["payment_terms"],
                    created_at=now - datetime.timedelta(days=45)
                )
                db.add(b_obj)
                db.commit()
                db.refresh(b_obj)
            b2b_map[b["company_name"]] = b_obj

        # ----------------------------------------------------
        # 3. Diverse Customers (C2C, B2C, B2B)
        # ----------------------------------------------------
        print("🧑‍💼 [4/9] Seeding Customers (C2C, B2C, B2B)...")
        customers_seed = [
            {
                "id": "cust_pooja_hegde",
                "name": "Pooja Hegde",
                "mobile": "+91 98801 23456",
                "email": "pooja.hegde@gmail.com",
                "customer_type": "C2C",
                "company": None,
                "address": "402, Sunshine Heights, Koramangala 4th Block, Bangalore - 560034",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz Khan",
                "id_proof": "AADHAAR-8921-4310-9921",
                "credit_limit": 0.0,
                "credit_period_days": 0,
                "b2b_company_id": None
            },
            {
                "id": "cust_dr_vivek",
                "name": "Dr. Vivek Murthy",
                "mobile": "+91 94480 87654",
                "email": "dr.vivek.murthy@avesthagenbio.com",
                "customer_type": "B2B",
                "company": "Avesthagen BioTech Laboratories",
                "address": "Whitefield ITPL Main Rd, KIADB Export Zone, Bangalore - 560066",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Lata Ramesh",
                "id_proof": "PASSPORT-Z8920194",
                "credit_limit": 250000.0,
                "credit_period_days": 60,
                "b2b_company_id": b2b_map["Avesthagen BioTech Laboratories"].id
            },
            {
                "id": "cust_ananya_sharma",
                "name": "Ananya Sharma",
                "mobile": "+91 97410 99881",
                "email": "ananya.sharma@mysoresilks.in",
                "customer_type": "B2B",
                "company": "Mysore Royal Silks & Handlooms",
                "address": "Banjara Hills Road No. 12, Hyderabad - 500034",
                "center": "Hyderabad Hub",
                "assigned_employee": "Umesh Gowda",
                "id_proof": "PAN-AHYPS9012K",
                "credit_limit": 150000.0,
                "credit_period_days": 30,
                "b2b_company_id": b2b_map["Mysore Royal Silks & Handlooms"].id
            },
            {
                "id": "cust_rohan_mehra",
                "name": "Rohan Mehra",
                "mobile": "+91 98450 11223",
                "email": "rohan@apexexports.com",
                "customer_type": "B2B",
                "company": "Apex Global Exports Pvt Ltd",
                "address": "Plot 42, Electronic City Phase 1, Bangalore - 560100",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz Khan",
                "id_proof": "GSTIN-29AAACA1234F1Z1",
                "credit_limit": 300000.0,
                "credit_period_days": 30,
                "b2b_company_id": b2b_map["Apex Global Exports Pvt Ltd"].id
            },
            {
                "id": "cust_karthik_raja",
                "name": "Karthik Raja",
                "mobile": "+91 96111 44332",
                "email": "karthik.raja@bluewave.io",
                "customer_type": "C2C",
                "company": None,
                "address": "Salt Lake Sector V, Kolkata - 700091",
                "center": "Kolkata Center",
                "assigned_employee": "Uma Maheshwari",
                "id_proof": "AADHAAR-3391-9012-7711",
                "credit_limit": 0.0,
                "credit_period_days": 0,
                "b2b_company_id": None
            },
            {
                "id": "cust_suresh_kulkarni",
                "name": "Suresh Kulkarni",
                "mobile": "+91 99001 55667",
                "email": "logistics@nextech-india.com",
                "customer_type": "B2B",
                "company": "NexTech Electronics Bangalore",
                "address": "Andheri East MIDC Complex, Mumbai - 400093",
                "center": "Mumbai Branch",
                "assigned_employee": "Nawaz Khan",
                "id_proof": "GSTIN-29AABCN9876K1Z9",
                "credit_limit": 200000.0,
                "credit_period_days": 45,
                "b2b_company_id": b2b_map["NexTech Electronics Bangalore"].id
            },
            {
                "id": "cust_meera_nambiar",
                "name": "Meera Nambiar",
                "mobile": "+91 94801 88220",
                "email": "meera.nambiar@organicspices.co",
                "customer_type": "B2C",
                "company": "Nambiar Organic Farms",
                "address": "Jubilee Hills Road 36, Hyderabad - 500033",
                "center": "Hyderabad Hub",
                "assigned_employee": "Lata Ramesh",
                "id_proof": "PAN-BNQPN4411M",
                "credit_limit": 50000.0,
                "credit_period_days": 15,
                "b2b_company_id": None
            },
            {
                "id": "cust_rajesh_gupta",
                "name": "Rajesh Gupta",
                "mobile": "+91 98200 44119",
                "email": "rajesh.gupta@delhiartisans.com",
                "customer_type": "B2C",
                "company": "Delhi Handcraft Emporium",
                "address": "Connaught Place Block B, New Delhi - 110001",
                "center": "Delhi Regional Hub",
                "assigned_employee": "Umesh Gowda",
                "id_proof": "PASSPORT-M1109823",
                "credit_limit": 75000.0,
                "credit_period_days": 15,
                "b2b_company_id": None
            },
            {
                "id": "cust_sneha_reddy",
                "name": "Sneha Reddy",
                "mobile": "+91 97000 66332",
                "email": "sneha.reddy@student.ox.ac.uk",
                "customer_type": "C2C",
                "company": None,
                "address": "Hauz Khas Enclave, New Delhi - 110016",
                "center": "Delhi Regional Hub",
                "assigned_employee": "Uma Maheshwari",
                "id_proof": "AADHAAR-5520-9941-1102",
                "credit_limit": 0.0,
                "credit_period_days": 0,
                "b2b_company_id": None
            },
            {
                "id": "cust_vikram_singh",
                "name": "Vikram Singh",
                "mobile": "+91 98110 33221",
                "email": "vikram.singh@precisionmachinery.in",
                "customer_type": "B2C",
                "company": "Singh Precision Tools",
                "address": "Thane Industrial Estate, Mumbai - 400604",
                "center": "Mumbai Branch",
                "assigned_employee": "Nawaz Khan",
                "id_proof": "PAN-CYZPS8821L",
                "credit_limit": 100000.0,
                "credit_period_days": 30,
                "b2b_company_id": None
            }
        ]

        cust_map = {}
        for c in customers_seed:
            cust_obj = db.query(Customer).filter((Customer.mobile == c["mobile"]) | (Customer.id == c["id"])).first()
            if not cust_obj:
                cust_obj = Customer(
                    id=c["id"],
                    name=c["name"],
                    company=c.get("company"),
                    mobile=c["mobile"],
                    whatsapp=c["mobile"],
                    email=c.get("email"),
                    address=c.get("address"),
                    id_proof=c.get("id_proof"),
                    customer_type=c["customer_type"],
                    source="Walk-in / Referral",
                    center=c["center"],
                    assigned_employee=c["assigned_employee"],
                    credit_limit=c.get("credit_limit", 0.0),
                    credit_period_days=c.get("credit_period_days", 30),
                    b2b_company_id=c.get("b2b_company_id"),
                    created_at=now - datetime.timedelta(days=35)
                )
                db.add(cust_obj)
            else:
                cust_obj.center = c["center"]
                cust_obj.address = c.get("address")
            db.commit()
            db.refresh(cust_obj)
            cust_map[c["name"]] = cust_obj

        # ----------------------------------------------------
        # 4. Realistic Shipments across carriers & routes
        # ----------------------------------------------------
        print("📦 [5/9] Seeding Shipments & Linked Invoices...")
        shipments_seed = [
            # 1. FedEx - Bangalore -> USA Priority (Paid via PhonePe)
            {
                "awb": "FMC-BLR-89210",
                "date": today_str,
                "pickup_date": today_str,
                "customer_name": "Pooja Hegde",
                "customer_type": "C2C",
                "receiver_name": "Deepak Hegde",
                "receiver_phone": "+1 415 890 1234",
                "receiver_city": "San Francisco",
                "receiver_country": "USA",
                "receiver_zip": "94107",
                "description": "Homemade Indian Sweets, Spices & Savories",
                "packages_count": 2,
                "actual_weight": 8.5,
                "length": 35.0, "width": 25.0, "height": 20.0,
                "volumetric_weight": 3.5,
                "chargeable_weight": 8.5,
                "courier": "FedEx",
                "service_type": "International Priority Express",
                "provider_type": "postpaid",
                "provider_name": "FedEx",
                "price": 9200.0,
                "provider_cost": 5800.0,
                "actual_provider_cost": 5800.0,
                "gross_profit": 3400.0,
                "payment_status": "Paid",
                "payment_method": "PhonePe",
                "paid_to": "Office QR (PhonePe)",
                "collected_by": "Nawaz Khan",
                "status": "In Transit",
                "center": "Main Hub (Bangalore)"
            },
            # 2. DHL - Bangalore -> UK London Medical (Paid via Google Pay)
            {
                "awb": "FMC-BLR-89211",
                "date": today_str,
                "pickup_date": today_str,
                "customer_name": "Dr. Vivek Murthy",
                "customer_type": "B2B",
                "receiver_name": "Royal Infirmary Pharmacy Dept",
                "receiver_phone": "+44 20 7946 0192",
                "receiver_city": "London",
                "receiver_country": "United Kingdom",
                "receiver_zip": "EC1A 1BB",
                "description": "Diagnostic Herbal Extracts & Temperature Monitored Lab Samples",
                "packages_count": 1,
                "actual_weight": 3.2,
                "length": 25.0, "width": 20.0, "height": 15.0,
                "volumetric_weight": 1.5,
                "chargeable_weight": 3.2,
                "courier": "DHL",
                "service_type": "DHL Express Worldwide",
                "provider_type": "postpaid",
                "provider_name": "DHL Express",
                "price": 6500.0,
                "provider_cost": 4100.0,
                "actual_provider_cost": 4100.0,
                "gross_profit": 2400.0,
                "payment_status": "Paid",
                "payment_method": "Google Pay",
                "paid_to": "Office QR (PhonePe)",
                "collected_by": "Lata Ramesh",
                "status": "Picked Up",
                "center": "Main Hub (Bangalore)"
            },
            # 3. Aramex - Delhi -> UAE Dubai Silk Sarees (Paid via Cash)
            {
                "awb": "FMC-BLR-89212",
                "date": today_str,
                "pickup_date": today_str,
                "customer_name": "Rajesh Gupta",
                "customer_type": "B2C",
                "receiver_name": "Dubai Silk House LLC",
                "receiver_phone": "+971 4 398 2210",
                "receiver_city": "Dubai",
                "receiver_country": "UAE",
                "receiver_zip": "337-1500",
                "description": "Mysore Pure Silk Sarees with Gold Zari & Kurtis",
                "packages_count": 4,
                "actual_weight": 14.0,
                "length": 45.0, "width": 35.0, "height": 30.0,
                "volumetric_weight": 9.45,
                "chargeable_weight": 14.0,
                "courier": "Aramex",
                "service_type": "Aramex Value Express",
                "provider_type": "postpaid",
                "provider_name": "Aramex",
                "price": 12800.0,
                "provider_cost": 7900.0,
                "actual_provider_cost": 7900.0,
                "gross_profit": 4900.0,
                "payment_status": "Paid",
                "payment_method": "Cash",
                "paid_to": "Main Office Petty Cash",
                "collected_by": "Umesh Gowda",
                "status": "Booked",
                "center": "Delhi Regional Hub"
            },
            # 4. FedEx - Bangalore -> Singapore Connectors (B2B Credit)
            {
                "awb": "FMC-BLR-89213",
                "date": yesterday_str,
                "pickup_date": yesterday_str,
                "delivery_date": today_str,
                "customer_name": "Rohan Mehra",
                "customer_type": "B2B",
                "receiver_name": "Singapore Tech Imports Pte",
                "receiver_phone": "+65 6789 0123",
                "receiver_city": "Singapore",
                "receiver_country": "Singapore",
                "receiver_zip": "048623",
                "description": "Industrial Precision Electronic Connectors & Cables",
                "packages_count": 6,
                "actual_weight": 42.0,
                "length": 60.0, "width": 40.0, "height": 40.0,
                "volumetric_weight": 19.2,
                "chargeable_weight": 42.0,
                "courier": "FedEx",
                "service_type": "FedEx International Economy Freight",
                "provider_type": "postpaid",
                "provider_name": "FedEx",
                "price": 38500.0,
                "provider_cost": 24000.0,
                "actual_provider_cost": 24000.0,
                "gross_profit": 14500.0,
                "payment_status": "B2B Credit",
                "payment_method": "B2B Credit",
                "paid_to": "HDFC Current Account",
                "collected_by": "Nawaz Khan",
                "status": "In Transit",
                "center": "Main Hub (Bangalore)"
            },
            # 5. DHL - Kolkata -> Australia Sydney (Paid PhonePe)
            {
                "awb": "FMC-BLR-89214",
                "date": prev2_str,
                "pickup_date": prev2_str,
                "delivery_date": today_str,
                "customer_name": "Karthik Raja",
                "customer_type": "C2C",
                "receiver_name": "Meera Raja",
                "receiver_phone": "+61 2 9123 4567",
                "receiver_city": "Sydney",
                "receiver_country": "Australia",
                "receiver_zip": "2000",
                "description": "Personal Effects & Engineering Textbooks",
                "packages_count": 1,
                "actual_weight": 11.0,
                "length": 40.0, "width": 30.0, "height": 25.0,
                "volumetric_weight": 6.0,
                "chargeable_weight": 11.0,
                "courier": "DHL",
                "service_type": "DHL Express Worldwide",
                "provider_type": "postpaid",
                "provider_name": "DHL Express",
                "price": 14200.0,
                "provider_cost": 9100.0,
                "actual_provider_cost": 9100.0,
                "gross_profit": 5100.0,
                "payment_status": "Paid",
                "payment_method": "PhonePe",
                "paid_to": "Office QR (PhonePe)",
                "collected_by": "Uma Maheshwari",
                "status": "Delivered",
                "center": "Kolkata Center"
            },
            # 6. Blue Dart - Kolkata -> Canada Toronto (Paid Cash)
            {
                "awb": "FMC-BLR-89215",
                "date": prev3_str,
                "pickup_date": prev3_str,
                "customer_name": "Karthik Raja",
                "customer_type": "C2C",
                "receiver_name": "Toronto Ethnic Fashions",
                "receiver_phone": "+1 416 555 0182",
                "receiver_city": "Toronto",
                "receiver_country": "Canada",
                "receiver_zip": "M5V 2T6",
                "description": "Embroidered Silk Shawls & Dupattas",
                "packages_count": 2,
                "actual_weight": 7.0,
                "length": 30.0, "width": 25.0, "height": 20.0,
                "volumetric_weight": 3.0,
                "chargeable_weight": 7.0,
                "courier": "Blue Dart",
                "service_type": "Blue Dart Apex Express",
                "provider_type": "postpaid",
                "provider_name": "Blue Dart",
                "price": 8900.0,
                "provider_cost": 5600.0,
                "actual_provider_cost": 5600.0,
                "gross_profit": 3300.0,
                "payment_status": "Paid",
                "payment_method": "Cash",
                "paid_to": "Main Office Petty Cash",
                "collected_by": "Umesh Gowda",
                "status": "Delayed",
                "delay_reason": "Customs clearance inspection at Toronto Pearson Airport",
                "center": "Kolkata Center"
            },
            # 7. ICL - Mumbai -> Germany Munich Automotive (Prepaid Wallet ICL)
            {
                "awb": "FMC-BLR-89216",
                "date": prev5_str,
                "pickup_date": prev5_str,
                "delivery_date": prev2_str,
                "customer_name": "Suresh Kulkarni",
                "customer_type": "B2B",
                "receiver_name": "Bavaria Auto Sensors GmbH",
                "receiver_phone": "+49 89 2345 6789",
                "receiver_city": "Munich",
                "receiver_country": "Germany",
                "receiver_zip": "80331",
                "description": "Automotive Sensors & ECU Prototypes",
                "packages_count": 3,
                "actual_weight": 18.5,
                "length": 50.0, "width": 30.0, "height": 25.0,
                "volumetric_weight": 7.5,
                "chargeable_weight": 18.5,
                "courier": "ICL",
                "service_type": "ICL Air Freight Direct",
                "provider_type": "prepaid",
                "provider_name": "ICL",
                "price": 22400.0,
                "provider_cost": 14200.0,
                "actual_provider_cost": 14200.0,
                "gross_profit": 8200.0,
                "payment_status": "B2B Credit",
                "payment_method": "B2B Credit",
                "paid_to": "HDFC Current Account",
                "collected_by": "Nawaz Khan",
                "status": "Delivered",
                "center": "Mumbai Branch"
            },
            # 8. BRV - Hyderabad -> UK London Organic Spices (Prepaid Wallet BRV)
            {
                "awb": "FMC-BLR-89217",
                "date": prev7_str,
                "pickup_date": prev7_str,
                "delivery_date": prev3_str,
                "customer_name": "Meera Nambiar",
                "customer_type": "B2C",
                "receiver_name": "Green Leaf Gourmet London",
                "receiver_phone": "+44 20 7123 4567",
                "receiver_city": "London",
                "receiver_country": "United Kingdom",
                "receiver_zip": "W1D 3NE",
                "description": "Cardamom, Tellicherry Black Pepper & Pure Saffron",
                "packages_count": 2,
                "actual_weight": 6.0,
                "length": 30.0, "width": 20.0, "height": 15.0,
                "volumetric_weight": 1.8,
                "chargeable_weight": 6.0,
                "courier": "BRV",
                "service_type": "BRV Air Express Courier",
                "provider_type": "prepaid",
                "provider_name": "BRV",
                "price": 7800.0,
                "provider_cost": 4800.0,
                "actual_provider_cost": 4800.0,
                "gross_profit": 3000.0,
                "payment_status": "Paid",
                "payment_method": "PhonePe",
                "paid_to": "Office QR (PhonePe)",
                "collected_by": "Lata Ramesh",
                "status": "Delivered",
                "center": "Hyderabad Hub"
            },
            # 9. Aramex - Delhi -> USA New York Handicrafts (Partial Payment)
            {
                "awb": "FMC-BLR-89218",
                "date": prev10_str,
                "pickup_date": prev10_str,
                "delivery_date": prev5_str,
                "customer_name": "Rajesh Gupta",
                "customer_type": "B2C",
                "receiver_name": "Manhattan Artisans Boutique",
                "receiver_phone": "+1 212 555 9812",
                "receiver_city": "New York",
                "receiver_country": "USA",
                "receiver_zip": "10001",
                "description": "Brass Statues, Wooden Carvings & Handcrafted Wall Decor",
                "packages_count": 5,
                "actual_weight": 28.0,
                "length": 55.0, "width": 40.0, "height": 35.0,
                "volumetric_weight": 15.4,
                "chargeable_weight": 28.0,
                "courier": "Aramex",
                "service_type": "Aramex Value Express",
                "provider_type": "postpaid",
                "provider_name": "Aramex",
                "price": 26500.0,
                "provider_cost": 16500.0,
                "actual_provider_cost": 17200.0,
                "cost_reconciled": True,
                "gross_profit": 9300.0,
                "payment_status": "Partial",
                "payment_method": "Google Pay",
                "paid_to": "Office QR (PhonePe)",
                "collected_by": "Umesh Gowda",
                "status": "Delivered",
                "center": "Delhi Regional Hub"
            },
            # 10. DHL - Delhi -> UK Oxford Student Baggage (Paid via Bank)
            {
                "awb": "FMC-BLR-89219",
                "date": prev14_str,
                "pickup_date": prev14_str,
                "delivery_date": prev10_str,
                "customer_name": "Sneha Reddy",
                "customer_type": "C2C",
                "receiver_name": "Sneha Reddy (St. Anne's College)",
                "receiver_phone": "+44 1865 274800",
                "receiver_city": "Oxford",
                "receiver_country": "United Kingdom",
                "receiver_zip": "OX2 6HS",
                "description": "Academic Transcripts, Personal Books & Winter Clothing",
                "packages_count": 2,
                "actual_weight": 16.0,
                "length": 45.0, "width": 35.0, "height": 25.0,
                "volumetric_weight": 7.87,
                "chargeable_weight": 16.0,
                "courier": "DHL",
                "service_type": "DHL Express Worldwide",
                "provider_type": "postpaid",
                "provider_name": "DHL Express",
                "price": 18500.0,
                "provider_cost": 11800.0,
                "actual_provider_cost": 11800.0,
                "gross_profit": 6700.0,
                "payment_status": "Paid",
                "payment_method": "Bank Transfer",
                "paid_to": "HDFC Current Account",
                "collected_by": "Uma Maheshwari",
                "status": "Delivered",
                "center": "Delhi Regional Hub"
            },
            # 11. Blue Dart - Mumbai Peenya Tooling Spares (Domestic Mumbai Express)
            {
                "awb": "FMC-BLR-89220",
                "date": prev20_str,
                "pickup_date": prev20_str,
                "delivery_date": prev14_str,
                "customer_name": "Vikram Singh",
                "customer_type": "B2C",
                "receiver_name": "Maharashtra Heavy Tooling Works",
                "receiver_phone": "+91 98200 11990",
                "receiver_city": "Mumbai",
                "receiver_country": "India",
                "receiver_zip": "400093",
                "domestic_international": "Domestic",
                "description": "Carbide Cutting Inserts & Tool Holders",
                "packages_count": 1,
                "actual_weight": 4.5,
                "length": 25.0, "width": 20.0, "height": 10.0,
                "volumetric_weight": 1.0,
                "chargeable_weight": 4.5,
                "courier": "Blue Dart",
                "service_type": "Domestic Air Surface Express",
                "provider_type": "postpaid",
                "provider_name": "Blue Dart",
                "price": 2400.0,
                "provider_cost": 1350.0,
                "actual_provider_cost": 1350.0,
                "gross_profit": 1050.0,
                "payment_status": "Paid",
                "payment_method": "PhonePe",
                "paid_to": "Office QR (PhonePe)",
                "collected_by": "Nawaz Khan",
                "status": "Delivered",
                "center": "Mumbai Branch"
            },
            # 12. FedEx - Hyderabad -> USA Chicago Bulk Silk (B2B Credit Net 30 - Overdue)
            {
                "awb": "FMC-BLR-89221",
                "date": prev30_str,
                "pickup_date": prev30_str,
                "delivery_date": prev20_str,
                "customer_name": "Ananya Sharma",
                "customer_type": "B2B",
                "receiver_name": "Midwest Indian Fashion House",
                "receiver_phone": "+1 312 555 0199",
                "receiver_city": "Chicago",
                "receiver_country": "USA",
                "receiver_zip": "60601",
                "description": "Silk Bridal Lehengas & Handcrafted Dupattas",
                "packages_count": 8,
                "actual_weight": 54.0,
                "length": 70.0, "width": 50.0, "height": 45.0,
                "volumetric_weight": 31.5,
                "chargeable_weight": 54.0,
                "courier": "FedEx",
                "service_type": "FedEx International Economy Freight",
                "provider_type": "postpaid",
                "provider_name": "FedEx",
                "price": 49000.0,
                "provider_cost": 31000.0,
                "actual_provider_cost": 31000.0,
                "gross_profit": 18000.0,
                "payment_status": "B2B Credit",
                "payment_method": "B2B Credit",
                "paid_to": "HDFC Current Account",
                "collected_by": "Umesh Gowda",
                "status": "Delivered",
                "center": "Hyderabad Hub"
            }
        ]

        for s in shipments_seed:
            cust = cust_map.get(s["customer_name"])
            cid = cust.id if cust else None
            b2b_id = cust.b2b_company_id if cust else None

            existing_ship = db.query(Shipment).filter(Shipment.awb == s["awb"]).first()
            if not existing_ship:
                existing_ship = Shipment(
                    id=f"ship_{uuid.uuid4().hex[:8]}",
                    awb=s["awb"],
                    date=s["date"],
                    pickup_date=s.get("pickup_date"),
                    delivery_date=s.get("delivery_date"),
                    customer_id=cid,
                    customer_name=s["customer_name"],
                    customer_type=s["customer_type"],
                    b2b_company_id=b2b_id,
                    center=s["center"],
                    employee=s["collected_by"],
                    sender_name=s["customer_name"],
                    sender_phone=cust.mobile if cust else "+91 98000 00000",
                    sender_address=cust.address if cust else "Bangalore, India",
                    receiver_name=s["receiver_name"],
                    receiver_phone=s["receiver_phone"],
                    receiver_city=s["receiver_city"],
                    receiver_country=s["receiver_country"],
                    receiver_zip=s["receiver_zip"],
                    receiver_address=f"Suite / Door 24, {s['receiver_city']}, {s['receiver_country']}",
                    description=s["description"],
                    packages_count=s["packages_count"],
                    actual_weight=s["actual_weight"],
                    length=s["length"], width=s["width"], height=s["height"],
                    volumetric_weight=s["volumetric_weight"],
                    chargeable_weight=s["chargeable_weight"],
                    courier=s["courier"],
                    domestic_international=s.get("domestic_international", "International"),
                    service_type=s["service_type"],
                    provider_type=s["provider_type"],
                    provider_name=s["provider_name"],
                    price=s["price"],
                    provider_cost=s["provider_cost"],
                    actual_provider_cost=s["actual_provider_cost"],
                    cost_reconciled=s.get("cost_reconciled", False),
                    gross_profit=s["gross_profit"],
                    payment_status=s["payment_status"],
                    payment_method=s["payment_method"],
                    paid_to=s["paid_to"],
                    collected_by=s["collected_by"],
                    status=s["status"],
                    delay_reason=s.get("delay_reason"),
                    created_at=datetime.datetime.strptime(s["date"], '%Y-%m-%d')
                )
                db.add(existing_ship)
            else:
                existing_ship.center = s["center"]
                existing_ship.customer_name = s["customer_name"]
                existing_ship.customer_type = s["customer_type"]
                existing_ship.customer_id = cid
                existing_ship.date = s["date"]
                existing_ship.pickup_date = s.get("pickup_date")
                existing_ship.delivery_date = s.get("delivery_date")
            db.commit()
            db.refresh(existing_ship)

            # Generate matching invoice
            inv_no = f"INV-2026-{s['awb'][-5:]}"
            existing_inv = db.query(Invoice).filter(Invoice.invoice_no == inv_no).first()
            if not existing_inv:
                is_paid = s["payment_status"] == "Paid"
                is_credit = s["payment_status"] == "B2B Credit"
                is_partial = s["payment_status"] == "Partial"

                if is_paid:
                    paid_amt = s["price"]
                    bal_amt = 0.0
                    inv_status = "Paid"
                elif is_partial:
                    paid_amt = round(s["price"] * 0.5)
                    bal_amt = s["price"] - paid_amt
                    inv_status = "Partial"
                elif is_credit:
                    paid_amt = 0.0
                    bal_amt = s["price"]
                    # If older than 30 days, mark overdue
                    inv_status = "Overdue" if s["date"] <= prev30_str else "Due"
                else:
                    paid_amt = 0.0
                    bal_amt = s["price"]
                    inv_status = "Due"

                new_inv = Invoice(
                    id=f"inv_{uuid.uuid4().hex[:8]}",
                    invoice_no=inv_no,
                    date=s["date"],
                    due_date=(datetime.datetime.strptime(s["date"], '%Y-%m-%d') + datetime.timedelta(days=30)).strftime('%Y-%m-%d'),
                    customer_id=cid,
                    customer_name=s["customer_name"],
                    b2b_company_id=b2b_id,
                    shipment_id=existing_ship.id,
                    awb=s["awb"],
                    courier=s["courier"],
                    service=s["service_type"],
                    description=s["description"],
                    amount=round(s["price"] / 1.18, 2), # Pre-tax
                    gst=round(s["price"] - (s["price"] / 1.18), 2),
                    total=s["price"],
                    paid=paid_amt,
                    balance=bal_amt,
                    status=inv_status,
                    created_at=datetime.datetime.strptime(s["date"], '%Y-%m-%d')
                )
                db.add(new_inv)
                db.commit()

        # ----------------------------------------------------
        # 5. Customer Follow-ups (Retention, Invoices, B2B)
        # ----------------------------------------------------
        print("🔔 [6/9] Seeding Customer Follow-ups & Reminders...")
        followups_seed = [
            {
                "customer": "Dr. Vivek Murthy",
                "customer_name": "Dr. Vivek Murthy",
                "category": "Customer Retention",
                "due_date": today_str,
                "priority": "High",
                "channel_action": "WhatsApp",
                "notes": "Quote for 50kg temperature-controlled cold chain Europe medical shipment",
                "status": "Pending"
            },
            {
                "customer": "Apex Global Exports Pvt Ltd",
                "customer_name": "Rohan Mehra",
                "category": "B2B Payment",
                "due_date": today_str,
                "priority": "Medium",
                "channel_action": "Email",
                "notes": "Dispatch monthly B2B statement and reconcile Net 30 credit payments",
                "status": "Pending"
            },
            {
                "customer": "Mysore Royal Silks & Handlooms",
                "customer_name": "Ananya Sharma",
                "category": "Invoice Due",
                "due_date": next1_str,
                "priority": "High",
                "channel_action": "Call",
                "notes": "Payment follow-up for overdue Chicago freight invoice (INV-2026-89221 - ₹49,000)",
                "status": "Pending"
            },
            {
                "customer": "Pooja Hegde",
                "customer_name": "Pooja Hegde",
                "category": "Customer Retention",
                "due_date": yesterday_str,
                "priority": "Low",
                "channel_action": "WhatsApp",
                "notes": "San Francisco live tracking link shared; collected 5-star customer feedback",
                "status": "Done"
            },
            {
                "customer": "Meera Nambiar",
                "customer_name": "Meera Nambiar",
                "category": "Inactivity 15d",
                "due_date": next3_str,
                "priority": "Medium",
                "channel_action": "WhatsApp",
                "notes": "Special discount offering on UK organic spices export rates",
                "status": "Pending"
            }
        ]

        for f in followups_seed:
            cust = cust_map.get(f["customer_name"])
            existing_f = db.query(Followup).filter(Followup.notes == f["notes"]).first()
            if not existing_f:
                new_f = Followup(
                    id=f"fu_{uuid.uuid4().hex[:8]}",
                    customer_id=cust.id if cust else None,
                    customer=f["customer"],
                    category=f["category"],
                    due_date=f["due_date"],
                    priority=f["priority"],
                    status=f["status"],
                    channel_action=f["channel_action"],
                    notes=f["notes"],
                    created_at=now - datetime.timedelta(days=2)
                )
                db.add(new_f)
        db.commit()

        # ----------------------------------------------------
        # 6. Communication Logs (WhatsApp / Call logs)
        # ----------------------------------------------------
        print("💬 [7/9] Seeding Customer Communication History...")
        comm_seeds = [
            {
                "customer": "Pooja Hegde",
                "date": today_str,
                "channel": "WhatsApp",
                "staff": "Nawaz Khan",
                "message": "Hi Pooja, your FedEx parcel FMC-BLR-89210 is dispatched to San Francisco. Live tracking: https://flymycart.com/track/FMC-BLR-89210",
                "status": "Delivered"
            },
            {
                "customer": "Ananya Sharma",
                "date": yesterday_str,
                "channel": "WhatsApp",
                "staff": "Umesh Gowda",
                "message": "Dear Ananya, your Dubai Aramex shipment FMC-BLR-89212 has been booked successfully. Invoice #INV-2026-89212 generated.",
                "status": "Delivered"
            },
            {
                "customer": "Dr. Vivek Murthy",
                "date": prev2_str,
                "channel": "Call",
                "staff": "Lata Ramesh",
                "message": "Discussed cold-chain packaging dry ice requirements with Dr. Murthy for Berlin batch.",
                "status": "Delivered"
            }
        ]

        for comm in comm_seeds:
            cust = cust_map.get(comm["customer"])
            existing_c = db.query(CommunicationLog).filter(CommunicationLog.message == comm["message"]).first()
            if not existing_c:
                c_obj = CommunicationLog(
                    id=f"comm_{uuid.uuid4().hex[:8]}",
                    customer_id=cust.id if cust else None,
                    customer=comm["customer"],
                    date=comm["date"],
                    channel=comm["channel"],
                    staff=comm["staff"],
                    message=comm["message"],
                    status=comm["status"],
                    created_at=now - datetime.timedelta(days=1)
                )
                db.add(c_obj)
        db.commit()

        # ----------------------------------------------------
        # 7. Prepaid Wallet Transactions (ICL & BRV)
        # ----------------------------------------------------
        print("💳 [8/9] Seeding Prepaid Wallet Recharges & Usages...")
        wallet_seeds = [
            {
                "date": prev10_str,
                "wallet": "ICL",
                "type": "recharge",
                "amount": 50000.0,
                "paid_from": "HDFC Current Account",
                "reference": "HDFC-NEFT-ICL-99812",
                "awb": "-",
                "notes": "Prepaid wallet top-up for ICL Air Express",
                "balance_after": 50000.0
            },
            {
                "date": prev5_str,
                "wallet": "ICL",
                "type": "usage",
                "amount": 14200.0,
                "paid_from": "ICL Wallet",
                "reference": "AWB-FMC-BLR-89216",
                "awb": "FMC-BLR-89216",
                "notes": "Air waybill deduction for Munich Germany automotive consignment",
                "balance_after": 35800.0
            },
            {
                "date": prev14_str,
                "wallet": "BRV",
                "type": "recharge",
                "amount": 40000.0,
                "paid_from": "HDFC Current Account",
                "reference": "HDFC-RTGS-BRV-4410",
                "awb": "-",
                "notes": "Opening deposit recharge for BRV Courier Services",
                "balance_after": 40000.0
            },
            {
                "date": prev7_str,
                "wallet": "BRV",
                "type": "usage",
                "amount": 4800.0,
                "paid_from": "BRV Wallet",
                "reference": "AWB-FMC-BLR-89217",
                "awb": "FMC-BLR-89217",
                "notes": "Air waybill cost deduction for London UK spices parcel",
                "balance_after": 35200.0
            }
        ]

        for w in wallet_seeds:
            existing_w = db.query(WalletTransaction).filter(WalletTransaction.reference == w["reference"]).first()
            if not existing_w:
                w_obj = WalletTransaction(
                    id=f"tx_{uuid.uuid4().hex[:8]}",
                    date=w["date"],
                    wallet=w["wallet"],
                    type=w["type"],
                    amount=w["amount"],
                    paid_from=w["paid_from"],
                    reference=w["reference"],
                    awb=w["awb"],
                    notes=w["notes"],
                    balance_after=w["balance_after"],
                    created_at=datetime.datetime.strptime(w["date"], '%Y-%m-%d')
                )
                db.add(w_obj)
        db.commit()

        # ----------------------------------------------------
        # 8. Customer Refunds & Reconciliation Batches
        # ----------------------------------------------------
        print("⚖️ [9/9] Seeding Refund Claims & Provider Cost Reconciliation...")
        # Refund 1: Volumetric recalculation approved & refunded
        ref1 = db.query(Refund).filter(Refund.awb == "FMC-BLR-89215").first()
        if not ref1:
            ref1 = Refund(
                id=f"ref_{uuid.uuid4().hex[:8]}",
                customer="Ananya Sharma",
                customer_id=cust_map["Ananya Sharma"].id,
                awb="FMC-BLR-89215",
                invoice_no="INV-2026-89215",
                amount=850.0,
                reason="Volumetric weight recalculation discount adjustment credited back",
                requested_by="Umesh Gowda",
                request_date=prev2_str,
                status="Refunded",
                approved_by="Gangabathina Chanakya",
                approval_date=yesterday_str,
                refund_date=today_str,
                refund_method="UPI Transfer (PhonePe)",
                created_at=now - datetime.timedelta(days=2)
            )
            db.add(ref1)

        # Refund 2: Requested pending super admin approval
        ref2 = db.query(Refund).filter(Refund.awb == "FMC-BLR-89218").first()
        if not ref2:
            ref2 = Refund(
                id=f"ref_{uuid.uuid4().hex[:8]}",
                customer="Rajesh Gupta",
                customer_id=cust_map["Rajesh Gupta"].id,
                awb="FMC-BLR-89218",
                invoice_no="INV-2026-89218",
                amount=1200.0,
                reason="Minor packaging carton dent goodwill credit claim",
                requested_by="Umesh Gowda",
                request_date=today_str,
                status="Requested",
                created_at=now
            )
            db.add(ref2)

        # Reconciliation Batch for Aramex
        rec_batch = db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_no == "REC-202609-ARX1").first()
        if not rec_batch:
            rec_batch = ReconciliationBatch(
                id=f"rec_{uuid.uuid4().hex[:8]}",
                batch_no="REC-202609-ARX1",
                date=today_str,
                provider="Aramex",
                bill_reference="ARAMEX-AUG-INV-88910",
                total_shipments=2,
                predicted_total=24400.0,
                actual_bill=25100.0,
                variance=700.0,
                status="Applied",
                matched_count=1,
                discrepancy_count=1,
                notes="Reconciliation batch applied. Real Gross Profit updated for Aramex shipments.",
                created_at=now
            )
            db.add(rec_batch)
            db.commit()

            # Reconciliation Items
            item1 = ReconciliationItem(
                id=f"reci_{uuid.uuid4().hex[:8]}",
                batch_id=rec_batch.id,
                awb="FMC-BLR-89212",
                shipment_id=db.query(Shipment).filter(Shipment.awb == "FMC-BLR-89212").first().id,
                customer_name="Ananya Sharma",
                predicted_cost=7900.0,
                actual_cost=7900.0,
                variance=0.0,
                status="MATCHED",
                notes="Exact cost match"
            )
            item2 = ReconciliationItem(
                id=f"reci_{uuid.uuid4().hex[:8]}",
                batch_id=rec_batch.id,
                awb="FMC-BLR-89218",
                shipment_id=db.query(Shipment).filter(Shipment.awb == "FMC-BLR-89218").first().id,
                customer_name="Rajesh Gupta",
                predicted_cost=16500.0,
                actual_cost=17200.0,
                variance=700.0,
                status="WRONG AMOUNT",
                notes="Carrier fuel surcharge variance +₹700"
            )
            db.add_all([item1, item2])

        db.commit()
        print("🎉 ✅ All Rich Demo Data Populated Successfully into Fly My Cart CRM!")
        return True

    except Exception as e:
        db.rollback()
        print(f"❌ Error while seeding demo data: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_seed()
