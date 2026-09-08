import os
import sys
import datetime

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.finance_engine import (
    calculate_volumetric_and_chargeable_weight,
    calculate_gross_profit,
    calculate_b2b_aging_buckets,
    match_provider_bill_entries
)

def test_volumetric_and_chargeable_weight():
    # Case 1: Actual weight greater than volumetric
    # 30 x 20 x 10 / 5000 = 1.2 kg; Actual = 3.5 kg -> Chargeable = 3.5 kg
    vol, chg = calculate_volumetric_and_chargeable_weight(30, 20, 10, 3.5)
    assert vol == 1.2
    assert chg == 3.5

    # Case 2: Volumetric weight greater than actual
    # 50 x 40 x 30 / 5000 = 12.0 kg; Actual = 8.0 kg -> Chargeable = 12.0 kg
    vol, chg = calculate_volumetric_and_chargeable_weight(50, 40, 30, 8.0)
    assert vol == 12.0
    assert chg == 12.0

def test_gross_profit_calculation():
    # Unreconciled fallback to predicted cost
    profit1 = calculate_gross_profit(selling_price=5000, provider_cost=3200, actual_provider_cost=3200, cost_reconciled=False)
    assert profit1 == 1800.0

    # Reconciled uses actual provider cost
    profit2 = calculate_gross_profit(selling_price=5000, provider_cost=3200, actual_provider_cost=3600, cost_reconciled=True)
    assert profit2 == 1400.0

def test_b2b_aging_schedule():
    today = datetime.date(2026, 8, 31)
    items = [
        {"balance": 5000, "date": "2026-08-31", "credit_period_days": 30},   # Not Due (0 days)
        {"balance": 8000, "date": "2026-08-15", "credit_period_days": 30},   # 1-30 Days (16 days)
        {"balance": 4000, "date": "2026-07-15", "credit_period_days": 30},   # 31-60 Days (47 days)
        {"balance": 2000, "date": "2026-06-15", "credit_period_days": 30},   # 61-90 Days (77 days)
        {"balance": 1500, "date": "2026-05-01", "credit_period_days": 30},   # 90+ Days (122 days)
    ]
    aging = calculate_b2b_aging_buckets(items, as_of_date=today)
    assert aging["not_due"] == 13000.0
    assert aging["days1_30"] == 4000.0
    assert aging["days31_60"] == 2000.0
    assert aging["days61_90"] == 0.0
    assert aging["days90_plus"] == 1500.0
    assert aging["total_outstanding"] == 20500.0
    # Overdue past 30 days credit period: 4000 + 2000 + 1500 = 7500
    assert aging["overdue_total"] == 7500.0

def test_provider_reconciliation_matching():
    class DummyShipment:
        def __init__(self, awb, customer_name, provider_cost):
            self.id = f"id_{awb}"
            self.awb = awb
            self.customer_name = customer_name
            self.provider_cost = provider_cost

    crm_shipments = [
        DummyShipment("FX100", "Alice", 1000.0),
        DummyShipment("FX200", "Bob", 2000.0),
        DummyShipment("FX300", "Charlie", 3000.0)
    ]

    bill_entries = [
        {"awb": "FX100", "actual_cost": 1000.0},  # Exact match
        {"awb": "FX200", "actual_cost": 2200.0},  # Wrong amount (+200 variance)
        {"awb": "FX999", "actual_cost": 500.0},   # Missing in CRM (Extra AWB)
        {"awb": "FX100", "actual_cost": 1000.0}   # Duplicate AWB
    ]

    result = match_provider_bill_entries(bill_entries, crm_shipments)
    assert result["matched_count"] == 1
    assert len(result["wrong_amount"]) == 1
    assert len(result["missing_in_crm"]) == 1
    assert len(result["duplicate_awb"]) == 1
    assert len(result["missing_in_bill"]) == 1  # FX300 unbilled

if __name__ == "__main__":
    test_volumetric_and_chargeable_weight()
    test_gross_profit_calculation()
    test_b2b_aging_schedule()
    test_provider_reconciliation_matching()
    print("All finance engine unit tests PASSED successfully!")
