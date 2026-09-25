"""Read-only production schema and financial consistency checks; no personal records printed."""
import os, sys, json
from pathlib import Path
from dotenv import dotenv_values
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import Session
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
config = dotenv_values(ROOT / 'backend/.env')
os.environ.update(DATABASE_URL='sqlite:///:memory:', ENVIRONMENT='development', REMINDERS_ENABLED='false')
from app.database import Base
from app.models import Shipment, Invoice, PaymentCollection
from app.routers.dashboard import get_dashboard_summary
from app.routers.accounts import get_accounts_summary
from app.routers.b2b import get_b2b_summary
from app.routers.account_workspace import get_workspace_overview
ctx={'is_super_admin':True,'permissions':{'*':True}}
results={}
try:
 engine=create_engine(config['DATABASE_URL'],connect_args={'connect_timeout':15})
 with engine.connect() as connection:
  connection.execute(text('SET TRANSACTION READ ONLY'))
  connection.execute(text("SET LOCAL statement_timeout = '30000'"))
  columns=set(connection.execute(text("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).all())
  results['missing_columns']=[f'{t.name}.{c.name}' for t in Base.metadata.sorted_tables for c in t.columns if (t.name,c.name) not in columns]
  with Session(bind=connection) as db:
   dash=get_dashboard_summary(ctx=ctx,db=db)
   acc=get_accounts_summary(ctx=ctx,db=db)
   overview=get_workspace_overview(ctx=ctx,db=db)
   b2b=get_b2b_summary(companies_limit=1,companies_offset=0,ctx=ctx,db=db)
   results['database_reachable']=True
   results['record_counts']={'shipments':db.query(Shipment).count(),'invoices':db.query(Invoice).count(),'collections':db.query(PaymentCollection).count()}
   results['dashboard_accounts_sales_match']=round(float(dash['total_sales']),2)==round(float(acc['total_sales']),2)
   results['dashboard_accounts_collections_match']=round(float(dash['total_collected']),2)==round(float(acc['total_collected']),2)
   results['dashboard_overview_sales_match']=round(float(dash['total_sales']),2)==round(float(overview['totals']['sales']),2)
   results['b2b_summary_loaded']=b2b['companies_total']>=0
   results['invoice_arithmetic_mismatches']=db.query(Invoice).filter(func.abs(Invoice.total-Invoice.paid-Invoice.balance)>0.011).count()
   results['invoice_shipment_total_mismatches']=db.query(Invoice).join(Shipment,Shipment.id==Invoice.shipment_id).filter(func.abs(Invoice.total-Shipment.total_amount)>0.011).count()
   results['shipments_without_invoice']=db.query(Shipment).filter(~Shipment.id.in_(db.query(Invoice.shipment_id).filter(Invoice.shipment_id.isnot(None)))).count()
   collection=db.query(PaymentCollection.invoice_id.label('id'),func.sum(PaymentCollection.amount).label('paid')).group_by(PaymentCollection.invoice_id).subquery()
   results['invoice_collection_mismatches']=db.query(Invoice).outerjoin(collection,collection.c.id==Invoice.id).filter(func.abs(Invoice.paid-func.coalesce(collection.c.paid,0))>0.011).count()
   center=db.query(Shipment.center).filter(Shipment.center.isnot(None)).first()
   if center:
    filtered=get_dashboard_summary(ctx=ctx,db=db,center=center[0])
    expected=db.query(func.coalesce(func.sum(Shipment.price),0)).filter(Shipment.center==center[0]).scalar()
    results['filtered_dashboard_matches_database']=round(float(filtered['total_sales']),2)==round(float(expected),2)
  connection.rollback()
 engine.dispose()
except Exception as exc:
 results['error_type']=type(exc).__name__
results['read_only']=True
(ROOT/'qa-results/final-production-readonly.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
