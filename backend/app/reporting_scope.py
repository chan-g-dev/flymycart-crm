"""Temporary report filters that intersect existing staff access restrictions."""
from contextlib import contextmanager
from sqlalchemy import event, select, and_, or_, func
from sqlalchemy.orm import Session, with_loader_criteria
from app.models import Shipment, Invoice, PaymentCollection, Refund, Customer, Followup, AccountingEntry, B2BCompany


def shipment_filters(center=None, scope=None, entity=None):
    table = Shipment.__table__.c
    filters = []
    if center and center != 'All Centers':
        filters.append(table.center == center)
    if scope:
        domestic = or_(table.domestic_international == 'Domestic', and_(
            func.coalesce(table.domestic_international, '') != 'International',
            func.lower(func.coalesce(table.receiver_country, '')) == 'india'))
        filters.append(domestic if scope == 'Domestic' else ~domestic)
    if entity:
        filters.append(func.coalesce(table.entity, 'Globe Courier') == entity)
    return filters


@contextmanager
def report_scope(db, center=None, scope=None, entity=None):
    previous = db.info.get('report_filters')
    db.info['report_filters'] = (center, scope, entity)
    try:
        yield
    finally:
        if previous is None:
            db.info.pop('report_filters', None)
        else:
            db.info['report_filters'] = previous


@event.listens_for(Session, 'do_orm_execute')
def filter_report_reads(state):
    values = state.session.info.get('report_filters')
    if not state.is_select or not values:
        return
    center, scope, entity = values
    filters = shipment_filters(center, scope, entity)
    if not filters:
        return
    ships = Shipment.__table__.c
    ids = select(ships.id).where(*filters)
    customer_ids = select(ships.customer_id).where(*filters)
    policies = {
        Shipment: and_(*filters),
        Invoice: Invoice.shipment_id.in_(ids),
        PaymentCollection: PaymentCollection.shipment_id.in_(ids),
        Refund: Refund.awb.in_(select(ships.awb).where(*filters)),
    }
    if scope or entity:
        policies[Customer] = Customer.id.in_(customer_ids)
        policies[Followup] = Followup.customer_id.in_(customer_ids)
        policies[AccountingEntry] = AccountingEntry.shipment_id.in_(ids)
        policies[B2BCompany] = B2BCompany.id.in_(select(ships.b2b_company_id).where(*filters))
    elif center:
        customers = Customer.__table__.c
        policies[Customer] = Customer.center == center
        policies[Followup] = Followup.customer_id.in_(select(customers.id).where(customers.center == center))
        policies[AccountingEntry] = AccountingEntry.center == center
        policies[B2BCompany] = or_(B2BCompany.id.in_(select(customers.b2b_company_id).where(customers.center == center)), B2BCompany.id.in_(select(ships.b2b_company_id).where(*filters)))
    for model, criterion in policies.items():
        state.statement = state.statement.options(with_loader_criteria(model, criterion, include_aliases=True))
