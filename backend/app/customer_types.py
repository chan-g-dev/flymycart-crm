from fastapi import HTTPException

DEFAULT_CUSTOMER_TYPES = ['C2C', 'B2C', 'B2B']


def normalize_customer_types(values):
    if not isinstance(values, list) or len(values) > 100:
        raise HTTPException(400, 'Enter up to 100 customer types')
    result = list(DEFAULT_CUSTOMER_TYPES)
    seen = {value.casefold() for value in result}
    for value in values:
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 50 or any(ord(c) < 32 for c in value):
            raise HTTPException(400, 'Customer types must contain 1-50 characters without control characters')
        value = value.strip()
        if value.casefold() not in seen:
            result.append(value)
            seen.add(value.casefold())
    if len(result) > 100:
        raise HTTPException(400, 'Up to 100 customer types are supported, including C2C, B2C and B2B')
    return result


def resolve_customer_type(db, value, existing=None):
    from app.models import SystemSettings
    settings = db.query(SystemSettings).first()
    types = normalize_customer_types((settings.config_json or {}).get('customerTypes', []) if settings else [])
    for choice in types:
        if choice.casefold() == value.strip().casefold():
            return choice
    if existing and value == existing:
        return existing
    raise HTTPException(400, 'Add this customer type in Settings before using it')
