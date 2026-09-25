"""Run fresh-data API workflows against the local development database only."""
from pathlib import Path
import os,sys,json,secrets,datetime as dt
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['REMINDERS_ENABLED']='false'
from app.config import settings
from sqlalchemy.engine import make_url
assert settings.ENVIRONMENT=='development' and make_url(settings.DATABASE_URL).drivername=='sqlite'
from app.main import app
from app.database import SessionLocal
from app.models import UserProfile,Role,UserCenterAccess,Shipment,Invoice,AccountingEntry
from app.auth import create_app_session,hash_password,revoke_app_session
from app.access_policy import ROLE_NAMES
from fastapi.testclient import TestClient
from app.business_dates import business_today

root=Path(__file__).resolve().parents[2]
results=[]
def check(condition,name):
    results.append({'check':name,'passed':bool(condition)})
    if not condition: raise AssertionError(name)

def run():
 with TestClient(app,base_url='http://localhost',raise_server_exceptions=True) as client:
    with SessionLocal() as db:
        admin=db.query(UserProfile).filter_by(role='super_admin',status='active').first()
        _,token=create_app_session(db,admin.id,mfa_verified=True)
        admin_id=admin.id
        role_ids={r.name:r.id for r in db.query(Role)}
        credentials={}
        for code in ['manager','team_leader','counter_staff','operations_executive']:
            uid='qa-'+code
            user=db.get(UserProfile,uid)
            if not user:
                password=secrets.token_urlsafe(22)+'!Aa1'
                user=UserProfile(id=uid,email=uid+'@example.test',display_name='QA '+code.replace('_',' ').title(),role=code,status='active',password_hash=hash_password(password))
                user.roles.append(db.get(Role,role_ids[ROLE_NAMES[code]]))
                db.add(user); db.flush()
                db.add(UserCenterAccess(user_id=uid,center_id='Main Hub (Bangalore)'))
                credentials[user.email]=password
        db.commit()
        if credentials: (root/'qa-results'/'local-test-logins.json').write_text(json.dumps(credentials,indent=2))
    client.headers['Authorization']='Bearer '+token
    def call(method,url,payload=None,expected=200,**kw):
        response=client.request(method,url,json=payload,**kw)
        check(response.status_code==expected,f'{method} {url}: {response.status_code} expected {expected}'+(' '+response.text[:400] if response.status_code!=expected else ''))
        return response.json() if response.content else None
    today=business_today().isoformat()
    cash={'owner_type':'Business','account_holder':'QA Office'}
    wallet={'wallet':'ICL','date':today,'amount':10000,'paid_from':'QA Cash','payment_method':'Cash','payment_details':cash,'reference':'QA-WALLET'}
    call('POST','/api/accounts/wallets/recharge',wallet,headers={'Idempotency-Key':'qa-wallet-recharge-20260922'})
    customers=call('GET','/api/customers')
    saved=[]
    for i in range(4):
        name=f'QA Customer {i+1}'
        existing=next((c for c in customers if c['name']==name),None)
        saved.append(existing or call('POST','/api/customers',{'name':name,'mobile':f'90000001{i:02}','email':f'qa-customer-{i+1}@example.test','customer_type':'B2B' if i==2 else 'C2C','center':'Delhi Regional Hub' if i==3 else 'Main Hub (Bangalore)','credit_limit':50000}))
    existing=call('GET','/api/shipments')
    shipments=[]
    for i in range(12):
        customer=saved[i%4]; awb=f'QA-20260922-{i+1:03}'
        payload={'awb':awb,'date':today if i<10 else (business_today()-dt.timedelta(days=1)).isoformat(),'customer_id':customer['id'],'customer_name':customer['name'],'customer_mobile':customer['mobile'],'customer_type':customer['customer_type'],'center':customer['center'],'receiver':{'name':'QA Receiver','city':'London','country':'UK'},'parcel':{'actual_weight':2,'boxes':[{'length':20,'width':20,'height':20,'actual_weight':2}]},'courier':'ICL' if i==0 else 'Aramex','provider_type':'prepaid' if i==0 else 'postpaid','provider_name':'ICL' if i==0 else 'Aramex','price':1000+i*100,'provider_cost':600+i*50,'is_gst_applicable':i%3!=1,'gst_rate':18,'payment_status':'Paid' if i%3==0 else 'Unpaid','payment_method':'Cash','paid_to':'QA Cash','collected_by':'QA Admin','payment_details':cash,'payment_reference':f'QA-BOOK-{i}','status':['Booked','In Transit','Delivered'][i%3]}
        shipments.append(next((s for s in existing if s['awb']==awb),None) or call('POST','/api/shipments',payload,headers={'Idempotency-Key':f'qa-booking-{i}-20260922'}))
    check(len(call('GET','/api/shipments?booking_date='+today+'&limit=5'))==5,'Date-filtered booking pagination')
    invoices=call('GET','/api/invoices')
    invoice=next(i for i in invoices if i['shipment_id']==shipments[1]['id'])
    if invoice['balance']>0:
        call('POST',f"/api/invoices/{invoice['id']}/payments",{'amount':invoice['balance'],'payment_method':'Cash','paid_to':'QA Cash','collected_by':'QA Admin','payment_details':cash,'reference':'QA-COLLECTION'},headers={'Idempotency-Key':'qa-invoice-collection-20260922'})
    invoice=call('GET',f"/api/invoices/{invoice['id']}")
    check(invoice['balance']==0 and invoice['status']=='Paid','Invoice payment settles balance')
    payload={'date':today,'kind':'expense','category':'QA Packing','vendor':'QA Vendor','amount':250,'account':'QA Cash','payment_mode':'Cash','payment_details':cash,'reference':'QA-EXPENSE'}
    first=call('POST','/api/accounts/entries',payload,201,headers={'Idempotency-Key':'qa-expense-20260922'})
    second=call('POST','/api/accounts/entries',payload,201,headers={'Idempotency-Key':'qa-expense-20260922'})
    check(first['id']==second['id'],'Expense retries do not duplicate payments')
    matched=[{'awb':s['awb'],'actual_cost':float(s['provider_cost'])+25,'current_cost':float(s['provider_cost'])} for s in shipments[1:4]]
    with SessionLocal() as db: reconciled=db.get(Shipment,shipments[1]['id']).cost_reconciled
    if not reconciled: call('POST','/api/reconciliation/apply',{'provider':'Aramex','bill_reference':'QA-BILL','matched':matched})
    amount=sum(m['actual_cost'] for m in matched)
    call('POST','/api/accounts/entries',{**payload,'kind':'provider_payment','provider':'Aramex','category':None,'amount':amount,'reference':'QA-ARAMEX'},201,headers={'Idempotency-Key':'qa-aramex-payment-20260922'})
    accounts=call('GET','/api/accounts/summary')
    aramex=next(p for p in accounts['postpaid_accounts'] if p['name']=='Aramex')
    check(aramex['payments_made'] >= amount and aramex['actual_billed'] >= amount, 'Courier payment posted to carrier ledger')
    check(aramex['net_payable'] == max(0, aramex['actual_billed']-aramex['payments_made']), 'Carrier due equals reconciled bills minus payments')
    call('POST','/api/accounts/entries',{**payload,'kind':'transfer','category':None,'transfer_to':'QA Bank','amount':500,'reference':'QA-TRANSFER'},201,headers={'Idempotency-Key':'qa-transfer-20260922'})
    followup=next((f for f in call('GET','/api/followups/') if f.get('notes')=='QA test - do not contact'),None) or call('POST','/api/followups/',{'customer_id':saved[0]['id'],'customer':saved[0]['name'],'due_date':today,'category':'Customer Retention','notes':'QA test - do not contact'})
    call('PATCH',f"/api/followups/{followup['id']}/complete",{})
    refund=next((f for f in call('GET','/api/refunds') if f['reason']=='QA test adjustment'),None) or call('POST','/api/refunds',{'customer_id':saved[0]['id'],'customer':saved[0]['name'],'awb':shipments[0]['awb'],'amount':50,'reason':'QA test adjustment'})
    if refund['status']=='Requested': call('PATCH',f"/api/refunds/{refund['id']}/status",{'status':'Approved'})
    if refund['status']!='Refunded': call('PATCH',f"/api/refunds/{refund['id']}/status",{'status':'Refunded','refund_method':'Cash','account':'QA Cash','reference':'QA-REFUND','payment_details':cash},headers={'Idempotency-Key':'qa-refund-20260922'})
    for url in ['/api/dashboard/summary','/api/accounts/overview','/api/accounts/shipment-ledger','/api/b2b/summary','/api/b2b/companies','/api/reconciliation/batches','/api/reports/weekly','/api/reports/monthly','/api/reports/eod','/api/settings','/api/users','/api/users/roles','/api/users/audit-logs?actor_id='+admin_id]:
        call('GET',url)
    with SessionLocal() as db:
        admin_session=token
        for code in ['manager','team_leader','counter_staff','operations_executive']:
            _,staff_token=create_app_session(db,'qa-'+code,mfa_verified=True)
            client.headers['Authorization']='Bearer '+staff_token
            rows=call('GET','/api/shipments')
            check(all(s['center']=='Main Hub (Bangalore)' and (s['provider_cost'] is not None if code == 'manager' else s['provider_cost'] is None) and s['gross_profit'] is None for s in rows),code+' scope and cost masking')
            call('GET','/api/users/audit-logs',expected=200 if code == 'manager' else 403)
        client.headers['Authorization']='Bearer '+admin_session
    with SessionLocal() as db:
        check(db.query(Shipment).filter(Shipment.awb.like('QA-20260922-%')).count()==12,'Fresh dataset has 12 shipments')
        check(db.query(Invoice).filter(Invoice.awb.like('QA-20260922-%')).count()==12,'All 12 shipments have invoices')
    results.append({'check':'Fresh scenario complete','passed':True})
try:
    run()
finally:
    (root/'qa-results'/'workflow-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps({'passed':sum(r['passed'] for r in results),'failed':[r for r in results if not r['passed']]},indent=2))

