"""Generate actionable follow-ups without sending messages to customers."""
import datetime
import hashlib
from sqlalchemy import func
from app.models import Customer, Invoice, Shipment, Followup, SystemSettings


def generate_reminders(db, today=None):
    today = today or datetime.date.today()
    settings = db.query(SystemSettings).first()
    config = settings.config_json if settings else {}
    retention_days = int(config.get('retentionFollowupDays', 30))
    created = 0

    def add(key, customer, due, category, notes):
        nonlocal created
        record_id = 'auto_' + hashlib.sha256(key.encode()).hexdigest()[:32]
        if db.get(Followup, record_id):
            return
        db.add(Followup(id=record_id, customer_id=customer.id, customer=customer.name,
            due_date=due.isoformat(), category=category, priority='High' if due <= today else 'Medium',
            status='Pending', channel_action='Call', notes=notes))
        created += 1

    for invoice, customer in db.query(Invoice, Customer).join(Customer, Invoice.customer_id == Customer.id).filter(Invoice.balance > 0).all():
        try:
            due = datetime.date.fromisoformat(invoice.due_date) if invoice.due_date else datetime.date.fromisoformat(invoice.date) + datetime.timedelta(days=customer.credit_period_days if customer.customer_type == 'B2B' else 0)
        except (ValueError, TypeError):
            continue
        if due <= today + datetime.timedelta(days=3):
            add(f'invoice:{invoice.id}:{due}', customer, due, 'B2B Payment' if customer.customer_type == 'B2B' else 'Invoice Due', f'Invoice {invoice.invoice_no}: outstanding ₹{invoice.balance:.2f}. Due {due}.')

    if retention_days > 0:
        last_dates = db.query(Shipment.customer_id, func.max(Shipment.date)).group_by(Shipment.customer_id).all()
        for customer_id, last_date in last_dates:
            customer = db.get(Customer, customer_id) if customer_id else None
            if not customer:
                continue
            try:
                due = datetime.date.fromisoformat(last_date) + datetime.timedelta(days=retention_days)
            except (ValueError, TypeError):
                continue
            if due <= today:
                add(f'retention:{customer_id}:{last_date}:{retention_days}', customer, due, 'Customer Retention', f'No shipment since {last_date}; {retention_days}-day retention follow-up.')
    db.commit()
    return created
