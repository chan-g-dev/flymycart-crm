# ================================================================
# FLY MY CART CRM - COMPREHENSIVE LIVE SEED DATA (SEPTEMBER 2026)
# ================================================================

import uuid
import datetime
import random
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models import (
    Customer, B2BCompany, Shipment, Invoice, PaymentCollection,
    AccountingEntry, WalletTransaction, ReconciliationBatch,
    ReconciliationItem, Followup, CommunicationLog, Refund,
    AttendanceRecord, SystemSettings, ShipmentTrackingEvent
)
from app.finance_engine import calculate_gross_profit


def seed_comprehensive_live_data():
    db = SessionLocal()
    try:
        print("1. Clearing transactional records...")
        db.query(ReconciliationItem).delete()
        db.query(ReconciliationBatch).delete()
        db.query(PaymentCollection).delete()
        db.query(Invoice).delete()
        db.query(Refund).delete()
        db.query(Followup).delete()
        db.query(CommunicationLog).delete()
        db.query(AccountingEntry).delete()
        db.query(WalletTransaction).delete()
        db.query(ShipmentTrackingEvent).delete()
        db.query(Shipment).delete()
        db.query(AttendanceRecord).delete()
        db.commit()

        # Update System Settings with clean standard accounts
        settings = db.query(SystemSettings).first()
        if settings:
            config = settings.config_json or {}
            config["paidToAccounts"] = [
                "Main Bank Account (HDFC)",
                "Office Cash Drawer",
                "PhonePe QR Account",
                "ICICI Current Account"
            ]
            config["expenseCategories"] = [
                "Office Rent",
                "Packaging Materials",
                "Software & Internet",
                "Electricity & Utilities",
                "Courier Supplies",
                "Staff Welfare & Refreshments",
                "Vehicle Fuel & Conveyance",
                "Marketing & Promotion"
            ]
            config["prepaidWallets"] = [
                {"name": "ICL", "openingBalance": 35000.0, "notes": "ICL Prepaid Carrier Wallet"},
                {"name": "Atlantic", "openingBalance": 20000.0, "notes": "Atlantic Worldwide Wallet"}
            ]
            config["postpaidProviders"] = [
                {"name": "FedEx", "deposit": 50000.0, "billingCycle": "Weekly", "notes": "FedEx Express Postpaid"},
                {"name": "Aramex", "deposit": 30000.0, "billingCycle": "Bi-weekly", "notes": "Aramex Postpaid Ledger"},
                {"name": "DHL", "deposit": 40000.0, "billingCycle": "Monthly", "notes": "DHL Express Postpaid"},
                {"name": "UPS", "deposit": 25000.0, "billingCycle": "Monthly", "notes": "UPS International Postpaid"}
            ]
            settings.config_json = config
            db.commit()

        print("2. Seeding B2B Companies & Customers...")
        companies_data = [
            {
                "id": "b2b_apex",
                "company_name": "Apex Global Exports Pvt Ltd",
                "contact_person": "Vikram Malhotra",
                "mobile": "9845012345",
                "email": "exports@apexglobal.in",
                "gst_number": "29AABCA1234F1Z5",
                "billing_address": "42, Export Zone, Whitefield, Bangalore - 560066",
                "credit_limit": 250000.0,
                "credit_period_days": 30
            },
            {
                "id": "b2b_horizon",
                "company_name": "Horizon Electronics Corp",
                "contact_person": "Ritu Singhania",
                "mobile": "9880098765",
                "email": "finance@horizonelec.com",
                "gst_number": "29AABCH5678K1Z2",
                "billing_address": "Plot 12, Electronics City Phase 1, Bangalore - 560100",
                "credit_limit": 180000.0,
                "credit_period_days": 45
            },
            {
                "id": "b2b_globe",
                "company_name": "Globe Courier B2B",
                "contact_person": "Nawaz Pasha",
                "mobile": "9886179959",
                "email": "globe@flymycart.internal",
                "gst_number": "29AABCG9012M1Z8",
                "billing_address": "Maruthi Sevanagar, Bangalore - 560033",
                "credit_limit": 100000.0,
                "credit_period_days": 30
            },
            {
                "id": "b2b_nexus",
                "company_name": "Nexus Biotech Labs",
                "contact_person": "Dr. Sameer Joshi",
                "mobile": "9741234567",
                "email": "logistics@nexusbio.in",
                "gst_number": "29AABCN3456P1Z3",
                "billing_address": "88, Bio Innovation Park, Peenya, Bangalore - 560058",
                "credit_limit": 150000.0,
                "credit_period_days": 30
            }
        ]

        b2b_map = {}
        for c_data in companies_data:
            existing = db.get(B2BCompany, c_data["id"])
            if not existing:
                existing = B2BCompany(**c_data)
                db.add(existing)
            else:
                for k, v in c_data.items():
                    setattr(existing, k, v)
            db.commit()
            db.refresh(existing)
            b2b_map[c_data["company_name"]] = existing

        # Customers (B2B and Retail)
        customers_data = [
            {
                "name": "Apex Global Exports Pvt Ltd",
                "company": "Apex Global Exports Pvt Ltd",
                "mobile": "9845012345",
                "email": "exports@apexglobal.in",
                "address": "42, Export Zone, Whitefield, Bangalore - 560066",
                "customer_type": "B2B",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz",
                "credit_limit": 250000.0,
                "b2b_company_id": b2b_map["Apex Global Exports Pvt Ltd"].id
            },
            {
                "name": "Horizon Electronics Corp",
                "company": "Horizon Electronics Corp",
                "mobile": "9880098765",
                "email": "finance@horizonelec.com",
                "address": "Plot 12, Electronics City Phase 1, Bangalore - 560100",
                "customer_type": "B2B",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Akash",
                "credit_limit": 180000.0,
                "b2b_company_id": b2b_map["Horizon Electronics Corp"].id
            },
            {
                "name": "Globe Courier B2B",
                "company": "Globe Courier B2B",
                "mobile": "9886179959",
                "email": "globe@flymycart.internal",
                "address": "Maruthi Sevanagar, Bangalore - 560033",
                "customer_type": "B2B",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz",
                "credit_limit": 100000.0,
                "b2b_company_id": b2b_map["Globe Courier B2B"].id
            },
            {
                "name": "Nexus Biotech Labs",
                "company": "Nexus Biotech Labs",
                "mobile": "9741234567",
                "email": "logistics@nexusbio.in",
                "address": "88, Bio Innovation Park, Peenya, Bangalore - 560058",
                "customer_type": "B2B",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Akash",
                "credit_limit": 150000.0,
                "b2b_company_id": b2b_map["Nexus Biotech Labs"].id
            },
            {
                "name": "Priya Sharma",
                "company": "",
                "mobile": "9844112233",
                "email": "priya.sharma@gmail.com",
                "address": "15, 4th Cross, Indiranagar, Bangalore - 560038",
                "customer_type": "C2C",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Akash",
                "credit_limit": 0.0
            },
            {
                "name": "Dr. Anand Verma",
                "company": "Apollo Health Consult",
                "mobile": "9820033445",
                "email": "anand.verma@apollo.org",
                "address": "77, MG Road, Bangalore - 560001",
                "customer_type": "B2C",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz",
                "credit_limit": 20000.0
            },
            {
                "name": "Sneha Kulkarni",
                "company": "",
                "mobile": "9900223344",
                "email": "sneha.kulkarni@yahoo.com",
                "address": "12, Koramangala 5th Block, Bangalore - 560095",
                "customer_type": "C2C",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Akash",
                "credit_limit": 0.0
            },
            {
                "name": "Vikram Reddy",
                "company": "Reddy Spices",
                "mobile": "9845556677",
                "email": "vikram@reddyspices.com",
                "address": "33, Commercial Street, Bangalore - 560042",
                "customer_type": "B2C",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz",
                "credit_limit": 30000.0
            },
            {
                "name": "Amit Sengupta",
                "company": "",
                "mobile": "9731112233",
                "email": "amit.sengupta@outlook.com",
                "address": "5B, HSR Layout Sector 2, Bangalore - 560102",
                "customer_type": "C2C",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Akash",
                "credit_limit": 0.0
            },
            {
                "name": "Aisha Khan",
                "company": "Zari Boutique",
                "mobile": "9880011224",
                "email": "aisha@zariboutique.in",
                "address": "90, Jayanagar 4th Block, Bangalore - 560011",
                "customer_type": "B2C",
                "center": "Main Hub (Bangalore)",
                "assigned_employee": "Nawaz",
                "credit_limit": 25000.0
            }
        ]

        cust_map = {}
        for c in customers_data:
            existing = db.query(Customer).filter_by(name=c["name"]).first()
            if not existing:
                existing = Customer(**c)
                db.add(existing)
            else:
                for k, v in c.items():
                    setattr(existing, k, v)
            db.commit()
            db.refresh(existing)
            cust_map[c["name"]] = existing

        print("3. Seeding Shipments & Invoices for September 2026...")
        shipments_spec = [
            # Week 1: Sept 1 - Sept 7
            {"awb": "FDX-900101", "date": "2026-09-01", "cust": "Apex Global Exports Pvt Ltd", "courier": "FedEx", "provider_type": "postpaid", "dest": "U.S.A.", "city": "New York", "weight": 14.5, "price": 12500.0, "cost": 8900.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ARX-900102", "date": "2026-09-02", "cust": "Globe Courier B2B", "courier": "Aramex", "provider_type": "postpaid", "dest": "U.A.E.", "city": "Dubai", "weight": 2.5, "price": 3200.0, "cost": 2100.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "DHL-900103", "date": "2026-09-03", "cust": "Horizon Electronics Corp", "courier": "DHL", "provider_type": "postpaid", "dest": "Germany", "city": "Frankfurt", "weight": 8.0, "price": 9800.0, "cost": 6700.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ICL-900104", "date": "2026-09-04", "cust": "Priya Sharma", "courier": "ICL", "provider_type": "prepaid", "dest": "United Kingdom", "city": "London", "weight": 1.5, "price": 2800.0, "cost": 1750.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ATL-900105", "date": "2026-09-05", "cust": "Dr. Anand Verma", "courier": "Atlantic", "provider_type": "prepaid", "dest": "Australia", "city": "Sydney", "weight": 3.2, "price": 4500.0, "cost": 2900.0, "pay_mode": "Office Cash Drawer", "pay_method": "Cash", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "FDX-900106", "date": "2026-09-06", "cust": "Nexus Biotech Labs", "courier": "FedEx", "provider_type": "postpaid", "dest": "Canada", "city": "Toronto", "weight": 5.0, "price": 6200.0, "cost": 4100.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "UPS-900107", "date": "2026-09-07", "cust": "Sneha Kulkarni", "courier": "UPS", "provider_type": "postpaid", "dest": "Singapore", "city": "Singapore", "weight": 1.0, "price": 2100.0, "cost": 1350.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},

            # Week 2: Sept 8 - Sept 14
            {"awb": "FDX-900201", "date": "2026-09-08", "cust": "Apex Global Exports Pvt Ltd", "courier": "FedEx", "provider_type": "postpaid", "dest": "U.S.A.", "city": "Chicago", "weight": 22.0, "price": 18500.0, "cost": 12800.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ARX-900202", "date": "2026-09-09", "cust": "Vikram Reddy", "courier": "Aramex", "provider_type": "postpaid", "dest": "Saudi Arabia", "city": "Riyadh", "weight": 4.5, "price": 5400.0, "cost": 3600.0, "pay_mode": "Office Cash Drawer", "pay_method": "Cash", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "DHL-900203", "date": "2026-09-10", "cust": "Horizon Electronics Corp", "courier": "DHL", "provider_type": "postpaid", "dest": "Japan", "city": "Tokyo", "weight": 12.0, "price": 14200.0, "cost": 9900.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ICL-900204", "date": "2026-09-11", "cust": "Amit Sengupta", "courier": "ICL", "provider_type": "prepaid", "dest": "Qatar", "city": "Doha", "weight": 2.0, "price": 3100.0, "cost": 1950.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ATL-900205", "date": "2026-09-12", "cust": "Aisha Khan", "courier": "Atlantic", "provider_type": "prepaid", "dest": "France", "city": "Paris", "weight": 3.8, "price": 4900.0, "cost": 3150.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "FDX-900206", "date": "2026-09-13", "cust": "Globe Courier B2B", "courier": "FedEx", "provider_type": "postpaid", "dest": "U.S.A.", "city": "San Francisco", "weight": 9.5, "price": 8600.0, "cost": 5900.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},
            {"awb": "ARX-900207", "date": "2026-09-14", "cust": "Nexus Biotech Labs", "courier": "Aramex", "provider_type": "postpaid", "dest": "Oman", "city": "Muscat", "weight": 6.2, "price": 6800.0, "cost": 4500.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Delivered"},

            # Week 3: Sept 15 - Sept 21
            {"awb": "FDX-900301", "date": "2026-09-15", "cust": "Apex Global Exports Pvt Ltd", "courier": "FedEx", "provider_type": "postpaid", "dest": "U.S.A.", "city": "Los Angeles", "weight": 18.0, "price": 15600.0, "cost": 10900.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Paid", "carrier_pay": "Pending", "status": "In Transit"},
            {"awb": "ARX-900302", "date": "2026-09-16", "cust": "Globe Courier B2B", "courier": "Aramex", "provider_type": "postpaid", "dest": "Lebanon", "city": "Beirut", "weight": 1.2, "price": 2400.0, "cost": 1600.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Pending", "status": "In Transit"},
            {"awb": "DHL-900303", "date": "2026-09-17", "cust": "Horizon Electronics Corp", "courier": "DHL", "provider_type": "postpaid", "dest": "Germany", "city": "Munich", "weight": 11.5, "price": 13500.0, "cost": 9200.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Unpaid", "carrier_pay": "Pending", "status": "In Transit"},
            {"awb": "ICL-900304", "date": "2026-09-18", "cust": "Priya Sharma", "courier": "ICL", "provider_type": "prepaid", "dest": "United Kingdom", "city": "Manchester", "weight": 2.2, "price": 3400.0, "cost": 2100.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "In Transit"},
            {"awb": "UPS-900305", "date": "2026-09-19", "cust": "Dr. Anand Verma", "courier": "UPS", "provider_type": "postpaid", "dest": "U.S.A.", "city": "Boston", "weight": 4.0, "price": 5100.0, "cost": 3400.0, "pay_mode": "Office Cash Drawer", "pay_method": "Cash", "pay_status": "Paid", "carrier_pay": "Pending", "status": "In Transit"},
            {"awb": "ATL-900306", "date": "2026-09-20", "cust": "Vikram Reddy", "courier": "Atlantic", "provider_type": "prepaid", "dest": "Australia", "city": "Melbourne", "weight": 5.5, "price": 6800.0, "cost": 4300.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Partial", "carrier_pay": "Paid", "status": "Customs Cleared"},
            {"awb": "FDX-900307", "date": "2026-09-21", "cust": "Nexus Biotech Labs", "courier": "FedEx", "provider_type": "postpaid", "dest": "Jordan", "city": "Amman", "weight": 3.0, "price": 4200.0, "cost": 2800.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Unpaid", "carrier_pay": "Pending", "status": "Out for Delivery"},

            # Today: Sept 22, 2026
            {"awb": "FDX-900401", "date": "2026-09-22", "cust": "Apex Global Exports Pvt Ltd", "courier": "FedEx", "provider_type": "postpaid", "dest": "U.S.A.", "city": "Dallas", "weight": 25.0, "price": 21000.0, "cost": 14500.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Unpaid", "carrier_pay": "Pending", "status": "Booked"},
            {"awb": "ARX-900402", "date": "2026-09-22", "cust": "Globe Courier B2B", "courier": "Aramex", "provider_type": "postpaid", "dest": "Philippines", "city": "Manila", "weight": 1.8, "price": 2700.0, "cost": 1750.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Pending", "status": "Booked"},
            {"awb": "DHL-900403", "date": "2026-09-22", "cust": "Horizon Electronics Corp", "courier": "DHL", "provider_type": "postpaid", "dest": "Germany", "city": "Berlin", "weight": 6.5, "price": 8200.0, "cost": 5500.0, "pay_mode": "Main Bank Account (HDFC)", "pay_method": "Bank Transfer", "pay_status": "Unpaid", "carrier_pay": "Pending", "status": "Booked"},
            {"awb": "ICL-900404", "date": "2026-09-22", "cust": "Sneha Kulkarni", "courier": "ICL", "provider_type": "prepaid", "dest": "United Kingdom", "city": "Birmingham", "weight": 0.8, "price": 1900.0, "cost": 1200.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Booked"},
            {"awb": "ATL-900405", "date": "2026-09-22", "cust": "Amit Sengupta", "courier": "Atlantic", "provider_type": "prepaid", "dest": "U.A.E.", "city": "Sharjah", "weight": 2.0, "price": 2900.0, "cost": 1800.0, "pay_mode": "Office Cash Drawer", "pay_method": "Cash", "pay_status": "Paid", "carrier_pay": "Paid", "status": "Booked"},
            {"awb": "UPS-900406", "date": "2026-09-22", "cust": "Aisha Khan", "courier": "UPS", "provider_type": "postpaid", "dest": "Qatar", "city": "Doha", "weight": 4.2, "price": 5300.0, "cost": 3500.0, "pay_mode": "PhonePe QR Account", "pay_method": "UPI", "pay_status": "Paid", "carrier_pay": "Pending", "status": "Booked"}
        ]

        inv_counter = 1
        for s in shipments_spec:
            customer = cust_map[s["cust"]]
            ship_id = f"ship_{uuid.uuid4().hex[:16]}"
            price = s["price"]
            gst_applicable = True
            gst_rate = 18.0
            gst_amount = round(price * 0.18, 2)
            total_amount = round(price + gst_amount, 2)
            cost = s["cost"]
            actual_cost = cost
            cost_reconciled = s["carrier_pay"] == "Paid"
            gross_profit = calculate_gross_profit(price, actual_cost if cost_reconciled else cost)

            shipment = Shipment(
                id=ship_id,
                awb=s["awb"],
                date=s["date"],
                pickup_date=s["date"],
                customer_id=customer.id,
                customer_name=customer.name,
                customer_type=customer.customer_type,
                b2b_company_id=customer.b2b_company_id,
                center="Main Hub (Bangalore)",
                employee=customer.assigned_employee or "Nawaz",
                sender_name=customer.name,
                sender_phone=customer.mobile,
                sender_email=customer.email,
                sender_address=customer.address,
                receiver_name=f"{s['dest']} Consignee",
                receiver_city=s["city"],
                receiver_country=s["dest"],
                actual_weight=s["weight"],
                chargeable_weight=s["weight"],
                packages_count=1,
                courier=s["courier"],
                provider_type=s["provider_type"],
                provider_name=s["courier"],
                service_type="International Express",
                price=price,
                is_gst_applicable=gst_applicable,
                gst_rate=gst_rate,
                gst_amount=gst_amount,
                total_amount=total_amount,
                provider_cost=cost,
                actual_provider_cost=actual_cost,
                cost_reconciled=cost_reconciled,
                gross_profit=gross_profit,
                payment_status=s["pay_status"],
                carrier_payment_status=s["carrier_pay"],
                payment_method=s["pay_method"],
                paid_to=s["pay_mode"],
                collected_by=customer.assigned_employee or "Nawaz",
                status=s["status"]
            )
            db.add(shipment)
            db.flush()

            # Tracking Events
            db.add(ShipmentTrackingEvent(
                shipment_id=ship_id,
                timestamp=datetime.datetime.strptime(s["date"] + " 10:00:00", "%Y-%m-%d %H:%M:%S"),
                status="Booked",
                location="Bangalore Main Hub",
                remarks="Shipment manifested & picked up from customer"
            ))
            if s["status"] in ["In Transit", "Customs Cleared", "Out for Delivery", "Delivered"]:
                db.add(ShipmentTrackingEvent(
                    shipment_id=ship_id,
                    timestamp=datetime.datetime.strptime(s["date"] + " 18:30:00", "%Y-%m-%d %H:%M:%S"),
                    status="In Transit",
                    location=f"{s['courier']} Airport Hub",
                    remarks="Dispatched on international flight"
                ))
            if s["status"] == "Delivered":
                db.add(ShipmentTrackingEvent(
                    shipment_id=ship_id,
                    timestamp=datetime.datetime.strptime(s["date"] + " 16:00:00", "%Y-%m-%d %H:%M:%S") + datetime.timedelta(days=3),
                    status="Delivered",
                    location=s["city"],
                    remarks="Successfully delivered & signed by recipient"
                ))

            # Corresponding Invoice
            inv_id = f"inv_{uuid.uuid4().hex[:16]}"
            inv_no = f"INV-202609-{inv_counter:03d}"
            inv_counter += 1

            paid_amount = total_amount if s["pay_status"] == "Paid" else (round(total_amount / 2, 2) if s["pay_status"] == "Partial" else 0.0)
            balance = round(total_amount - paid_amount, 2)
            inv_status = "Paid" if balance <= 0 else ("Partial" if paid_amount > 0 else "Due")

            invoice = Invoice(
                id=inv_id,
                invoice_no=inv_no,
                date=s["date"],
                due_date=(datetime.datetime.strptime(s["date"], "%Y-%m-%d") + datetime.timedelta(days=30)).strftime("%Y-%m-%d"),
                customer_id=customer.id,
                customer_name=customer.name,
                b2b_company_id=customer.b2b_company_id,
                shipment_id=ship_id,
                awb=s["awb"],
                courier=s["courier"],
                service="International Express",
                description=f"Export courier service to {s['dest']} ({s['weight']} kg)",
                amount=price,
                is_gst_invoice=gst_applicable,
                tax_rate=gst_rate,
                cgst=round(gst_amount / 2, 2),
                sgst=round(gst_amount / 2, 2),
                igst=0.0,
                gst=gst_amount,
                total=total_amount,
                paid=paid_amount,
                balance=balance,
                status=inv_status
            )
            db.add(invoice)
            db.flush()

            # Record Payment Collection if any paid
            if paid_amount > 0:
                payment_col = PaymentCollection(
                    id=f"pay_{uuid.uuid4().hex[:12]}",
                    invoice_id=inv_id,
                    shipment_id=ship_id,
                    date=s["date"],
                    amount=paid_amount,
                    payment_method=s["pay_method"],
                    paid_to=s["pay_mode"],
                    collected_by=customer.assigned_employee or "Nawaz",
                    reference=f"PAY-{s['awb']}"
                )
                db.add(payment_col)

                # If prepaid wallet usage, record wallet usage
                if s["provider_type"] == "prepaid":
                    db.add(WalletTransaction(
                        date=s["date"],
                        wallet=s["courier"],
                        type="usage",
                        amount=cost,
                        awb=s["awb"],
                        balance_after=35000.0 - cost,
                        reference=f"AWB {s['awb']} booking deduction",
                        notes="Automated booking deduction"
                    ))

        db.commit()

        print("4. Seeding Operating Expenses & Account Transfers for September 2026...")
        expenses_spec = [
            {"date": "2026-09-01", "kind": "expense", "cat": "Office Rent", "vendor": "Bangalore Real Estate Holdings", "amt": 45000.0, "acc": "Main Bank Account (HDFC)", "mode": "Bank Transfer", "ref": "RENT-SEP2026"},
            {"date": "2026-09-03", "kind": "transfer", "cat": None, "vendor": None, "amt": 15000.0, "acc": "Main Bank Account (HDFC)", "transfer_to": "Office Cash Drawer", "mode": "Cash ATM Withdrawal", "ref": "TRF-ATM-0903"},
            {"date": "2026-09-05", "kind": "expense", "cat": "Packaging Materials", "vendor": "Maruthi Packaging Mart", "amt": 8500.0, "acc": "Office Cash Drawer", "mode": "Cash", "ref": "EXP-BOX-0905"},
            {"date": "2026-09-06", "kind": "transfer", "cat": None, "vendor": "ICL Courier Ltd", "amt": 25000.0, "acc": "Main Bank Account (HDFC)", "transfer_to": "ICL", "mode": "Bank Transfer", "ref": "WLT-ICL-0906"},
            {"date": "2026-09-08", "kind": "expense", "cat": "Software & Internet", "vendor": "Airtel Broadband & Cloud", "amt": 4200.0, "acc": "Main Bank Account (HDFC)", "mode": "Bank Transfer", "ref": "EXP-NET-0908"},
            {"date": "2026-09-10", "kind": "provider_payment", "cat": None, "vendor": "FedEx Express India", "amt": 35000.0, "acc": "Main Bank Account (HDFC)", "mode": "NEFT Transfer", "ref": "PAY-FDX-SEP-WK1"},
            {"date": "2026-09-12", "kind": "expense", "cat": "Electricity & Utilities", "vendor": "BESCOM Bangalore", "amt": 6800.0, "acc": "Main Bank Account (HDFC)", "mode": "Bank Transfer", "ref": "UTIL-SEP2026"},
            {"date": "2026-09-14", "kind": "transfer", "cat": None, "vendor": "Atlantic Worldwide", "amt": 15000.0, "acc": "Main Bank Account (HDFC)", "transfer_to": "Atlantic", "mode": "Bank Transfer", "ref": "WLT-ATL-0914"},
            {"date": "2026-09-15", "kind": "provider_payment", "cat": None, "vendor": "Aramex India Pvt Ltd", "amt": 22000.0, "acc": "Main Bank Account (HDFC)", "mode": "NEFT Transfer", "ref": "PAY-ARX-SEP-WK2"},
            {"date": "2026-09-16", "kind": "expense", "cat": "Courier Supplies", "vendor": "PrintPro Barcodes", "amt": 3400.0, "acc": "PhonePe QR Account", "mode": "UPI", "ref": "EXP-PRT-0916"},
            {"date": "2026-09-18", "kind": "provider_payment", "cat": None, "vendor": "DHL Express India", "amt": 18000.0, "acc": "Main Bank Account (HDFC)", "mode": "NEFT Transfer", "ref": "PAY-DHL-SEP-WK2"},
            {"date": "2026-09-19", "kind": "expense", "cat": "Staff Welfare & Refreshments", "vendor": "Coffee Day Pantry Supplies", "amt": 2100.0, "acc": "Office Cash Drawer", "mode": "Cash", "ref": "EXP-TEA-0919"},
            {"date": "2026-09-21", "kind": "expense", "cat": "Vehicle Fuel & Conveyance", "vendor": "HP Petrol Bunk Indiranagar", "amt": 2800.0, "acc": "Office Cash Drawer", "mode": "Cash", "ref": "EXP-FUEL-0921"}
        ]

        for e in expenses_spec:
            entry = AccountingEntry(
                id=f"entry_{uuid.uuid4().hex[:16]}",
                date=e["date"],
                kind=e["kind"],
                category=e["cat"],
                vendor=e["vendor"],
                provider=e["vendor"] if e["kind"] == "provider_payment" else None,
                amount=e["amt"],
                account=e["acc"],
                payment_mode=e["mode"],
                transfer_to=e.get("transfer_to"),
                center="Main Hub (Bangalore)",
                reference=e["ref"],
                created_by="Admin"
            )
            db.add(entry)

            if e["kind"] == "transfer" and e.get("transfer_to") in ["ICL", "Atlantic"]:
                db.add(WalletTransaction(
                    date=e["date"],
                    wallet=e["transfer_to"],
                    type="recharge",
                    amount=e["amt"],
                    paid_from=e["acc"],
                    reference=e["ref"],
                    notes=f"Wallet top-up via {e['mode']}"
                ))

        db.commit()

        print("5. Seeding Staff Attendance Records for September 2026...")
        staff_members = ["Akash", "Nawaz", "Jeevan Sai", "Ramesh", "Sara", "Gangabathina Chanakya"]
        for day in range(1, 23):
            d_str = f"2026-09-{day:02d}"
            is_sunday = datetime.date(2026, 9, day).weekday() == 6
            if is_sunday:
                continue

            for s_name in staff_members:
                # Login
                login_hour = 9 if random.random() > 0.15 else 10
                login_min = random.randint(0, 25)
                login_time = f"{login_hour:02d}:{login_min:02d}:00 AM"

                db.add(AttendanceRecord(
                    date=d_str,
                    time=login_time,
                    staff_name=s_name,
                    event="LOGIN",
                    notes="Office biometric login"
                ))

                # Lunch Start & End
                db.add(AttendanceRecord(
                    date=d_str,
                    time="01:15:00 PM",
                    staff_name=s_name,
                    event="LUNCH START",
                    notes="Lunch break"
                ))
                db.add(AttendanceRecord(
                    date=d_str,
                    time="02:00:00 PM",
                    staff_name=s_name,
                    event="LUNCH END",
                    notes="Resumed duty"
                ))

                # If before today, record logout
                if day < 22:
                    logout_hour = random.choice([6, 7])
                    logout_min = random.randint(0, 30)
                    logout_time = f"{logout_hour:02d}:{logout_min:02d}:00 PM"
                    db.add(AttendanceRecord(
                        date=d_str,
                        time=logout_time,
                        staff_name=s_name,
                        event="LOGOUT",
                        notes="End of shift"
                    ))

        # Today Sept 22, 2026: Add an active shift punch for Akash & Nawaz
        db.add(AttendanceRecord(
            date="2026-09-22",
            time="09:12:00 AM",
            staff_name="Akash",
            event="LOGIN",
            notes="Morning shift"
        ))
        db.add(AttendanceRecord(
            date="2026-09-22",
            time="09:05:00 AM",
            staff_name="Nawaz",
            event="LOGIN",
            notes="Morning shift"
        ))

        print("6. Seeding Follow-ups & CRM tasks...")
        db.add(Followup(
            customer_id=cust_map["Horizon Electronics Corp"].id,
            customer="Horizon Electronics Corp",
            due_date="2026-09-23",
            category="Invoice Payment Follow-up",
            notes="Follow up with accounts team regarding overdue Sept invoice"
        ))
        db.add(Followup(
            customer_id=cust_map["Apex Global Exports Pvt Ltd"].id,
            customer="Apex Global Exports Pvt Ltd",
            due_date="2026-09-24",
            category="Customer Retention",
            notes="Quarterly export volume review & rate discussion"
        ))
        db.add(Followup(
            customer_id=cust_map["Priya Sharma"].id,
            customer="Priya Sharma",
            due_date="2026-09-22",
            category="Delivery Confirmation",
            notes="Confirm UK parcel delivery satisfaction"
        ))

        db.commit()
        print("SUCCESS: Successfully seeded fresh, complete September 2026 business dataset!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_comprehensive_live_data()
