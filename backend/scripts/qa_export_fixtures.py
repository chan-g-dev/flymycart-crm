import json
from pathlib import Path
from app.database import SessionLocal
from app.models import UserProfile
from app.auth import create_app_session,revoke_app_session
from app.main import app
from fastapi.testclient import TestClient
with SessionLocal() as db:
 admin=db.query(UserProfile).filter_by(role='super_admin',status='active').first()
 session,token=create_app_session(db,admin.id,mfa_verified=True)
 session_id=session.id
with TestClient(app) as client:
 client.headers['Authorization']='Bearer '+token
 paths={'dashboard':'/api/dashboard/summary','shipments':'/api/shipments','customers':'/api/customers','invoices':'/api/invoices','accounts':'/api/accounts/summary','b2b':'/api/b2b/summary','settings':'/api/settings','refunds':'/api/refunds','followups':'/api/followups/'}
 data={}
 for key,path in paths.items():
  response=client.get(path)
  assert response.status_code==200,(path,response.status_code)
  data[key]=response.json()
 Path('../qa-results/frontend-fixtures.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print('Frontend fixtures saved from local API')
