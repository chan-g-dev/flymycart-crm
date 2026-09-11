# ================================================================
# FLY MY CART CRM - CORE FINANCE & BUSINESS CALCULATION ENGINE
# (app/finance_engine.py)
# ================================================================
# Implements the 10 Fundamental Accounting & Logistics Rules:
# Rule 1: Prepaid Wallet Recharge = Balance Transfer, NOT an expense
# Rule 2: Wallet usage on shipment = Direct logistics cost
# Rule 3: Postpaid predicted cost = Estimate until bill reconciliation
# Rule 4: Reconciliation replaces predicted cost with actual billed cost
# Rule 5: Gross Profit = Selling Price - Actual Cost (fallback to predicted)
# Rule 6: Reconciliation recalculates gross profit per matched shipment
# Rule 7: B2B Credit sale = Revenue now, collected when paid (Aging 5 buckets)
# Rule 8: Dual employee audit: stores both `paid_to` and `collected_by`
# Rule 9: Net Business Profit = Gross Profit - Approved Refunds
# Rule 10: Traceable AWB link across all financial transactions
# ================================================================

import datetime
from typing import Dict, Any, List, Optional, Tuple

VOLUMETRIC_DIVISOR = 5000.0


def calculate_volumetric_and_chargeable_weight(
    length_cm: float,
    width_cm: float,
    height_cm: float,
    actual_weight_kg: float,
    divisor: float = 5000.0
) -> Tuple[float, float]:
    """
    Computes volumetric weight (L*W*H / divisor) and chargeable weight = max(actual, volumetric).
    Server-side authoritative calculation. Defaults to 5000 (Express), or 4000 (Cargo/Surface).
    """
    l = max(0.0, float(length_cm or 0.0))
    w = max(0.0, float(width_cm or 0.0))
    h = max(0.0, float(height_cm or 0.0))
    act = max(0.0, float(actual_weight_kg or 0.0))
    effective_divisor = float(divisor) if divisor and float(divisor) > 0 else 5000.0

    if l > 0 and w > 0 and h > 0:
        vol_wt = round((l * w * h) / effective_divisor, 2)
    else:
        vol_wt = 0.0

    chargeable_wt = round(max(act, vol_wt), 2)
    return vol_wt, chargeable_wt


def calculate_gross_profit(
    selling_price: float,
    provider_cost: float,
    actual_provider_cost: Optional[float] = None,
    cost_reconciled: bool = False
) -> float:
    """
    Gross Profit = Customer Selling Price - Provider Cost.
    Uses actual_provider_cost if cost_reconciled or actual is provided,
    otherwise falls back to predicted provider_cost.
    """
    price = float(selling_price or 0.0)
    if cost_reconciled and actual_provider_cost is not None:
        effective_cost = float(actual_provider_cost)
    else:
        effective_cost = float(actual_provider_cost if actual_provider_cost is not None else (provider_cost or 0.0))
    return round(price - effective_cost, 2)


def calculate_b2b_aging_buckets(
    b2b_items: List[Dict[str, Any]],
    as_of_date: Optional[datetime.date] = None
) -> Dict[str, float]:
    """
    Computes standard B2B aging schedule:
    - Not Due
    - 1-30 Days
    - 31-60 Days
    - 61-90 Days
    - 90+ Days Overdue
    """
    ref_date = as_of_date or datetime.date.today()
    buckets = {
        "not_due": 0.0,
        "days1_30": 0.0,
        "days31_60": 0.0,
        "days61_90": 0.0,
        "days90_plus": 0.0,
        "total_outstanding": 0.0,
        "overdue_total": 0.0
    }

    for item in b2b_items:
        balance = float(item.get("balance", item.get("outstanding", 0.0)))
        if balance <= 0:
            continue

        item_date_str = item.get("date") or item.get("created_at_date")
        credit_period_days = int(item.get("credit_period_days", 30))

        try:
            if isinstance(item_date_str, datetime.date):
                item_date = item_date_str
            elif isinstance(item_date_str, str):
                item_date = datetime.date.fromisoformat(item_date_str[:10])
            else:
                item_date = ref_date
            age_days = (ref_date - item_date).days
        except Exception:
            age_days = 0

        buckets["total_outstanding"] += balance

        # Buckets measure days past the agreed due date, not invoice age.
        overdue_days = age_days - credit_period_days
        if overdue_days <= 0:
            buckets["not_due"] += balance
        elif overdue_days <= 30:
            buckets["days1_30"] += balance
        elif overdue_days <= 60:
            buckets["days31_60"] += balance
        elif overdue_days <= 90:
            buckets["days61_90"] += balance
        else:
            buckets["days90_plus"] += balance

        if age_days > credit_period_days:
            buckets["overdue_total"] += balance

    for k in buckets:
        buckets[k] = round(buckets[k], 2)

    return buckets


