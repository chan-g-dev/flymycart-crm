import uuid
import datetime
from app.database import SessionLocal
from app.models import (
    Shipment, Invoice, Customer, PaymentCollection,
    ReconciliationBatch, ReconciliationItem, AccountingEntry,
    Refund, Followup, CommunicationLog, WalletTransaction
)
from app.cache import cache_engine
from app.finance_engine import calculate_gross_profit

def reset_and_seed_reconciliation_data():
    db = SessionLocal()
    try:
        print("Clearing transactional tables...")
        db.query(ReconciliationItem).delete()
        db.query(ReconciliationBatch).delete()
        db.query(PaymentCollection).delete()
        db.query(Invoice).delete()
        db.query(Refund).delete()
        db.query(Followup).delete()
        db.query(CommunicationLog).delete()
        db.query(AccountingEntry).delete()
        db.query(WalletTransaction).delete()
        db.query(Shipment).delete()
        db.commit()

        # Ensure a default customer exists
        cust = db.query(Customer).filter_by(name="Globe Courier").first()
        if not cust:
            cust = Customer(
                id=f"cust_{uuid.uuid4().hex[:16]}",
                name="Globe Courier",
                mobile="9886179959",
                whatsapp="9886179959",
                email="globe@flymycart.internal",
                address="Maruthi Sevanagar, Bangalore - 560033",
                customer_type="B2B",
                center="Main Hub (Bangalore)",
                assigned_employee="Nawaz"
            )
            db.add(cust)
            db.commit()
            db.refresh(cust)

        # File 1: FDX / FedEx (and ICL) Shipments
        fdx_data = [
            {"awb": "6003516401", "date": "2026-08-21", "destination": "Germany", "courier": "FedEx", "weight": 0.5, "provider_cost": 1580.74, "price": 2200.0},
            {"awb": "6003525090", "date": "2026-08-24", "destination": "U.S.A.", "courier": "FedEx", "weight": 1.5, "provider_cost": 2014.38, "price": 2800.0},
            {"awb": "6003526859", "date": "2026-08-24", "destination": "U.S.A.", "courier": "FedEx", "weight": 15.0, "provider_cost": 9695.37, "price": 13500.0},
            {"awb": "6003527021", "date": "2026-08-24", "destination": "United Kingdom", "courier": "FedEx", "weight": 2.5, "provider_cost": 2424.58, "price": 3400.0},
            {"awb": "6003527088", "date": "2026-08-24", "destination": "United Kingdom", "courier": "FedEx", "weight": 2.5, "provider_cost": 2424.58, "price": 3400.0},
            {"awb": "6003527141", "date": "2026-08-24", "destination": "Jordan", "courier": "FedEx", "weight": 3.0, "provider_cost": 3013.51, "price": 4200.0},
            {"awb": "6003527238", "date": "2026-08-24", "destination": "U.A.E.", "courier": "FedEx", "weight": 2.5, "provider_cost": 2610.63, "price": 3600.0},
            {"awb": "6003528966", "date": "2026-08-25", "destination": "U.S.A.", "courier": "FedEx", "weight": 0.5, "provider_cost": 1722.84, "price": 2400.0},
            {"awb": "6003529242", "date": "2026-08-25", "destination": "U.S.A.", "courier": "FedEx", "weight": 1.5, "provider_cost": 2014.38, "price": 2800.0},
            {"awb": "6003529937", "date": "2026-08-25", "destination": "Philippines", "courier": "FedEx", "weight": 0.5, "provider_cost": 2061.26, "price": 2900.0},
            {"awb": "6003530338", "date": "2026-08-25", "destination": "United Kingdom", "courier": "FedEx", "weight": 25.0, "provider_cost": 10875.00, "price": 15000.0},
        ]

        # File 2: Aramex Annexure Shipments
        aramex_data = [
            {"awb": "30812224332", "date": "2026-08-07", "destination": "Qatar", "courier": "Aramex", "weight": 43.1, "provider_cost": 16500.00, "price": 22500.0},
            {"awb": "30811195870", "date": "2026-08-17", "destination": "Saudi Arabia", "courier": "Aramex", "weight": 0.86, "provider_cost": 1831.72, "price": 2600.0},
            {"awb": "30812224446", "date": "2026-08-17", "destination": "Lebanon", "courier": "Aramex", "weight": 0.31, "provider_cost": 1774.07, "price": 2500.0},
            {"awb": "30812224450", "date": "2026-08-17", "destination": "Bangladesh", "courier": "Aramex", "weight": 0.25, "provider_cost": 1196.44, "price": 1700.0},
            {"awb": "30812224435", "date": "2026-08-15", "destination": "Oman", "courier": "Aramex", "weight": 0.59, "provider_cost": 1686.42, "price": 2400.0},
            {"awb": "30811073252", "date": "2026-08-18", "destination": "Saudi Arabia", "courier": "Aramex", "weight": 0.48, "provider_cost": 1678.59, "price": 2400.0},
            {"awb": "30812024773", "date": "2026-08-18", "destination": "U.A.E.", "courier": "Aramex", "weight": 0.714, "provider_cost": 1749.63, "price": 2500.0},
            {"awb": "30812024762", "date": "2026-08-18", "destination": "Oman", "courier": "Aramex", "weight": 23.99, "provider_cost": 10440.00, "price": 14500.0},
            {"awb": "30811073230", "date": "2026-08-18", "destination": "U.A.E.", "courier": "Aramex", "weight": 0.17, "provider_cost": 1381.83, "price": 2000.0},
            {"awb": "30812224461", "date": "2026-08-19", "destination": "Saudi Arabia", "courier": "Aramex", "weight": 0.93, "provider_cost": 1831.72, "price": 2600.0},
            {"awb": "30811195903", "date": "2026-08-19", "destination": "U.A.E.", "courier": "Aramex", "weight": 0.13, "provider_cost": 1381.83, "price": 2000.0},
        ]

        all_shipments = fdx_data + aramex_data
        print(f"Adding {len(all_shipments)} shipments from both files...")

        for s_data in all_shipments:
            ship_id = f"ship_{uuid.uuid4().hex[:16]}"
            price = s_data["price"]
            gst_amt = round(price * 0.18, 2)
            total_amt = round(price + gst_amt, 2)
            provider_cost = s_data["provider_cost"]
            # Predicted provider cost initially before reconciliation
            pred_cost = round(provider_cost * 0.95, 2)

            shipment = Shipment(
                id=ship_id,
                awb=s_data["awb"],
                date=s_data["date"],
                pickup_date=s_data["date"],
                customer_id=cust.id,
                customer_name=cust.name,
                customer_type="B2B",
                center="Main Hub (Bangalore)",
                employee="Nawaz",
                sender_name=cust.name,
                sender_phone=cust.mobile,
                sender_address=cust.address,
                receiver_name=f"Receiver ({s_data['destination']})",
                receiver_city=s_data["destination"],
                receiver_country=s_data["destination"],
                actual_weight=s_data["weight"],
                chargeable_weight=s_data["weight"],
                packages_count=1,
                courier=s_data["courier"],
                provider_type="postpaid",
                provider_name=s_data["courier"],
                price=price,
                is_gst_applicable=True,
                gst_rate=18.0,
                gst_amount=gst_amt,
                total_amount=total_amt,
                provider_cost=pred_cost,
                actual_provider_cost=pred_cost,
                cost_reconciled=False,
                carrier_payment_status="Pending",
                gross_profit=round(price - pred_cost, 2),
                payment_status="Paid",
                payment_method="Cash",
                paid_to="Cash in Hand",
                collected_by="Nawaz",
                status="Delivered"
            )
            db.add(shipment)

            invoice = Invoice(
                id=f"inv_{uuid.uuid4().hex[:16]}",
                invoice_no=f"FMC-202608-{uuid.uuid4().hex[:8].upper()}",
                date=s_data["date"],
                customer_id=cust.id,
                customer_name=cust.name,
                shipment_id=ship_id,
                awb=s_data["awb"],
                courier=s_data["courier"],
                service="International Priority",
                description=f"Logistics Courier Service - {s_data['courier']} ({s_data['weight']} kg)",
                amount=price,
                is_gst_invoice=True,
                tax_rate=18.0,
                cgst=round(gst_amt / 2, 2),
                sgst=round(gst_amt / 2, 2),
                gst=gst_amt,
                total=total_amt,
                paid=total_amt,
                balance=0.0,
                status="Paid"
            )
            db.add(invoice)

        db.commit()
        cache_engine.invalidate_prefix("shipments:")
        cache_engine.invalidate_prefix("dashboard_summary")
        print(f"Successfully populated {len(all_shipments)} shipments ready for reconciliation checks!")
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_seed_reconciliation_data()
