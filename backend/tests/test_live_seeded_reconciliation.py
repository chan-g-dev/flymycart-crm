import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base
from app.models import Shipment, Customer
from app.finance_engine import match_provider_bill_entries

class TestLoadedReconciliation(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def test_database_seeded_matching(self):
        db = self.Session()
        try:
            cust = Customer(id="c1", name="Globe Courier", mobile="9886179959", center="Main Hub (Bangalore)")
            db.add(cust)
            db.commit()

            aramex_entries = [
                {"awb": "30812224332", "actual_cost": 16500.00},
                {"awb": "30811195870", "actual_cost": 1831.72},
                {"awb": "30812224446", "actual_cost": 1774.07},
                {"awb": "30812224450", "actual_cost": 1196.44},
                {"awb": "30812224435", "actual_cost": 1686.42},
                {"awb": "30811073252", "actual_cost": 1678.59},
                {"awb": "30812024773", "actual_cost": 1749.63},
                {"awb": "30812024762", "actual_cost": 10440.00},
                {"awb": "30811073230", "actual_cost": 1381.83},
                {"awb": "30812224461", "actual_cost": 1831.72},
                {"awb": "30811195903", "actual_cost": 1381.83},
            ]
            for item in aramex_entries:
                db.add(Shipment(
                    id=f"ship_{item['awb']}", awb=item['awb'], date="2026-08-18",
                    customer_id="c1", customer_name="Globe Courier", customer_type="B2B",
                    center="Main Hub", employee="Nawaz", receiver_name="Recv", receiver_city="Dubai",
                    receiver_country="UAE", courier="Aramex", provider_type="postpaid", provider_name="Aramex",
                    price=2500, provider_cost=item['actual_cost'], actual_provider_cost=item['actual_cost']
                ))

            fdx_entries = [
                {"awb": "6003516401", "actual_cost": 1580.74},
                {"awb": "6003525090", "actual_cost": 2014.38},
                {"awb": "6003526859", "actual_cost": 9695.37},
                {"awb": "6003527021", "actual_cost": 2424.58},
                {"awb": "6003527088", "actual_cost": 2424.58},
                {"awb": "6003527141", "actual_cost": 3013.51},
                {"awb": "6003527238", "actual_cost": 2610.63},
                {"awb": "6003528966", "actual_cost": 1722.84},
                {"awb": "6003529242", "actual_cost": 2014.38},
                {"awb": "6003529937", "actual_cost": 2061.26},
                {"awb": "6003530338", "actual_cost": 10875.00},
            ]
            for item in fdx_entries:
                db.add(Shipment(
                    id=f"ship_{item['awb']}", awb=item['awb'], date="2026-08-24",
                    customer_id="c1", customer_name="Globe Courier", customer_type="B2B",
                    center="Main Hub", employee="Nawaz", receiver_name="Recv", receiver_city="London",
                    receiver_country="UK", courier="FedEx", provider_type="postpaid", provider_name="FedEx",
                    price=3000, provider_cost=item['actual_cost'], actual_provider_cost=item['actual_cost']
                ))
            db.commit()

            aramex_ships = db.query(Shipment).filter(Shipment.courier == "Aramex").all()
            self.assertEqual(len(aramex_ships), 11)
            result = match_provider_bill_entries(aramex_entries, aramex_ships)
            self.assertEqual(result["matched_count"] + len(result["wrong_amount"]), 11)
            self.assertEqual(len(result["missing_in_crm"]), 0)

            fdx_ships = db.query(Shipment).filter(Shipment.courier == "FedEx").all()
            self.assertEqual(len(fdx_ships), 11)
            result_fdx = match_provider_bill_entries(fdx_entries, fdx_ships)
            self.assertEqual(result_fdx["matched_count"] + len(result_fdx["wrong_amount"]), 11)
            self.assertEqual(len(result_fdx["missing_in_crm"]), 0)
        finally:
            db.close()
            self.engine.dispose()

if __name__ == "__main__":
    unittest.main()