def match_provider_bill_entries(
    bill_entries: List[Dict[str, Any]],
    crm_shipments: List[Any]
) -> Dict[str, Any]:
    """
    Matches provider bill rows against CRM shipments by AWB.
    Classifies into 6 spec statuses:
    1. MATCHED: AWB found, predicted cost == actual cost (within +/- 0.01)
    2. WRONG AMOUNT: AWB found, but predicted cost != actual cost
    3. MISSING AWB (in CRM): AWB in bill but not recorded in CRM (Extra AWB from carrier)
    4. DUPLICATE AWB: AWB appears multiple times in the bill
    5. UNMATCHED: Carrier / format mismatch
    6. MISSING IN BILL: CRM shipment exists for this provider but not billed yet
    """
    shipment_by_awb = {s.awb.strip().upper(): s for s in crm_shipments if s.awb}
    matched_awb_set = set()
    seen_bill_awbs = {}

    matched_items = []
    wrong_amount_items = []
    missing_in_crm_items = []
    duplicate_awb_items = []

    total_predicted = 0.0
    total_current = 0.0
    total_actual = 0.0

    for entry in bill_entries:
        awb_raw = str(entry.get("awb", "")).strip()
        awb_key = awb_raw.upper()
        actual_cost = round(float(entry.get("actual_cost", 0.0)), 2)

        if not awb_key:
            continue

        total_actual += actual_cost

        # Check duplicate AWB in provider bill
        if awb_key in seen_bill_awbs:
            duplicate_awb_items.append({
                "awb": awb_raw,
                "customer": "-",
                "predicted_cost": 0.0,
                "actual_cost": actual_cost,
                "variance": actual_cost,
                "status": "DUPLICATE AWB",
                "notes": f"AWB repeated in bill ({seen_bill_awbs[awb_key]} previously seen)"
            })
            continue

        seen_bill_awbs[awb_key] = 1

        ship = shipment_by_awb.get(awb_key)
        if not ship:
            missing_in_crm_items.append({
                "awb": awb_raw,
                "customer": "-",
                "predicted_cost": 0.0,
                "actual_cost": actual_cost,
                "variance": actual_cost,
                "status": "MISSING AWB",
                "notes": "Extra AWB billed by carrier but not in Fly My Cart CRM"
            })
        else:
            matched_awb_set.add(awb_key)
            predicted_cost = round(float(ship.provider_cost or 0.0), 2)
            total_predicted += predicted_cost
            current_cost = round(float(ship.actual_provider_cost), 2) if getattr(ship, 'cost_reconciled', False) and getattr(ship, 'actual_provider_cost', None) is not None else predicted_cost
            total_current += current_cost
            variance = round(actual_cost - current_cost, 2)

            item = {
                "shipment_id": ship.id,
                "awb": ship.awb,
                "customer_name": ship.customer_name,
                "predicted_cost": predicted_cost,
                "current_cost": current_cost,
                "actual_cost": actual_cost,
                "variance": variance,
                "notes": "Cost matches net cost" if abs(variance) < 0.01 else f"Discrepancy of {'+' if variance > 0 else ''}{variance}"
            }

            if abs(variance) < 0.01:
                item["status"] = "MATCHED"
                matched_items.append(item)
            else:
                item["status"] = "WRONG AMOUNT"
                wrong_amount_items.append(item)

    # CRM shipments for this provider that were not in the bill (Unbilled usage)
    missing_in_bill_items = []
    for awb_key, ship in shipment_by_awb.items():
        if awb_key not in matched_awb_set and not getattr(ship, 'cost_reconciled', False):
            pred = round(float(ship.provider_cost or 0.0), 2)
            missing_in_bill_items.append({
                "shipment_id": ship.id,
                "awb": ship.awb,
                "customer_name": ship.customer_name,
                "predicted_cost": pred,
                "actual_cost": 0.0,
                "variance": -pred,
                "status": "UNMATCHED",
                "notes": "Unbilled shipment in CRM (Not in carrier bill)"
            })

    total_variance = round(total_actual - total_current, 2)
    discrepancy_count = len(wrong_amount_items) + len(missing_in_crm_items) + len(duplicate_awb_items)

    return {
        "total_rows": len(bill_entries),
        "matched_count": len(matched_items),
        "discrepancy_count": discrepancy_count,
        "total_predicted": round(total_predicted, 2),
        "total_current": round(total_current, 2),
        "total_actual": round(total_actual, 2),
        "variance": total_variance,
        "matched": matched_items,
        "wrong_amount": wrong_amount_items,
        "missing_in_crm": missing_in_crm_items,
        "duplicate_awb": duplicate_awb_items,
        "missing_in_bill": missing_in_bill_items,
        "all_items": matched_items + wrong_amount_items + missing_in_crm_items + duplicate_awb_items
    }
