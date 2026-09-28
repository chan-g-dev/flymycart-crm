"""Invoice defaults are shared, validated and protected from stale settings saves."""
import base64
import os

os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.dependencies import get_current_session_context
from app.models import AuditLog, SystemSettings
from app.routers.invoices import invoices_router
from app.routers.settings import settings_router

PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='


@pytest.fixture
def branding():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(invoices_router, prefix='/api')
    app.include_router(settings_router, prefix='/api')
    ctx = {'user_id': 'admin', 'display_name': 'Admin', 'is_super_admin': True,
           'status': 'active', 'permissions': {'*': True}}
    def database():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_session_context] = lambda: ctx
    with TestClient(app) as client:
        yield client, engine, ctx
    engine.dispose()


def test_custom_logo_persists_and_can_restore_default(branding):
    client, engine, _ = branding
    assert client.get('/api/invoices/branding').json() == {'logo': 'original'}
    assert client.put('/api/invoices/branding', json={'logo': PNG}).status_code == 200
    assert client.get('/api/invoices/branding').json() == {'logo': PNG}
    with Session(engine) as db:
        assert db.query(SystemSettings).first().config_json['invoiceLogo'] == PNG
        assert PNG not in str(db.query(AuditLog).first().after_value)
    for design in ('express-wing', 'global-orbit', 'parcel-flight', 'swift-arrow', 'fmc-monogram', 'original'):
        assert client.put('/api/invoices/branding', json={'logo': design}).json() == {'logo': design}
        assert client.get('/api/invoices/branding').json() == {'logo': design}


def test_invalid_images_do_not_overwrite_saved_logo(branding):
    client, _, _ = branding
    client.put('/api/invoices/branding', json={'logo': 'express-wing'})
    invalid = ['unknown', 'https://example.com/logo.png', 'data:image/svg+xml;base64,PHN2Zz4=',
               'data:image/png;base64,invalid!', 'data:image/png;base64,aGVsbG8=',
               'data:image/jpeg;base64,' + PNG.split(',')[1],
               'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'0' * (512 * 1024)).decode()]
    for value in invalid:
        assert client.put('/api/invoices/branding', json={'logo': value}).status_code == 422
    assert client.get('/api/invoices/branding').json() == {'logo': 'express-wing'}


def test_only_super_admin_can_change_default(branding):
    client, _, ctx = branding
    ctx['is_super_admin'] = False
    assert client.put('/api/invoices/branding', json={'logo': PNG}).status_code == 403


def test_other_settings_cannot_overwrite_invoice_default(branding):
    client, _, _ = branding
    client.put('/api/invoices/branding', json={'logo': PNG})
    response = client.put('/api/settings/', json={'companyName': 'New name', 'invoiceLogo': 'original'})
    assert response.status_code == 200, response.text
    assert client.get('/api/invoices/branding').json() == {'logo': PNG}
