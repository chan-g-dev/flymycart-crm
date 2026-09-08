"""Collection facts shared by customer, ledger and reporting views."""
from app.models import Invoice, PaymentCollection, Shipment
from sqlalchemy import func


def shipment_payments_query(db):
    return db.query(Invoice.shipment_id.label("shipment_id"), func.sum(Invoice.paid).label("paid")).filter(
        Invoice.shipment_id.isnot(None)).group_by(Invoice.shipment_id)


def shipment_paid_map(db, shipment_ids=None):
    query = shipment_payments_query(db)
    if shipment_ids is not None:
        if not shipment_ids:
            return {}
        query = query.filter(Invoice.shipment_id.in_(shipment_ids))
    return {shipment_id: float(paid or 0) for shipment_id, paid in query.all()}


def collection_totals(db, date=None):
    query = db.query(PaymentCollection.payment_method, PaymentCollection.collected_by,
        PaymentCollection.paid_to, Shipment.center, func.sum(PaymentCollection.amount).label("amount")
    ).outerjoin(Shipment, PaymentCollection.shipment_id == Shipment.id)
    if date:
        query = query.filter(PaymentCollection.date == date)
    rows = query.group_by(PaymentCollection.payment_method, PaymentCollection.collected_by,
        PaymentCollection.paid_to, Shipment.center).all()
    result = {"total": 0.0, "by_method": {}, "by_employee": {}, "by_account": {}, "by_center": {}}
    for row in rows:
        result["total"] += row.amount
        for bucket, key in (("by_method", row.payment_method), ("by_employee", row.collected_by), ("by_account", row.paid_to), ("by_center", row.center or "Unassigned")):
            result[bucket][key] = round(result[bucket].get(key, 0.0) + row.amount, 2)
    result["total"] = round(result["total"], 2)
    return result
