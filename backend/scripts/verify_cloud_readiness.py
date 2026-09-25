"""Verify hosted services without changing application records or the public schema.

Creates and removes a uniquely named empty PostgreSQL QA schema and one storage
object. Credentials are read from backend/.env and never printed.
"""
import json
import os
from pathlib import Path
import sys
import uuid

from dotenv import dotenv_values
import requests
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
config = dotenv_values(ROOT / 'backend/.env')
os.environ.update(DATABASE_URL='sqlite:///:memory:', ENVIRONMENT='development', REMINDERS_ENABLED='false')
sys.path.insert(0, str(ROOT / 'backend'))
from app.database import Base
from app import models  # noqa: F401
from app.seed import migrate_database_schema

results = {}
schema = 'qa_readiness_' + uuid.uuid4().hex
engine = create_engine(config['DATABASE_URL'], connect_args={'connect_timeout': 15}, pool_pre_ping=True)
schema_created = False
try:
    with engine.connect() as connection:
        connection.execute(text('SET TRANSACTION READ ONLY'))
        results['postgres_version'] = connection.execute(text('SHOW server_version')).scalar()
        columns = connection.execute(text("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'")).all()
        current = {(table, column) for table, column in columns}
        results['public_missing_model_columns'] = sorted(
            f'{table.name}.{column.name}' for table in Base.metadata.sorted_tables for column in table.columns
            if (table.name, column.name) not in current
        )
        connection.rollback()
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        schema_created = True
    # A separate engine sets the schema on every connection, including inspector calls.
    from sqlalchemy import event
    staging = create_engine(config['DATABASE_URL'], connect_args={'connect_timeout': 15})
    @event.listens_for(staging, 'connect')
    def isolate(dbapi_connection, _record):
        old = dbapi_connection.autocommit
        dbapi_connection.autocommit = True
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO "{schema}"')
        dbapi_connection.autocommit = old
    @event.listens_for(staging, 'begin')
    def isolate_transaction(connection):
        # Supabase transaction pooling can switch server sessions after COMMIT.
        connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')
        assert connection.exec_driver_sql('SELECT current_schema()').scalar() == schema
    try:
        with staging.begin() as connection:
            assert connection.execute(text('SELECT current_schema()')).scalar() == schema
            Base.metadata.create_all(connection)
            for table, names in {
                'shipments': ['entity', 'is_ddp', 'receiver_id_proof', 'receiver_id_proof_front', 'receiver_id_proof_back', 'id_proof_front', 'id_proof_back'],
                'booking_requests': ['entity', 'is_ddp', 'receiver_id_proof', 'receiver_id_proof_front', 'receiver_id_proof_back'],
                'customers': ['id_proof_front', 'id_proof_back'],
            }.items():
                for name in names:
                    connection.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{name}"'))
        with Session(staging) as db:
            migrate_database_schema(db)
            migrate_database_schema(db)
        missing = []
        for table in Base.metadata.sorted_tables:
            actual = {column['name'] for column in inspect(staging).get_columns(table.name)}
            missing.extend(f'{table.name}.{column.name}' for column in table.columns if column.name not in actual)
        results['postgres_upgrade_twice'] = not missing
        results['isolated_missing_columns'] = missing
    finally:
        staging.dispose()
except Exception as exc:
    results['postgres_error_type'] = type(exc).__name__
    results['postgres_error_code'] = getattr(getattr(exc, 'orig', None), 'pgcode', None)
finally:
    if schema_created:
        try:
            with engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            results['qa_schema_removed'] = True
        except Exception as exc:
            results['qa_schema_cleanup_error'] = type(exc).__name__
            results['qa_schema_to_remove'] = schema
    engine.dispose()

url = config['SUPABASE_URL'].rstrip('/')
bucket = config['SUPABASE_BUCKET']
key = config['SUPABASE_SERVICE_ROLE_KEY']
headers = {'Authorization': 'Bearer ' + key, 'apikey': key}
object_key = 'qa-readiness/' + uuid.uuid4().hex + '.txt'
uploaded = False
try:
    bucket_response = requests.get(f'{url}/storage/v1/bucket/{bucket}', headers=headers, timeout=20)
    results['bucket_status'] = bucket_response.status_code
    bucket_response.raise_for_status()
    results['bucket_private'] = bucket_response.json().get('public') is False
    if results['bucket_private']:
        body = b'Fly My Cart isolated storage readiness check. No customer data.'
        response = requests.post(f'{url}/storage/v1/object/{bucket}/{object_key}', headers={**headers, 'Content-Type': 'text/plain', 'x-upsert': 'false'}, data=body, timeout=20)
        results['storage_upload_status'] = response.status_code
        response.raise_for_status()
        uploaded = True
        download = requests.get(f'{url}/storage/v1/object/authenticated/{bucket}/{object_key}', headers=headers, timeout=20)
        results['storage_roundtrip'] = download.status_code == 200 and download.content == body
        anonymous = requests.get(f'{url}/storage/v1/object/public/{bucket}/{object_key}', timeout=20)
        results['anonymous_download_denied'] = anonymous.status_code != 200
except Exception as exc:
    results['storage_error_type'] = type(exc).__name__
finally:
    if uploaded:
        response = requests.delete(f'{url}/storage/v1/object/{bucket}', headers=headers, json={'prefixes': [object_key]}, timeout=20)
        results['qa_object_removed'] = response.status_code == 200
        if response.status_code != 200:
            results['qa_object_to_remove'] = object_key

for service, endpoint in [('api', 'https://flymycart-crm.onrender.com/api/health'), ('frontend', 'https://flymycart-crm.vercel.app')]:
    try:
        response = requests.get(endpoint, timeout=30)
        results[service + '_http_status'] = response.status_code
    except Exception as exc:
        results[service + '_error_type'] = type(exc).__name__
(ROOT / 'qa-results/cloud-readiness.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
