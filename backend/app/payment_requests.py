"""Claim a payment request in the same transaction as its money movement."""
import hashlib
import json
import re
from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from app.config import settings
from app.models import PaymentRequest


def claim_payment_request(db, request, ctx, payload):
    key = request.headers.get('Idempotency-Key')
    if not key:
        if settings.ENVIRONMENT == 'production':
            raise HTTPException(400, 'Refresh the application before recording this payment (request key required)')
        return None
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,100}', key):
        raise HTTPException(400, 'Invalid payment request key')
    operation = request.method + ':' + request.url.path.rstrip('/')
    identity = hashlib.sha256(f'{ctx["user_id"]}:{operation}:{key}'.encode()).hexdigest()
    body = payload.model_dump(mode='json') if hasattr(payload, 'model_dump') else payload
    try:
        fingerprint = hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    except (ValueError, TypeError):
        raise HTTPException(400, 'Payment request contains invalid values')
    insert = pg_insert if db.bind.dialect.name == 'postgresql' else sqlite_insert
    db.execute(insert(PaymentRequest).values(id=identity, fingerprint=fingerprint).on_conflict_do_nothing(index_elements=['id']))
    claim = db.query(PaymentRequest).filter(PaymentRequest.id == identity).with_for_update().one()
    if claim.fingerprint != fingerprint:
        raise HTTPException(409, 'This request key was already used with different payment details')
    return claim


def finish_payment_request(claim, resource_id):
    if claim is not None:
        claim.resource_id = resource_id
