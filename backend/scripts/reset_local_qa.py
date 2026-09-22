"""Back up and reset LOCAL SQLite business records. Never accepts remote DBs."""
from pathlib import Path
import datetime as dt
import json
import sqlite3
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy.engine import make_url
from sqlalchemy import delete, select, func
from app.config import settings
from app.database import engine, Base
from app import models

root = Path(__file__).resolve().parents[2]
url = make_url(settings.DATABASE_URL)
assert settings.ENVIRONMENT == 'development' and url.drivername == 'sqlite', 'Reset is local-development SQLite only'
target = Path(url.database).resolve()
assert target.is_relative_to(root / 'backend') and target.is_file(), 'Unexpected database target'
backup_dir = root / 'qa-results'
backup_dir.mkdir(exist_ok=True)
backup = backup_dir / ('before-reset-' + dt.datetime.now().strftime('%Y%m%d-%H%M%S') + '.db')
with sqlite3.connect(target) as source, sqlite3.connect(backup) as destination:
    source.backup(destination)
    assert destination.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
preserved = {'users','user_profiles','roles','permissions','user_roles','role_permissions','user_permission_overrides',
             'user_center_access','app_sessions','user_invitations','profile_audit_log','system_settings'}
counts = {}
with engine.begin() as connection:
    connection.execute(models.UserProfile.__table__.update().values(customer_id=None,b2b_company_id=None))
    for table in reversed(Base.metadata.sorted_tables):
        if table.name not in preserved:
            counts[table.name] = connection.scalar(select(func.count()).select_from(table))
            connection.execute(delete(table))
    row = connection.execute(select(models.SystemSettings.__table__.c.config_json).where(models.SystemSettings.id == 1)).scalar_one()
    config = dict(row)
    for field, amount in [('prepaidWallets','openingBalance'),('postpaidProviders','deposit')]:
        config[field] = [{**p, amount: 0} for p in config.get(field, [])]
    connection.execute(models.SystemSettings.__table__.update().where(models.SystemSettings.id == 1).values(config_json=config))
    connection.execute(models.AuditLog.__table__.insert().values(user_name='Local QA reset', event_type='qa.reset', entity_type='database',
        entity_id='local', action='reset_business_records', before_value=counts, after_value={'backup':backup.name,'preserved':'staff access and company configuration'}))
report={'database':str(target),'backup':str(backup),'cleared_records':counts,'preserved':sorted(preserved)}
(backup_dir/'reset-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
