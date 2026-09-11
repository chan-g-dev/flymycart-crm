"""Enforce assigned-center scopes on ORM reads and writes for CRM records."""
from fastapi import HTTPException
from sqlalchemy import event, select, or_
from sqlalchemy.orm import Session, with_loader_criteria
from app.models import Customer, Shipment, Invoice, BookingRequest, Refund, Followup, CommunicationLog, PaymentCollection, B2BCompany, AccountCheck


def policies(centers):
    customers = select(Customer.__table__.c.id).where(Customer.__table__.c.center.in_(centers))
    shipments = select(Shipment.__table__.c.id).where(Shipment.__table__.c.center.in_(centers))
    awbs = select(Shipment.__table__.c.awb).where(Shipment.__table__.c.center.in_(centers))
    return {
        Customer: Customer.center.in_(centers),
        B2BCompany: B2BCompany.id.in_(select(Customer.__table__.c.b2b_company_id).where(Customer.__table__.c.center.in_(centers))),
        Shipment: Shipment.center.in_(centers),
        Invoice: or_(Invoice.shipment_id.in_(shipments), Invoice.customer_id.in_(customers)),
        BookingRequest: BookingRequest.customer_id.in_(customers),
        Refund: Refund.awb.in_(awbs),
        Followup: Followup.customer_id.in_(customers),
        CommunicationLog: CommunicationLog.customer_id.in_(customers),
        PaymentCollection: PaymentCollection.shipment_id.in_(shipments),
        AccountCheck: AccountCheck.center.in_(centers),
    }


@event.listens_for(Session, "do_orm_execute")
def restrict_queries(state):
    centers = state.session.info.get("allowed_centers")
    if centers is None:
        return
    if state.is_select or state.is_update or state.is_delete:
        for model, criterion in policies(centers).items():
            state.statement = state.statement.options(with_loader_criteria(model, criterion, include_aliases=True))


@event.listens_for(Session, "before_flush")
def restrict_writes(session, flush_context, instances):
    centers = session.info.get("allowed_centers")
    if centers is None:
        return
    for obj in session.new.union(session.dirty):
        if isinstance(obj, AccountCheck) and obj.center not in centers:
            raise HTTPException(status_code=403, detail="Select an account-check center within your assigned access.")
        if isinstance(obj, (Customer, Shipment)):
            if (obj.center or "Main Hub (Bangalore)") not in centers:
                raise HTTPException(status_code=403, detail="This center is outside your assigned access.")
            if isinstance(obj, Shipment) and obj.customer_id:
                pending = next((c for c in session.new if isinstance(c, Customer) and c.id == obj.customer_id), None)
                if not pending and not session.query(Customer).filter(Customer.id == obj.customer_id).first():
                    raise HTTPException(status_code=403, detail="This customer is outside your assigned access.")
        elif isinstance(obj, (Invoice, BookingRequest, Followup, CommunicationLog)):
            customer_id = obj.customer_id
            pending_customer = next((c for c in session.new if isinstance(c, Customer) and c.id == customer_id), None)
            customer = pending_customer or session.query(Customer).filter(Customer.id == customer_id).first()
            if not customer:
                raise HTTPException(status_code=403, detail="A customer in your assigned center is required.")
        elif isinstance(obj, Refund):
            if not session.query(Shipment).filter(Shipment.awb == obj.awb).first():
                raise HTTPException(status_code=403, detail="This shipment is outside your assigned access.")
